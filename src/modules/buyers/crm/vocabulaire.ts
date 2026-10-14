/**
 * Le vocabulaire du CRM acquéreurs — **un seul endroit**.
 *
 * POURQUOI CE FICHIER EXISTE. Les étapes et les qualifications étaient
 * écrites dans treize fichiers : la liste, le pipeline, le panneau de
 * traitement, la fiche, les filtres, les compteurs, chacun avec sa copie.
 * Rien n'obligeait ces copies à coïncider, et elles avaient fini par diverger
 * — ce qui obligeait Antoine à requalifier un dossier déjà qualifié, et à
 * déplacer une carte déjà déplacée. Ce fichier est la copie unique ; tout le
 * reste l'importe.
 *
 * TROIS NOTIONS, JAMAIS CONFONDUES.
 *
 *   • L'ÉTAPE dit OÙ EN EST la personne dans le traitement. Elle appartient à
 *     la personne, pas au bien : on appelle quelqu'un une fois, même s'il
 *     s'intéresse à deux villas.
 *   • La QUALIFICATION dit CE QU'ON PENSE de son potentiel. Elle n'est jamais
 *     déduite d'un budget déclaré — c'est un jugement, posé par quelqu'un qui
 *     a eu la personne au téléphone.
 *   • L'ISSUE COMMERCIALE (gagné, perdu) appartient à l'AFFAIRE, donc au bien.
 *     Quelqu'un peut acheter Verdun et ne jamais donner suite sur Jean Jaurès.
 *     Elle ne figure pas ici : ce n'est pas une étape de traitement.
 *
 * Les deux premières sont INDÉPENDANTES. Qualifier quelqu'un ne le déplace pas
 * dans le pipeline, et le déplacer ne le juge pas. Les mélanger est ce qui
 * faisait rester un « non qualifié » dans la file des gens à contacter.
 */

// --- Étapes de traitement ----------------------------------------------------

export const ETAPES_ACQUEREUR = [
  "a_contacter",
  "a_rappeler",
  "en_discussion",
  "visite_planifiee",
  "vivier",
  "pas_interesse",
  "ecarte",
  "mauvais_numero",
] as const;

export type EtapeAcquereur = (typeof ETAPES_ACQUEREUR)[number];

export interface DefinitionEtape {
  valeur: EtapeAcquereur;
  label: string;
  /** Ce que la colonne veut dire, affiché en légende et en infobulle. */
  sens: string;
  /** Variable CSS de la pastille. Jamais une couleur en dur. */
  couleur: string;
  /** Vrai quand la couleur est assez sombre pour porter du texte blanc. */
  texteClair: boolean;
  /**
   * Dans la FILE ACTIVE : la personne attend encore quelque chose de nous.
   * Les quatre dernières n'y sont pas — une personne écartée ne doit plus
   * remonter dans « à contacter », et c'est exactement ce qui se produisait.
   */
  active: boolean;
  /**
   * Appelable. « Mauvais numéro » sort de la file d'appels sans porter de
   * jugement sur la personne : le numéro est faux, pas le dossier. Corriger
   * le numéro la fait revenir.
   */
  appelable: boolean;
}

export const ETAPES: readonly DefinitionEtape[] = [
  {
    valeur: "a_contacter",
    label: "À contacter",
    sens: "Aucune tentative enregistrée",
    couleur: "--crm-acq-a_contacter",
    texteClair: true,
    active: true,
    appelable: true,
  },
  {
    valeur: "a_rappeler",
    label: "À rappeler",
    sens: "Sans réponse ou rappel prévu",
    couleur: "--crm-acq-a_rappeler",
    texteClair: true,
    active: true,
    appelable: true,
  },
  {
    valeur: "en_discussion",
    label: "En discussion",
    sens: "Échange engagé",
    couleur: "--crm-acq-en_discussion",
    texteClair: true,
    active: true,
    appelable: true,
  },
  {
    valeur: "visite_planifiee",
    label: "Visite planifiée",
    sens: "Visite réellement programmée, avec date, heure et bien",
    couleur: "--crm-acq-visite_planifiee",
    texteClair: true,
    active: true,
    appelable: true,
  },
  {
    valeur: "vivier",
    label: "Vivier",
    sens: "Suivi mis en attente",
    couleur: "--crm-acq-vivier",
    texteClair: true,
    /* Hors file active, mais PAS un échec : un gros potentiel peut être mis en
       vivier sans rien perdre de sa qualification. C'est la case qui manquait,
       et faute de laquelle ces gens finissaient en « perdu ». */
    active: false,
    appelable: true,
  },
  {
    valeur: "pas_interesse",
    label: "Pas intéressé",
    sens: "Refus exprimé par la personne",
    couleur: "--crm-acq-pas_interesse",
    texteClair: true,
    active: false,
    appelable: false,
  },
  {
    valeur: "ecarte",
    label: "Écarté",
    sens: "Traitement arrêté pour un autre motif — budget incompatible, par exemple",
    couleur: "--crm-acq-ecarte",
    texteClair: true,
    active: false,
    appelable: false,
  },
  {
    valeur: "mauvais_numero",
    label: "Mauvais numéro",
    sens: "Numéro incorrect, appel impossible",
    couleur: "--crm-acq-mauvais_numero",
    texteClair: true,
    active: false,
    appelable: false,
  },
] as const;

const ETAPE_PAR_VALEUR = new Map(ETAPES.map((e) => [e.valeur, e]));

export function estEtapeConnue(v: unknown): v is EtapeAcquereur {
  return typeof v === "string" && ETAPE_PAR_VALEUR.has(v as EtapeAcquereur);
}

/** La définition, ou celle de « À contacter » — jamais `undefined`. */
export function etape(v: string): DefinitionEtape {
  return ETAPE_PAR_VALEUR.get(v as EtapeAcquereur) ?? ETAPES[0]!;
}

/** Les étapes où la personne attend encore quelque chose de nous. */
export const ETAPES_ACTIVES: readonly EtapeAcquereur[] = ETAPES.filter((e) => e.active).map(
  (e) => e.valeur,
);

/** Celles qui sortent la personne de la file d'appels. */
export const ETAPES_HORS_FILE: readonly EtapeAcquereur[] = ETAPES.filter((e) => !e.appelable).map(
  (e) => e.valeur,
);

// --- Qualification -----------------------------------------------------------

export const QUALIFICATIONS_ACQUEREUR = [
  "a_qualifier",
  "qualifie",
  "gros_potentiel",
  "non_qualifie",
] as const;

export type QualificationAcquereur = (typeof QUALIFICATIONS_ACQUEREUR)[number];

export interface DefinitionQualification {
  valeur: QualificationAcquereur;
  label: string;
  couleur: string;
  /** Un motif est exigé : écarter quelqu'un sans dire pourquoi n'apprend rien. */
  motifRequis: boolean;
}

export const QUALIFICATIONS: readonly DefinitionQualification[] = [
  {
    valeur: "a_qualifier",
    label: "À qualifier",
    couleur: "--crm-acq-q-a_qualifier",
    motifRequis: false,
  },
  { valeur: "qualifie", label: "Qualifié", couleur: "--crm-acq-q-qualifie", motifRequis: false },
  {
    valeur: "gros_potentiel",
    label: "Gros potentiel",
    couleur: "--crm-acq-q-gros_potentiel",
    motifRequis: false,
  },
  {
    valeur: "non_qualifie",
    label: "Non qualifié",
    couleur: "--crm-acq-q-non_qualifie",
    motifRequis: true,
  },
] as const;

const QUALIF_PAR_VALEUR = new Map(QUALIFICATIONS.map((q) => [q.valeur, q]));

export function estQualificationConnue(v: unknown): v is QualificationAcquereur {
  return typeof v === "string" && QUALIF_PAR_VALEUR.has(v as QualificationAcquereur);
}

export function qualification(v: string): DefinitionQualification {
  return QUALIF_PAR_VALEUR.get(v as QualificationAcquereur) ?? QUALIFICATIONS[0]!;
}

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

// --- Ce qu'une qualification entraîne ----------------------------------------

/**
 * L'étape qu'on PROPOSE quand la qualification change.
 *
 * Proposée, jamais imposée : c'est le commercial qui décide. Mais « non
 * qualifié » doit pouvoir sortir la personne de la file active DANS LE MÊME
 * enregistrement — lui demander ensuite de déplacer la carte à la main était
 * exactement le « je l'ai déjà fait » dont Antoine se plaignait.
 *
 * Rend `null` quand il n'y a rien à proposer : qualifier quelqu'un de gros
 * potentiel ne dit rien de l'endroit où en est la conversation.
 */
export function etapeProposeeParQualification(
  nouvelle: QualificationAcquereur,
  etapeActuelle: string,
): EtapeAcquereur | null {
  if (nouvelle !== "non_qualifie") return null;
  /* Déjà sortie de la file : ne rien proposer plutôt que de rétrograder un
     « pas intéressé » en « écarté », qui perdrait l'information du refus. */
  if (!etape(etapeActuelle).appelable) return null;
  return "ecarte";
}
