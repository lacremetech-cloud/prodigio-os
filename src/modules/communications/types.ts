/**
 * Vocabulaire du domaine **Communications**.
 *
 * ⚠️ Aucun type ici ne dépend de Lumail ni de Twilio. Les fournisseurs sont des
 * VALEURS (`ProviderKey`), jamais des structures : remplacer un fournisseur ne
 * doit invalider ni un dossier, ni un consentement, ni un modèle.
 *
 * Quatre notions distinctes, à ne jamais confondre :
 *   • **catégorie** (`transactionnel` / `marketing`) — nature juridique ;
 *   • **statut** du message — où il en est ;
 *   • **motif de blocage** — décision de la POLITIQUE (jamais du fournisseur) ;
 *   • **code d'erreur** — échec TECHNIQUE, normalisé, indépendant du fournisseur.
 */

/** Canaux sortants adressés à un CONTACT. Slack et Supabase Auth n'en sont pas. */
export const CHANNELS = ["email", "sms"] as const;
export type Channel = (typeof CHANNELS)[number];

/**
 * Catégorie **juridiquement structurante**.
 * `transactionnel` : répond à une demande de la personne ou exécute un service.
 * `marketing` : finalité distincte, exigeant une base légale établie.
 */
export const CATEGORIES = ["transactionnel", "marketing"] as const;
export type Category = (typeof CATEGORIES)[number];

/** Cycle de vie d'un message. `bloque` ≠ `echec` : l'un est une décision, l'autre une panne. */
export const MESSAGE_STATUSES = [
  "planifie",
  "en_attente",
  "envoye",
  "livre",
  "echec",
  "bloque",
  "annule",
] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

/** Statuts d'une ligne d'outbox. */
export const OUTBOX_STATUSES = [
  "en_attente",
  "en_cours",
  "traite",
  "ignore",
  "echec",
  "abandonne",
] as const;
export type OutboxStatus = (typeof OUTBOX_STATUSES)[number];

/**
 * Motifs de blocage décidés par la **politique**. Aucun ne provient d'un
 * fournisseur : ce sont des décisions de Prodigio, explicables à un utilisateur.
 */
export const BLOCKED_REASONS = [
  "coordonnee_absente",
  "ne_plus_contacter",
  "opposition_active",
  "base_legale_insuffisante",
  "canal_non_autorise",
  "modele_absent",
  "modele_inactif",
  "google_couvre_l_envoi",
  "envoi_desactive",
] as const;
export type BlockedReason = (typeof BLOCKED_REASONS)[number];

/**
 * Codes d'erreur **normalisés**. Chaque adaptateur traduit ses propres codes
 * vers cette liste : le CRM n'affiche jamais un code propriétaire brut.
 */
export const ERROR_CODES = [
  "configuration_absente",
  "authentification_refusee",
  "destinataire_invalide",
  "domaine_non_verifie",
  "limite_debit",
  "indisponible",
  "delai_depasse",
  "rejet_permanent",
  "erreur_inconnue",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/** Un réessai n'a de sens que sur une cause **transitoire**. */
export const RETRYABLE_ERROR_CODES: readonly ErrorCode[] = [
  "limite_debit",
  "indisponible",
  "delai_depasse",
];

export function isRetryable(code: ErrorCode | null | undefined): boolean {
  return code != null && RETRYABLE_ERROR_CODES.includes(code);
}

/** Fournisseurs connus. `aucun` couvre le mode simulation (aucun appel réseau). */
export const PROVIDERS = ["lumail", "twilio", "aucun"] as const;
export type ProviderKey = (typeof PROVIDERS)[number];

/** Les SIX événements métier couverts par la V1 (voir docs/21 §4). */
export const COMMUNICATION_EVENTS = [
  "demande_mandat_enregistree",
  "interet_acquereur_enregistre",
  "estimation_planifiee",
  "estimation_reportee",
  "estimation_annulee",
  "estimation_rappel",
] as const;
export type CommunicationEvent = (typeof COMMUNICATION_EVENTS)[number];

/** Statuts de modèle et d'automatisation. */
export type TemplateStatus = "brouillon" | "actif" | "archive";
export type AutomationStatus = "brouillon" | "actif" | "en_pause" | "archive";

/** Portée et motifs d'une opposition. */
export type SuppressionScope = "marketing" | "transactionnel" | "tout";
export type SuppressionChannel = Channel | "tout";
export const SUPPRESSION_REASONS = [
  "rebond_definitif",
  "plainte",
  "desinscription",
  "demande_personne",
  "erreur_permanente",
  "decision_interne",
] as const;
export type SuppressionReason = (typeof SUPPRESSION_REASONS)[number];

/** Décision d'éligibilité — miroir du retour de `crm_comm_eligibility`. */
export interface EligibilityDecision {
  allowed: boolean;
  reason: BlockedReason | null;
}

export function isChannel(value: unknown): value is Channel {
  return typeof value === "string" && (CHANNELS as readonly string[]).includes(value);
}

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}
