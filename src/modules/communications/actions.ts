"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireCrmSession } from "@/modules/crm/auth/session";
import {
  env,
  isCommunicationDispatchEnabled,
  isLumailConfigured,
  isTwilioConfigured,
} from "@/config";
import { dispatchPending } from "./dispatcher";
import { createLumailProvider } from "./providers/lumail";
import { createTwilioProvider } from "./providers/twilio";
import { CATEGORIES, CHANNELS, SUPPRESSION_REASONS, COMMUNICATION_EVENTS } from "./types";

/**
 * Actions serveur du centre de communications.
 *
 * Elles délèguent aux fonctions SQL `crm_comm_*` (SECURITY DEFINER), qui
 * re-vérifient le rôle, appliquent la politique et écrivent l'AuditEvent : **la
 * base fait autorité**. On ajoute ici une garde de session (défense en
 * profondeur), la validation Zod à la frontière et l'invalidation du cache.
 *
 * Ce qui n'est JAMAIS accepté depuis le navigateur : un statut d'envoi, un
 * identifiant fournisseur, un contenu rendu, une décision d'éligibilité. Toutes
 * ces valeurs sont produites côté serveur.
 */

export interface ActionResult {
  ok: boolean;
  error?: string;
  info?: string;
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

function revalidate() {
  revalidatePath("/crm/communications");
}

const uuid = z.string().uuid("Identifiant invalide.");

// --- Modèles ------------------------------------------------------------------
const templateSchema = z.object({
  templateKey: z
    .string()
    .trim()
    .regex(/^[a-z0-9_]{3,64}$/, "Clé invalide (minuscules, chiffres et « _ »)."),
  channel: z.enum(CHANNELS),
  category: z.enum(CATEGORIES),
  name: z.string().trim().min(3).max(160),
  subject: z.string().trim().max(200).nullable().optional(),
  body: z.string().trim().min(10).max(20_000),
  bodyFormat: z.enum(["markdown", "html", "texte"]).default("markdown"),
  previewText: z.string().trim().max(200).nullable().optional(),
  allowedVariables: z.array(z.string().trim().regex(/^[a-z][a-z0-9_]*$/)).max(30).default([]),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export async function upsertTemplateAction(input: unknown): Promise<ActionResult> {
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };
  const v = parsed.data;

  if (v.channel === "email" && !v.subject) {
    return { ok: false, error: "Un modèle e-mail exige un sujet." };
  }

  await requireCrmSession();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_comm_upsert_template", {
    p_template_key: v.templateKey,
    p_channel: v.channel,
    p_category: v.category,
    p_name: v.name,
    p_subject: v.subject ?? null,
    p_body: v.body,
    p_body_format: v.bodyFormat,
    p_preview_text: v.previewText ?? null,
    p_allowed_variables: v.allowedVariables,
    p_notes: v.notes ?? null,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };

  revalidate();
  return { ok: true, info: "Nouvelle version créée en brouillon." };
}

const templateStatusSchema = z.object({
  templateId: uuid,
  status: z.enum(["brouillon", "actif", "archive"]),
});

export async function setTemplateStatusAction(input: unknown): Promise<ActionResult> {
  const parsed = templateStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Données invalides." };

  await requireCrmSession();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_comm_set_template_status", {
    p_template_id: parsed.data.templateId,
    p_status: parsed.data.status,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };

  revalidate();
  return { ok: true };
}

// --- Oppositions ---------------------------------------------------------------
const suppressionSchema = z.object({
  contactId: uuid,
  channel: z.enum(["email", "sms", "tout"]),
  scope: z.enum(["marketing", "transactionnel", "tout"]),
  reason: z.enum(SUPPRESSION_REASONS),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export async function addSuppressionAction(input: unknown): Promise<ActionResult> {
  const parsed = suppressionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Données invalides." };
  const v = parsed.data;

  await requireCrmSession();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_comm_add_suppression", {
    p_contact_id: v.contactId,
    p_channel: v.channel,
    p_scope: v.scope,
    p_reason: v.reason,
    p_notes: v.notes ?? null,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };

  revalidate();
  return { ok: true };
}

const releaseSchema = z.object({
  suppressionId: uuid,
  // Motif OBLIGATOIRE : lever une opposition est une décision sensible, tracée.
  reason: z.string().trim().min(5, "Un motif est obligatoire.").max(1000),
});

export async function releaseSuppressionAction(input: unknown): Promise<ActionResult> {
  const parsed = releaseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };

  await requireCrmSession();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_comm_release_suppression", {
    p_id: parsed.data.suppressionId,
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };

  revalidate();
  return { ok: true };
}

// --- Automatisations ------------------------------------------------------------
const automationSchema = z.object({
  automationKey: z.string().trim().regex(/^[a-z0-9_]{3,64}$/, "Clé invalide."),
  name: z.string().trim().min(3).max(160),
  triggerEvent: z.enum(COMMUNICATION_EVENTS),
  templateKey: z.string().trim().regex(/^[a-z0-9_]{3,64}$/, "Clé de modèle invalide."),
  channel: z.enum(CHANNELS),
  delayMinutes: z.number().int().min(0).max(525_600).default(0),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export async function upsertAutomationAction(input: unknown): Promise<ActionResult> {
  const parsed = automationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };
  const v = parsed.data;

  await requireCrmSession();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_comm_upsert_automation", {
    p_automation_key: v.automationKey,
    p_name: v.name,
    p_trigger_event: v.triggerEvent,
    p_template_key: v.templateKey,
    p_channel: v.channel,
    p_delay_minutes: v.delayMinutes,
    p_notes: v.notes ?? null,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };

  revalidate();
  return { ok: true, info: "Automatisation créée en brouillon — elle ne produit rien tant qu'elle n'est pas activée." };
}

const automationStatusSchema = z.object({
  automationId: uuid,
  status: z.enum(["brouillon", "actif", "en_pause", "archive"]),
});

export async function setAutomationStatusAction(input: unknown): Promise<ActionResult> {
  const parsed = automationStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Données invalides." };

  await requireCrmSession();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_comm_set_automation_status", {
    p_automation_id: parsed.data.automationId,
    p_status: parsed.data.status,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };

  revalidate();
  return { ok: true };
}

// --- Messages -------------------------------------------------------------------
const cancelSchema = z.object({
  messageId: uuid,
  reason: z.string().trim().min(3, "Un motif est obligatoire.").max(1000),
});

export async function cancelMessageAction(input: unknown): Promise<ActionResult> {
  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };

  await requireCrmSession();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_comm_cancel_message", {
    p_message_id: parsed.data.messageId,
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };

  revalidate();
  return { ok: true };
}

export async function retryMessageAction(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ messageId: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Données invalides." };

  await requireCrmSession();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_comm_retry_message", {
    p_message_id: parsed.data.messageId,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };

  revalidate();
  return { ok: true };
}

// --- File d'attente ---------------------------------------------------------------
/**
 * Traite la file. **En V1, l'envoi réel est désactivé** : sans l'interrupteur
 * `COMMUNICATIONS_DISPATCH_ENABLED=true`, le dispatcher applique la politique,
 * prépare et trace les messages, mais n'émet AUCUN appel fournisseur.
 */
export async function processOutboxAction(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ limit: z.number().int().min(1).max(50).default(10) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Données invalides." };

  await requireCrmSession();
  const supabase = await createSupabaseServerClient();

  try {
    const report = await dispatchPending(
      {
        supabase,
        emailProvider: createLumailProvider({
          apiKey: env.LUMAIL_API_KEY,
          fromAddress: env.LUMAIL_FROM_EMAIL,
          replyTo: env.LUMAIL_REPLY_TO,
        }),
        smsProvider: createTwilioProvider({
          accountSid: env.TWILIO_ACCOUNT_SID,
          authToken: env.TWILIO_AUTH_TOKEN,
          from: env.TWILIO_FROM,
        }),
        dispatchEnabled:
          isCommunicationDispatchEnabled() && (isLumailConfigured() || isTwilioConfigured()),
      },
      parsed.data.limit,
    );

    revalidate();
    const simulated = report.outcomes.filter((o) => o.result === "simule").length;
    const blocked = report.outcomes.filter((o) => o.result === "bloque").length;
    const sent = report.outcomes.filter((o) => o.result === "envoye").length;

    return {
      ok: true,
      info: `${report.claimed} événement(s) traité(s) — ${sent} envoyé(s), ${simulated} simulé(s), ${blocked} bloqué(s).`,
    };
  } catch {
    return { ok: false, error: "Traitement de la file impossible." };
  }
}

export async function scheduleRemindersAction(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ hoursAhead: z.number().int().min(1).max(168).default(24) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Données invalides." };

  await requireCrmSession();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("crm_comm_schedule_reminders", {
    p_hours_ahead: parsed.data.hoursAhead,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };

  const scheduled = (data as { scheduled?: number } | null)?.scheduled ?? 0;
  revalidate();
  return { ok: true, info: `${scheduled} rappel(s) planifié(s).` };
}
