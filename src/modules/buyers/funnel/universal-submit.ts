"use server";

import {
  env,
  isSupabaseConfigured,
  isTurnstileConfigured,
  isTurnstileProductionSafe,
} from "@/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import { buyerFunnel } from "./content";
import {
  buildUniversalPayload,
  universalSubmitActionInputSchema,
  type UniversalSubmitResult,
} from "./universal-payload";
import { BUYER_TURNSTILE_ACTION, verifyTurnstileToken } from "./turnstile";

/**
 * Action serveur du formulaire acquéreur **universel**.
 *
 * Elle dépose via la fonction SQL contrôlée `submit_buyer_interest` (qui
 * recontrôle tout et fait autorité), n'utilise que la clé publiable, vérifie
 * Turnstile avant tout dépôt, et ne renvoie jamais d'état interne — à une
 * exception près, assumée : l'adresse de la **brochure**, qui est la
 * contrepartie promise à la personne et n'est délivrée que contre un intérêt
 * réellement enregistré.
 *
 * Cette mission ne déclenche **aucun e-mail ni SMS** : rien n'est envoyé à la
 * personne, la brochure est remise à l'écran.
 */

interface SubmitResult {
  accepted: boolean;
  created?: boolean;
  interest_id?: string | null;
}

const turnstileFailure: UniversalSubmitResult = {
  ok: false,
  reason: "turnstile",
  message: buyerFunnel.errors.turnstile,
  resetChallenge: true,
};

export async function submitUniversalInterestAction(
  input: unknown,
): Promise<UniversalSubmitResult> {
  const parsed = universalSubmitActionInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "validation", message: buyerFunnel.errors.validation };
  }

  const { turnstileToken, ...request } = parsed.data;

  // Pot de miel : rempli => accusé « ok » silencieux, rien n'est enregistré.
  if (request.answers.company && request.answers.company.length > 0) {
    return { ok: true, brochureUrl: null };
  }

  if (!isSupabaseConfigured() || !isTurnstileConfigured()) {
    return { ok: false, reason: "unavailable", message: buyerFunnel.errors.unavailable };
  }
  if (!isTurnstileProductionSafe()) {
    console.error("Turnstile mal configuré en production — dépôt acquéreur refusé.");
    return turnstileFailure;
  }

  const isProduction = env.NODE_ENV === "production";
  const verification = await verifyTurnstileToken({
    secret: env.TURNSTILE_SECRET_KEY as string,
    token: turnstileToken,
    expectedAction: BUYER_TURNSTILE_ACTION,
    expectedHostname: env.TURNSTILE_EXPECTED_HOSTNAME ?? null,
    // Le formulaire est embarqué sur des domaines tiers : le nom d'hôte vu par
    // Turnstile est celui de l'iframe, pas celui du parent. On ne l'impose donc
    // pas ici — la liste des domaines autorisés est gardée par `frame-ancestors`.
    enforceHostname: false,
    allowEmptyAction: !isProduction,
  });
  if (!verification.ok) {
    console.error("Vérification Turnstile universelle refusée", { reason: verification.reason });
    return turnstileFailure;
  }

  try {
    const payload = buildUniversalPayload(request) as Json;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("submit_buyer_interest", { payload });

    if (error) {
      console.error("submit_buyer_interest (universel) a échoué", { code: error.code });
      return { ok: false, reason: "error", message: buyerFunnel.errors.generic };
    }

    const result = data as unknown as SubmitResult | null;
    if (!result || result.accepted !== true) {
      return { ok: false, reason: "error", message: buyerFunnel.errors.generic };
    }

    // Brochure : délivrée UNIQUEMENT contre l'identifiant d'un dépôt réel. Un
    // accusé neutre (bien inconnu, formulaire inactif) n'en porte aucune.
    let brochureUrl: string | null = null;
    if (result.created === true && typeof result.interest_id === "string") {
      const { data: url } = await supabase.rpc("buyer_form_brochure", {
        p_slug: request.slug,
        p_interest_id: result.interest_id,
      });
      if (typeof url === "string" && url.length > 0) brochureUrl = url;
    }

    return { ok: true, brochureUrl };
  } catch (cause) {
    console.error("submit_buyer_interest (universel) exception", {
      name: cause instanceof Error ? cause.name : "unknown",
    });
    return { ok: false, reason: "error", message: buyerFunnel.errors.generic };
  }
}
