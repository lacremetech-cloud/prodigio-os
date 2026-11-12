/**
 * Les pastilles du pipeline Mandats, et la lecture de `?filtre=`.
 *
 * Module NEUTRE — ni serveur, ni client — parce que les deux côtés en ont
 * besoin : la page (serveur) lit le paramètre de l'adresse, le tableau
 * (client) l'écrit quand on clique une pastille. Le vocabulaire ne peut pas
 * vivre dans le composant : une page serveur n'a pas le droit d'importer une
 * fonction depuis un module « use client », et c'est bien ainsi — un module
 * client embarque du code de rendu dont le serveur n'a que faire.
 */

/** Les quatre pastilles, et celle qui ne filtre rien. */
export const FILTRES_PIPELINE = ["tous", "non_affecte", "en_retard", "fort_potentiel"] as const;
export type FiltreRapide = (typeof FILTRES_PIPELINE)[number];

/**
 * `?filtre=`. Une valeur inconnue ne filtre rien plutôt que de vider le
 * tableau : un lien copié d'une version plus ancienne du CRM doit rester
 * utilisable, pas renvoyer un pipeline vide sans explication.
 */
export function lireFiltrePipeline(valeur: string | string[] | undefined): FiltreRapide {
  const v = Array.isArray(valeur) ? valeur[0] : valeur;
  return FILTRES_PIPELINE.includes(v as FiltreRapide) ? (v as FiltreRapide) : "tous";
}
