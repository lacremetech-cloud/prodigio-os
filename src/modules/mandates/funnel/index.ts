/**
 * Module funnel Mandats — logique de capture (landing + analyse d'éligibilité).
 *
 * N'exporte ici que des éléments sûrs côté client et côté serveur (schémas,
 * contenu, normalisation, attribution, idempotence, construction de payload).
 * L'action serveur `submitMandateFunnelAction` s'importe directement depuis
 * `./submit` (fichier « use server »).
 */
export * from "./schema";
export * from "./content";
export * from "./normalize";
export * from "./attribution";
export * from "./idempotency";
export {
  buildSubmissionPayload,
  submissionRequestSchema,
  type SubmissionRequest,
  type SubmitResult,
} from "./payload";
