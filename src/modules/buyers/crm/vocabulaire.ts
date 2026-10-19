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
  /**
   * Variable CSS de l'ENCRE posée sur cette couleur.
   *
   * « Mauvais numéro » est le seul repère noir — il doit se distinguer du
   * rouge des refus — et le noir ne porte que du blanc. En thème clair,
   * l'encre commune vaut #0b0e13 : du noir sur du #242830, illisible. Un test
   * vérifiait déjà le bon contraste avec la variable dédiée, mais aucun
   * composant ne la lisait. Elle est désormais portée par l'étape elle-même.
   */
  encre: string;
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
    encre: "--crm-acq-sur-etape",
    texteClair: true,
    active: true,
    appelable: true,
  },
  {
    valeur: "a_rappeler",
    label: "À rappeler",
    sens: "Sans réponse ou rappel prévu",
    couleur: "--crm-acq-a_rappeler",
    encre: "--crm-acq-sur-etape",
    texteClair: true,
    active: true,
    appelable: true,
  },
  {
    valeur: "en_discussion",
    label: "En discussion",
    sens: "Échange engagé",
    couleur: "--crm-acq-en_discussion",
    encre: "--crm-acq-sur-etape",
    texteClair: true,
    active: true,
    appelable: true,
  },
  {
    valeur: "visite_planifiee",
    label: "Visite planifiée",
    sens: "Visite réellement programmée, avec date, heure et bien",
    couleur: "--crm-acq-visite_planifiee",
    encre: "--crm-acq-sur-etape",
    texteClair: true,
    active: true,
    appelable: true,
  },
  {
    valeur: "vivier",
    label: "Vivier",
    sens: "Suivi mis en attente",
    couleur: "--crm-acq-vivier",
    encre: "--crm-acq-sur-etape",
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
    encre: "--crm-acq-sur-etape",
    texteClair: true,
    active: false,
    appelable: false,
  },
  {
    valeur: "mauvais_numero",
    label: "Mauvais numéro",
    sens: "Numéro incorrect, appel impossible",
    couleur: "--crm-acq-mauvais_numero",
    encre: "--crm-acq-sur-mauvais_numero",
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
/**
 * Les valeurs RETIRÉES, traduites vers celles qui restent.
 *
 * Un historique de six mois contient « nouveau », « visite », « perdu » et
 * « en_reflexion ». Sans cette table, elles retombaient toutes sur la
 * première entrée de la liste : « en_reflexion » s'affichait « À qualifier »
 * alors que l'agence l'a tranché en « Qualifié ». Un libellé faux dans un
 * historique est pire qu'un identifiant technique — il se lit comme un fait.
 *
 * Ces correspondances sont celles de `crm_etape_v2` et `crm_qualification_v2`
 * en base, au mot près : les deux côtés doivent raconter la même histoire.
 */
export const ETAPES_RETIREES: Record<string, EtapeAcquereur> = {
  nouveau: "a_contacter",
  visite: "visite_planifiee",
  perdu: "pas_interesse",
  gagne: "en_discussion",
  offre: "en_discussion",
};

/**
 * Les étapes qu'une ÉCRITURE accepte : les sept actuelles, plus les anciennes,
 * que la base traduit elle-même (`crm_etape_v2`).
 *
 * Cette liste existe parce que son absence a coûté cher. Le serveur gardait sa
 * propre énumération, figée au vocabulaire d'avant la reprise du 14 octobre :
 * quatre colonnes du pipeline sur sept refusaient le dépôt, en répondant
 * « utilisez l'action dédiée » — une action qui n'existait plus. Deux listes
 * pour une seule vérité, et c'est la copie oubliée qui parle à l'utilisateur.
 *
 * Les anciens noms restent acceptés tant que des onglets ouverts peuvent les
 * envoyer : la base les normalise, personne ne perd sa saisie.
 */
export const ETAPES_ACCEPTEES_EN_ECRITURE = [
  ...ETAPES_ACQUEREUR,
  "nouveau",
  "visite",
  "perdu",
  "gagne",
  "offre",
] as const;

const QUALIFICATIONS_RETIREES: Record<string, QualificationAcquereur> = {
  en_reflexion: "qualifie",
};

export function etape(v: string): DefinitionEtape {
  const direct = ETAPE_PAR_VALEUR.get(v as EtapeAcquereur);
  if (direct) return direct;
  const traduite = ETAPES_RETIREES[v];
  return (traduite ? ETAPE_PAR_VALEUR.get(traduite) : undefined) ?? ETAPES[0]!;
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
  const direct = QUALIF_PAR_VALEUR.get(v as QualificationAcquereur);
  if (direct) return direct;
  const traduite = QUALIFICATIONS_RETIREES[v];
  return (traduite ? QUALIF_PAR_VALEUR.get(traduite) : undefined) ?? QUALIFICATIONS[0]!;
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
 * « Non qualifié » sort la personne de la file active À LUI SEUL.
 *
 * Il y avait au départ une étape « Écarté » pour ça. Elle a été retirée : à
 * l'écran, « Écarté » et « Pas intéressé » étaient deux cases grises voisines
 * qui disaient presque la même chose, et un pipeline qui finit sur trois
 * colonnes négatives décourage celui qui le regarde toute la journée.
 *
 * La sortie de file change donc d'axe. Elle n'est plus une étape où l'on range
 * les gens, mais une conséquence du jugement porté sur eux. Concrètement :
 *
 *   • la personne garde l'étape qu'elle avait — où en était la conversation
 *     reste vrai, et le jour où elle est requalifiée, on la retrouve au bon
 *     endroit plutôt qu'au début ;
 *   • elle ne paraît plus ni dans « à contacter », ni dans la file d'appels,
 *     ni dans les compteurs du travail à faire ;
 *   • le filtre « Non qualifié » reste le chemin pour la retrouver.
 *
 * C'est ce qui corrige la plainte d'origine — « quand un lead passe en non
 * qualifié, il reste dans à contacter » — sans ajouter de colonne.
 */
export function sortDeLaFileActive(
  qualificationValeur: string,
  etapeValeur: string,
): boolean {
  if (qualificationValeur === "non_qualifie") return true;
  return !etape(etapeValeur).active;
}

/**
 * Appelable : ni un numéro faux, ni un refus, ni un dossier écarté par
 * jugement. Le vivier, lui, reste appelable — la personne est en attente, pas
 * écartée.
 */
export function estAppelable(qualificationValeur: string, etapeValeur: string): boolean {
  if (qualificationValeur === "non_qualifie") return false;
  return etape(etapeValeur).appelable;
}

// --- Ce qui s'est passé ------------------------------------------------------

/**
 * Les sept activités qu'on enregistre, et rien d'autre.
 *
 * Elles remplacent deux blocs concurrents : « Résultat de l'appel » dans le
 * panneau et « Type / Résultat de l'échange » dans la fiche. Les deux
 * décrivaient le même fait avec des mots différents, et aucun ne savait dire
 * qu'on avait envoyé un WhatsApp.
 *
 * UNE ACTIVITÉ EST UN FAIT, pas une intention. Ouvrir WhatsApp ne prouve pas
 * qu'un message est parti, et cliquer sur « Appeler » ne prouve pas qu'un appel
 * a eu lieu : c'est le commercial qui confirme, après coup, ce qui s'est
 * réellement passé.
 */
export const ACTIVITES = [
  { valeur: "appel_sans_reponse", label: "Appel — sans réponse", rappelle: true },
  { valeur: "appel_echange", label: "Appel — échange effectué", rappelle: false },
  { valeur: "message_vocal", label: "Message vocal laissé", rappelle: true },
  { valeur: "whatsapp", label: "Message WhatsApp envoyé", rappelle: false },
  { valeur: "sms", label: "SMS / iMessage envoyé", rappelle: false },
  { valeur: "email", label: "E-mail envoyé", rappelle: false },
  { valeur: "note", label: "Note libre", rappelle: false },
] as const;

export type Activite = (typeof ACTIVITES)[number]["valeur"];

const ACTIVITE_PAR_VALEUR = new Map(ACTIVITES.map((a) => [a.valeur, a]));

export function activiteLabel(v: string): string {
  return ACTIVITE_PAR_VALEUR.get(v as Activite)?.label ?? v;
}

/**
 * Cette activité appelle-t-elle un rappel ?
 *
 * Un appel sans réponse et un message vocal, oui : la conversation n'a pas eu
 * lieu, elle reste à avoir. Un message envoyé, non — on attend une réponse,
 * on ne se rappelle pas soi-même. Et surtout : un message envoyé ne vaut pas
 * « en discussion », tant que personne n'a répondu.
 */
export function appelleUnRappel(v: string | null): boolean {
  return v ? (ACTIVITE_PAR_VALEUR.get(v as Activite)?.rappelle ?? false) : false;
}
