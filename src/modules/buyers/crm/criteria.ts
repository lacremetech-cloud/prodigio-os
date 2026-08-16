/**
 * Critères de recherche acquéreur : bornes de budget et formatage.
 *
 * ⚠️ Miroir EXACT de `public.buyer_band_bounds(text)` en base. Les bornes
 * reprennent celles déjà utilisées par le scoring acquéreur (`buyer-scoring-v1`)
 * — aucune nouvelle valeur économique n'est introduite ici, et rien n'est codé
 * en dur qui relèverait d'un paramètre configurable (seuil premium, partages,
 * base HT/TTC restent hors de ce module).
 *
 * Ces bornes servent uniquement à **amorcer** une fourchette de recherche à
 * partir d'une tranche déclarée au funnel. Elles sont ensuite **affinables par
 * un humain** : une saisie humaine n'est jamais écrasée par un nouvel intérêt.
 */

export interface BudgetBounds {
  /** Borne basse en centimes. `null` = non bornée. */
  minCents: number | null;
  /** Borne haute en centimes. `null` = non bornée. */
  maxCents: number | null;
}

/** Bornes indicatives d'une tranche de budget acquéreur (miroir SQL). */
export function budgetBandBounds(band: string | null | undefined): BudgetBounds {
  switch (band) {
    case "moins_800k":
      return { minCents: 0, maxCents: 80_000_000 };
    case "800k_1_2m":
      return { minCents: 80_000_000, maxCents: 120_000_000 };
    case "1_2m_2m":
      return { minCents: 120_000_000, maxCents: 200_000_000 };
    case "2m_3m":
      return { minCents: 200_000_000, maxCents: 300_000_000 };
    case "plus_3m":
      return { minCents: 300_000_000, maxCents: null };
    default:
      // « à définir » ou valeur inconnue : aucune fausse précision.
      return { minCents: null, maxCents: null };
  }
}

/** Euros → centimes (entier). `null` reste `null`. */
export function eurosToCents(euros: number | null | undefined): number | null {
  if (euros == null || !Number.isFinite(euros)) return null;
  return Math.round(euros * 100);
}

/** Centimes → euros. `null` reste `null`. */
export function centsToEuros(cents: number | null | undefined): number | null {
  if (cents == null || !Number.isFinite(cents)) return null;
  return cents / 100;
}

/** Montant en centimes formaté en euros (français), sans décimales. */
export function formatCents(cents: number | null | undefined): string | null {
  if (cents == null || !Number.isFinite(cents)) return null;
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return `${Math.round(cents / 100)} €`;
  }
}

/**
 * Fourchette de budget lisible. Distingue explicitement les bornes absentes
 * (« non renseigné ») d'une fourchette réelle : on n'invente jamais de borne.
 */
export function formatBudgetRange(
  minCents: number | null | undefined,
  maxCents: number | null | undefined,
): string {
  const min = formatCents(minCents);
  const max = formatCents(maxCents);
  if (min && max) return `${min} – ${max}`;
  if (min) return `À partir de ${min}`;
  if (max) return `Jusqu’à ${max}`;
  return "Budget non renseigné";
}

/**
 * Normalise une liste saisie librement (séparateurs virgule / point-virgule /
 * retour à la ligne) en tokens propres, dédoublonnés. Les localisations sont
 * mises en minuscules, comme en base, pour que la comparaison reste explicite.
 */
export function parseList(input: string, lowercase = false): string[] {
  const seen = new Set<string>();
  for (const raw of input.split(/[,;\n]/)) {
    const value = raw.trim();
    if (!value) continue;
    seen.add(lowercase ? value.toLowerCase() : value);
  }
  return [...seen];
}
