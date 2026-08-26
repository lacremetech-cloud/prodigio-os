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
  /** Invitation à regarder le film — sous le titre, au-dessus de l'écrin. */
  vslNote: "Cinq minutes pour voir la différence.",
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

export const systeme = {
  index: "02",
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
  index: "03",
  kicker: "Le modèle",
  title: "Nous finançons la visibilité.",
  emphasis: "Rémunérés au résultat.",
  text:
    "Nous avons assez confiance dans le système pour avancer le budget de " +
    "diffusion des biens éligibles. Notre intérêt est le vôtre : la vente.",
} as const;

export const preuve = {
  index: "04",
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
