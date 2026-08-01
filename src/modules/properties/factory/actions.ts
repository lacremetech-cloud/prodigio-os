"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireCrmSession } from "@/modules/crm/auth/session";
import { canDecideMandate } from "@/modules/crm/auth/roles";
import { isSupabaseAdminConfigured } from "@/config";
import type { PropertyMediaRow, PropertyDocumentRow } from "@/lib/supabase/types";
import {
  buildAssetPath,
  createPropertyAssetSignedUrl,
  removePropertyAsset,
  uploadPropertyAsset,
  validateDocument,
  validateMedia,
} from "./storage";

/**
 * Actions serveur de MUTATION de la Fabrique de biens. Elles délèguent aux
 * fonctions SQL `crm_property_*` (SECURITY DEFINER) qui re-vérifient le rôle et
 * écrivent l'AuditEvent : la base fait autorité. On ajoute ici une garde de
 * session (défense en profondeur), la validation Zod des entrées, et
 * l'invalidation du cache. Aucun message technique ni secret n'est renvoyé au
 * client ; jamais d'URL signée ni de chemin stockés en base.
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
const isoDateTime = z.string().datetime({ offset: true }).or(z.string().datetime());
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

// --- Identité ----------------------------------------------------------------
const identitySchema = z.object({
  propertyId: uuid,
  projectName: optionalText(200),
  commercialTitle: optionalText(300),
  propertyType: optionalText(120),
  addressLine: optionalText(300),
  locationCity: optionalText(160),
  locationPostalCode: optionalText(30),
  locationCountry: optionalText(120),
  surfaceM2: z.number().min(0).max(1_000_000).nullable().optional(),
  landM2: z.number().min(0).max(100_000_000).nullable().optional(),
  rooms: z.number().int().min(0).max(1000).nullable().optional(),
  bedrooms: z.number().int().min(0).max(1000).nullable().optional(),
  yearBuilt: z.number().int().min(0).max(3000).nullable().optional(),
  archStyle: optionalText(160),
  description: optionalText(8000),
  history: optionalText(8000),
  signatureDetail: optionalText(2000),
});

export async function updatePropertyIdentityAction(input: unknown): Promise<ActionResult> {
  await requireCrmSession();
  const parsed = identitySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }
  const d = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("crm_property_update_identity", {
    p_property_id: d.propertyId,
    p_project_name: d.projectName ?? null,
    p_commercial_title: d.commercialTitle ?? null,
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
    p_history: d.history ?? null,
    p_signature_detail: d.signatureDetail ?? null,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  revalidateProperty(d.propertyId);
  return { ok: true, data: (data as Record<string, unknown>) ?? undefined };
}

// --- Positionnement ----------------------------------------------------------
const positioningSchema = z.object({
  propertyId: uuid,
  centralPromise: optionalText(2000),
  valuePillars: optionalText(4000),
  differentiators: optionalText(4000),
  emotionalDetails: optionalText(4000),
  idealBuyerProfile: optionalText(4000),
  buyerLocations: optionalText(2000),
  buyerMotivation: optionalText(4000),
  targetZones: optionalText(2000),
  adAngles: optionalText(4000),
  doNotCommunicate: optionalText(4000),
  brandName: optionalText(200),
});

export async function upsertPropertyPositioningAction(input: unknown): Promise<ActionResult> {
  await requireCrmSession();
  const parsed = positioningSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }
  const d = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_property_upsert_positioning", {
    p_property_id: d.propertyId,
    p_central_promise: d.centralPromise ?? null,
    p_value_pillars: d.valuePillars ?? null,
    p_differentiators: d.differentiators ?? null,
    p_emotional_details: d.emotionalDetails ?? null,
    p_ideal_buyer_profile: d.idealBuyerProfile ?? null,
    p_buyer_locations: d.buyerLocations ?? null,
    p_buyer_motivation: d.buyerMotivation ?? null,
    p_target_zones: d.targetZones ?? null,
    p_ad_angles: d.adAngles ?? null,
    p_do_not_communicate: d.doNotCommunicate ?? null,
    p_brand_name: d.brandName ?? null,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  revalidateProperty(d.propertyId);
  return { ok: true };
}

const validatePositioningSchema = z.object({ propertyId: uuid, validated: z.boolean() });

export async function validatePropertyPositioningAction(input: unknown): Promise<ActionResult> {
  const session = await requireCrmSession();
  if (!canDecideMandate(session.roles)) {
    return { ok: false, error: "Seul un administrateur ou un manager valide le positionnement." };
  }
  const parsed = validatePositioningSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Saisie invalide." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_property_validate_positioning", {
    p_property_id: parsed.data.propertyId,
    p_validated: parsed.data.validated,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  revalidateProperty(parsed.data.propertyId);
  return { ok: true };
}

// --- Médias ------------------------------------------------------------------
const MEDIA_KINDS = ["photo", "video", "drone", "plan", "rendu", "couverture", "autre"] as const;

export async function uploadPropertyMediaAction(formData: FormData): Promise<ActionResult> {
  await requireCrmSession();
  if (!isSupabaseAdminConfigured()) {
    return { ok: false, error: "Stockage des médias non configuré (clé serveur absente)." };
  }
  const propertyId = String(formData.get("propertyId") ?? "");
  const kind = String(formData.get("kind") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const file = formData.get("file");

  if (!uuid.safeParse(propertyId).success) return { ok: false, error: "Bien invalide." };
  if (!(MEDIA_KINDS as readonly string[]).includes(kind)) {
    return { ok: false, error: "Type de média invalide." };
  }
  if (!(file instanceof File)) return { ok: false, error: "Aucun fichier fourni." };

  const validation = validateMedia({ mime: file.type, size: file.size, fileName: file.name });
  if (!validation.ok) return { ok: false, error: validation.error };

  const storagePath = buildAssetPath(propertyId, "media", validation.ext);
  const uploaded = await uploadPropertyAsset({
    storagePath,
    bytes: await file.arrayBuffer(),
    mime: validation.mime,
  });
  if (!uploaded.ok) return { ok: false, error: uploaded.error };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("crm_property_register_media", {
    p_property_id: propertyId,
    p_kind: kind,
    p_storage_path: storagePath,
    p_file_name: validation.fileName,
    p_mime_type: validation.mime,
    p_size_bytes: validation.size,
    p_title: title || null,
  });
  if (error) {
    await removePropertyAsset(storagePath); // compensation : aucun objet orphelin.
    return { ok: false, error: humanize(error.code, error.message) };
  }
  revalidateProperty(propertyId);
  return { ok: true, data: (data as Record<string, unknown>) ?? undefined };
}

const updateMediaSchema = z.object({
  propertyId: uuid,
  mediaId: uuid,
  title: optionalText(300),
  kind: z.enum(MEDIA_KINDS).optional(),
  rightsStatus: z.enum(["a_verifier", "libre", "sous_licence", "restreint"]).optional(),
});

export async function updatePropertyMediaAction(input: unknown): Promise<ActionResult> {
  await requireCrmSession();
  const parsed = updateMediaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Saisie invalide." };
  const d = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_property_update_media", {
    p_media_id: d.mediaId,
    p_title: d.title ?? null,
    p_kind: d.kind ?? null,
    p_rights_status: d.rightsStatus ?? null,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  revalidateProperty(d.propertyId);
  return { ok: true };
}

const setPrimarySchema = z.object({ propertyId: uuid, mediaId: uuid });

export async function setPrimaryMediaAction(input: unknown): Promise<ActionResult> {
  await requireCrmSession();
  const parsed = setPrimarySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Saisie invalide." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_property_set_primary_media", {
    p_property_id: parsed.data.propertyId,
    p_media_id: parsed.data.mediaId,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  revalidateProperty(parsed.data.propertyId);
  return { ok: true };
}

const deleteMediaSchema = z.object({ propertyId: uuid, mediaId: uuid });

export async function deletePropertyMediaAction(input: unknown): Promise<ActionResult> {
  await requireCrmSession();
  const parsed = deleteMediaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Saisie invalide." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("crm_property_delete_media", {
    p_media_id: parsed.data.mediaId,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  const storagePath =
    data && typeof data === "object" && "storage_path" in data
      ? String((data as Record<string, unknown>).storage_path ?? "")
      : "";
  if (storagePath) await removePropertyAsset(storagePath);
  revalidateProperty(parsed.data.propertyId);
  return { ok: true };
}

// --- Documents ---------------------------------------------------------------
const DOC_CATEGORIES = [
  "mandat",
  "diagnostic",
  "plan",
  "titre",
  "legal",
  "copropriete",
  "autorisation",
  "libre",
] as const;

export async function uploadPropertyDocumentAction(formData: FormData): Promise<ActionResult> {
  await requireCrmSession();
  if (!isSupabaseAdminConfigured()) {
    return { ok: false, error: "Stockage des documents non configuré (clé serveur absente)." };
  }
  const propertyId = String(formData.get("propertyId") ?? "");
  const category = String(formData.get("category") ?? "");
  const visibility = String(formData.get("visibility") ?? "interne");
  const file = formData.get("file");

  if (!uuid.safeParse(propertyId).success) return { ok: false, error: "Bien invalide." };
  if (!(DOC_CATEGORIES as readonly string[]).includes(category)) {
    return { ok: false, error: "Catégorie de document invalide." };
  }
  if (!["interne", "restreint"].includes(visibility)) {
    return { ok: false, error: "Visibilité invalide." };
  }
  if (!(file instanceof File)) return { ok: false, error: "Aucun fichier fourni." };

  const validation = validateDocument({ mime: file.type, size: file.size, fileName: file.name });
  if (!validation.ok) return { ok: false, error: validation.error };

  const storagePath = buildAssetPath(propertyId, "documents", validation.ext);
  const uploaded = await uploadPropertyAsset({
    storagePath,
    bytes: await file.arrayBuffer(),
    mime: validation.mime,
  });
  if (!uploaded.ok) return { ok: false, error: uploaded.error };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("crm_property_register_document", {
    p_property_id: propertyId,
    p_category: category,
    p_storage_path: storagePath,
    p_file_name: validation.fileName,
    p_mime_type: validation.mime,
    p_size_bytes: validation.size,
    p_visibility: visibility,
  });
  if (error) {
    await removePropertyAsset(storagePath);
    return { ok: false, error: humanize(error.code, error.message) };
  }
  revalidateProperty(propertyId);
  return { ok: true, data: (data as Record<string, unknown>) ?? undefined };
}

const deleteDocSchema = z.object({ propertyId: uuid, documentId: uuid });

export async function deletePropertyDocumentAction(input: unknown): Promise<ActionResult> {
  const session = await requireCrmSession();
  if (!canDecideMandate(session.roles)) {
    return { ok: false, error: "Droits insuffisants pour supprimer un document." };
  }
  const parsed = deleteDocSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Saisie invalide." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("crm_property_delete_document", {
    p_document_id: parsed.data.documentId,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  const storagePath =
    data && typeof data === "object" && "storage_path" in data
      ? String((data as Record<string, unknown>).storage_path ?? "")
      : "";
  if (storagePath) await removePropertyAsset(storagePath);
  revalidateProperty(parsed.data.propertyId);
  return { ok: true };
}

/**
 * URL signée COURTE pour consulter un asset (média OU document) privé. Lecture via
 * le client serveur (JWT) : la RLS garantit que l'appelant peut voir CET asset.
 * L'URL n'est jamais stockée. Réponse neutre si l'asset n'est pas visible.
 */
export interface SignedUrlResult {
  ok: boolean;
  url?: string;
  error?: string;
}

const assetUrlSchema = z.object({
  assetType: z.enum(["media", "document"]),
  assetId: uuid,
});

export async function getPropertyAssetSignedUrlAction(input: unknown): Promise<SignedUrlResult> {
  await requireCrmSession();
  if (!isSupabaseAdminConfigured()) {
    return { ok: false, error: "Consultation non configurée." };
  }
  const parsed = assetUrlSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Asset invalide." };
  const supabase = await createSupabaseServerClient();
  const table = parsed.data.assetType === "media" ? "property_media" : "property_documents";
  const { data } = await supabase
    .from(table)
    .select("*")
    .eq("id", parsed.data.assetId)
    .eq("status", "actif")
    .maybeSingle();
  const row = (data as PropertyMediaRow | PropertyDocumentRow | null) ?? null;
  if (!row) return { ok: false, error: "Fichier introuvable ou accès refusé." };
  const url = await createPropertyAssetSignedUrl(row.storage_path);
  if (!url) return { ok: false, error: "Impossible de générer le lien. Réessayez." };
  return { ok: true, url };
}

// --- Plan de production ------------------------------------------------------
export async function seedProductionPlanAction(input: unknown): Promise<ActionResult> {
  await requireCrmSession();
  const parsed = z.object({ propertyId: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Saisie invalide." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("crm_property_seed_production_plan", {
    p_property_id: parsed.data.propertyId,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  revalidateProperty(parsed.data.propertyId);
  return { ok: true, data: (data as Record<string, unknown>) ?? undefined };
}

const setProductionSchema = z.object({
  propertyId: uuid,
  itemId: uuid,
  status: z
    .enum(["a_faire", "en_cours", "en_revue", "termine", "valide", "bloque"])
    .optional(),
  assigneeUserId: uuid.nullable().optional(),
  dueAt: isoDateTime.nullable().optional(),
  notes: optionalText(4000),
  deliverableUrl: z.string().trim().url("Lien invalide.").max(2000).nullable().optional(),
  blocker: optionalText(2000),
});

export async function setProductionItemAction(input: unknown): Promise<ActionResult> {
  await requireCrmSession();
  const parsed = setProductionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }
  const d = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_property_set_production", {
    p_item_id: d.itemId,
    p_status: d.status ?? null,
    p_assignee_user_id: d.assigneeUserId ?? null,
    p_due_at: d.dueAt ?? null,
    p_notes: d.notes ?? null,
    p_deliverable_url: d.deliverableUrl ?? null,
    p_blocker: d.blocker ?? null,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  revalidateProperty(d.propertyId);
  return { ok: true };
}

// --- Responsable (décision : admin/manager) ----------------------------------
const responsibleSchema = z.object({ propertyId: uuid, userId: uuid.nullable() });

export async function setPropertyResponsibleAction(input: unknown): Promise<ActionResult> {
  const session = await requireCrmSession();
  if (!canDecideMandate(session.roles)) {
    return { ok: false, error: "Seul un administrateur ou un manager change le responsable." };
  }
  const parsed = responsibleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Saisie invalide." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_property_set_responsible", {
    p_property_id: parsed.data.propertyId,
    p_user_id: parsed.data.userId,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  revalidateProperty(parsed.data.propertyId);
  return { ok: true };
}

// --- Transition de statut (décisions sensibles : admin/manager en base) -------
const transitionSchema = z.object({
  propertyId: uuid,
  status: z.enum([
    "preparation_a_lancer",
    "collecte_en_cours",
    "strategie_en_cours",
    "production_en_cours",
    "validation_avant_lancement",
    "pret_a_lancer",
    "en_diffusion",
    "suspendu",
    "archive",
  ]),
  reason: optionalText(2000),
});

export async function transitionPropertyStatusAction(input: unknown): Promise<ActionResult> {
  await requireCrmSession();
  const parsed = transitionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Saisie invalide." };
  const d = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_property_transition_status", {
    p_property_id: d.propertyId,
    p_status: d.status,
    p_reason: d.reason ?? null,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  revalidateProperty(d.propertyId);
  return { ok: true };
}
