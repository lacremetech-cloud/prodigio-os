import { env as globalEnv, isBuyerSlackConfigured, mandateCrmBaseUrl } from "@/config";
import type { Env } from "@/config";
import { postSlackWebhook, type SlackFetch } from "@/modules/mandates/notifications/slack";
import type { BuyerSubmissionRequest } from "../funnel/payload";
import type { BuyerScoreResult } from "../scoring";
import { buildBuyerSlackMessage } from "./message";
import { budgetBandLabels } from "../funnel/content";
import type { FicheLead } from "./alerte-email";

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
  /** Dossier acquéreur consolidé, résolu en base au moment du dépôt. */
  buyerProfileId: string | null;
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

/** Libelles de priorite du tunnel historique, miroir de ceux de l'alerte Slack. */
const PRIORITES_HISTORIQUE: Record<string, string> = {
  prioritaire: "Prioritaire",
  a_qualifier: "À qualifier",
  a_suivre: "À suivre",
};

/**
 * Traduit une demande du tunnel HISTORIQUE en fiche d'alerte e-mail.
 *
 * Les deux tunnels sont encore vivants : celui des landing pages
 * (`universal-form`) et celui-ci (`buyer-funnel`). « Un e-mail a chaque
 * nouveau lead » serait faux si un seul des deux alertait — d'ou ce second
 * convertisseur, qui lit les champs la ou CE tunnel les range.
 *
 * Valeurs BRUTES : le module e-mail a son propre nettoyage.
 */
export function ficheLeadHistorique(
  input: BuyerNotifyInput,
  recuLe: Date = new Date(),
): FicheLead {
  const c = input.request.answers.contact;
  const nom = `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim();
  const bande = input.request.answers.budgetBand;
  return {
    nom: nom || null,
    telephone: c.phoneRaw ?? null,
    email: c.emailRaw ?? null,
    bien: input.propertyName,
    budget: bande ? budgetBandLabels[bande] ?? null : null,
    /* Ce tunnel ne pose pas la question actuelle : il n'a qu'une ANCIENNE
       tranche, et « 800 k€ – 1,2 M€ » chevauche le million. La convertir
       inventerait une réponse jamais donnée, donc `null` : ces leads ne
       déclenchent pas d'alerte immédiate et passent par le récapitulatif.
       Sans effet en pratique — un seul dépôt en neuf jours n'a pas de code. */
    budgetChoice: null,
    // Ce tunnel ne porte pas de parametres de campagne dans l'alerte.
    provenance: null,
    score: {
      overall: input.score.overall,
      priority: PRIORITES_HISTORIQUE[input.score.priority] ?? input.score.priority,
    },
    buyerProfileId: input.buyerProfileId,
    interestId: input.interestId,
    recuLe,
  };
}

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
      buyerProfileId: input.buyerProfileId,
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
