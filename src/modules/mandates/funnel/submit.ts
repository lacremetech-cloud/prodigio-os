"use server";

import {
  env,
  isSupabaseConfigured,
  isTurnstileConfigured,
  isTurnstileProductionSafe,
} from "@/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json, SubmitMandateFunnelResult } from "@/lib/supabase/types";
import { scoreFromAnswers } from "../scoring";
import { analysis } from "./content";
import {
  buildSubmissionPayload,
  submitActionInputSchema,
  type SubmitResult,
} from "./payload";
import { TURNSTILE_ACTION, verifyTurnstileToken } from "./turnstile";

/**
 * Réponse neutre en cas d'échec / d'indisponibilité de la vérification anti-abus
 * (Turnstile). Le motif exact n'est jamais divulgué au client ; le widget est
 * réinitialisé pour permettre un nouvel essai (jeton absent / invalide / expiré
 * / déjà utilisé / mauvaise action / mauvais hostname / siteverify indisponible).
 */
const turnstileFailure: SubmitResult = {
  ok: false,
  reason: "turnstile",
  message: analysis.errors.turnstile,
  resetChallenge: true,
};

/**
 * Action serveur : dépose une demande via la fonction SQL contrôlée
 * `submit_mandate_funnel`. Valide à nouveau les données côté serveur (Zod),
 * **vérifie le jeton Cloudflare Turnstile** avant tout dépôt, n'utilise que la
 * clé publiable, et ne renvoie jamais de données d'autrui.
 *
 * Le jeton Turnstile est le SEUL élément anti-abus transmis par le navigateur ;
 * il est vérifié ici (siteverify) puis **écarté** : jamais stocké dans Supabase
 * / FunnelSubmission / raw_answers, jamais journalisé, jamais renvoyé au client.
 */
export async function submitMandateFunnelAction(
  input: unknown,
): Promise<SubmitResult> {
  // 1) Validation + normalisation côté serveur (frontière de confiance). Le
  //    jeton Turnstile est extrait à part et ne rejoint jamais le payload.
  const parsed = submitActionInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "validation",
      message: analysis.errors.validation,
    };
  }

  const { turnstileToken, ...request } = parsed.data;

  // Honeypot : un champ leurre rempli => on répond « ok » sans rien enregistrer
  // ni révéler d'appréciation. (Défense faible ; Turnstile reste la vraie garde.)
  if (request.answers.company && request.answers.company.length > 0) {
    return { ok: true, appreciation: null };
  }

  // 2) Services requis pour un dépôt réel : Supabase ET Turnstile. Sans l'un ou
  //    l'autre, aucun dépôt public — réponse neutre « indisponible ».
  if (!isSupabaseConfigured() || !isTurnstileConfigured()) {
    return {
      ok: false,
      reason: "unavailable",
      message: analysis.errors.unavailable,
    };
  }

  // 3) Garde-fou de production : des clés de TEST ne doivent JAMAIS accorder
  //    l'accès en production. Si tel est le cas, on refuse sans appeler
  //    siteverify (le dépôt ne doit pas être « validé » par une clé de test).
  if (!isTurnstileProductionSafe()) {
    console.error(
      "Turnstile mal configuré en production (clé de test détectée) — dépôt refusé.",
    );
    return turnstileFailure;
  }

  // 4) Vérification du jeton auprès de Cloudflare (siteverify). Aucun dépôt si
  //    le jeton est absent, invalide, expiré, déjà utilisé, d'action ou de
  //    hostname incorrect, ou si siteverify est indisponible.
  const isProduction = env.NODE_ENV === "production";
  const verification = await verifyTurnstileToken({
    secret: env.TURNSTILE_SECRET_KEY as string,
    token: turnstileToken,
    expectedAction: TURNSTILE_ACTION,
    expectedHostname: env.TURNSTILE_EXPECTED_HOSTNAME ?? null,
    // Le hostname n'est imposé qu'en production (les clés de test renvoient un
    // hostname arbitraire). L'action vide n'est tolérée qu'hors production.
    enforceHostname: isProduction && Boolean(env.TURNSTILE_EXPECTED_HOSTNAME),
    allowEmptyAction: !isProduction,
  });

  if (!verification.ok) {
    // On ne journalise QUE le motif technique (jamais le jeton).
    console.error("Vérification Turnstile refusée", { reason: verification.reason });
    return turnstileFailure;
  }

  // Appréciation qualitative calculée CÔTÉ SERVEUR à partir des seules réponses
  // validées : le navigateur ne peut ni l'imposer ni la modifier (les scores
  // numériques ne sont jamais renvoyés). La valeur stockée en base est, elle,
  // recalculée par la fonction SQL (source de vérité) — voir la migration scoring.
  const appreciation = scoreFromAnswers(request.answers).appreciation;

  // 5) Dépôt atomique via la fonction contrôlée. Le payload NE contient PAS le
  //    jeton Turnstile (écarté à l'étape 1).
  try {
    const payload = buildSubmissionPayload(request) as Json;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("submit_mandate_funnel", {
      payload,
    });

    if (error) {
      // On ne journalise QUE le SQLSTATE : un message Postgres peut contenir des
      // valeurs de ligne (donnée personnelle). Détail technique côté serveur.
      console.error("submit_mandate_funnel a échoué", { code: error.code });
      return { ok: false, reason: "error", message: analysis.errors.generic };
    }

    // La réponse est un accusé neutre ; on ne s'appuie sur aucune donnée renvoyée.
    const result = data as unknown as SubmitMandateFunnelResult | null;
    if (result && result.accepted === true) {
      return { ok: true, appreciation };
    }
    return { ok: false, reason: "error", message: analysis.errors.generic };
  } catch (cause) {
    console.error("submit_mandate_funnel exception", {
      name: cause instanceof Error ? cause.name : "unknown",
    });
    return { ok: false, reason: "error", message: analysis.errors.generic };
  }
}
