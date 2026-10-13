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
  | "a_contacter"
  | "a_rappeler"
  | "injoignables"
  | "gros_potentiel"
  | "en_reflexion"
  | "non_qualifies"
  | "numero_invalide"
  | "nouveaux"
  | "en_retard"
  | "fort_potentiel"
  | "sans_action"
  | "non_affectes";

const SIGNAUX: Signal[] = [
  "tous",
  "a_contacter",
  "a_rappeler",
  "injoignables",
  "gros_potentiel",
  "en_reflexion",
  "non_qualifies",
  "numero_invalide",
  "nouveaux",
  "en_retard",
  "fort_potentiel",
  "sans_action",
  "non_affectes",
];

/**
 * Les filtres RAPIDES, ceux qui méritent une pastille au-dessus de la liste.
 * Les autres restent accessibles par l'URL et par les compteurs, mais une
 * rangée de treize pastilles ne se lit plus.
 */
export const FILTRES_RAPIDES: { signal: Signal; label: string }[] = [
  { signal: "tous", label: "Tous" },
  { signal: "a_contacter", label: "À contacter" },
  { signal: "a_rappeler", label: "À rappeler" },
  { signal: "injoignables", label: "Injoignables" },
  { signal: "gros_potentiel", label: "Gros potentiel" },
  { signal: "en_reflexion", label: "En réflexion" },
  { signal: "non_qualifies", label: "Non qualifiés" },
  { signal: "numero_invalide", label: "Numéros invalides" },
];

/** Normalise un paramètre d'URL : une valeur inconnue ne filtre rien. */
export function lireSignal(valeur: string | string[] | undefined): Signal {
  const v = Array.isArray(valeur) ? valeur[0] : valeur;
  return SIGNAUX.includes(v as Signal) ? (v as Signal) : "tous";
}

/** Un dossier porte-t-il ce signal ? Fonction pure. */
export function porteLeSignal(row: BuyerInboxRow, signal: Signal): boolean {
  switch (signal) {
    /* « À contacter » = personne ne lui a encore parlé. C'est le compteur du
       premier traitement, pas « sans prochaine action » : un dossier qu'on a
       déjà appelé trois fois sans succès n'est plus à contacter, il est à
       rappeler. */
    case "a_contacter":
      return row.callAttempts === 0;
    case "a_rappeler":
      return row.nextActionAt !== null;
    /* Injoignable = le DERNIER appel n'a mené à personne. Un dossier qu'on a
       fini par joindre n'est plus injoignable, même s'il l'a été dix fois. */
    case "injoignables":
      return row.lastCallOutcome === "sans_reponse" || row.lastCallOutcome === "message_laisse";
    case "gros_potentiel":
      return row.qualification === "gros_potentiel";
    case "en_reflexion":
      return row.qualification === "en_reflexion";
    case "non_qualifies":
      return row.qualification === "non_qualifie";
    case "numero_invalide":
      return row.phoneInvalid;
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
