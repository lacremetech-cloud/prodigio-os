import { env as globalEnv, isBuyerSlackConfigured, mandateCrmBaseUrl } from "@/config";
import type { Env } from "@/config";
import { postSlackWebhook, type SlackFetch } from "@/modules/mandates/notifications/slack";
import type { BuyerSubmissionRequest } from "../funnel/payload";
import type { BuyerScoreResult } from "../scoring";
import { buildBuyerSlackMessage } from "./message";

/**
 * Orchestrateur d'alerte Slack pour une **nouvelle demande acquéreur réellement
 * enregistrée**. Ne DÉCLENCHE JAMAIS d'exception (best-effort) : une panne Slack
 * ne bloque ni n'annule le dépôt (déjà enregistré avant cet appel).
 *
 * Utilise le webhook DÉDIÉ `SLACK_BUYER_LEADS_WEBHOOK_URL` (canal
 * `#alertes-acquereurs`) — JAMAIS le canal Mandats. Journalise uniquement des
 * méta-informations nettoyées (jamais de coordonnées, de webhook, de message).
 */

export interface BuyerNotifyInput {
  request: BuyerSubmissionRequest;
  score: BuyerScoreResult;
  interestId: string;
  propertyId: string;
  propertyName: string | null;
}

export interface BuyerNotifyResult {
  status: "sent" | "skipped" | "failed";
  attempts: number;
}

export interface BuyerNotifyDeps {
  env?: Env;
  fetchImpl?: SlackFetch;
  now?: Date;
  maxAttempts?: number;
  timeoutMs?: number;
}

const LOG_EVENT = "buyer_slack_notification";

export async function notifyNewBuyerInterest(
  input: BuyerNotifyInput,
  deps: BuyerNotifyDeps = {},
): Promise<BuyerNotifyResult> {
  const env = deps.env ?? globalEnv;
  const webhook = env.SLACK_BUYER_LEADS_WEBHOOK_URL;

  // Preview / dev / canal non configuré → Slack désactivé proprement (aucun appel).
  if (!isBuyerSlackConfigured(env) || !webhook) {
    console.info(LOG_EVENT, { event: "new_buyer_interest", status: "disabled" });
    return { status: "skipped", attempts: 0 };
  }

  let message;
  try {
    message = buildBuyerSlackMessage({
      request: input.request,
      score: input.score,
      interestId: input.interestId,
      propertyId: input.propertyId,
      propertyName: input.propertyName,
      crmBaseUrl: mandateCrmBaseUrl(env),
      receivedAt: deps.now ?? new Date(),
    });
  } catch {
    console.error(LOG_EVENT, {
      event: "new_buyer_interest",
      status: "build_error",
      interestId: input.interestId,
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
          event: "new_buyer_interest",
          status: "sent",
          attempts,
          interestId: input.interestId,
        });
        return { status: "sent", attempts };
      }
      if (typeof res.status === "number" && res.status < 500) break;
    } catch {
      // Erreur réseau / timeout : on réessaie tant qu'il reste des tentatives.
    }
  }

  console.error(LOG_EVENT, {
    event: "new_buyer_interest",
    status: "failed",
    attempts,
    code: lastStatus,
    interestId: input.interestId,
  });
  return { status: "failed", attempts };
}
