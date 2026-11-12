/**
 * Mise en forme des chiffres du pilotage. C'est ICI, et seulement ici, que les
 * montants exacts sont arrondis : à l'euro pour les commissions (comme dans le
 * cockpit validé par Victor), au centime pour un coût saisi.
 */

import { decimal, eurosArrondis, type Exact } from "./exact";
import type { Montant, Total } from "./commission";
import { manqueLabels } from "./labels";

const euros = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const eurosAuCentime = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Des centimes exacts, à l'euro près : « 29 518 € ». */
export function formatEurosExact(centimes: Exact): string {
  return euros.format(eurosArrondis(centimes));
}

/** Un montant calculé, ou ce qui l'empêche : « 29 518 € » / « manquant : … ». */
export function formatMontant(m: Montant): string {
  return m.ok ? formatEurosExact(m.centimes) : `manquant — ${manqueLabels[m.manque]}`;
}

/** Un total, honnête sur ce qui lui manque. */
export function formatTotal(t: Total): string {
  const valeur = formatEurosExact(t.centimes);
  if (t.complet) return valeur;
  const lignes = t.absents === 1 ? "1 ligne manque" : `${t.absents} lignes manquent`;
  return `au moins ${valeur} (${lignes})`;
}

/** Des centimes entiers saisis (un coût, un prix), sans arrondi : « 3 500 € » / « 3 500,50 € ». */
export function formatCentimes(centimes: number | null | undefined): string {
  if (centimes == null || !Number.isFinite(centimes)) return "manquant";
  const fmt = centimes % 100 === 0 ? euros : eurosAuCentime;
  return fmt.format(centimes / 100);
}

/** Un pourcentage lu en base : « 3,75 % », « 70 % ». */
export function formatPourcentage(valeur: number | string | null | undefined, maxDecimales = 4): string {
  const x = decimal(valeur, maxDecimales);
  if (!x) return "manquant";
  const n = Number(x.n) / Number(x.d);
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: maxDecimales }).format(n)} %`;
}

/** Un pourcentage en champ de formulaire : « 3,75 ». */
export function pourcentagePourSaisie(valeur: number | string | null | undefined, maxDecimales = 4): string {
  const x = decimal(valeur, maxDecimales);
  if (!x) return "";
  const n = Number(x.n) / Number(x.d);
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: maxDecimales, useGrouping: false }).format(n);
}

/**
 * Des centimes en champ de formulaire : « 1 250 000 » / « 3 500,5 ». Les
 * espaces de milliers se relisent sans peine (`parseEurosToCents` les ignore).
 */
export function centimesPourSaisie(centimes: number | null | undefined): string {
  if (centimes == null || !Number.isFinite(centimes)) return "";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(centimes / 100);
}
