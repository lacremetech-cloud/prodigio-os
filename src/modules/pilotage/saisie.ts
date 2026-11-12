/**
 * Lecture des saisies françaises du pilotage — fonctions pures, partagées par
 * les formulaires (pour signaler une faute tout de suite) et testées.
 *
 * Convention de retour, la même que `parseEurosToCents` :
 *   `null`      → champ vide (la donnée manque, et c'est permis) ;
 *   `undefined` → saisie illisible (on refuse, on ne devine pas).
 */

export { parseEurosToCents } from "@/modules/mandates/lifecycle/money";

/**
 * Un pourcentage : « 3,75 », « 3.75 », « 3,75 % », « 70 ». Au plus
 * `maxDecimales` décimales — la précision de la colonne en base.
 */
export function parsePourcentage(
  saisie: string | null | undefined,
  maxDecimales: number,
): number | null | undefined {
  if (saisie == null) return null;
  const brut = saisie.replace(/\s/g, "").replace(/%$/, "");
  if (brut === "") return null;
  const m = /^(\d{1,3})(?:[.,](\d+))?$/.exec(brut);
  if (!m) return undefined;
  const decimales = m[2] ?? "";
  if (decimales.length > maxDecimales) return undefined;
  const n = Number(`${m[1]}.${decimales || "0"}`);
  return Number.isFinite(n) && n <= 100 ? n : undefined;
}

/** Une date « AAAA-MM-JJ » réelle (pas un 31 février). */
export function estUnJour(valeur: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valeur)) return false;
  const d = new Date(`${valeur}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valeur;
}

/** Vrai si `x` n'a pas plus de `k` décimales (tolérance de l'écriture binaire). */
export function auPlusDecimales(x: number, k: number): boolean {
  const echelle = 10 ** k;
  return Math.abs(Math.round(x * echelle) - x * echelle) < 1e-6;
}
