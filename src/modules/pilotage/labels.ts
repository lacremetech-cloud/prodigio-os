/**
 * Libellés français du pilotage (source unique). Les jetons restent alignés
 * sur les contraintes SQL de `20261112150000_pilotage_conditions_lots_et_couts_fixes` ;
 * un test vérifie que chaque jeton de la base a son libellé.
 */

import type { Manque } from "./commission";

export const STATUTS_COMMERCIAUX = ["a_vendre", "sous_offre", "compromis_signe", "vendu"] as const;
export type StatutCommercial = (typeof STATUTS_COMMERCIAUX)[number];

/** Dans l'ordre du parcours : À vendre → Sous offre → Compromis signé → Vendu. */
export const statutCommercialLabels: Record<StatutCommercial, string> = {
  a_vendre: "À vendre",
  sous_offre: "Sous offre",
  compromis_signe: "Compromis signé",
  vendu: "Vendu",
};

export const TYPES_COUT = ["production", "montage", "photos", "autre"] as const;
export type TypeCout = (typeof TYPES_COUT)[number];

export const typeCoutLabels: Record<TypeCout, string> = {
  production: "Production (tournage)",
  montage: "Montage",
  photos: "Photos",
  autre: "Autre",
};

export const BASES_HONORAIRES = ["TTC", "HT", "a_confirmer"] as const;

export const baseHonorairesLabels: Record<(typeof BASES_HONORAIRES)[number], string> = {
  TTC: "TTC",
  HT: "HT",
  a_confirmer: "À confirmer",
};

export const NATURES_PRIX = ["fai", "ht_grille_promoteur"] as const;
export type NaturePrix = (typeof NATURES_PRIX)[number];

export const naturePrixLabels: Record<NaturePrix, string> = {
  fai: "Prix affiché, frais d’agence inclus (FAI)",
  ht_grille_promoteur: "Prix HT de la grille du promoteur, pris comme prix affiché",
};

/** Ce qu'on affiche à la place d'un chiffre qui ne peut pas être calculé. */
export const manqueLabels: Record<Manque, string> = {
  base_a_confirmer: "base des honoraires à confirmer",
  base_ht_non_prevue: "base HT : aucune règle de calcul validée",
  prix_manquant: "prix manquant",
  taux_manquant: "taux de commission manquant",
  part_manquante: "part de Prodigio manquante",
  tva_manquante: "taux de TVA manquant",
  prix_vente_final_manquant: "prix de vente final à saisir",
};
