/**
 * Contenu éditorial de la landing propriétaire.
 *
 * Le texte est aligné sur le **script de la VSL** : la page dit ce que dit la
 * vidéo, avec les mêmes mots-clés et le même libellé de bouton, pour que le
 * visiteur qui regarde puis lit ne rencontre aucune dissonance.
 *
 * Principes : une idée par écran, jamais deux fois la même ; une affirmation
 * concrète plutôt qu'un adjectif ; aucune promesse chiffrée hors du cas réel
 * documenté (et son avertissement).
 */

/** Libellé d'action unique — **le même que celui prononcé dans la VSL**. */
export const CTA_PRIMARY = "Vérifier l'éligibilité de mon bien";
/** Variante courte, réservée à l'en-tête (contrainte de largeur). */
export const CTA_NAV = "Vérifier mon éligibilité";
export const MICROCOPY = "Questionnaire d'une minute · Étude confidentielle";
export const CTA_SUB = "Questionnaire d'une minute · Étude confidentielle";

export const marqueeItems = [
  "Immobilier d'exception",
  "Mise en marché active",
  "1 bien · 1 écrin",
  "En France comme à l'étranger",
];

export const hero = {
  brand: "PRODIGIO",
  tagline: "Immobilier d'exception",
  titleLine1: "Votre propriété mérite",
  titleLine2: "plus qu'une annonce.",
  /** Annotation manuscrite qui désigne le film, sous le titre. */
  vslNote: "En moins de 5 min, on vous explique tout.",
} as const;

/** Moment signature — le cœur émotionnel, repris de la VSL. */
export const statement = {
  kicker: "La différence",
  line1: "Prodigio ne met pas votre bien en vente.",
  line2: "Prodigio le vend.",
  support:
    "Ce n'est plus l'acheteur qui cherche le bien. C'est le bien qui vient " +
    "trouver son acheteur.",
} as const;

export const constat = {
  index: "01",
  kicker: "L'écrin",
  title: "Vos biens méritent un meilleur écrin.",
  body:
    "Une surface, un nombre de pièces, quelques photographies, une description. " +
    "Et juste à côté, des dizaines d'autres biens auxquels le vôtre est " +
    "immédiatement comparé.",
} as const;

/** Comparaison en deux parties : agences classiques ↔ mise en marché Prodigio. */
export const ecrin = {
  classique: {
    label: "Partout ailleurs",
    title: "La même fiche, partout.",
    text:
      "Les outils pour vendre un bien n'ont presque pas changé. Le vôtre devient " +
      "une annonce de plus.",
  },
  prodigio: {
    label: "Avec Prodigio",
    title: "Une marque. Un site dédié.",
    text:
      "Un film, des photographies, une narration, un site entièrement consacré " +
      "à votre bien. Il n'est plus mélangé aux autres : il devient le seul sujet.",
    captions: {
      ecrinProdigio: "Site dédié au bien",
      ecrinIdentite: "Carte d'identité",
      ecrinBrochureCover: "Brochure confidentielle",
    },
  },
} as const;

/** Vitrine — l'écrin d'un bien réel, ouvert en direct dans la page. */
export const vitrine = {
  index: "02",
  kicker: "L'écrin, en vrai",
  title: "Ouvrez-le. C'est un bien réel.",
  body:
    "Le site et la brochure ci-dessous sont ceux d'une propriété que nous avons " +
    "commercialisée. Feuilletez-les comme le ferait un acquéreur.",
  site: {
    label: "Le site dédié",
    hint: "Parcourez la page du bien",
    open: "Ouvrir le site",
  },
  brochure: {
    label: "La brochure confidentielle",
    hint: "Tournez les pages",
    open: "Feuilleter en grand",
  },
} as const;

/** Questions que se pose un propriétaire avant de remplir le questionnaire. */
export const faq = {
  index: "06",
  kicker: "Questions fréquentes",
  title: "Ce que les propriétaires nous demandent.",
  items: [
    {
      q: "Qui paie les campagnes publicitaires ?",
      a:
        "Nous. Sur les biens éligibles, Prodigio avance le budget de diffusion. " +
        "C'est le sens du modèle : nous sommes rémunérés au résultat, donc notre " +
        "intérêt est le même que le vôtre — la vente.",
    },
    {
      q: "Est-ce que je m'engage en remplissant le questionnaire ?",
      a:
        "Non. Le questionnaire sert à déterminer si votre bien relève du système " +
        "Prodigio. Il ne vaut ni mandat, ni promesse, ni engagement d'aucune " +
        "sorte, d'un côté comme de l'autre.",
    },
    {
      q: "Qui porte le mandat de vente ?",
      a:
        "Une agence immobilière habilitée, distincte du Système Prodigio. " +
        "Prodigio conçoit et pilote la mise en marché ; le mandat, les visites et " +
        "la transaction relèvent de l'agence partenaire.",
    },
    {
      q: "Ma démarche reste-t-elle confidentielle ?",
      a:
        "Oui. Votre demande est étudiée individuellement et n'est diffusée nulle " +
        "part. Rien n'est publié, ni même préparé, sans votre accord.",
    },
    {
      q: "Combien de temps faut-il pour vendre ?",
      a:
        "Nous ne promettons aucun délai : cela dépend du bien, de son prix et de " +
        "son marché. Ce que nous pouvons dire, c'est ce que nous faisons — aller " +
        "chercher l'acheteur au lieu d'attendre qu'il passe.",
    },
    {
      q: "Travaillez-vous avec tous les biens ?",
      a:
        "Non. Nous ne retenons que les propriétés pour lesquelles nous pensons " +
        "pouvoir construire une stratégie à la hauteur. Un refus n'est pas un " +
        "jugement sur votre bien : c'est un aveu sur ce que notre système sait " +
        "faire, et sur ce qu'il ne sait pas faire.",
    },
  ],
} as const;

export const systeme = {
  index: "03",
  kicker: "Le Système Prodigio",
  titleLine1: "Nous n'attendons pas le coup de cœur.",
  titleLine2: "Nous le provoquons.",
  lead:
    "Dans l'immobilier d'exception, on n'achète pas des mètres carrés. " +
    "On achète une sensation.",
  phases: [
    {
      n: "I",
      title: "Comprendre",
      lead: "Un ciblage chirurgical",
      text: "Qui achètera ce bien, où il vit, ce qui le fera basculer.",
    },
    {
      n: "II",
      title: "Concevoir",
      lead: "Une marque, pas une fiche",
      text: "On ne vend pas un chalet en montagne comme une villa en bord de mer.",
    },
    {
      n: "III",
      title: "Produire",
      lead: "Film, image, narration",
      text: "Un écrin entier pour un seul bien : votre propriété devient le sujet.",
    },
    {
      n: "IV",
      title: "Acquérir",
      lead: "Aller chercher l'acheteur",
      text: "Le bon message, sur le bon écran, devant la bonne personne.",
    },
  ],
} as const;

export const modele = {
  index: "04",
  kicker: "Le modèle",
  title: "Nous finançons la visibilité.",
  emphasis: "Rémunérés au résultat.",
  text:
    "Nous avons assez confiance dans le système pour avancer le budget de " +
    "diffusion des biens éligibles. Notre intérêt est le vôtre : la vente.",
} as const;

export const preuve = {
  index: "05",
  kicker: "La preuve",
  title: "Un cas réel, présenté sans promesse.",
  intro:
    "Un chalet proposé à 1,6 million d'euros, à Font-Romeu. Quatorze jours de " +
    "campagne.",
  stats: [
    { value: 312, suffix: "", label: "demandes générées" },
    { value: 172, suffix: "", label: "budgets déclarés" },
    { value: 23, suffix: "", label: "acquéreurs à plus de 1 M€" },
    { value: 6, suffix: "", label: "visites qualifiées" },
    { value: 1, suffix: "", label: "vente" },
  ],
  disclaimer:
    "Il s'agit d'un cas réel. Les résultats dépendent du bien, du marché et de " +
    "la stratégie déployée, et ne constituent pas une garantie de performance.",
} as const;

/** Fin de page : la sélectivité et l'appel à l'action, réunis en un seul écran. */
export const finalCta = {
  eyebrow: "Sélection & confidentialité",
  titleLine1: "Votre propriété mérite mieux qu'une annonce.",
  titleLine2: "Elle mérite une stratégie à sa mesure.",
  text:
    "Nous ne sélectionnons pas toutes les propriétés — uniquement celles pour " +
    "lesquelles nous pouvons construire une stratégie à la hauteur.",
} as const;

export const footer = {
  brand: "PRODIGIO",
  tagline: "Immobilier d'exception — mise en marché active",
} as const;
