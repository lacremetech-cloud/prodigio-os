"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireCrmSession } from "@/modules/crm/auth/session";
import { canDecideMandate } from "@/modules/crm/auth/roles";
import { isSupabaseAdminConfigured } from "@/config";
import type { PropertyPublicMediaRow } from "@/lib/supabase/types";
import {
  buildMasterPath,
  copyMasterToPublic,
  purgePublicCopies,
  removeMasterObject,
  removePublicObjects,
  uploadMasterAsset,
  validatePublicMedia,
} from "./storage";

/**
 * Actions serveur de MUTATION de l'expérience publique. Elles délèguent aux
 * fonctions SQL `crm_property_*` / `crm_buyer_interest_*` (SECURITY DEFINER) qui
 * re-vérifient le rôle et écrivent l'AuditEvent : la base fait autorité. On ajoute
 * ici une garde de session (défense en profondeur), la validation Zod et
 * l'invalidation du cache. Aucune donnée technique ni secret n'est renvoyé.
 */

export interface ActionResult {
  ok: boolean;
  error?: string;
  data?: Record<string, unknown>;
}

function humanize(code: string | undefined, message: string): string {
  switch (code) {
    case "28000":
      return "Session expirée. Reconnectez-vous.";
    case "42501":
      return message || "Droits insuffisants pour cette action.";
    case "23505":
      return message || "Ce slug est déjà utilisé.";
    case "22023":
      return message || "Données invalides.";
    default:
      return message || "Une erreur est survenue. Réessayez.";
  }
}

function revalidateProperty(propertyId?: string) {
  revalidatePath("/crm/biens");
  if (propertyId) revalidatePath(`/crm/biens/${propertyId}`);
}

const uuid = z.string().uuid("Identifiant invalide.");
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

// --- Configuration de l'expérience publique ----------------------------------
const configSchema = z.object({
  propertyId: uuid,
  slug: optionalText(120),
  publicName: optionalText(200),
  tagline: optionalText(300),
  intro: optionalText(4000),
  story: optionalText(8000),
  experienceText: optionalText(8000),
  architectureText: optionalText(8000),
  pillars: optionalText(4000),
  highlightedFeatures: optionalText(4000),
  emotionalDetails: optionalText(4000),
  environmentText: optionalText(8000),
  ctaLabel: optionalText(120),
  showPrice: z.boolean().nullable().optional(),
  priceLabel: optionalText(120),
  publicLocation: optionalText(200),
  referenceValueEuros: z.number().min(0).max(1_000_000_000).nullable().optional(),
  seoIndex: z.boolean().nullable().optional(),
  seoTitle: optionalText(200),
  seoDescription: optionalText(400),
  privacyReviewed: z.boolean().nullable().optional(),
  sections: z.record(z.string(), z.unknown()).nullable().optional(),
});

export async function upsertPublicConfigAction(input: unknown): Promise<ActionResult> {
  await requireCrmSession();
  const parsed = configSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }
  const d = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("crm_property_upsert_public_config", {
    p_property_id: d.propertyId,
    p_slug: d.slug ?? null,
    p_public_name: d.publicName ?? null,
    p_tagline: d.tagline ?? null,
    p_intro: d.intro ?? null,
    p_story: d.story ?? null,
    p_experience_text: d.experienceText ?? null,
    p_architecture_text: d.architectureText ?? null,
    p_pillars: d.pillars ?? null,
    p_highlighted_features: d.highlightedFeatures ?? null,
    p_emotional_details: d.emotionalDetails ?? null,
    p_environment_text: d.environmentText ?? null,
    p_sections_config: (d.sections as never) ?? null,
    p_cta_label: d.ctaLabel ?? null,
    p_show_price: d.showPrice ?? null,
    p_price_label: d.priceLabel ?? null,
    p_public_location: d.publicLocation ?? null,
    // Euros → centimes (aucune valeur économique n'est codée en dur ; c'est une
    // saisie opérateur, interne au scoring acquéreur).
    p_reference_value_cents:
      d.referenceValueEuros == null ? null : Math.round(d.referenceValueEuros * 100),
    p_seo_index: d.seoIndex ?? null,
    p_seo_title: d.seoTitle ?? null,
    p_seo_description: d.seoDescription ?? null,
    p_privacy_reviewed: d.privacyReviewed ?? null,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  revalidateProperty(d.propertyId);
  return { ok: true, data: (data as Record<string, unknown>) ?? undefined };
}

const validateContentSchema = z.object({ propertyId: uuid, validated: z.boolean() });

export async function validatePublicContentAction(input: unknown): Promise<ActionResult> {
  const session = await requireCrmSession();
  if (!canDecideMandate(session.roles)) {
    return { ok: false, error: "Seul un administrateur ou un manager valide le contenu public." };
  }
  const parsed = validateContentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Saisie invalide." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_property_validate_public_content", {
    p_property_id: parsed.data.propertyId,
    p_validated: parsed.data.validated,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  revalidateProperty(parsed.data.propertyId);
  return { ok: true };
}

// --- Médias publics (bucket PUBLIC) ------------------------------------------
const PUBLIC_MEDIA_KINDS = ["photo", "video", "drone", "rendu", "plan", "couverture"] as const;

export async function uploadPublicMediaAction(formData: FormData): Promise<ActionResult> {
  await requireCrmSession();
  if (!isSupabaseAdminConfigured()) {
    return { ok: false, error: "Stockage public non configuré (clé serveur absente)." };
  }
  const propertyId = String(formData.get("propertyId") ?? "");
  const kind = String(formData.get("kind") ?? "");
  const alt = String(formData.get("alt") ?? "").trim();
  const caption = String(formData.get("caption") ?? "").trim();
  const file = formData.get("file");

  if (!uuid.safeParse(propertyId).success) return { ok: false, error: "Bien invalide." };
  if (!(PUBLIC_MEDIA_KINDS as readonly string[]).includes(kind)) {
    return { ok: false, error: "Type de média invalide." };
  }
  if (!(file instanceof File)) return { ok: false, error: "Aucun fichier fourni." };

  const validation = validatePublicMedia({ mime: file.type, size: file.size, fileName: file.name });
  if (!validation.ok) return { ok: false, error: validation.error };

  // Le MASTER est téléversé dans le bucket PRIVÉ ; la copie publique n'est créée
  // qu'à la publication (cycle de vie maîtrisé).
  const masterPath = buildMasterPath(propertyId, validation.ext);
  const uploaded = await uploadMasterAsset({
    storagePath: masterPath,
    bytes: await file.arrayBuffer(),
    mime: validation.mime,
  });
  if (!uploaded.ok) return { ok: false, error: uploaded.error };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("crm_property_register_public_media", {
    p_property_id: propertyId,
    p_kind: kind,
    p_storage_path: masterPath,
    p_file_name: validation.fileName,
    p_mime_type: validation.mime,
    p_size_bytes: validation.size,
    p_alt_text: alt || null,
    p_caption: caption || null,
    p_source_media_id: null,
  });
  if (error) {
    await removeMasterObject(masterPath); // compensation : aucun objet orphelin.
    return { ok: false, error: humanize(error.code, error.message) };
  }
  revalidateProperty(propertyId);
  return { ok: true, data: (data as Record<string, unknown>) ?? undefined };
}

const updateMediaSchema = z.object({
  propertyId: uuid,
  mediaId: uuid,
  altText: optionalText(400),
  caption: optionalText(600),
  kind: z.enum(PUBLIC_MEDIA_KINDS).optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  approved: z.boolean().optional(),
});

export async function updatePublicMediaAction(input: unknown): Promise<ActionResult> {
  await requireCrmSession();
  const parsed = updateMediaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Saisie invalide." };
  const d = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_property_update_public_media", {
    p_media_id: d.mediaId,
    p_alt_text: d.altText ?? null,
    p_caption: d.caption ?? null,
    p_kind: d.kind ?? null,
    p_sort_order: d.sortOrder ?? null,
    p_approved: d.approved ?? null,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  revalidateProperty(d.propertyId);
  return { ok: true };
}

const deleteMediaSchema = z.object({ propertyId: uuid, mediaId: uuid });

export async function deletePublicMediaAction(input: unknown): Promise<ActionResult> {
  await requireCrmSession();
  const parsed = deleteMediaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Saisie invalide." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("crm_property_delete_public_media", {
    p_media_id: parsed.data.mediaId,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  const row = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const master = String(row.storage_path ?? "");
  const publicPath = String(row.public_path ?? "");
  if (master) await removeMasterObject(master);
  if (publicPath) await removePublicObjects([publicPath]);
  revalidateProperty(parsed.data.propertyId);
  return { ok: true };
}

const mediaRoleSchema = z.object({
  propertyId: uuid,
  role: z.enum(["hero", "main", "social"]),
  mediaId: uuid.nullable(),
});

export async function setPublicMediaRoleAction(input: unknown): Promise<ActionResult> {
  await requireCrmSession();
  const parsed = mediaRoleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Saisie invalide." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_property_set_public_media_role", {
    p_property_id: parsed.data.propertyId,
    p_role: parsed.data.role,
    p_media_id: parsed.data.mediaId,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  revalidateProperty(parsed.data.propertyId);
  return { ok: true };
}

// --- Publication (décisions sensibles : admin/manager en base) ---------------
interface MediaToPublish {
  id: string;
  storage_path: string;
  mime_type: string;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.length > 0);
}

/**
 * Publication orchestrée côté serveur : purge les anciennes copies publiques,
 * COPIE chaque master approuvé vers le bucket public (chemin frais, sans PII),
 * puis délègue à `crm_property_publish` (garde + snapshot atomique). En cas
 * d'échec, les copies fraîchement créées sont retirées (aucun objet orphelin).
 */
export async function publishPropertyAction(input: unknown): Promise<ActionResult> {
  await requireCrmSession();
  const parsed = z.object({ propertyId: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Saisie invalide." };
  if (!isSupabaseAdminConfigured()) {
    return { ok: false, error: "Stockage public non configuré (clé serveur absente)." };
  }
  const propertyId = parsed.data.propertyId;
  const supabase = await createSupabaseServerClient();

  const { data: mediaData, error: listError } = await supabase.rpc(
    "crm_property_media_to_publish",
    { p_property_id: propertyId },
  );
  if (listError) return { ok: false, error: humanize(listError.code, listError.message) };
  const media = (Array.isArray(mediaData) ? mediaData : []) as MediaToPublish[];

  // Purge des anciennes copies publiques : seule la version courante subsiste.
  await purgePublicCopies(propertyId);

  const publicPaths: Record<string, string> = {};
  const created: string[] = [];
  for (const m of media) {
    const copy = await copyMasterToPublic({
      propertyId,
      masterPath: m.storage_path,
      mime: m.mime_type,
    });
    if (!copy.ok) {
      await removePublicObjects(created); // compensation.
      return { ok: false, error: copy.error };
    }
    publicPaths[m.id] = copy.publicPath;
    created.push(copy.publicPath);
  }

  const { data, error } = await supabase.rpc("crm_property_publish", {
    p_property_id: propertyId,
    p_public_paths: publicPaths as never,
  });
  if (error) {
    await removePublicObjects(created); // aucune copie orpheline si la garde refuse.
    return { ok: false, error: humanize(error.code, error.message) };
  }
  revalidateProperty(propertyId);
  return { ok: true, data: (data as Record<string, unknown>) ?? undefined };
}

const unpublishSchema = z.object({ propertyId: uuid, reason: optionalText(2000) });

export async function unpublishPropertyAction(input: unknown): Promise<ActionResult> {
  await requireCrmSession();
  const parsed = unpublishSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Saisie invalide." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("crm_property_unpublish", {
    p_property_id: parsed.data.propertyId,
    p_reason: parsed.data.reason ?? null,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  // Supprime les COPIES publiques : la copie directe cesse de résoudre.
  const paths = toStringArray((data as Record<string, unknown> | null)?.public_paths);
  await removePublicObjects(paths);
  await purgePublicCopies(parsed.data.propertyId); // filet : aucun résidu.
  revalidateProperty(parsed.data.propertyId);
  return { ok: true };
}

const publicationStatusSchema = z.object({
  propertyId: uuid,
  status: z.enum(["brouillon", "en_preparation", "pret_a_publier", "archive"]),
});

export async function setPublicationStatusAction(input: unknown): Promise<ActionResult> {
  await requireCrmSession();
  const parsed = publicationStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Saisie invalide." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("crm_property_set_publication_status", {
    p_property_id: parsed.data.propertyId,
    p_status: parsed.data.status,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  // L'archivage retire aussi les copies publiques.
  if (parsed.data.status === "archive") {
    const paths = toStringArray((data as Record<string, unknown> | null)?.public_paths);
    await removePublicObjects(paths);
    await purgePublicCopies(parsed.data.propertyId);
  }
  revalidateProperty(parsed.data.propertyId);
  return { ok: true };
}

// --- Intérêts acquéreurs : statut de réception -------------------------------
const interestStatusSchema = z.object({
  propertyId: uuid,
  interestId: uuid,
  status: z.enum(["nouveau", "consulte", "traite"]),
});

export async function setBuyerInterestStatusAction(input: unknown): Promise<ActionResult> {
  await requireCrmSession();
  const parsed = interestStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Saisie invalide." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_buyer_interest_set_status", {
    p_interest_id: parsed.data.interestId,
    p_status: parsed.data.status,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  revalidateProperty(parsed.data.propertyId);
  return { ok: true };
}

export type { PropertyPublicMediaRow };
