import { env as globalEnv, isSlackConfigured, mandateCrmBaseUrl } from "@/config";
import type { Env } from "@/config";
import type { SubmissionRequest } from "../funnel/payload";
import type { ScoreResult } from "../scoring";
import { buildMandateSlackMessage } from "./message";
import { postSlackWebhook, type SlackFetch } from "./slack";

/**
 * Orchestrateur d'alerte Slack pour une **nouvelle demande de mandat réellement
 * enregistrée**. Ne DÉCLENCHE JAMAIS d'exception (best-effort) : une panne Slack
 * ne bloque ni n'annule la soumission (déjà enregistrée avant cet appel).
 *
 * Journalise uniquement des méta-informations NETTOYÉES (type d'événement,
 * identifiant interne d'opportunité, statut d'envoi, nombre de tentatives, code
 * technique) — JAMAIS de coordonnées, de message complet, ni de webhook.
 */

export interface NotifyInput {
  request: SubmissionRequest;
  score: ScoreResult;
  opportunityId: string;
}

export interface NotifyResult {
  status: "sent" | "skipped" | "failed";
  attempts: number;
}

export interface NotifyDeps {
  env?: Env;
  fetchImpl?: SlackFetch;
  now?: Date;
  maxAttempts?: number;
  timeoutMs?: number;
}

const LOG_EVENT = "mandate_slack_notification";

export async function notifyNewMandateSubmission(
  input: NotifyInput,
  deps: NotifyDeps = {},
): Promise<NotifyResult> {
  const env = deps.env ?? globalEnv;
  const webhook = env.SLACK_MANDATES_WEBHOOK_URL;

  // Preview / dev : webhook absent → Slack désactivé proprement (aucun appel).
  if (!isSlackConfigured(env) || !webhook) {
    console.info(LOG_EVENT, { event: "new_mandate", status: "disabled" });
    return { status: "skipped", attempts: 0 };
  }

  let message;
  try {
    message = buildMandateSlackMessage({
      request: input.request,
      score: input.score,
      opportunityId: input.opportunityId,
      crmBaseUrl: mandateCrmBaseUrl(env),
      receivedAt: deps.now ?? new Date(),
    });
  } catch {
    console.error(LOG_EVENT, {
      event: "new_mandate",
      status: "build_error",
      opportunityId: input.opportunityId,
    });
    return { status: "failed", attempts: 0 };
  }

  const maxAttempts = Math.max(1, deps.maxAttempts ?? 2);
  let attempts = 0;
  let lastStatus: number | null = null;

  while (attempts < maxAttempts) {
    attempts += 1;
    try {
      const res = await postSlackWebhook(webhook, message, {
        fetchImpl: deps.fetchImpl,
        timeoutMs: deps.timeoutMs,
      });
      lastStatus = res.status;
      if (res.ok) {
        console.info(LOG_EVENT, {
          event: "new_mandate",
          status: "sent",
          attempts,
          opportunityId: input.opportunityId,
        });
        return { status: "sent", attempts };
      }
      // Erreur client (4xx, ex. payload invalide) : un réessai est inutile.
      if (typeof res.status === "number" && res.status < 500) break;
    } catch {
      // Erreur réseau / timeout : on réessaie tant qu'il reste des tentatives.
    }
  }

  console.error(LOG_EVENT, {
    event: "new_mandate",
    status: "failed",
    attempts,
    code: lastStatus,
    opportunityId: input.opportunityId,
  });
  return { status: "failed", attempts };
}
