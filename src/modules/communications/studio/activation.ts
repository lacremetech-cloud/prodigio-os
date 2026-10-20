/**
 * **Centre de préparation à l'activation.**
 *
 * Sépare strictement deux questions qui n'ont ni la même nature ni la même
 * réponse :
 *   • **Transactionnel** — une question TECHNIQUE : le fournisseur est-il
 *     configuré, l'interrupteur est-il armé, un modèle est-il prêt, la file
 *     est-elle traitable, une preuve de livraison est-elle disponible ?
 *   • **Marketing** — une question JURIDIQUE et ORGANISATIONNELLE, qui ne se
 *     règle pas dans le code. Tant que les décisions ne sont pas prises,
 *     l'activation marketing est **bloquée**.
 *
 * ⚠️ Ce module n'affirme JAMAIS une conformité. Il n'existe aucun état
 * « conforme RGPD » : seulement « décision prise » ou « décision à prendre ».
 */

/** Constat factuel : vrai / faux, sans interprétation. */
export interface ReadinessCheck {
  key: string;
  label: string;
  /** Ce que le constat signifie exactement, pour éviter toute sur-lecture. */
  meaning: string;
  ready: boolean;
  /** Ce qu'il reste à faire lorsque le constat est faux. */
  todo: string;
}

export interface TransactionalReadinessInput {
  emailProviderConfigured: boolean;
  smsProviderConfigured: boolean;
  dispatchEnabled: boolean;
  /** Nombre de modèles au statut `actif`. */
  activeTemplateCount: number;
  /** Nombre total de modèles, toutes versions confondues. */
  templateCount: number;
  /** La file peut-elle être traitée (au moins un fournisseur configuré) ? */
  queueProcessable: boolean;
  /** Une preuve de livraison fournisseur est-elle réellement disponible ? */
  deliveryProofAvailable: boolean;
}

/**
 * État de préparation TRANSACTIONNELLE. Chaque ligne est un fait vérifiable —
 * jamais une promesse.
 */
export function transactionalReadiness(
  input: TransactionalReadinessInput,
): ReadinessCheck[] {
  return [
    {
      key: "fournisseur_email",
      label: "Fournisseur e-mail configuré",
      meaning:
        "Les variables d'environnement attendues sont présentes. Aucune valeur n'est lue ni affichée.",
      ready: input.emailProviderConfigured,
      todo: "Renseigner les variables du fournisseur e-mail dans l'environnement concerné.",
    },
    {
      key: "fournisseur_sms",
      label: "Fournisseur SMS configuré",
      meaning: "Idem pour le canal SMS. Le canal reste facultatif en V1.",
      ready: input.smsProviderConfigured,
      todo: "Renseigner les variables du fournisseur SMS si le canal doit être ouvert.",
    },
    {
      key: "dispatcher",
      label: "Dispatcher activé",
      meaning:
        "L'interrupteur d'envoi réel. Désarmé, les messages sont préparés et tracés, mais rien ne part.",
      ready: input.dispatchEnabled,
      todo: "Décision d'exploitation : armer l'interrupteur d'envoi une fois le reste validé.",
    },
    {
      key: "modeles",
      label: "Modèles prêts",
      meaning: `Au moins un modèle au statut « actif ». ${input.templateCount} version(s) existent, ${input.activeTemplateCount} active(s).`,
      ready: input.activeTemplateCount > 0,
      todo: "Relire le contenu d'un modèle, puis activer la version retenue.",
    },
    {
      key: "file",
      label: "Traitement de la file disponible",
      meaning:
        "La file peut être consommée par le dispatcher. Sans fournisseur, le traitement reste une simulation.",
      ready: input.queueProcessable,
      todo: "Configurer au moins un fournisseur pour rendre le traitement effectif.",
    },
    {
      key: "preuve",
      label: "Preuve de livraison disponible",
      meaning:
        "Un statut de livraison rapporté par le fournisseur (webhook ou sondage). Sans preuve, aucun message ne peut être déclaré livré.",
      ready: input.deliveryProofAvailable,
      todo: "Mettre en place la remontée de statut du fournisseur avant toute affirmation de livraison.",
    },
  ];
}

/**
 * Décisions **bloquantes** pour toute activation marketing. Aucune n'est
 * technique : elles relèvent d'un arbitrage juridique et organisationnel, hors
 * du système.
 */
export interface MarketingDecision {
  key: string;
  label: string;
  question: string;
  /** Décision réellement validée hors du système ? Faux par défaut en V1. */
  settled: boolean;
}

export const MARKETING_DECISIONS: readonly MarketingDecision[] = [
  {
    key: "base_legale",
    label: "Base légale",
    question:
      "Sur quelle base légale repose la prospection marketing, et par qui a-t-elle été arbitrée ?",
    settled: false,
  },
  {
    key: "texte_information",
    label: "Texte d'information",
    question:
      "Quel texte d'information est présenté à la personne, dans quelle version, et où en est conservée la preuve ?",
    settled: false,
  },
  {
    key: "duree_conservation",
    label: "Durée de conservation",
    question: "Combien de temps les données sont-elles conservées, et selon quelle règle ?",
    settled: false,
  },
  {
    key: "opposition",
    label: "Opposition / désinscription",
    question:
      "Par quel mécanisme la personne s'oppose-t-elle, et comment ce refus est-il rendu opposable partout ?",
    settled: false,
  },
  {
    key: "exercice_droits",
    label: "Exercice des droits",
    question: "Qui traite les demandes d'accès, de rectification et d'opposition, et sous quel délai ?",
    settled: false,
  },
  {
    key: "suppression",
    label: "Suppression ou anonymisation",
    question:
      "Que devient une donnée en fin de conservation : suppression, anonymisation, et selon quelle traçabilité ?",
    settled: false,
  },
  {
    key: "liste_opposition",
    label: "Liste d'opposition",
    question:
      "Comment la liste d'opposition est-elle alimentée, consultée et rendue prioritaire sur toute campagne ?",
    settled: false,
  },
];

export interface MarketingActivationState {
  /** Vrai tant qu'au moins une décision reste à prendre. En V1 : toujours vrai. */
  blocked: boolean;
  pending: readonly MarketingDecision[];
  settled: readonly MarketingDecision[];
  /** Formulation affichée. Ne contient jamais « conforme ». */
  statement: string;
}

/**
 * État d'activation MARKETING. Volontairement conservateur : l'absence de
 * décision vaut blocage, jamais autorisation.
 */
export function marketingActivation(
  decisions: readonly MarketingDecision[] = MARKETING_DECISIONS,
): MarketingActivationState {
  const pending = decisions.filter((d) => !d.settled);
  const settled = decisions.filter((d) => d.settled);
  return {
    blocked: pending.length > 0,
    pending,
    settled,
    statement:
      pending.length > 0
        ? `Activation bloquée — ${pending.length} décision(s) restent à trancher hors du système.`
        : "Toutes les décisions listées ont été tranchées. Une validation juridique demeure requise avant toute campagne.",
  };
}

/**
 * Vrai si une activation marketing peut être proposée dans l'interface.
 * **Toujours faux en V1** : la fonction existe pour être appelée et testée là où
 * une activation serait envisagée, plutôt que d'être supposée.
 */
export function canOfferMarketingActivation(): false {
  return false;
}

/** Formule autorisée pour décrire l'état RGPD. Ne contient jamais « conforme ». */
export const RGPD_STATEMENT =
  "Prodigio enregistre les choix, les bases légales déclarées et les oppositions. Il n'en déduit aucune conformité : la validation juridique reste à obtenir hors du système.";
