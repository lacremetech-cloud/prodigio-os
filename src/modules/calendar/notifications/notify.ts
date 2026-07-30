import { env as globalEnv, isEstimationSlackConfigured } from "@/config";
import type { Env } from "@/config";
import { postSlackWebhook, type SlackFetch } from "@/modules/mandates/notifications/slack";
import { buildEstimationSlackMessage } from "./message";
import type { EstimationAlertData } from "./types";

/**
 * Orchestrateur d'alerte Slack d'un rendez-vous d'estimation. Best-effort : ne
 * DÉCLENCHE JAMAIS d'exception. L'échec de Slack n'annule ni ne bloque un
 * rendez-vous déjà enregistré (l'appel est de toute façon différé après la
 * réponse utilisateur — voir `schedule.ts`).
 *
 * Transport : POST webhook, timeout court (4 s), au plus 2 nouvelles tentatives
 * sur erreur réseau ou HTTP 5xx, aucun retry sur 4xx.
 *
 * Journalise UNIQUEMENT des méta-informations NETTOYÉES (type d'événement,
 * identifiant interne d'opportunité, statut, nombre de tentatives, code HTTP) —
 * JAMAIS de coordonnées, de message complet, de webhook ni de secret.
 */

export interface NotifyResult {
  status: "sent" | "skipped" | "failed";
  attempts: number;
}

export interface NotifyDeps {
  env?: Env;
  fetchImpl?: SlackFetch;
  /** Nombre total de tentatives (1 initiale + jusqu'à 2 nouvelles). */
  maxAttempts?: number;
  timeoutMs?: number;
}

const LOG_EVENT = "estimation_slack_notification";

export async function sendEstimationSlackAlert(
  data: EstimationAlertData,
  deps: NotifyDeps = {},
): Promise<NotifyResult> {
  const env = deps.env ?? globalEnv;
  const webhook = env.SLACK_ESTIMATION_APPOINTMENTS_WEBHOOK_URL;

  // Preview / dev : webhook absent → alertes désactivées proprement (aucun appel).
  if (!isEstimationSlackConfigured(env) || !webhook) {
    console.info(LOG_EVENT, { event: data.kind, status: "disabled" });
    return { status: "skipped", attempts: 0 };
  }

  let message;
  try {
    message = buildEstimationSlackMessage(data);
  } catch {
    console.error(LOG_EVENT, {
      event: data.kind,
      status: "build_error",
      opportunityId: data.opportunityId,
    });
    return { status: "failed", attempts: 0 };
  }

  const maxAttempts = Math.max(1, deps.maxAttempts ?? 3);
  let attempts = 0;
  let lastStatus: number | null = null;

  while (attempts < maxAttempts) {
    attempts += 1;
    try {
      const res = await postSlackWebhook(webhook, message, {
        fetchImpl: deps.fetchImpl,
        timeoutMs: deps.timeoutMs ?? 4000,
      });
      lastStatus = res.status;
      if (res.ok) {
        console.info(LOG_EVENT, {
          event: data.kind,
          status: "sent",
          attempts,
          opportunityId: data.opportunityId,
        });
        return { status: "sent", attempts };
      }
      // Erreur client (4xx) : un réessai est inutile.
      if (typeof res.status === "number" && res.status < 500) break;
    } catch {
      // Erreur réseau / timeout : on réessaie tant qu'il reste des tentatives.
    }
  }

  console.error(LOG_EVENT, {
    event: data.kind,
    status: "failed",
    attempts,
    code: lastStatus,
    opportunityId: data.opportunityId,
  });
  return { status: "failed", attempts };
}
