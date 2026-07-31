"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireCrmSession } from "../auth/session";
import { evaluateMove } from "../kanban";

/**
 * Actions serveur de MUTATION du CRM. Elles délèguent aux fonctions SQL
 * `crm_*` (SECURITY DEFINER) qui re-vérifient le rôle du·de la caller·euse et
 * écrivent l'AuditEvent : c'est la base qui fait autorité. On ajoute ici une
 * garde de session (défense en profondeur) et l'invalidation du cache.
 */

export interface ActionResult {
  ok: boolean;
  error?: string;
}

function humanizeError(code: string | undefined, message: string): string {
  switch (code) {
    case "28000":
      return "Session expirée. Reconnectez-vous.";
    case "42501":
      return "Droits insuffisants pour cette action.";
    case "22023":
      // Message métier explicite renvoyé par la fonction (déjà en français).
      return message || "Données invalides.";
    default:
      return message || "Une erreur est survenue. Réessayez.";
  }
}

function revalidateCrm(opportunityId?: string) {
  revalidatePath("/crm");
  revalidatePath("/crm/mandats");
  revalidatePath("/crm/mandats/pipeline");
  revalidatePath("/crm/taches");
  if (opportunityId) revalidatePath(`/crm/mandats/${opportunityId}`);
}

async function callRpc<Args extends Record<string, unknown>>(
  fn:
    | "crm_assign_opportunity"
    | "crm_self_assign"
    | "crm_change_stage"
    | "crm_log_activity"
    | "crm_create_task"
    | "crm_set_task_status"
    | "crm_decide_segment"
    | "crm_record_outcome",
  args: Args,
  opportunityId?: string,
): Promise<ActionResult> {
  await requireCrmSession();
  const supabase = await createSupabaseServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase.rpc(fn as never, args as any);
  if (error) {
    return { ok: false, error: humanizeError(error.code, error.message) };
  }
  revalidateCrm(opportunityId);
  return { ok: true };
}

export async function assignOpportunity(
  opportunityId: string,
  userId: string,
  responsibility = "setter",
): Promise<ActionResult> {
  return callRpc(
    "crm_assign_opportunity",
    {
      p_opportunity_id: opportunityId,
      p_user_id: userId,
      p_responsibility: responsibility,
    },
    opportunityId,
  );
}

export async function selfAssign(opportunityId: string): Promise<ActionResult> {
  return callRpc(
    "crm_self_assign",
    { p_opportunity_id: opportunityId, p_responsibility: "setter" },
    opportunityId,
  );
}

export async function changeStage(
  opportunityId: string,
  stage: string,
  note?: string,
): Promise<ActionResult> {
  return callRpc(
    "crm_change_stage",
    { p_opportunity_id: opportunityId, p_stage: stage, p_note: note ?? null },
    opportunityId,
  );
}

/**
 * Déplacement d'une carte du Kanban : ré-applique la règle de progression
 * (cibles protégées refusées) AVANT d'appeler la mutation serveur. Défense en
 * profondeur : la base re-vérifie le rôle, et cette garde empêche qu'un
 * glisser-déposer force un statut « proposé / signé / perdu » sans passer par les
 * fonctions dédiées. Renvoie `requiresAction` pour que le client oriente vers la
 * bonne action métier.
 */
export interface MoveStageResult extends ActionResult {
  requiresAction?: "mandat" | "resultat";
}

export async function moveLeadStage(input: {
  opportunityId: string;
  fromStage: string;
  toStage: string;
}): Promise<MoveStageResult> {
  const evaluation = evaluateMove(input.fromStage, input.toStage);
  if (evaluation.noop) return { ok: true };
  if (!evaluation.allowed) {
    return {
      ok: false,
      error: evaluation.reason ?? "Déplacement non autorisé.",
      requiresAction: evaluation.requiresAction,
    };
  }
  return callRpc(
    "crm_change_stage",
    { p_opportunity_id: input.opportunityId, p_stage: input.toStage, p_note: null },
    input.opportunityId,
  );
}

export async function logActivity(input: {
  opportunityId: string;
  type: string;
  outcome?: string | null;
  body?: string | null;
  contactId?: string | null;
}): Promise<ActionResult> {
  return callRpc(
    "crm_log_activity",
    {
      p_opportunity_id: input.opportunityId,
      p_type: input.type,
      p_outcome: input.outcome ?? null,
      p_body: input.body ?? null,
      p_contact_id: input.contactId ?? null,
    },
    input.opportunityId,
  );
}

export async function createTask(input: {
  opportunityId: string;
  title: string;
  kind?: string;
  dueAt?: string | null;
  assigneeUserId?: string | null;
}): Promise<ActionResult> {
  return callRpc(
    "crm_create_task",
    {
      p_opportunity_id: input.opportunityId,
      p_title: input.title,
      p_kind: input.kind ?? "rappel",
      p_due_at: input.dueAt ?? null,
      p_assignee_user_id: input.assigneeUserId ?? null,
    },
    input.opportunityId,
  );
}

export async function setTaskStatus(
  taskId: string,
  status: string,
  opportunityId?: string,
): Promise<ActionResult> {
  return callRpc(
    "crm_set_task_status",
    { p_task_id: taskId, p_status: status },
    opportunityId,
  );
}

export async function decideSegment(input: {
  opportunityId: string;
  segment: string;
  reason?: string | null;
  isDerogation?: boolean;
}): Promise<ActionResult> {
  return callRpc(
    "crm_decide_segment",
    {
      p_opportunity_id: input.opportunityId,
      p_segment: input.segment,
      p_reason: input.reason ?? null,
      p_is_derogation: input.isDerogation ?? false,
    },
    input.opportunityId,
  );
}

export async function recordOutcome(input: {
  opportunityId: string;
  outcome: string;
  reason?: string | null;
}): Promise<ActionResult> {
  return callRpc(
    "crm_record_outcome",
    {
      p_opportunity_id: input.opportunityId,
      p_outcome: input.outcome,
      p_reason: input.reason ?? null,
    },
    input.opportunityId,
  );
}
