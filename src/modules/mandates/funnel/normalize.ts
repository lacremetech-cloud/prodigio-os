/**
 * Normalisation des coordonnées (téléphone, e-mail) et de texte libre.
 *
 * Objectif : conserver la saisie **brute** (preuve / RGPD) tout en produisant une
 * valeur **normalisée** stable pour le dédoublonnage. Aucune donnée personnelle
 * n'est journalisée ici ; ces fonctions sont pures et testables.
 */

/** Normalise un e-mail : découpe, minuscule, validation basique. Null si invalide. */
export function normalizeEmail(input: string | null | undefined): string | null {
  if (!input) return null;
  const value = input.trim().toLowerCase();
  // Validation volontairement simple et robuste (une seule « @ », un point après).
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(value)) return null;
  return value;
}

/**
 * Normalise un numéro de téléphone, en privilégiant le format français.
 * - Conserve un « + » international s'il est fourni.
 * - « 00 » international → « + ».
 * - Numéro national à 10 chiffres commençant par 0 → « +33 » + reste.
 * Retourne une forme type E.164 simplifiée, ou null si manifestement invalide.
 */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;

  const hasPlus = trimmed.startsWith("+");
  // Ne conserver que les chiffres.
  let digits = trimmed.replace(/\D/g, "");
  if (digits.length === 0) return null;

  if (hasPlus) {
    // Déjà international : « +CC……… ».
    if (digits.length < 8 || digits.length > 15) return null;
    return `+${digits}`;
  }

  // « 00 » → indicatif international.
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
    if (digits.length < 8 || digits.length > 15) return null;
    return `+${digits}`;
  }

  // Numéro national français : 10 chiffres commençant par 0.
  if (digits.length === 10 && digits.startsWith("0")) {
    return `+33${digits.slice(1)}`;
  }

  // 9 chiffres sans le 0 initial (ex. « 612345678 ») → suppose la France.
  if (digits.length === 9 && !digits.startsWith("0")) {
    return `+33${digits}`;
  }

  // Autres cas plausibles (numéro étranger saisi sans « + »).
  if (digits.length >= 8 && digits.length <= 15) {
    return `+${digits}`;
  }

  return null;
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
