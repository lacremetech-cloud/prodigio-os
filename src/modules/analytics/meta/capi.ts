import { env, isMetaCapiConfigured } from "@/config";
import {
  buildFbc,
  hashCity,
  hashCountry,
  hashEmail,
  hashName,
  hashPhone,
} from "./hash";

/**
 * API de conversions Meta — envoi **serveur** des conversions.
 *
 * Pourquoi côté serveur plutôt que par le pixel navigateur : les bloqueurs, le
 * refus des cookies tiers et iOS font disparaître une part importante des
 * événements navigateur. Ici, une conversion est émise au moment où elle a
 * réellement lieu dans le CRM — une demande déposée, un dossier qualifié, une
 * visite planifiée — et non quand un script a pu s'exécuter.
 *
 * Trois règles tenues partout dans ce module :
 *
 *  • **Rien ne part en clair.** E-mail, téléphone et nom sont normalisés puis
 *    hachés (voir `hash.ts`). Seules les empreintes quittent le serveur.
 *  • **Un échec ici n'a aucune conséquence métier.** Une mesure publicitaire ne
 *    doit jamais faire échouer un dépôt ni une action du CRM : la fonction
 *    n'émet pas d'exception et se contente d'un avertissement.
 *  • **Chaque événement porte un `event_id` déterministe**, pour que Meta
 *    dédoublonne de lui-même si le même fait est signalé deux fois (nouvel
 *    essai, double clic, ou pixel navigateur ajouté plus tard).
 */

const META_API_VERSION = "v21.0";
const TIMEOUT_MS = 4000;

/**
 * Les événements suivis, dans le vocabulaire standard de Meta.
 *
 * `PageView` est d'une autre nature que les trois autres : il ne rapporte
 * aucun fait commercial, seulement qu'une page a été vue. Il donne le
 * DÉNOMINATEUR — sans lui, on connaît le nombre de demandes sans jamais savoir
 * combien de visites il a fallu pour les obtenir.
 */
export type MetaEventName = "PageView" | "Lead" | "CompleteRegistration" | "Schedule";

export interface MetaIdentity {
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  city?: string | null;
  /** Code ISO 3166-1 alpha-2, p. ex. `FR`. */
  country?: string | null;
  /** `fbclid` relevé sur l'URL d'arrivée, converti en cookie `_fbc`. */
  fbclid?: string | null;
  /** Date du clic publicitaire, pour horodater le `_fbc`. */
  clickedAt?: Date | string | null;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
}

export interface MetaConversion {
  eventName: MetaEventName;
  /** Identifiant stable du fait rapporté : c'est lui qui dédoublonne. */
  eventId: string;
  /** Moment du fait. Meta refuse au-delà de 7 jours dans le passé. */
  eventTime?: Date;
  eventSourceUrl?: string | null;
  identity: MetaIdentity;
  customData?: Record<string, unknown>;
}

export type MetaSendOutcome =
  | { sent: true }
  | { sent: false; reason: "non_configure" | "sans_correspondance" | "refus" | "erreur" };

/**
 * Construit le bloc `user_data`. Exporté pour être testable sans réseau : c'est
 * la partie où une erreur est invisible à l'œil nu et coûte toute la
 * correspondance.
 */
export function buildUserData(identity: MetaIdentity): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  const em = hashEmail(identity.email);
  const ph = hashPhone(identity.phone);
  const fn = hashName(identity.firstName);
  const ln = hashName(identity.lastName);
  const ct = hashCity(identity.city);
  const country = hashCountry(identity.country);
  // Meta attend un tableau pour les champs hachés (plusieurs valeurs possibles).
  if (em) data.em = [em];
  if (ph) data.ph = [ph];
  if (fn) data.fn = [fn];
  if (ln) data.ln = [ln];
  if (ct) data.ct = [ct];
  if (country) data.country = [country];

  // Ces trois-là partent en clair : Meta les attend ainsi, et ce ne sont pas
  // des identifiants nominatifs.
  const fbc = buildFbc(identity.fbclid, identity.clickedAt);
  if (fbc) data.fbc = fbc;
  if (identity.clientIpAddress) data.client_ip_address = identity.clientIpAddress;
  if (identity.clientUserAgent) data.client_user_agent = identity.clientUserAgent;
  return data;
}

/** Un événement sans aucun signal de correspondance ne sert à rien : Meta ne peut l'attribuer. */
export function hasMatchSignal(userData: Record<string, unknown>): boolean {
  return Boolean(userData.em || userData.ph || userData.fbc);
}

/**
 * Un visiteur anonyme n'a ni e-mail ni téléphone à offrir, et s'il n'est pas
 * venu d'une publicité il n'a pas non plus de `fbclid`. Exiger de `PageView`
 * les mêmes clés que d'une conversion commerciale reviendrait à ne jamais
 * l'envoyer — c'est-à-dire à ne jamais connaître le dénominateur.
 *
 * Ses clés à lui sont l'adresse IP et le navigateur, que Meta accepte comme
 * telles. La correspondance est faible, et c'est normal : on ne cherche pas à
 * reconnaître quelqu'un, on cherche à compter. Les trois conversions
 * commerciales, elles, gardent l'exigence stricte.
 */
export function peutEtreRattache(
  eventName: MetaEventName,
  userData: Record<string, unknown>,
): boolean {
  if (hasMatchSignal(userData)) return true;
  if (eventName !== "PageView") return false;
  return Boolean(userData.client_ip_address && userData.client_user_agent);
}

export function buildEventPayload(conversion: MetaConversion): Record<string, unknown> {
  const userData = buildUserData(conversion.identity);
  const event: Record<string, unknown> = {
    event_name: conversion.eventName,
    event_time: Math.floor((conversion.eventTime ?? new Date()).getTime() / 1000),
    event_id: conversion.eventId,
    action_source: "website",
    user_data: userData,
  };
  if (conversion.eventSourceUrl) event.event_source_url = conversion.eventSourceUrl;
  if (conversion.customData && Object.keys(conversion.customData).length > 0) {
    event.custom_data = conversion.customData;
  }
  return event;
}

/**
 * Envoie une conversion. Ne lève jamais : renvoie la raison d'un non-envoi.
 * Hors production ou sans configuration, l'appel est simplement ignoré — le
 * CRM fonctionne à l'identique.
 */
export async function envoyerConversionMeta(
  conversion: MetaConversion,
): Promise<MetaSendOutcome> {
  if (!isMetaCapiConfigured()) return { sent: false, reason: "non_configure" };

  const event = buildEventPayload(conversion);
  const userData = event.user_data as Record<string, unknown>;
  if (!peutEtreRattache(conversion.eventName, userData)) {
    // Sans e-mail, téléphone ni `fbclid`, l'événement serait compté sans jamais
    // être rattaché à une personne : mieux vaut ne rien envoyer et le dire.
    console.warn("conversion Meta sans signal de correspondance", {
      event: conversion.eventName,
    });
    return { sent: false, reason: "sans_correspondance" };
  }

  const body: Record<string, unknown> = { data: [event] };
  if (env.META_CAPI_TEST_EVENT_CODE) body.test_event_code = env.META_CAPI_TEST_EVENT_CODE;

  const url =
    `https://graph.facebook.com/${META_API_VERSION}/` +
    `${encodeURIComponent(String(env.META_CAPI_PIXEL_ID))}/events`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // Le jeton voyage en en-tête, jamais dans l'URL : une URL se retrouve
        // dans les journaux d'accès, pas un en-tête.
        authorization: `Bearer ${env.META_CAPI_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) {
      // Le corps d'erreur de Meta peut citer la requête : on ne journalise que
      // le statut, jamais la réponse, pour ne pas recopier d'empreintes.
      console.warn("conversion Meta refusée", {
        event: conversion.eventName,
        status: response.status,
      });
      return { sent: false, reason: "refus" };
    }
    return { sent: true };
  } catch (cause) {
    console.warn("conversion Meta non transmise", {
      event: conversion.eventName,
      name: cause instanceof Error ? cause.name : "unknown",
    });
    return { sent: false, reason: "erreur" };
  }
}
