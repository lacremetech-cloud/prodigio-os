/**
 * Normalisation des coordonnées (téléphone, e-mail) et de texte libre.
 *
 * Objectif : conserver la saisie **brute** (preuve / RGPD) tout en produisant une
 * valeur **normalisée** stable pour le dédoublonnage. Aucune donnée personnelle
 * n'est journalisée ici ; ces fonctions sont pures et testables.
 */

import {
  isSupportedCountry,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

/** Pays par défaut du funnel (marché français). */
export const DEFAULT_PHONE_COUNTRY: CountryCode = "FR";

/** Normalise un e-mail : découpe, minuscule, validation basique. Null si invalide. */
export function normalizeEmail(input: string | null | undefined): string | null {
  if (!input) return null;
  const value = input.trim().toLowerCase();
  // Validation volontairement simple et robuste (une seule « @ », un point après).
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(value)) return null;
  return value;
}

/** Convertit une entrée de pays en `CountryCode` valide, ou le pays par défaut. */
export function resolvePhoneCountry(
  country: string | null | undefined,
): CountryCode {
  if (typeof country === "string") {
    const upper = country.toUpperCase();
    if (isSupportedCountry(upper)) return upper as CountryCode;
  }
  return DEFAULT_PHONE_COUNTRY;
}

/**
 * Normalise un numéro de téléphone au format **E.164** (`+33625773592`) via
 * `libphonenumber-js` (fondé sur libphonenumber de Google). Le pays sélectionné
 * permet d'interpréter une saisie **nationale** (ex. « 06 25 77 35 92 » avec la
 * France). Retourne `null` si le numéro n'est pas un numéro **valide** pour le
 * pays donné (validation réelle, pas seulement une longueur plausible).
 */
export function normalizePhone(
  input: string | null | undefined,
  country: string | null | undefined = DEFAULT_PHONE_COUNTRY,
): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;

  const parsed = parsePhoneNumberFromString(trimmed, resolvePhoneCountry(country));
  if (parsed && parsed.isValid()) return parsed.number; // format E.164
  return null;
}

/** Vrai si l'entrée est un numéro **valide** pour le pays donné. */
export function isValidPhone(
  input: string | null | undefined,
  country: string | null | undefined = DEFAULT_PHONE_COUNTRY,
): boolean {
  return normalizePhone(input, country) !== null;
}

/** Nettoie un texte libre court (espaces multiples, bornage de longueur). */
export function normalizeText(
  input: string | null | undefined,
  maxLength = 200,
): string | null {
  if (!input) return null;
  const value = input.replace(/\s+/g, " ").trim();
  if (value.length === 0) return null;
  return value.slice(0, maxLength);
}

/** Normalise un code postal (chiffres/lettres, majuscules, sans espaces superflus). */
export function normalizePostalCode(
  input: string | null | undefined,
): string | null {
  if (!input) return null;
  const value = input.replace(/\s+/g, " ").trim().toUpperCase();
  return value.length === 0 ? null : value.slice(0, 16);
}
