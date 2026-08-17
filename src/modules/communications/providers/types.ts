/**
 * Interfaces de transport. **Le domaine s'arrête ici.**
 *
 * Un adaptateur ne connaît ni contact, ni dossier, ni consentement, ni modèle :
 * il reçoit une adresse déjà résolue et un contenu déjà rendu, et rapporte un
 * résultat normalisé. Cette frontière est ce qui rend Lumail et Twilio
 * réellement remplaçables.
 */

import type { ErrorCode, ProviderKey } from "../types";

/** Résultat d'un envoi, normalisé — jamais un objet propriétaire. */
export type SendResult =
  | { ok: true; providerMessageId: string | null; providerStatus?: string | null }
  | { ok: false; errorCode: ErrorCode; detail?: string | null; status?: number | null };

export interface EmailSendInput {
  to: string;
  subject: string;
  body: string;
  bodyFormat: "markdown" | "html" | "texte";
  previewText?: string | null;
  replyTo?: string | null;
}

export interface SmsSendInput {
  /** Numéro au format E.164 (`+33…`), validé avant appel. */
  to: string;
  body: string;
}

export interface ProviderTransportOptions {
  /** Injecté dans les tests : garantit qu'aucune API réelle n'est appelée. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export interface EmailProvider {
  readonly key: ProviderKey;
  /** `false` si la configuration est absente : l'envoi est alors désactivé proprement. */
  isConfigured(): boolean;
  send(input: EmailSendInput, opts?: ProviderTransportOptions): Promise<SendResult>;
}

export interface SmsProvider {
  readonly key: ProviderKey;
  isConfigured(): boolean;
  send(input: SmsSendInput, opts?: ProviderTransportOptions): Promise<SendResult>;
}

/**
 * Traduit un statut HTTP en code d'erreur normalisé. Partagé par les adaptateurs
 * pour que le CRM n'affiche jamais deux vocabulaires différents.
 */
export function httpStatusToErrorCode(status: number): ErrorCode {
  if (status === 401 || status === 403) return "authentification_refusee";
  if (status === 404) return "destinataire_invalide";
  if (status === 422 || status === 400) return "destinataire_invalide";
  if (status === 429) return "limite_debit";
  if (status >= 500) return "indisponible";
  return "erreur_inconnue";
}

/**
 * Normalisation E.164 **conservatrice** : n'invente jamais un indicatif pour un
 * numéro international inconnu. Le préfixe national français `0X…` est converti
 * en `+33X…` — cas explicitement attendu pour la base de contacts actuelle.
 * Renvoie `null` si le numéro n'est pas exploitable en confiance.
 */
export function toE164(raw: string | null | undefined, defaultCountry: "FR" = "FR"): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[\s.\-()]/g, "");
  if (/^\+[1-9]\d{7,14}$/.test(cleaned)) return cleaned;
  if (defaultCountry === "FR" && /^0[1-9]\d{8}$/.test(cleaned)) {
    return `+33${cleaned.slice(1)}`;
  }
  if (/^00[1-9]\d{7,14}$/.test(cleaned)) return `+${cleaned.slice(2)}`;
  return null;
}
