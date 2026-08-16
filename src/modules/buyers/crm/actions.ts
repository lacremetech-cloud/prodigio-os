"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireCrmSession } from "@/modules/crm/auth/session";
import { canDecideMandate } from "@/modules/crm/auth/roles";
import { evaluateBuyerMove } from "./pipeline";

/**
 * Actions serveur de MUTATION du CRM Acquéreurs. Elles délèguent aux fonctions
 * SQL `crm_buyer_*` (SECURITY DEFINER) qui re-vérifient le rôle, appliquent les
 * règles métier et écrivent l'AuditEvent : **la base fait autorité**.
 *
 * On ajoute ici une garde de session (défense en profondeur), la validation Zod
 * à la frontière et l'invalidation du cache. Aucune donnée technique, aucun
 * secret, aucune note interne n'est renvoyé au navigateur.
 *
 * Ce qui n'est JAMAIS accepté depuis le navigateur : un score, une priorité
 * recommandée, un résultat de matching. Ces valeurs sont calculées en base.
 */

export interface ActionResult {
  ok: boolean;
  error?: string;
  /** Action métier dédiée à ouvrir quand un déplacement est refusé. */
  requiresAction?: "offre" | "resultat" | "reouverture";
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

function revalidateBuyer(buyerProfileId?: string) {
  revalidatePath("/crm/acquereurs");
  revalidatePath("/crm/acquereurs/pipeline");
  if (buyerProfileId) revalidatePath(`/crm/acquereurs/${buyerProfileId}`);
}

const uuid = z.string().uuid("Identifiant invalide.");
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

// --- Étape du pipeline --------------------------------------------------------
const stageSchema = z.object({
  buyerProfileId: uuid,
  // Les étapes sensibles sont volontairement ABSENTES : elles passent par les
  // actions métier dédiées (offre / résultat), en base comme ici.
  stage: z.enum([
    "nouveau",
    "a_contacter",
    "contact_en_cours",
    "qualifie",
    "bien_a_proposer",
    "visite_a_planifier",
    "visite_planifiee",
    "suivi_apres_visite",
  ]),
});

export async function setBuyerStageAction(input: unknown): Promise<ActionResult> {
  await requireCrmSession();
  const parsed = stageSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        "Cette étape ne se change pas par déplacement : utilisez l’action dédiée (offre ou résultat).",
    };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_buyer_set_stage", {
    p_buyer_profile_id: parsed.data.buyerProfileId,
    p_stage: parsed.data.stage,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  revalidateBuyer(parsed.data.buyerProfileId);
  return { ok: true };
}

/**
 * Déplacement d'une carte du Kanban Acquéreurs : ré-applique la règle de
 * progression (cibles protégées refusées) AVANT d'appeler la mutation serveur.
 * Défense en profondeur — la base re-vérifie tout — et permet d'orienter
 * l'utilisateur vers la bonne action métier plutôt que d'afficher une erreur
 * brute. Renvoie `requiresAction` à cette fin.
 */
export async function moveBuyerCardAction(input: {
  buyerProfileId: string;
  fromStage: string;
  toStage: string;
}): Promise<ActionResult> {
  const evaluation = evaluateBuyerMove(input.fromStage, input.toStage);
  if (evaluation.noop) return { ok: true };
  if (!evaluation.allowed) {
    return {
      ok: false,
      error: evaluation.reason ?? "Déplacement non autorisé.",
      requiresAction: evaluation.requiresAction,
    };
  }
  return setBuyerStageAction({
    buyerProfileId: input.buyerProfileId,
    stage: input.toStage,
  });
}

// --- Qualification HUMAINE ----------------------------------------------------
const qualifySchema = z.object({
  buyerProfileId: uuid,
  status: z.enum(["non_qualifie", "en_cours", "qualifie", "ecarte"]),
  reason: optionalText(2000),
});

export async function qualifyBuyerAction(input: unknown): Promise<ActionResult> {
  await requireCrmSession();
  const parsed = qualifySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Saisie invalide." };
  const d = parsed.data;
  if (d.status === "ecarte" && !d.reason?.trim()) {
    return { ok: false, error: "Un motif est requis pour écarter un dossier." };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_buyer_qualify", {
    p_buyer_profile_id: d.buyerProfileId,
    p_status: d.status,
    p_reason: d.reason ?? null,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  revalidateBuyer(d.buyerProfileId);
  return { ok: true };
}

// --- Affectation --------------------------------------------------------------
const assignSchema = z.object({
  buyerProfileId: uuid,
  userId: uuid,
  responsibility: z
    .enum(["setter", "manager", "agent_immobilier", "responsable_marketing"])
    .default("setter"),
});

export async function assignBuyerAction(input: unknown): Promise<ActionResult> {
  await requireCrmSession();
  const parsed = assignSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Saisie invalide." };
  const d = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_buyer_assign", {
    p_buyer_profile_id: d.buyerProfileId,
    p_user_id: d.userId,
    p_responsibility: d.responsibility,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  revalidateBuyer(d.buyerProfileId);
  return { ok: true };
}

export async function selfAssignBuyerAction(input: unknown): Promise<ActionResult> {
  const session = await requireCrmSession();
  const parsed = z.object({ buyerProfileId: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Saisie invalide." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_buyer_assign", {
    p_buyer_profile_id: parsed.data.buyerProfileId,
    p_user_id: session.userId,
    p_responsibility: "setter",
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  revalidateBuyer(parsed.data.buyerProfileId);
  return { ok: true };
}

export async function unassignBuyerAction(input: unknown): Promise<ActionResult> {
  await requireCrmSession();
  const parsed = z.object({ buyerProfileId: uuid, userId: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Saisie invalide." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_buyer_unassign", {
    p_buyer_profile_id: parsed.data.buyerProfileId,
    p_user_id: parsed.data.userId,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  revalidateBuyer(parsed.data.buyerProfileId);
  return { ok: true };
}

// --- Critères de recherche (saisie humaine) -----------------------------------
const criteriaSchema = z.object({
  buyerProfileId: uuid,
  propertyTypes: z.array(z.string().trim().min(1).max(60)).max(20).nullable().optional(),
  locations: z.array(z.string().trim().min(1).max(120)).max(30).nullable().optional(),
  // Saisie en euros côté interface, convertie en centimes ici.
  budgetMinEuros: z.number().min(0).max(1_000_000_000).nullable().optional(),
  budgetMaxEuros: z.number().min(0).max(1_000_000_000).nullable().optional(),
  purchaseHorizon: optionalText(60),
  financing: optionalText(60),
  projectNature: optionalText(60),
  decisionMode: optionalText(60),
  notes: optionalText(4000),
});

export async function upsertBuyerCriteriaAction(input: unknown): Promise<ActionResult> {
  await requireCrmSession();
  const parsed = criteriaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }
  const d = parsed.data;
  if (
    d.budgetMinEuros != null &&
    d.budgetMaxEuros != null &&
    d.budgetMaxEuros < d.budgetMinEuros
  ) {
    return { ok: false, error: "Le budget maximal doit être supérieur au budget minimal." };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_buyer_upsert_criteria", {
    p_buyer_profile_id: d.buyerProfileId,
    p_property_types: d.propertyTypes ?? null,
    p_locations: d.locations ?? null,
    p_budget_min_cents: d.budgetMinEuros == null ? null : Math.round(d.budgetMinEuros * 100),
    p_budget_max_cents: d.budgetMaxEuros == null ? null : Math.round(d.budgetMaxEuros * 100),
    p_purchase_horizon: d.purchaseHorizon ?? null,
    p_financing: d.financing ?? null,
    p_project_nature: d.projectNature ?? null,
    p_decision_mode: d.decisionMode ?? null,
    p_notes: d.notes ?? null,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  revalidateBuyer(d.buyerProfileId);
  return { ok: true };
}

// --- Offre en cours (action métier dédiée) ------------------------------------
const offerSchema = z.object({
  buyerProfileId: uuid,
  propertyId: uuid.nullable().optional(),
  amountEuros: z.number().min(0).max(1_000_000_000).nullable().optional(),
  note: optionalText(4000),
});

export async function recordBuyerOfferAction(input: unknown): Promise<ActionResult> {
  await requireCrmSession();
  const parsed = offerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Saisie invalide." };
  const d = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_buyer_record_offer", {
    p_buyer_profile_id: d.buyerProfileId,
    p_property_id: d.propertyId ?? null,
    p_amount_cents: d.amountEuros == null ? null : Math.round(d.amountEuros * 100),
    p_note: d.note ?? null,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  revalidateBuyer(d.buyerProfileId);
  return { ok: true };
}

// --- Résultat commercial (décision sensible : admin/manager en base) ----------
const outcomeSchema = z.object({
  buyerProfileId: uuid,
  outcome: z.enum(["gagne", "perdu"]),
  reason: optionalText(2000),
});

export async function recordBuyerOutcomeAction(input: unknown): Promise<ActionResult> {
  const session = await requireCrmSession();
  if (!canDecideMandate(session.roles)) {
    return {
      ok: false,
      error: "Seul un administrateur ou un manager enregistre le résultat d’un dossier.",
    };
  }
  const parsed = outcomeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Saisie invalide." };
  const d = parsed.data;
  if (d.outcome === "perdu" && !d.reason?.trim()) {
    return { ok: false, error: "Un motif de perte est obligatoire." };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_buyer_record_outcome", {
    p_buyer_profile_id: d.buyerProfileId,
    p_outcome: d.outcome,
    p_reason: d.reason ?? null,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  revalidateBuyer(d.buyerProfileId);
  return { ok: true };
}

export async function reopenBuyerAction(input: unknown): Promise<ActionResult> {
  const session = await requireCrmSession();
  if (!canDecideMandate(session.roles)) {
    return { ok: false, error: "Seul un administrateur ou un manager rouvre un dossier." };
  }
  const parsed = z
    .object({ buyerProfileId: uuid, reason: z.string().trim().min(1).max(2000) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Un motif est requis pour rouvrir un dossier." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_buyer_reopen", {
    p_buyer_profile_id: parsed.data.buyerProfileId,
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  revalidateBuyer(parsed.data.buyerProfileId);
  return { ok: true };
}

// --- Suivi opérationnel : activités, notes, tâches ----------------------------
const activitySchema = z.object({
  buyerProfileId: uuid,
  type: z.enum(["appel", "tentative_appel", "email", "sms_whatsapp", "rendez_vous", "note", "autre"]),
  outcome: z
    .enum(["sans_reponse", "message_laisse", "rappel_demande", "contact_etabli", "mauvais_numero"])
    .nullable()
    .optional(),
  body: optionalText(4000),
});

export async function logBuyerActivityAction(input: unknown): Promise<ActionResult> {
  await requireCrmSession();
  const parsed = activitySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Saisie invalide." };
  const d = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_buyer_log_activity", {
    p_buyer_profile_id: d.buyerProfileId,
    p_type: d.type,
    p_outcome: d.outcome ?? null,
    p_body: d.body ?? null,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  revalidateBuyer(d.buyerProfileId);
  return { ok: true };
}

const taskSchema = z.object({
  buyerProfileId: uuid,
  title: z.string().trim().min(1, "Un intitulé est requis.").max(300),
  kind: z.enum(["rappel", "tache"]).default("rappel"),
  dueAt: z.string().datetime().nullable().optional(),
  assigneeUserId: uuid.nullable().optional(),
});

export async function createBuyerTaskAction(input: unknown): Promise<ActionResult> {
  await requireCrmSession();
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }
  const d = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_buyer_create_task", {
    p_buyer_profile_id: d.buyerProfileId,
    p_title: d.title,
    p_kind: d.kind,
    p_due_at: d.dueAt ?? null,
    p_assignee_user_id: d.assigneeUserId ?? null,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  revalidateBuyer(d.buyerProfileId);
  return { ok: true };
}

export async function setBuyerTaskStatusAction(input: unknown): Promise<ActionResult> {
  await requireCrmSession();
  const parsed = z
    .object({
      buyerProfileId: uuid,
      taskId: uuid,
      status: z.enum(["a_faire", "fait", "annule"]),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Saisie invalide." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_buyer_set_task_status", {
    p_task_id: parsed.data.taskId,
    p_status: parsed.data.status,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  revalidateBuyer(parsed.data.buyerProfileId);
  return { ok: true };
}
