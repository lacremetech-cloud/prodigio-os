/**
 * Action Cloudflare Turnstile propre au funnel Acquéreur. **Distincte** de
 * l'action Mandats afin qu'un jeton ne soit jamais rejouable d'un funnel à
 * l'autre (le contrôle d'action est fait à la vérification serveur).
 *
 * La vérification elle-même réutilise le module pur et testé du funnel Mandats
 * (`verifyTurnstileToken`) — aucune duplication de la logique anti-abus.
 */
export const BUYER_TURNSTILE_ACTION = "buyer_submission" as const;

export {
  verifyTurnstileToken,
  TURNSTILE_SITEVERIFY_URL,
  TURNSTILE_DEFAULT_TIMEOUT_MS,
} from "@/modules/mandates/funnel/turnstile";
export type {
  TurnstileVerification,
  TurnstileFailureReason,
} from "@/modules/mandates/funnel/turnstile";
