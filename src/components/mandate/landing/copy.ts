/**
 * Contenu éditorial de la landing propriétaire (v3 — resserrage éditorial).
 * Isolé du contenu du parcours (`analysis`) pour ne pas toucher au quiz.
 *
 * Principe : **une idée par écran, jamais deux fois la même**. Chaque bloc
 * apporte une information neuve ; les redites (constat répété, listes
 * « avant/après », rappels de sélection) ont été supprimées.
 */

/** Libellé d'action unique sur toute la page (nav, hero, CTA final, CTA collant). */
export const CTA_PRIMARY = "Voir si mon bien est éligible";
/** Variante courte, réservée à l'en-tête (contrainte de largeur). */
export const CTA_NAV = "Vérifier mon éligibilité";
export const MICROCOPY = "Analyse confidentielle — environ 1 minute";
export const CTA_SUB = "1 minute · Confidentiel · Sans engagement";

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
  subtitle: "Nous ne la mettons pas en vente. Nous allons chercher l'acheteur.",
  scrollCue: "Le film",
} as const;

/** Écrin vidéo — sorti de la hero pour laisser l'action au-dessus de la ligne de flottaison. */
export const vsl = {
  kicker: "Le film",
  title: "Le système en cinq minutes.",
} as const;

/** Moment signature — la phrase que le client aime. */
export const statement = {
  kicker: "La différence",
  line1: "Prodigio ne met pas votre bien en vente.",
  line2: "Prodigio le vend.",
  support:
    "Nous ne publions pas une annonce en attendant l'acheteur. Nous allons le chercher.",
} as const;

export const constat = {
  index: "01",
  kicker: "L'écrin",
  title: "Vos biens méritent un meilleur écrin.",
  body:
    "Sur les portails, une demeure d'exception devient une annonce ordinaire. " +
    "Un bien rare mérite son propre récit.",
} as const;

/** Comparaison en deux parties : agences classiques ↔ mise en marché Prodigio. */
export const ecrin = {
  classique: {
    label: "Partout ailleurs",
    title: "La même fiche, partout.",
    text: "Un prix, quelques photos, un formulaire. Le même format pour tous les biens.",
  },
  prodigio: {
    label: "Avec Prodigio",
    title: "Une marque. Un site dédié.",
    text:
      "Une page dédiée, une carte d'identité, une brochure confidentielle. " +
      "Votre bien retrouve sa singularité.",
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
  phases: [
    {
      n: "I",
      title: "Comprendre",
      lead: "L'étude au sniper",
      text: "Qui achètera ce bien, où il vit, ce qui le décide.",
    },
    {
      n: "II",
      title: "Concevoir",
      lead: "Une marque, pas une fiche",
      text: "Un récit et une identité, pas une fiche technique.",
    },
    {
      n: "III",
      title: "Produire",
      lead: "Film, image, narration",
      text: "Captation, écrin éditorial, site dédié. 1 bien, 1 univers.",
    },
    {
      n: "IV",
      title: "Acquérir",
      lead: "Aller chercher l'acheteur",
      text: "Campagnes ciblées en France et à l'étranger, puis qualification.",
    },
  ],
} as const;

export const modele = {
  index: "03",
  kicker: "Le modèle",
  title: "Nous finançons la visibilité.",
  emphasis: "Rémunérés au résultat.",
  text:
    "Sur les biens éligibles, nous avançons les campagnes d'acquisition. " +
    "Notre intérêt est le vôtre : la vente.",
} as const;

export const preuve = {
  index: "04",
  kicker: "La preuve",
  title: "Un cas réel, présenté sans promesse.",
  intro: "De l'exposition à la signature.",
  stats: [
    { value: 312, suffix: "", label: "demandes générées en 14 jours" },
    { value: 172, suffix: "", label: "budgets déclarés" },
    { value: 23, suffix: "", label: "acquéreurs à plus de 1 M€" },
    { value: 6, suffix: "", label: "visites organisées" },
    { value: 1, suffix: "", label: "vente" },
  ],
  disclaimer:
    "Il s'agit d'un cas réel. Les résultats dépendent du bien, du marché et de " +
    "la stratégie déployée, et ne constituent pas une garantie de performance.",
} as const;

/** Fin de page : la sélectivité et l'appel à l'action, réunis en un seul écran. */
export const finalCta = {
  eyebrow: "Sélection & confidentialité",
  title: "Votre propriété est-elle éligible ?",
  text:
    "Nous ne travaillons pas avec toutes les propriétés. Chaque demande fait " +
    "l'objet d'une analyse confidentielle.",
} as const;

export const footer = {
  brand: "PRODIGIO",
  tagline: "Immobilier d'exception — mise en marché active",
} as const;
