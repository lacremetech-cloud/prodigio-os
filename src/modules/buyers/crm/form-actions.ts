"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canDecideMandate } from "@/modules/crm/auth/roles";
import { requireCrmSession } from "@/modules/crm/auth/session";
import { sanitizeOrigins } from "@/modules/buyers/public/embed-policy";

/**
 * Réglages du formulaire acquéreur, depuis le cockpit du bien.
 *
 * **Aucun de ces gestes ne publie la vitrine.** Poser un identifiant public,
 * ouvrir la collecte, désigner la brochure et autoriser des domaines sont des
 * réglages d'exploitation ; publier la page Prodigio reste une décision à part,
 * avec ses propres critères. La base le garantit (`crm_property_set_buyer_form`
 * ne touche jamais `publication_status`), pas seulement cette action.
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
    case "23505":
      return "Cet identifiant public est déjà utilisé par un autre bien.";
    case "22023":
      return message || "Données invalides.";
    default:
      return message || "Une erreur est survenue. Réessayez.";
  }
}

const schema = z.object({
  propertyId: z.string().uuid("Identifiant invalide."),
  slug: z.string().trim().max(120).nullable().optional(),
  status: z.enum(["inactif", "actif"]).nullable().optional(),
  brochureUrl: z.string().trim().max(2000).nullable().optional(),
  /** Saisi en texte libre, une origine par ligne ou séparées par des virgules. */
  allowedOrigins: z.string().trim().max(4000).nullable().optional(),
});

export interface BuyerFormSettings {
  slug: string | null;
  buyerFormStatus: string;
  publicationStatus: string;
  /** Origines réellement retenues, après nettoyage. */
  allowedOrigins: string[];
  /** Origines écartées parce qu'inexploitables — dites, jamais corrigées d'office. */
  rejectedOrigins: string[];
}

export async function setBuyerFormSettingsAction(
  input: unknown,
): Promise<ActionResult<BuyerFormSettings>> {
  const session = await requireCrmSession();
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }
  const d = parsed.data;

  // Ouvrir la collecte engage l'organisation : réservé aux décisionnaires.
  if (d.status && !canDecideMandate(session.roles)) {
    return {
      ok: false,
      error: "Seul un administrateur ou un manager active le formulaire acquéreur.",
    };
  }

  // Les origines sont nettoyées ICI pour pouvoir dire lesquelles ont été
  // écartées. La base reçoit une liste déjà saine ; on ne « répare » jamais une
  // saisie douteuse en silence.
  let origins: string[] | null = null;
  let rejected: string[] = [];
  if (d.allowedOrigins !== undefined && d.allowedOrigins !== null) {
    const declared = d.allowedOrigins
      .split(/[\n,;]+/)
      .map((o) => o.trim())
      .filter(Boolean);
    origins = sanitizeOrigins(declared);
    const kept = new Set(origins);
    rejected = declared.filter((o) => {
      const [normalized] = sanitizeOrigins([o]);
      return !normalized || !kept.has(normalized);
    });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("crm_property_set_buyer_form", {
    p_property_id: d.propertyId,
    p_slug: d.slug ?? null,
    p_status: d.status ?? null,
    p_brochure_url: d.brochureUrl ?? null,
    p_allowed_origins: origins,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };

  const row = (data ?? {}) as Record<string, unknown>;
  revalidatePath(`/crm/biens/${d.propertyId}`);

  return {
    ok: true,
    data: {
      slug: typeof row.slug === "string" ? row.slug : null,
      buyerFormStatus: String(row.buyer_form_status ?? "inactif"),
      publicationStatus: String(row.publication_status ?? "brouillon"),
      allowedOrigins: origins ?? [],
      rejectedOrigins: rejected,
    },
  };
}
