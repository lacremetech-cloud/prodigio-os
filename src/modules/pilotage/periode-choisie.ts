/**
 * La période choisie sur la page Pilotage, lue dans l'adresse — validée, jamais
 * crue sur parole : `?periode=7_derniers_jours`, ou `?du=AAAA-MM-JJ&au=AAAA-MM-JJ`
 * pour des dates au choix. Une valeur illisible retombe sur la période par
 * défaut, et l'écran le dit.
 */

import { z } from "zod";
import { PERIODES, type Periode } from "./meta/periodes";
import type { ChoixPeriode } from "./tableau";

export const PERIODE_PAR_DEFAUT: Periode = "30_derniers_jours";

const jourIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((j) => {
  const d = new Date(`${j}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === j;
});

export interface PeriodeLue {
  choix: ChoixPeriode;
  /** Vrai si l'adresse demandait autre chose qu'on n'a pas pu lire. */
  corrigee: boolean;
}

type Parametres = Record<string, string | string[] | undefined>;

function premier(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function lirePeriode(parametres: Parametres, aujourdHui: string): PeriodeLue {
  const du = premier(parametres.du);
  const au = premier(parametres.au);
  if (du !== undefined || au !== undefined) {
    const d = jourIso.safeParse(du);
    const a = jourIso.safeParse(au);
    if (d.success && a.success && d.data <= a.data && a.data <= aujourdHui) {
      return { choix: { type: "dates", debut: d.data, fin: a.data }, corrigee: false };
    }
    return { choix: { type: "proposee", periode: PERIODE_PAR_DEFAUT }, corrigee: true };
  }
  const p = premier(parametres.periode);
  if (p === undefined) return { choix: { type: "proposee", periode: PERIODE_PAR_DEFAUT }, corrigee: false };
  if ((PERIODES as readonly string[]).includes(p)) return { choix: { type: "proposee", periode: p as Periode }, corrigee: false };
  return { choix: { type: "proposee", periode: PERIODE_PAR_DEFAUT }, corrigee: true };
}

/** L'adresse d'une page pour une période donnée. */
export function adressePeriode(chemin: string, choix: ChoixPeriode): string {
  const q = choix.type === "dates" ? `du=${choix.debut}&au=${choix.fin}` : `periode=${choix.periode}`;
  return `${chemin}?${q}`;
}
