/**
 * Module funnel Mandats — logique de capture (landing + analyse d'éligibilité).
 *
 * N'exporte ici que des éléments sûrs côté client et côté serveur (schémas,
 * contenu, normalisation, attribution, idempotence, construction de payload).
 * L'action serveur `submitMandateFunnelAction` s'importe directement depuis
 * `./submit` (fichier « use server »).
 */
export * from "./schema";
export * from "./validate";
export * from "./content";
export * from "./normalize";
export * from "./attribution";
export * from "./idempotency";
export {
  buildSubmissionPayload,
  submissionRequestSchema,
  submitActionInputSchema,
  type SubmissionRequest,
  type SubmitActionInput,
  type SubmitResult,
} from "./payload";
export {
  TURNSTILE_ACTION,
  TURNSTILE_SITEVERIFY_URL,
  TURNSTILE_DEFAULT_TIMEOUT_MS,
  verifyTurnstileToken,
  type TurnstileVerification,
  type TurnstileFailureReason,
  type VerifyTurnstileOptions,
  type SiteverifyResponse,
} from "./turnstile";
