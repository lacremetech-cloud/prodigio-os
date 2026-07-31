/**
 * Aides monétaires **pures** (aucune dépendance serveur/navigateur), donc
 * testables. Les montants sont stockés en CENTIMES d'euro (entier fiable) et
 * affichés en euros au format français. Aucune valeur métier codée en dur.
 */

/**
 * Convertit une saisie utilisateur (« 850 000 », « 850000,50 », « 850 000 € »,
 * « 850.000 ») en centimes entiers. Renvoie `null` si vide, `undefined` si non
 * interprétable. Tolère espaces (dont insécables), séparateur de milliers et
 * virgule ou point décimal.
 */
export function parseEurosToCents(input: string | null | undefined): number | null | undefined {
  if (input == null) return null;
  const raw = String(input).trim();
  if (raw === "") return null;
  // Retire symbole €, apostrophes et TOUTES les espaces (\s couvre insécables et
  // fines) : en français, l'espace est un séparateur de milliers non ambigu.
  let cleaned = raw.replace(/[€’']/g, "").replace(/\s/g, "");
  if (cleaned === "") return null;
  // Deux séparateurs consécutifs = saisie malformée.
  if (/[.,]{2,}/.test(cleaned)) return undefined;

  const commaCount = (cleaned.match(/,/g) ?? []).length;
  const dotCount = (cleaned.match(/\./g) ?? []).length;

  // Un séparateur est « décimal » s'il est suivi de 1 à 2 chiffres seulement.
  const isDecimal = (sep: string): boolean => {
    const idx = cleaned.lastIndexOf(sep);
    const after = cleaned.length - idx - 1;
    return after >= 1 && after <= 2;
  };

  if (commaCount > 0 && dotCount > 0) {
    // Le dernier séparateur rencontré est décimal ; l'autre est un millier.
    const decimalSep = cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".") ? "," : ".";
    const thousandSep = decimalSep === "," ? "." : ",";
    cleaned = cleaned.split(thousandSep).join("").replace(decimalSep, ".");
  } else if (commaCount === 1 && isDecimal(",")) {
    cleaned = cleaned.replace(",", ".");
  } else if (commaCount >= 1) {
    cleaned = cleaned.split(",").join(""); // virgule(s) = milliers
  } else if (dotCount === 1 && isDecimal(".")) {
    // point décimal : rien à normaliser
  } else if (dotCount >= 1) {
    cleaned = cleaned.split(".").join(""); // point(s) = milliers
  }

  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return undefined;
  const euros = Number(cleaned);
  if (!Number.isFinite(euros) || euros < 0) return undefined;
  return Math.round(euros * 100);
}

/** Formate des centimes en euros au format français (« 850 000 € »). */
export function formatCentsToEuros(
  cents: number | null | undefined,
  options: { withDecimals?: boolean } = {},
): string {
  if (cents == null || !Number.isFinite(cents)) return "—";
  const euros = cents / 100;
  const hasCents = cents % 100 !== 0;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: options.withDecimals || hasCents ? 2 : 0,
    maximumFractionDigits: options.withDecimals || hasCents ? 2 : 0,
  }).format(euros);
}
