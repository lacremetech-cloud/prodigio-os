import { z } from "zod";
import { BUDGET_CHOICES_PROPOSES, budgetChoiceBounds, type BuyerBudgetChoice } from "./universal";

/**
 * LES TRANCHES DE BUDGET D'UN FORMULAIRE, BIEN PAR BIEN — fonctions pures.
 *
 * Chaque bien choisit, dans l'échelle commune, les tranches que son formulaire
 * propose : un chalet à 4 M€ ne pose pas la même question qu'un programme à
 * 500 000 €. « Non, je n'ai pas de projet » est TOUJOURS proposé, en premier :
 * c'est une réponse pleine, pas une tranche.
 *
 * La règle est celle de `public.pilotage_budget_erreur` (migration
 * 20261128150000), que la base tient pour autorité ; elle est reprise ici pour
 * répondre avant d'écrire, et pour qu'un réglage abîmé ne casse jamais le
 * formulaire public : il retombe alors sur les réponses d'aujourd'hui.
 *
 * Aucune de ces valeurs ne part chez Meta (docs/33 § 10).
 */

/** L'échelle commune : toutes les tranches qu'un formulaire peut proposer. */
export const TRANCHES_BUDGET = ["500k_1m", "plus_1m", "1m_2m", "2m_3m", "plus_3m"] as const satisfies readonly BuyerBudgetChoice[];
export type TrancheBudget = (typeof TRANCHES_BUDGET)[number];

export const NOMBRE_MAX_TRANCHES = 4;

export function estUneTranche(valeur: string): valeur is TrancheBudget {
  return (TRANCHES_BUDGET as readonly string[]).includes(valeur);
}

/** Sans réglage : les tranches que le formulaire propose depuis le 16/10/2026. */
export const TRANCHES_PAR_DEFAUT: readonly TrancheBudget[] = BUDGET_CHOICES_PROPOSES.filter((c: string) =>
  estUneTranche(c),
) as TrancheBudget[];

/** De la plus basse à la plus haute : borne basse, puis borne haute (ouverte en dernier). */
export function trierTranches(tranches: readonly TrancheBudget[]): TrancheBudget[] {
  const haut = (t: TrancheBudget) => budgetChoiceBounds(t).max ?? Number.POSITIVE_INFINITY;
  return [...tranches].sort((a, b) => budgetChoiceBounds(a).min! - budgetChoiceBounds(b).min! || haut(a) - haut(b));
}

/**
 * Ce qui ne va pas dans une liste de tranches, ou `null` si elle est valable :
 * connues, sans doublon, de la plus basse à la plus haute, sans trou ni
 * chevauchement, la dernière ouverte (« plus de … »). Mêmes phrases que la base.
 */
export function erreurDesTranches(tranches: readonly string[] | null | undefined): string | null {
  if (!tranches || tranches.length === 0) return "Choisissez au moins une tranche de budget.";
  if (tranches.length > NOMBRE_MAX_TRANCHES) return "Quatre tranches de budget au plus.";
  if (new Set(tranches).size !== tranches.length) return "Une tranche de budget est proposée deux fois.";
  let fin: number | null = null;
  let ouverte = false;
  for (const [i, t] of tranches.entries()) {
    if (!estUneTranche(t)) return "Tranche de budget inconnue.";
    if (ouverte) return "La tranche « plus de … » ferme la liste : rien ne vient après elle.";
    const { min, max } = budgetChoiceBounds(t);
    if (i > 0 && min !== fin) {
      return "Les tranches doivent se suivre, sans trou ni chevauchement, de la plus basse à la plus haute.";
    }
    fin = max;
    ouverte = max === null;
  }
  if (!ouverte) {
    return "La dernière tranche doit être ouverte (« plus de … ») : sinon les budgets au-dessus n’ont pas de réponse.";
  }
  return null;
}

/** Les cibles possibles : la borne basse de chaque tranche proposée, en centimes, croissantes. */
export function ciblesPossibles(tranches: readonly TrancheBudget[]): number[] {
  return [...new Set(tranches.map((t) => budgetChoiceBounds(t).min!))].sort((a, b) => a - b);
}

/** Ce qui ne va pas dans la cible d'une liste de tranches valable, ou `null`. */
export function erreurDeLaCible(tranches: readonly TrancheBudget[], cibleMinCentimes: number | null): string | null {
  if (cibleMinCentimes == null) return "Choisissez la cible.";
  if (!ciblesPossibles(tranches).includes(cibleMinCentimes)) {
    return "La cible doit être le bas d’une des tranches proposées.";
  }
  return null;
}

/** Tout le réglage : les tranches, puis la cible — dans l'ordre de la base. */
export function erreurDuReglage(tranches: readonly string[], cibleMinCentimes: number | null): string | null {
  return erreurDesTranches(tranches) ?? erreurDeLaCible(tranches as TrancheBudget[], cibleMinCentimes);
}

/**
 * Les tranches que la base renvoie au formulaire public, relues : une liste
 * valable, ou `null` — le formulaire garde alors ses réponses d'aujourd'hui.
 * Jamais d'exception : un réglage illisible ne doit pas faire perdre une demande.
 */
export function lireTranchesDuFormulaire(brut: unknown): TrancheBudget[] | null {
  const lu = z.array(z.string()).safeParse(brut);
  if (!lu.success || erreurDesTranches(lu.data) !== null) return null;
  return lu.data as TrancheBudget[];
}

/** Les réponses du formulaire, dans l'ordre : « pas de projet », puis les tranches du bien. */
export function reponsesDuFormulaire(tranches: readonly TrancheBudget[] | null): BuyerBudgetChoice[] {
  return ["aucun_projet", ...(tranches ?? TRANCHES_PAR_DEFAUT)];
}
