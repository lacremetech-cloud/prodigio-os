import type { BuyerInboxRow } from "./queries";

/**
 * Signal de travail de la boîte de réception.
 *
 * Ce n'est pas un filtre de plus à côté des autres : c'est le compteur
 * lui-même, devenu cliquable. On lit « 4 en retard », on clique, on a les
 * quatre dossiers. La rangée de pastilles qui doublonnait ces compteurs a été
 * retirée.
 *
 * Le même vocabulaire sert dans l'URL (`?signal=en_retard`), ce qui permet aux
 * tuiles du tableau de bord d'ouvrir exactement les dossiers qu'elles
 * annoncent — un compteur qui ouvre une autre liste que celle qu'il compte est
 * un compteur qui ment.
 *
 * Ce module est volontairement neutre (ni serveur, ni client) : la page
 * serveur lit le paramètre d'URL, le composant client applique le filtre. La
 * dernière fois qu'une fonction de ce genre vivait dans un module
 * « use client », la page qui l'importait plantait pour tout le monde.
 */
export type Signal =
  | "tous"
  | "nouveaux"
  | "en_retard"
  | "fort_potentiel"
  | "sans_action"
  | "non_affectes";

const SIGNAUX: Signal[] = [
  "tous",
  "nouveaux",
  "en_retard",
  "fort_potentiel",
  "sans_action",
  "non_affectes",
];

/** Normalise un paramètre d'URL : une valeur inconnue ne filtre rien. */
export function lireSignal(valeur: string | string[] | undefined): Signal {
  const v = Array.isArray(valeur) ? valeur[0] : valeur;
  return SIGNAUX.includes(v as Signal) ? (v as Signal) : "tous";
}

/** Un dossier porte-t-il ce signal ? Fonction pure. */
export function porteLeSignal(row: BuyerInboxRow, signal: Signal): boolean {
  switch (signal) {
    case "nouveaux":
      return row.stage === "nouveau";
    case "en_retard":
      return row.overdue;
    case "fort_potentiel":
      return row.highPotential;
    case "sans_action":
      return row.noNextAction;
    case "non_affectes":
      return row.unassigned;
    case "tous":
    default:
      return true;
  }
}
