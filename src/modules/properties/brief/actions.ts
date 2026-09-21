"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isPreviewDeployment } from "@/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canAdminEconomicRules, canDecideMandate } from "@/modules/crm/auth/roles";
import { requireCrmSession } from "@/modules/crm/auth/session";
import type { OrganizationCandidate, OrganizationResolution } from "./organization";
import { resolveOrganization, slugifyOrganization } from "./organization";
import { parseBrief, type BriefAnalysis } from "./parse";

/**
 * Actions serveur de la Fabrique « Créer un bien à partir d'un brief ».
 *
 * Séparation stricte des deux temps :
 *  - **Analyser** ne fait AUCUNE écriture. Ni organisation, ni bien. Elle lit
 *    l'annuaire des organisations pour dire ce qu'il faudrait faire, et rend la
 *    main à l'humain.
 *  - **Créer le bien en brouillon** écrit, après confirmation explicite, et
 *    uniquement ce que l'humain a validé dans la prévisualisation.
 *
 * Les droits sont vérifiés à trois niveaux : interface (affichage), ici
 * (défense en profondeur) et en base (`crm_can_decide()` dans les fonctions
 * SECURITY DEFINER, qui font autorité).
 */

export interface ActionResult<T = Record<string, unknown>> {
  ok: boolean;
  error?: string;
  data?: T;
}

function humanize(code: string | undefined, message: string): string {
  switch (code) {
    case "28000":
      return "Session expirée. Reconnectez-vous.";
    case "42501":
      return message || "Droits insuffisants pour cette action.";
    case "22023":
      return message || "Données invalides.";
    case "23503":
      return "Organisation porteuse introuvable.";
    case "23514":
      return "Le bien ne respecte pas les invariants du modèle (origine, rattachement).";
    default:
      return message || "Une erreur est survenue. Réessayez.";
  }
}

/**
 * Refus explicite des écritures réelles depuis un déploiement de
 * prévisualisation. Les previews partagent la base de production : y créer une
 * organisation ou un bien polluerait de vraies données. Ce n'est pas un mode
 * test masqué — le refus est visible et motivé, et n'a aucun effet en
 * production ni en développement local.
 */
const PREVIEW_REFUSAL =
  "Écriture refusée : cet environnement est une prévisualisation, reliée à la base réelle. " +
  "Créez le bien depuis l'environnement de production.";

function previewGuard<T>(): ActionResult<T> | null {
  return isPreviewDeployment() ? { ok: false, error: PREVIEW_REFUSAL } : null;
}

// -----------------------------------------------------------------------------
// 1. Analyser — lecture seule
// -----------------------------------------------------------------------------

const analyzeSchema = z.object({
  brief: z.string().min(1, "Collez d'abord le brief du bien.").max(20_000),
});

export interface AnalyzeBriefData {
  analysis: BriefAnalysis;
  organization: OrganizationResolution;
  /** Organisations partenaires connues, pour le choix manuel dans la preview. */
  organizations: OrganizationCandidate[];
}

export async function analyzeBriefAction(
  input: unknown,
): Promise<ActionResult<AnalyzeBriefData>> {
  const session = await requireCrmSession();
  if (!canDecideMandate(session.roles)) {
    return { ok: false, error: "Seul un administrateur ou un manager crée un bien." };
  }
  const parsed = analyzeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }

  const analysis = parseBrief(parsed.data.brief);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, slug, kind")
    .order("name", { ascending: true });
  if (error) return { ok: false, error: humanize(error.code, error.message) };

  const organizations = (data ?? []) as OrganizationCandidate[];
  return {
    ok: true,
    data: {
      analysis,
      organization: resolveOrganization(analysis.draft.organizationName, organizations),
      organizations,
    },
  };
}

// -----------------------------------------------------------------------------
// 2. Créer le bien en brouillon — écriture, après confirmation
// -----------------------------------------------------------------------------

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

const optionalNumber = (max: number) =>
  z.number().min(0).max(max).nullable().optional();

const createSchema = z
  .object({
    // Organisation : soit une existante choisie, soit une à enregistrer.
    organizationId: z.string().uuid().nullable().optional(),
    newOrganizationName: optionalText(200),

    projectName: z.string().trim().min(1, "Le nom du bien est obligatoire.").max(200),
    propertyType: optionalText(120),
    addressLine: optionalText(300),
    locationCity: optionalText(160),
    locationPostalCode: optionalText(30),
    locationCountry: optionalText(120),
    surfaceM2: optionalNumber(1_000_000),
    landM2: optionalNumber(100_000_000),
    rooms: optionalNumber(1000),
    bedrooms: optionalNumber(1000),
    /**
     * Année de CONSTRUCTION uniquement. Une année de rénovation ne remonte
     * jamais ici : l'analyseur les sépare, et la preview ne les confond pas.
     */
    yearBuilt: z.number().int().min(1000).max(2100).nullable().optional(),
    archStyle: optionalText(160),
    description: optionalText(8000),
  })
  .refine((value) => Boolean(value.organizationId ?? value.newOrganizationName), {
    message: "Une organisation porteuse est obligatoire pour un bien partenaire.",
    path: ["organizationId"],
  });

export interface CreateFromBriefData {
  propertyId: string;
  organizationId: string;
  /** Vrai si le bien existait déjà (idempotence) : rien n'a été dupliqué. */
  alreadyExisted: boolean;
  /** Vrai si l'organisation porteuse vient d'être enregistrée. */
  organizationCreated: boolean;
}

export async function createPropertyFromBriefAction(
  input: unknown,
): Promise<ActionResult<CreateFromBriefData>> {
  const session = await requireCrmSession();
  if (!canDecideMandate(session.roles)) {
    return { ok: false, error: "Seul un administrateur ou un manager crée un bien." };
  }
  const blocked = previewGuard<CreateFromBriefData>();
  if (blocked) return blocked;

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }
  const d = parsed.data;
  const supabase = await createSupabaseServerClient();

  // --- Organisation porteuse --------------------------------------------------
  let organizationId = d.organizationId ?? null;
  let organizationCreated = false;

  if (!organizationId) {
    const name = (d.newOrganizationName ?? "").trim();
    const slug = slugifyOrganization(name);
    if (!slug) {
      return { ok: false, error: "Nom d'organisation invalide." };
    }
    if (!canAdminEconomicRules(session.roles)) {
      return {
        ok: false,
        error:
          "Seul un administrateur enregistre une nouvelle organisation porteuse. " +
          "Sélectionnez une organisation existante.",
      };
    }
    // Réutilisation avant création : jamais de doublon de nom ou de slug.
    const { data: existing, error: lookupError } = await supabase
      .from("organizations")
      .select("id, name, slug, kind")
      .order("name", { ascending: true });
    if (lookupError) {
      return { ok: false, error: humanize(lookupError.code, lookupError.message) };
    }
    const resolution = resolveOrganization(name, (existing ?? []) as OrganizationCandidate[]);
    if (resolution.status === "existante") {
      organizationId = resolution.organization.id;
    } else if (resolution.status === "ambigue") {
      return {
        ok: false,
        error:
          "Plusieurs organisations portent ce nom. Sélectionnez celle qui convient " +
          "avant de créer le bien.",
      };
    } else {
      const { data: created, error: createError } = await supabase.rpc(
        "crm_register_partner_organization",
        { p_name: name, p_slug: slug },
      );
      if (createError) {
        return { ok: false, error: humanize(createError.code, createError.message) };
      }
      const payload = created as { id?: string } | null;
      if (!payload?.id) {
        return { ok: false, error: "L'organisation porteuse n'a pas pu être enregistrée." };
      }
      organizationId = payload.id;
      organizationCreated = true;
    }
  }

  // --- Bien en brouillon ------------------------------------------------------
  const { data: property, error: propertyError } = await supabase.rpc(
    "crm_property_create_partner",
    { p_holder_organization_id: organizationId, p_project_name: d.projectName },
  );
  if (propertyError) {
    // L'organisation peut avoir été enregistrée avant l'échec : on le dit, pour
    // qu'un nouvel essai la réutilise au lieu d'en créer une seconde.
    const base = humanize(propertyError.code, propertyError.message);
    revalidatePath("/crm/biens");
    return {
      ok: false,
      error: organizationCreated
        ? `${base} L'organisation « ${d.newOrganizationName} » est enregistrée : ` +
          "sélectionnez-la pour réessayer, n'en créez pas une seconde."
        : base,
    };
  }

  const result = property as { id?: string; already?: boolean } | null;
  if (!result?.id) {
    return { ok: false, error: "Le bien n'a pas pu être créé." };
  }

  // --- Identité : uniquement les champs validés dans la prévisualisation ------
  const { error: identityError } = await supabase.rpc("crm_property_update_identity", {
    p_property_id: result.id,
    p_project_name: d.projectName,
    p_commercial_title: null,
    p_property_type: d.propertyType ?? null,
    p_address_line: d.addressLine ?? null,
    p_location_city: d.locationCity ?? null,
    p_location_postal_code: d.locationPostalCode ?? null,
    p_location_country: d.locationCountry ?? null,
    p_surface_m2: d.surfaceM2 ?? null,
    p_land_m2: d.landM2 ?? null,
    p_rooms: d.rooms ?? null,
    p_bedrooms: d.bedrooms ?? null,
    p_year_built: d.yearBuilt ?? null,
    p_arch_style: d.archStyle ?? null,
    p_description: d.description ?? null,
    p_history: null,
    p_signature_detail: null,
  });

  revalidatePath("/crm/biens");
  revalidatePath(`/crm/biens/${result.id}`);

  if (identityError) {
    // Le bien existe : on ne le supprime pas, on signale que la fiche reste à
    // compléter dans le cockpit.
    return {
      ok: false,
      error:
        `${humanize(identityError.code, identityError.message)} ` +
        "Le bien est créé en brouillon : complétez sa fiche depuis le cockpit.",
      data: {
        propertyId: result.id,
        organizationId,
        alreadyExisted: Boolean(result.already),
        organizationCreated,
      },
    };
  }

  return {
    ok: true,
    data: {
      propertyId: result.id,
      organizationId,
      alreadyExisted: Boolean(result.already),
      organizationCreated,
    },
  };
}
