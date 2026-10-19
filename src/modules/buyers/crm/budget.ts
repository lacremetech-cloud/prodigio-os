import type { BuyerInboxRow } from "./queries";
import { BUDGET_CHOICE_COURT, type BuyerBudgetChoice } from "@/modules/buyers/funnel/universal";
import { budgetBandLabels } from "@/modules/buyers/funnel/content";

/**
 * LES TRANCHES DE BUDGET, ET LE PREDICAT QUI LES APPLIQUE.
 *
 * Elles vivaient dans la boite de reception, un composant « use client ». La
 * page pipeline est un composant SERVEUR : elle ne pouvait pas filtrer avec
 * les memes tranches sans tirer tout le composant derriere elle. Un module
 * pur, et les deux vues partagent le meme vocabulaire — c'est ce qui empeche
 * « plus d'1 M€ » de vouloir dire deux choses selon l'ecran.
 */
/**
 * LE FILTRE PORTE SUR LA RÉPONSE DONNÉE, PAS SUR UNE FOURCHETTE SAISIE.
 *
 * Il recoupait auparavant `budget_min_cents` / `budget_max_cents`, qui ne sont
 * renseignés QUE si un commercial saisit les critères de recherche à la main
 * dans la fiche. Personne ne l'a jamais fait : les 76 dépôts ont ces deux
 * bornes à NULL, et la fonction de recoupement écartait d'office toute ligne
 * sans fourchette. Le filtre ne renvoyait donc RIEN, quelle que soit la
 * tranche choisie — sans que rien à l'écran ne le dise.
 *
 * Les tranches proposées étaient en plus celles de l'ancien tunnel
 * (« < 800 k€ », « 800 k€ – 1,2 M€ »), alors que le formulaire ne pose plus
 * que trois réponses. Filtrer sur ce qui n'est plus demandé.
 *
 * Désormais on filtre sur `budgetChoice` : exactement ce que la personne a
 * répondu, et exactement ce que la colonne « Budget déclaré » affiche.
 *
 * Les libellés viennent de `BUDGET_CHOICE_COURT`, source unique : le filtre ne
 * peut donc plus annoncer autre chose que la colonne.
 *
 * Les tranches qui ne sont PLUS proposées (1–2 M€, 2–3 M€, plus de 3 M€) sont
 * repliées sur « Plus d'1 M€ » : cinq dossiers les portent encore, et ils
 * doivent rester atteignables.
 *
 * « Sans réponse » existe pour que les options COUVRENT toutes les lignes :
 * une fiche qu'aucun filtre ne peut atteindre est une fiche perdue, et c'est
 * précisément le défaut qu'on corrige ici.
 */
export const BUDGET_FILTERS: ReadonlyArray<{
  value: string;
  label: string;
  /** Valeurs retenues. `null` = toutes ; tableau vide = budget non renseigné. */
  choix: readonly string[] | null;
}> = [
  { value: "tous", label: "Tous budgets", choix: null },
  { value: "aucun_projet", label: BUDGET_CHOICE_COURT.aucun_projet, choix: ["aucun_projet"] },
  { value: "500k_1m", label: BUDGET_CHOICE_COURT["500k_1m"], choix: ["500k_1m"] },
  {
    value: "plus_1m",
    label: BUDGET_CHOICE_COURT.plus_1m,
    choix: ["plus_1m", "1m_2m", "2m_3m", "plus_3m"],
  },
  { value: "sans_reponse", label: "Sans réponse", choix: [] },
];

export function budgetCorrespond(row: BuyerInboxRow, filtre: string): boolean {
  const f = BUDGET_FILTERS.find((b) => b.value === filtre);
  if (!f || f.choix === null) return true;
  if (f.choix.length === 0) return !row.budgetChoice;
  return !!row.budgetChoice && f.choix.includes(row.budgetChoice);
}

/**
 * CE QU'ON AFFICHE DANS LA COLONNE « BUDGET DECLARE ».
 *
 * Trois cas, dans cet ordre :
 *   1. la reponse au formulaire actuel, forme courte ;
 *   2. a defaut, l'ancienne tranche, avec SON libelle — pas converti ;
 *   3. a defaut, rien.
 *
 * La conversion est refusee a dessein : « 800 k€ – 1,2 M€ » chevauche le
 * million, le ranger d'un cote ou de l'autre inventerait une reponse que
 * personne n'a donnee. Mieux vaut afficher ce qui a ete dit.
 */
export function libelleBudget(row: {
  budgetChoice: string | null;
  budgetBand?: string | null;
}): string | null {
  if (row.budgetChoice) {
    return BUDGET_CHOICE_COURT[row.budgetChoice as BuyerBudgetChoice] ?? row.budgetChoice;
  }
  if (row.budgetBand) {
    return budgetBandLabels[row.budgetBand as keyof typeof budgetBandLabels] ?? row.budgetBand;
  }
  return null;
}
