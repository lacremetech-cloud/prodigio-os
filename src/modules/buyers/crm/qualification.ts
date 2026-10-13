/**
 * LA qualification commerciale — quatre valeurs, une seule à la fois.
 *
 * Source unique : la liste, le panneau de traitement, la fiche, le Kanban et
 * le cockpit du bien lisent tous ce module. Il y a eu deux échelles pendant
 * quelques jours — celle-ci, par dossier, et une ancienne par personne
 * (`buyer_profiles.qualification_status`) qui survivait sur le Kanban et le
 * cockpit. Même mot, deux listes, deux écrans : plus personne ne savait
 * laquelle faisait foi. La migration 20261014090000 a repris la seconde dans
 * celle-ci, et ce fichier est désormais le seul endroit où la liste s'écrit.
 *
 * « Qualifié » a disparu de l'échelle. Il ne disait pas un niveau de potentiel
 * — il disait « quelqu'un a regardé » —, et il se confondait avec « Gros
 * potentiel » dans l'usage. Les quatre valeurs restantes répondent toutes à la
 * même question, celle qui sert à décider qui on rappelle : est-ce que ça vaut
 * le coup ?
 *
 * C'est le SEUL signal qui colore une ligne de la liste. Un gros potentiel qui
 * n'a pas décroché reste vert : son injoignabilité est un fait d'appel, pas un
 * jugement sur lui. Confondre les deux — ce que faisait l'ancienne liste, où le
 * rouge disait « en retard » — amenait le commercial à rappeler les mauvaises
 * personnes.
 *
 * Aucune de ces valeurs ne se déduit : ni d'un budget déclaré, ni d'un « pas de
 * projet actuellement ». Elles sont posées par la personne qui a eu quelqu'un
 * au téléphone.
 */

import type { BuyerQualification } from "@/lib/supabase/types";

export const BUYER_QUALIFICATIONS: readonly BuyerQualification[] = [
  "a_qualifier",
  "gros_potentiel",
  "en_reflexion",
  "non_qualifie",
] as const;

export const QUALIFICATION_LABELS: Record<BuyerQualification, string> = {
  a_qualifier: "À qualifier",
  gros_potentiel: "Gros potentiel",
  en_reflexion: "En réflexion",
  non_qualifie: "Non qualifié",
};

/**
 * Teinte de la ligne. `null` = ligne blanche : « à qualifier » est l'état par
 * défaut de tout le monde, le colorer ne distinguerait rien de rien.
 */
export const QUALIFICATION_TEINTE: Record<BuyerQualification, string | null> = {
  a_qualifier: null,
  gros_potentiel: "vert",
  en_reflexion: "orange",
  non_qualifie: "rouge",
};

/** Couleur du badge, lui toujours présent — le libellé l'accompagne toujours. */
export const QUALIFICATION_BADGE: Record<BuyerQualification, "gris" | "vert" | "orange" | "rouge"> = {
  a_qualifier: "gris",
  gros_potentiel: "vert",
  en_reflexion: "orange",
  non_qualifie: "rouge",
};

/**
 * Motifs proposés pour écarter un dossier. Courts, et « Autre » reste ouvert :
 * une liste fermée pousse à choisir au hasard le motif le moins faux.
 */
export const MOTIFS_NON_QUALIFIE = [
  "Budget incompatible",
  "Projet incompatible",
  "Pas intéressé",
  "Autre",
] as const;

export function estQualificationConnue(v: string): v is BuyerQualification {
  return (BUYER_QUALIFICATIONS as readonly string[]).includes(v);
}

/**
 * Lit une qualification venue de la base. Une valeur inconnue — un « qualifie »
 * resté dans une ligne écrite juste avant la migration, par exemple — retombe
 * sur l'état par défaut plutôt que de casser l'écran. C'est aussi la bonne
 * réponse métier : ce dossier est précisément à re-qualifier.
 */
export function lireQualification(v: string | null | undefined): BuyerQualification {
  return v && estQualificationConnue(v) ? v : "a_qualifier";
}

// --- Résultats d'appel --------------------------------------------------------
/**
 * Ce qui s'est passé pendant l'appel. C'est un FAIT, daté, qui ne se réécrit
 * pas — à ne pas confondre avec la qualification, qui est un jugement, ni avec
 * l'étape, qui dit où en est l'affaire.
 */
export const RESULTATS_APPEL = [
  { valeur: "contact_etabli", label: "Joint" },
  { valeur: "sans_reponse", label: "Injoignable" },
  { valeur: "message_laisse", label: "Message vocal laissé" },
  { valeur: "mauvais_numero", label: "Numéro invalide" },
] as const;

export type ResultatAppel = (typeof RESULTATS_APPEL)[number]["valeur"];

export const RESULTAT_APPEL_LABELS: Record<string, string> = Object.fromEntries(
  RESULTATS_APPEL.map((r) => [r.valeur, r.label]),
);

/**
 * Un appel sans réponse appelle un rappel : on le propose, on ne l'impose pas.
 * Joindre quelqu'un, en revanche, ne dit rien de la suite — c'est au commercial
 * de décider, et proposer une date par défaut lui mettrait un rappel inutile.
 */
export function proposeUnRappel(resultat: ResultatAppel | null): boolean {
  return resultat === "sans_reponse" || resultat === "message_laisse";
}

/**
 * Premier échange réussi : « en discussion » devient l'étape évidente. On ne la
 * propose que si elle fait AVANCER le dossier — proposer « en discussion » à
 * quelqu'un déjà en visite serait une rétrogradation déguisée.
 */
const EN_DISCUSSION = 2;

const RANG_ETAPE: Record<string, number> = {
  nouveau: 0,
  a_rappeler: 1,
  en_discussion: 2,
  visite: 3,
  offre: 4,
  gagne: 5,
  perdu: 5,
  vivier: 1,
};

export function etapeProposee(
  resultat: ResultatAppel | null,
  etapeActuelle: string,
): string | null {
  if (resultat !== "contact_etabli") return null;
  const actuel = RANG_ETAPE[etapeActuelle] ?? 0;
  return actuel < EN_DISCUSSION ? "en_discussion" : null;
}
