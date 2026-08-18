/**
 * Point d'entrée du module **Communications**.
 *
 * Ce barillet n'exporte QUE les éléments indépendants des fournisseurs et sans
 * dépendance serveur. Les adaptateurs (`providers/lumail`, `providers/twilio`),
 * le dispatcher et les requêtes sont `server-only` : ils s'importent par leur
 * chemin explicite, de sorte qu'ils ne puissent jamais atterrir dans un bundle
 * navigateur.
 */

export * from "./types";
export * from "./events";
export * from "./labels";
export {
  evaluatePolicy,
  BLOCKED_REASON_LABELS,
  BLOCKED_REASON_HINTS,
  UNSETTLED_LEGAL_BASIS,
  type PolicyInput,
  type PrivacySignal,
  type SuppressionSignal,
} from "./policy";
export {
  renderTemplate,
  extractVariables,
  renderErrorLabel,
  type BodyFormat,
  type RenderInput,
  type RenderResult,
} from "./templates/render";
