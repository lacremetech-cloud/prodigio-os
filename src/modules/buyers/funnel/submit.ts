"use server";

import { after } from "next/server";
import {
  env,
  isSupabaseConfigured,
  isTurnstileConfigured,
  isTurnstileProductionSafe,
} from "@/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import { computeBuyerScore } from "../scoring";
import { notifyNewBuyerInterest, type BuyerNotifyInput } from "../notifications";
import { buyerFunnel } from "./content";
import {
  buildBuyerPayload,
  buyerSubmitActionInputSchema,
  type BuyerSubmitResult,
} from "./payload";
import { BUYER_TURNSTILE_ACTION, verifyTurnstileToken } from "./turnstile";

/** Résultat serveur de `submit_buyer_interest` (destiné au serveur uniquement). */
interface SubmitBuyerInterestResult {
  accepted: boolean;
  created?: boolean;
  interest_id?: string | null;
  property_id?: string | null;
  property_name?: string | null;
}

/**
 * Programme l'alerte Slack acquéreur APRÈS la réponse (`after`) afin de ne jamais
 * bloquer ni ralentir la soumission. L'orchestrateur ne lève jamais.
 */
function scheduleBuyerSlackAlert(input: BuyerNotifyInput): void {
  try {
    after(() => notifyNewBuyerInterest(input));
  } catch {
    void notifyNewBuyerInterest(input);
  }
}

const turnstileFailure: BuyerSubmitResult = {
  ok: false,
  reason: "turnstile",
  message: buyerFunnel.errors.turnstile,
  resetChallenge: true,
};

/**
 * Action serveur : dépose un intérêt acquéreur via la fonction SQL contrôlée
 * `submit_buyer_interest`. Revalide côté serveur (Zod), **vérifie le jeton
 * Turnstile** avant tout dépôt (action DÉDIÉE `buyer_submission`), n'utilise que
 * la clé publiable, et ne renvoie jamais de données. Le score reste interne :
 * la réponse est toujours NEUTRE (jamais de « refusé »).
 */
export async function submitBuyerInterestAction(
  input: unknown,
): Promise<BuyerSubmitResult> {
  const parsed = buyerSubmitActionInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "validation", message: buyerFunnel.errors.validation };
  }

  const { turnstileToken, ...request } = parsed.data;

  // Honeypot : un champ leurre rempli => réponse « ok » silencieuse, rien enregistré.
  if (request.answers.company && request.answers.company.length > 0) {
    return { ok: true };
  }

  if (!isSupabaseConfigured() || !isTurnstileConfigured()) {
    return { ok: false, reason: "unavailable", message: buyerFunnel.errors.unavailable };
  }

  if (!isTurnstileProductionSafe()) {
    console.error(
      "Turnstile mal configuré en production (clé de test détectée) — dépôt acquéreur refusé.",
    );
    return turnstileFailure;
  }

  const isProduction = env.NODE_ENV === "production";
  const verification = await verifyTurnstileToken({
    secret: env.TURNSTILE_SECRET_KEY as string,
    token: turnstileToken,
    expectedAction: BUYER_TURNSTILE_ACTION,
    expectedHostname: env.TURNSTILE_EXPECTED_HOSTNAME ?? null,
    enforceHostname: isProduction && Boolean(env.TURNSTILE_EXPECTED_HOSTNAME),
    allowEmptyAction: !isProduction,
  });
  if (!verification.ok) {
    console.error("Vérification Turnstile acquéreur refusée", { reason: verification.reason });
    return turnstileFailure;
  }

  // Score calculé côté serveur pour l'alerte Slack UNIQUEMENT (jamais renvoyé au
  // client). La base recalcule et STOCKE le score de référence (source de vérité)
  // avec la valeur de référence interne du bien — non falsifiable depuis le navigateur.
  const answers = request.answers;
  const score = computeBuyerScore({
    budgetBand: answers.budgetBand,
    financing: answers.financing,
    purchaseHorizon: answers.purchaseHorizon,
    projectNature: answers.projectNature,
    decisionMode: answers.decisionMode,
    availability: answers.availability,
    // La valeur de référence est INTERNE (lue en base) : côté client on ne la
    // connaît pas. Le score Slack est indicatif ; le score stocké fait foi.
    referenceValueCents: null,
  });

  try {
    const payload = buildBuyerPayload(request) as Json;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("submit_buyer_interest", { payload });

    if (error) {
      console.error("submit_buyer_interest a échoué", { code: error.code });
      return { ok: false, reason: "error", message: buyerFunnel.errors.generic };
    }

    const result = data as unknown as SubmitBuyerInterestResult | null;
    if (result && result.accepted === true) {
      if (
        result.created === true &&
        typeof result.interest_id === "string" &&
        result.interest_id.length > 0 &&
        typeof result.property_id === "string" &&
        result.property_id.length > 0
      ) {
        scheduleBuyerSlackAlert({
          request,
          score,
          interestId: result.interest_id,
          propertyId: result.property_id,
          propertyName:
            typeof result.property_name === "string" ? result.property_name : null,
        });
      }
      return { ok: true };
    }
    return { ok: false, reason: "error", message: buyerFunnel.errors.generic };
  } catch (cause) {
    console.error("submit_buyer_interest exception", {
      name: cause instanceof Error ? cause.name : "unknown",
    });
    return { ok: false, reason: "error", message: buyerFunnel.errors.generic };
  }
}
