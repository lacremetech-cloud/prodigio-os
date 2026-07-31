"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireCrmSession } from "@/modules/crm/auth/session";
import {
  canAdminEconomicRules,
  canDecideMandate,
  canReportEstimation,
} from "@/modules/crm/auth/roles";
import { isSupabaseAdminConfigured } from "@/config";
import type { MandateDocumentRow } from "@/lib/supabase/types";
import {
  buildStoragePath,
  createMandateDocumentSignedUrl,
  removeMandateDocumentObject,
  uploadMandateDocumentObject,
  validateDocument,
} from "./storage";

/**
 * Actions serveur de MUTATION du cycle « estimation → éligibilité → mandat →
 * bien ». Elles délèguent aux fonctions SQL `crm_*` (SECURITY DEFINER) qui
 * re-vérifient le rôle et écrivent l'AuditEvent : la base fait autorité. On
 * ajoute ici une garde de session + de rôle (défense en profondeur), la
 * validation Zod des entrées, et l'invalidation du cache. Aucun message
 * technique ni secret n'est renvoyé au client.
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

function revalidateDossier(opportunityId?: string) {
  revalidatePath("/crm");
  revalidatePath("/crm/mandats");
  revalidatePath("/crm/mandats/pipeline");
  if (opportunityId) revalidatePath(`/crm/mandats/${opportunityId}`);
}

const uuid = z.string().uuid("Identifiant invalide.");
const isoDateTime = z
  .string()
  .datetime({ offset: true })
  .or(z.string().datetime());
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.");
const centsOptional = z.number().int().min(0).max(1_000_000_000_000).nullable().optional();

// --- Compte rendu d'estimation ------------------------------------------------

const estimationSchema = z.object({
  opportunityId: uuid,
  outcome: z.enum([
    "realisee",
    "proprietaire_absent",
    "rdv_annule",
    "estimation_impossible",
    "nouveau_rdv_necessaire",
  ]),
  performedAt: isoDateTime.nullable().optional(),
  valueLowCents: centsOptional,
  valueRecommendedCents: centsOptional,
  valueHighCents: centsOptional,
  ownerExpectedCents: centsOptional,
  propertyCondition: z.string().trim().max(2000).nullable().optional(),
  strengths: z.string().trim().max(4000).nullable().optional(),
  risks: z.string().trim().max(4000).nullable().optional(),
  ownerProjectSummary: z.string().trim().max(4000).nullable().optional(),
  confidentialNotes: z.string().trim().max(4000).nullable().optional(),
  agentRecommendation: z.string().trim().max(4000).nullable().optional(),
  nextAction: z.string().trim().max(500).nullable().optional(),
  nextActionAt: isoDateTime.nullable().optional(),
  appointmentId: uuid.nullable().optional(),
});

export async function saveEstimationReportAction(input: unknown): Promise<ActionResult> {
  const session = await requireCrmSession();
  if (!canReportEstimation(session.roles)) {
    return { ok: false, error: "Droits insuffisants pour renseigner l’estimation." };
  }
  const parsed = estimationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }
  const d = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("crm_save_estimation_report", {
    p_opportunity_id: d.opportunityId,
    p_outcome: d.outcome,
    p_performed_at: d.performedAt ?? null,
    p_performed_by: null,
    p_value_low_cents: d.valueLowCents ?? null,
    p_value_recommended_cents: d.valueRecommendedCents ?? null,
    p_value_high_cents: d.valueHighCents ?? null,
    p_owner_expected_cents: d.ownerExpectedCents ?? null,
    p_property_condition: d.propertyCondition ?? null,
    p_strengths: d.strengths ?? null,
    p_risks: d.risks ?? null,
    p_owner_project_summary: d.ownerProjectSummary ?? null,
    p_confidential_notes: d.confidentialNotes ?? null,
    p_agent_recommendation: d.agentRecommendation ?? null,
    p_next_action: d.nextAction ?? null,
    p_next_action_at: d.nextActionAt ?? null,
    p_appointment_id: d.appointmentId ?? null,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  revalidateDossier(d.opportunityId);
  return { ok: true, data: (data as Record<string, unknown>) ?? undefined };
}

// --- Décision d'éligibilité ---------------------------------------------------

const eligibilitySchema = z.object({
  opportunityId: uuid,
  decision: z.enum([
    "parcours_premium_prodigio",
    "agence_classique",
    "non_retenu",
    "a_completer",
  ]),
  reason: z.string().trim().max(2000).nullable().optional(),
  isDerogation: z.boolean().optional().default(false),
  derogationReason: z.string().trim().max(2000).nullable().optional(),
});

export async function validateEligibilityAction(input: unknown): Promise<ActionResult> {
  const session = await requireCrmSession();
  if (!canDecideMandate(session.roles)) {
    return { ok: false, error: "Seul un administrateur ou un manager valide l’éligibilité." };
  }
  const parsed = eligibilitySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }
  const d = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_validate_eligibility", {
    p_opportunity_id: d.opportunityId,
    p_decision: d.decision,
    p_reason: d.reason ?? null,
    p_is_derogation: d.isDerogation ?? false,
    p_derogation_reason: d.derogationReason ?? null,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  revalidateDossier(d.opportunityId);
  return { ok: true };
}

// --- Règles économiques (administrateur) -------------------------------------

const economicRuleSchema = z.object({
  id: uuid.nullable().optional(),
  name: z.string().trim().min(1, "Nom requis.").max(200),
  segment: z.string().trim().min(1, "Segment requis.").max(120),
  effectiveFrom: isoDate,
  effectiveTo: isoDate.nullable().optional(),
  feeBasis: z.enum(["HT", "TTC", "a_confirmer"]).default("a_confirmer"),
  prodigioSharePct: z.number().min(0).max(100).nullable().optional(),
  partnerSharePct: z.number().min(0).max(100).nullable().optional(),
  organizationId: uuid.nullable().optional(),
  status: z.enum(["actif", "inactif"]).default("actif"),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export async function upsertEconomicRuleAction(input: unknown): Promise<ActionResult> {
  const session = await requireCrmSession();
  if (!canAdminEconomicRules(session.roles)) {
    return { ok: false, error: "Seul un administrateur administre les règles économiques." };
  }
  const parsed = economicRuleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }
  const d = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("crm_upsert_economic_rule", {
    p_id: d.id ?? null,
    p_name: d.name,
    p_segment: d.segment,
    p_effective_from: d.effectiveFrom,
    p_fee_basis: d.feeBasis,
    p_prodigio_share_pct: d.prodigioSharePct ?? null,
    p_partner_share_pct: d.partnerSharePct ?? null,
    p_organization_id: d.organizationId ?? null,
    p_effective_to: d.effectiveTo ?? null,
    p_status: d.status,
    p_notes: d.notes ?? null,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  revalidatePath("/crm/parametres/regles-economiques");
  return { ok: true, data: (data as Record<string, unknown>) ?? undefined };
}

// --- Organisation porteuse (agence partenaire — administrateur) --------------

const partnerOrgSchema = z.object({
  name: z.string().trim().min(1, "Nom requis.").max(200),
  slug: z.string().trim().min(1, "Identifiant requis.").max(120),
});

export async function registerPartnerOrganizationAction(input: unknown): Promise<ActionResult> {
  const session = await requireCrmSession();
  if (!canAdminEconomicRules(session.roles)) {
    return { ok: false, error: "Seul un administrateur enregistre une organisation porteuse." };
  }
  const parsed = partnerOrgSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("crm_register_partner_organization", {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  revalidatePath("/crm/parametres/regles-economiques");
  revalidatePath("/crm/mandats");
  return { ok: true, data: (data as Record<string, unknown>) ?? undefined };
}

// --- Mandat : brouillon / proposition / signature / transitions --------------

const createDraftSchema = z.object({
  opportunityId: uuid,
  holderOrganizationId: uuid.nullable().optional(),
  mandateType: z.string().trim().max(120).nullable().optional(),
  isExclusive: z.boolean().nullable().optional(),
});

export async function createMandateDraftAction(input: unknown): Promise<ActionResult> {
  const session = await requireCrmSession();
  if (!canDecideMandate(session.roles)) {
    return { ok: false, error: "Seul un administrateur ou un manager gère les mandats." };
  }
  const parsed = createDraftSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }
  const d = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("crm_create_mandate_draft", {
    p_opportunity_id: d.opportunityId,
    p_holder_organization_id: d.holderOrganizationId ?? null,
    p_mandate_type: d.mandateType ?? null,
    p_is_exclusive: d.isExclusive ?? null,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  revalidateDossier(d.opportunityId);
  return { ok: true, data: (data as Record<string, unknown>) ?? undefined };
}

const proposeSchema = z.object({
  mandateId: uuid,
  economicRuleId: uuid,
  opportunityId: uuid.optional(),
  mandateType: z.string().trim().max(120).nullable().optional(),
  isExclusive: z.boolean().nullable().optional(),
  startDate: isoDate.nullable().optional(),
  expiresAt: isoDate.nullable().optional(),
});

export async function proposeMandateAction(input: unknown): Promise<ActionResult> {
  const session = await requireCrmSession();
  if (!canDecideMandate(session.roles)) {
    return { ok: false, error: "Droits insuffisants." };
  }
  const parsed = proposeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }
  const d = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_propose_mandate", {
    p_mandate_id: d.mandateId,
    p_economic_rule_id: d.economicRuleId,
    p_mandate_type: d.mandateType ?? null,
    p_is_exclusive: d.isExclusive ?? null,
    p_start_date: d.startDate ?? null,
    p_expires_at: d.expiresAt ?? null,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  revalidateDossier(d.opportunityId);
  return { ok: true };
}

const signSchema = z.object({
  mandateId: uuid,
  mandateNumber: z.string().trim().min(1, "Numéro de mandat requis.").max(120),
  signedAt: isoDateTime,
  signedDocumentId: uuid,
  opportunityId: uuid.optional(),
  startDate: isoDate.nullable().optional(),
  expiresAt: isoDate.nullable().optional(),
});

export async function signMandateAction(input: unknown): Promise<ActionResult> {
  const session = await requireCrmSession();
  if (!canDecideMandate(session.roles)) {
    return { ok: false, error: "Droits insuffisants." };
  }
  const parsed = signSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }
  const d = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_sign_mandate", {
    p_mandate_id: d.mandateId,
    p_mandate_number: d.mandateNumber,
    p_signed_at: d.signedAt,
    p_signed_document_id: d.signedDocumentId,
    p_start_date: d.startDate ?? null,
    p_expires_at: d.expiresAt ?? null,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  revalidateDossier(d.opportunityId);
  return { ok: true };
}

const transitionSchema = z.object({
  mandateId: uuid,
  status: z.enum(["en_attente_signature", "refuse", "expire", "annule"]),
  reasonCode: z.string().trim().max(120).nullable().optional(),
  reason: z.string().trim().max(2000).nullable().optional(),
  opportunityId: uuid.optional(),
});

export async function transitionMandateAction(input: unknown): Promise<ActionResult> {
  const session = await requireCrmSession();
  if (!canDecideMandate(session.roles)) {
    return { ok: false, error: "Droits insuffisants." };
  }
  const parsed = transitionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }
  const d = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_transition_mandate", {
    p_mandate_id: d.mandateId,
    p_status: d.status,
    p_reason_code: d.reasonCode ?? null,
    p_reason: d.reason ?? null,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  revalidateDossier(d.opportunityId);
  return { ok: true };
}

// --- Résultat commercial structuré (code de raison) --------------------------

const outcomeSchema = z.object({
  opportunityId: uuid,
  outcome: z.enum([
    "signe_gagne",
    "refuse_apres_proposition",
    "perdu_avant_signature",
  ]),
  reason: z.string().trim().max(2000).nullable().optional(),
  reasonCode: z.string().trim().max(120).nullable().optional(),
});

export async function recordStructuredOutcomeAction(input: unknown): Promise<ActionResult> {
  await requireCrmSession();
  const parsed = outcomeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }
  const d = parsed.data;
  const supabase = await createSupabaseServerClient();
  // La base restreint « signé/gagné » à admin/manager ; les pertes exigent un motif.
  const { error } = await supabase.rpc("crm_record_outcome", {
    p_opportunity_id: d.opportunityId,
    p_outcome: d.outcome,
    p_reason: d.reason ?? null,
    p_reason_code: d.reasonCode ?? null,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  revalidateDossier(d.opportunityId);
  return { ok: true };
}

// --- Documents (bucket privé + métadonnées) ----------------------------------

const DOC_KINDS = ["mandat_propose", "mandat_signe", "estimation_avis_valeur", "piece_interne"] as const;

/**
 * Téléverse un document dans le bucket PRIVÉ puis enregistre sa métadonnée. Le
 * contrôle de rôle est fait ici (admin/manager) ET re-vérifié en base par
 * `crm_register_document`. En cas d'échec de l'enregistrement, le fichier est
 * retiré du bucket (compensation) : aucun objet orphelin sans métadonnée.
 */
export async function uploadMandateDocumentAction(formData: FormData): Promise<ActionResult> {
  const session = await requireCrmSession();
  if (!canDecideMandate(session.roles)) {
    return { ok: false, error: "Droits insuffisants pour ajouter un document." };
  }
  if (!isSupabaseAdminConfigured()) {
    return {
      ok: false,
      error: "Stockage des documents non configuré (clé serveur absente).",
    };
  }

  const opportunityId = String(formData.get("opportunityId") ?? "");
  const kind = String(formData.get("kind") ?? "");
  const mandateIdRaw = String(formData.get("mandateId") ?? "");
  const file = formData.get("file");

  if (!uuid.safeParse(opportunityId).success) {
    return { ok: false, error: "Dossier invalide." };
  }
  if (!(DOC_KINDS as readonly string[]).includes(kind)) {
    return { ok: false, error: "Type de document invalide." };
  }
  const mandateId = mandateIdRaw && uuid.safeParse(mandateIdRaw).success ? mandateIdRaw : null;
  if (!(file instanceof File)) {
    return { ok: false, error: "Aucun fichier fourni." };
  }

  const validation = validateDocument({
    mime: file.type,
    size: file.size,
    fileName: file.name,
  });
  if (!validation.ok) return { ok: false, error: validation.error };

  const storagePath = buildStoragePath(opportunityId, validation.ext);
  const bytes = await file.arrayBuffer();
  const uploaded = await uploadMandateDocumentObject({
    storagePath,
    bytes,
    mime: validation.mime,
  });
  if (!uploaded.ok) return { ok: false, error: uploaded.error };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("crm_register_document", {
    p_opportunity_id: opportunityId,
    p_kind: kind,
    p_storage_path: storagePath,
    p_file_name: validation.fileName,
    p_mime_type: validation.mime,
    p_size_bytes: validation.size,
    p_mandate_id: mandateId,
  });
  if (error) {
    // Compensation : retirer l'objet orphelin (métadonnée non écrite).
    await removeMandateDocumentObject(storagePath);
    return { ok: false, error: humanize(error.code, error.message) };
  }

  revalidateDossier(opportunityId);
  return { ok: true, data: (data as Record<string, unknown>) ?? undefined };
}

const deleteDocSchema = z.object({ documentId: uuid, opportunityId: uuid.optional() });

export async function deleteMandateDocumentAction(input: unknown): Promise<ActionResult> {
  const session = await requireCrmSession();
  if (!canDecideMandate(session.roles)) {
    return { ok: false, error: "Droits insuffisants." };
  }
  const parsed = deleteDocSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("crm_delete_document", {
    p_document_id: parsed.data.documentId,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };

  // Retrait best-effort du fichier (la métadonnée `supprime` fait foi).
  const storagePath =
    data && typeof data === "object" && "storage_path" in data
      ? String((data as Record<string, unknown>).storage_path ?? "")
      : "";
  if (storagePath) await removeMandateDocumentObject(storagePath);

  revalidateDossier(parsed.data.opportunityId);
  return { ok: true };
}

/**
 * Génère une URL signée COURTE pour consulter un document. Lecture via le client
 * serveur (JWT) : la RLS garantit que l'appelant peut voir CE document (opérateur
 * ou agent affecté). L'URL n'est jamais stockée. Renvoie une erreur neutre si le
 * document n'est pas visible ou introuvable.
 */
export interface SignedUrlResult {
  ok: boolean;
  url?: string;
  error?: string;
}
export async function getDocumentSignedUrlAction(input: unknown): Promise<SignedUrlResult> {
  await requireCrmSession();
  if (!isSupabaseAdminConfigured()) {
    return { ok: false, error: "Consultation des documents non configurée." };
  }
  const parsed = z.object({ documentId: uuid }).safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Document invalide." };
  }
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("mandate_documents")
    .select("*")
    .eq("id", parsed.data.documentId)
    .eq("status", "actif")
    .maybeSingle();
  const doc = (data as MandateDocumentRow | null) ?? null;
  if (!doc) {
    return { ok: false, error: "Document introuvable ou accès refusé." };
  }
  const url = await createMandateDocumentSignedUrl(doc.storage_path);
  if (!url) return { ok: false, error: "Impossible de générer le lien. Réessayez." };
  return { ok: true, url };
}

// --- Handoff Fabrique de biens (idempotent) ----------------------------------

const handoffSchema = z.object({ mandateId: uuid, opportunityId: uuid.optional() });

export async function handoffCreatePropertyAction(input: unknown): Promise<ActionResult> {
  const session = await requireCrmSession();
  if (!canDecideMandate(session.roles)) {
    return { ok: false, error: "Droits insuffisants pour créer le bien." };
  }
  const parsed = handoffSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("crm_handoff_create_property", {
    p_mandate_id: parsed.data.mandateId,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  revalidateDossier(parsed.data.opportunityId);
  const propertyId =
    data && typeof data === "object" && "id" in data
      ? String((data as Record<string, unknown>).id ?? "")
      : "";
  if (propertyId) revalidatePath(`/crm/biens/${propertyId}`);
  return { ok: true, data: (data as Record<string, unknown>) ?? undefined };
}
