/**
 * QUI MERITE QU'ON LES DERANGE SUR LE CHAMP.
 *
 * Mesure du 22 octobre, sur les neuf jours suivant la reprise : douze leads
 * par jour, donc douze mails par personne. Antoine et JC ne lisaient plus
 * rien — une alerte qu'on n'ouvre pas ne vaut pas mieux que pas d'alerte, on
 * l'a deja paye le 14 octobre.
 *
 * La reponse n'est pas « moins d'alertes » mais « deux niveaux » : le mail
 * immediat pour le lead ou decrocher dans les dix minutes rapporte vraiment,
 * le recapitulatif trois fois par jour pour l'inventaire. Ce module ne decide
 * que du premier niveau.
 */

import { BUDGET_FILTERS } from "@/modules/buyers/crm/budget";

/**
 * LES BUDGETS QUI JUSTIFIENT L'INTERRUPTION.
 *
 * Volontairement une liste ECRITE, et non `BUDGET_FILTERS.find(...)` evalue au
 * chargement : si le filtre du CRM etait renomme, `find` rendrait `undefined`,
 * la liste serait vide, et PLUS AUCUNE alerte immediate ne partirait — en
 * silence. C'est exactement la panne qu'on a eue avec `acquereur_etape`.
 *
 * La coherence avec le filtre « Plus d'1 M€ » du CRM est donc garantie par un
 * test, pas par une indirection. Si les deux divergent, le test casse.
 *
 * Les anciennes tranches du tunnel historique n'y figurent pas : `budget.ts`
 * refuse deja de les convertir, parce que « 800 k€ – 1,2 M€ » chevauche le
 * million et que les ranger d'un cote inventerait une reponse jamais donnee.
 */
export const BUDGETS_AU_DESSUS_1M: readonly string[] = [
  "plus_1m",
  "1m_2m",
  "2m_3m",
  "plus_3m",
];

/** Le filtre du CRM, pour que le test puisse comparer les deux. */
export const BUDGETS_AU_DESSUS_1M_SELON_LE_CRM: readonly string[] =
  BUDGET_FILTERS.find((b) => b.value === "plus_1m")?.choix ?? [];

/**
 * Bornes de la journee de travail, heure de Paris.
 *
 * Pas de regle de week-end : sur une villa a Cassis, un acquereur qui depose
 * le dimanche a 15h vaut un appel le dimanche a 15h.
 */
export const HEURE_OUVERTURE = 8;
export const HEURE_FERMETURE = 19;

const HEURE_PARIS = new Intl.DateTimeFormat("fr-FR", {
  hour: "numeric",
  hour12: false,
  timeZone: "Europe/Paris",
});

/**
 * L'heure locale a Paris, quelle que soit celle du serveur.
 *
 * `Intl` plutot qu'un decalage fixe : le 25 octobre on repasse en heure
 * d'hiver, et un `+2` code en dur se tromperait d'une heure a partir de ce
 * jour-la sans que rien ne le signale.
 */
export function heureParis(d: Date): number {
  const brut = HEURE_PARIS.format(d);
  const n = Number.parseInt(brut.replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n % 24 : 0;
}

export function dansLesHoraires(d: Date): boolean {
  const h = heureParis(d);
  return h >= HEURE_OUVERTURE && h < HEURE_FERMETURE;
}

export function budgetAuDessusDe1M(budgetChoice: string | null | undefined): boolean {
  return !!budgetChoice && BUDGETS_AU_DESSUS_1M.includes(budgetChoice);
}

export interface CritereUrgence {
  budgetChoice: string | null;
  recuLe: Date;
}

/**
 * `tous` rend TOUJOURS vrai : c'est le comportement historique, et le defaut.
 * Le filtre ne s'applique que lorsqu'on l'a explicitement demande, une fois le
 * recapitulatif en service.
 */
export function meriteAlerteImmediate(
  lead: CritereUrgence,
  politique: "tous" | "urgents",
): boolean {
  if (politique === "tous") return true;
  return budgetAuDessusDe1M(lead.budgetChoice) && dansLesHoraires(lead.recuLe);
}
