import type { BuyerInboxRow } from "./queries";
import { QUALIFICATIONS } from "./vocabulaire";

/**
 * LE NIVEAU DE QUALIFICATION, COMME TROISIÈME AXE DE FILTRAGE.
 *
 * Trois axes, trois rangées, qui se croisent : l'étape et le signal de travail
 * (« à rappeler », « en retard »), la tranche de budget, et maintenant le
 * jugement porté sur la personne. On veut « les plus d'1 M€ qui sont encore à
 * qualifier », pas choisir entre les trois.
 *
 * Module PUR, comme `budget.ts` et pour la même raison : la page pipeline est
 * un composant serveur, la boîte de réception un composant client. Les deux
 * doivent appliquer le MÊME prédicat, sinon « qualifié » finit par vouloir
 * dire deux choses selon l'écran — c'est exactement ce qui avait produit
 * « 10 dans le pipeline » en face de « 8 dans la liste ».
 *
 * Les libellés viennent de `QUALIFICATIONS`, seul endroit où ils sont écrits :
 * la pastille ne peut donc pas annoncer autre chose que le badge de la carte.
 *
 * ATTENTION À NE PAS CONFONDRE AVEC « FORT POTENTIEL », sur la première
 * rangée. Celle-là porte sur `recommended_priority`, un score CALCULÉ. Celle-ci
 * porte sur « Gros potentiel », un jugement POSÉ par quelqu'un qui a eu la
 * personne au téléphone. Deux choses différentes, et les deux valent
 * actuellement zéro — le score n'a jamais désigné personne, et la
 * qualification n'a jamais été posée.
 */
export const QUALIFICATION_FILTERS: ReadonlyArray<{
  value: string;
  label: string;
  /** `null` = toutes les qualifications. */
  valeurs: readonly string[] | null;
}> = [
  { value: "tous", label: "Toutes qualifications", valeurs: null },
  ...QUALIFICATIONS.map((q) => ({
    value: q.valeur as string,
    label: q.label,
    valeurs: [q.valeur] as readonly string[],
  })),
];

/** Normalise un paramètre d'URL : une valeur inconnue ne filtre rien. */
export function lireQualificationFiltre(valeur: string | string[] | undefined): string {
  const v = Array.isArray(valeur) ? valeur[0] : valeur;
  return QUALIFICATION_FILTERS.some((q) => q.value === v) ? (v as string) : "tous";
}

export function qualificationCorrespond(row: BuyerInboxRow, filtre: string): boolean {
  const f = QUALIFICATION_FILTERS.find((q) => q.value === filtre);
  if (!f || f.valeurs === null) return true;
  return f.valeurs.includes(row.qualification);
}

/**
 * Le pipeline écarte les non qualifiés de toutes ses colonnes : un dossier
 * écarté ne doit pas revenir tous les matins dans « à contacter ». Mais
 * DEMANDER explicitement « Non qualifié » doit les faire apparaître — sinon la
 * pastille annoncerait 9 et en ouvrirait 0, et un filtre dont le nombre ne
 * survit pas au clic est un filtre qui ment.
 */
export function demandeLesNonQualifies(filtre: string): boolean {
  return filtre === "non_qualifie";
}
