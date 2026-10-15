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
  | "gros_potentiel"
  | "non_qualifies"
  | "numero_invalide"
  | "en_cours"
  | "nouveaux"
  | "en_retard"
  | "fort_potentiel"
  | "sans_action"
  | "non_affectes";

const SIGNAUX: Signal[] = [
  "tous",
  "a_contacter",
  "a_rappeler",
  "gros_potentiel",
  "non_qualifies",
  "numero_invalide",
  "en_cours",
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
];

/** Normalise un paramètre d'URL : une valeur inconnue ne filtre rien. */
export function lireSignal(valeur: string | string[] | undefined): Signal {
  const v = Array.isArray(valeur) ? valeur[0] : valeur;
  return SIGNAUX.includes(v as Signal) ? (v as Signal) : "tous";
}

/**
 * Dans le TRAITEMENT ACTIF : quelqu'un dont on attend encore quelque chose.
 *
 * Trois sorties, et une seule vient de l'étape. « Non qualifié » est un
 * jugement sur la personne, pas une case du pipeline : il la retire de la file
 * sans la déplacer, ce qui laisse lisible où en était la conversation le jour
 * où on la requalifie. C'est ce qui corrige la plainte d'origine — un dossier
 * passé en non qualifié restait dans « à contacter » et revenait tous les
 * matins.
 *
 * Ces personnes ne disparaissent pas : « Tous » et le filtre « Non qualifiés »
 * les retrouvent, avec leurs notes.
 */
export function estEnTraitementActif(row: BuyerInboxRow): boolean {
  if (row.qualification === "non_qualifie") return false;
  return row.stage !== "pas_interesse" && row.stage !== "mauvais_numero";
}

/** Un dossier porte-t-il ce signal ? Fonction pure. */
export function porteLeSignal(row: BuyerInboxRow, signal: Signal): boolean {
  switch (signal) {
    /* « À contacter » = personne ne lui a encore parlé. C'est le compteur du
       premier traitement, pas « sans prochaine action » : un dossier qu'on a
       déjà appelé trois fois sans succès n'est plus à contacter, il est à
       rappeler. */
    case "a_contacter":
      return row.stage === "a_contacter" && estEnTraitementActif(row);
    case "a_rappeler":
      return row.stage === "a_rappeler" && estEnTraitementActif(row);
    case "gros_potentiel":
      return row.qualification === "gros_potentiel";
    case "non_qualifies":
      return row.qualification === "non_qualifie";
    case "numero_invalide":
      return row.phoneInvalid || row.stage === "mauvais_numero";
    /* « En cours » : un échange est engagé. Le compteur du tableau de bord et
       ce filtre doivent compter la MÊME chose — un compteur qui ouvre une
       autre liste que celle qu'il annonce est un compteur qui ment. */
    case "en_cours":
      return (
        ["a_rappeler", "en_discussion", "visite_planifiee"].includes(row.stage) &&
        estEnTraitementActif(row)
      );
    case "nouveaux":
      return row.stage === "a_contacter" && estEnTraitementActif(row);
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

/**
 * Le compte qui doit s'afficher en haut de la file : combien de personnes on
 * travaille, et combien sont mises de côté.
 *
 * Les deux nombres sont calculés ICI, une fois, et lus par la liste comme par
 * le pipeline. Les avoir comptés de chaque côté est exactement ce qui a produit
 * « 10 dans le pipeline » en face de « 8 dans la liste » : deux écrans, deux
 * additions, et plus personne pour dire laquelle était bonne.
 */
export function comptesDeLaFile(rows: BuyerInboxRow[]): {
  actifs: number;
  nonQualifies: number;
  /** Qualifiées, mais sorties par l'étape : « pas intéressé », « mauvais
      numéro ». Affichées seulement si elles existent — les trois nombres
      doivent s'additionner au total de la liste, sinon le bandeau ment. */
  sorties: number;
} {
  let actifs = 0;
  let nonQualifies = 0;
  let sorties = 0;
  for (const row of rows) {
    if (row.qualification === "non_qualifie") nonQualifies += 1;
    else if (estEnTraitementActif(row)) actifs += 1;
    else sorties += 1;
  }
  return { actifs, nonQualifies, sorties };
}
