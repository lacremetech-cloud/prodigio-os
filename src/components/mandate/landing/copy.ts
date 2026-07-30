/**
 * Contenu éditorial de la landing propriétaire (refonte cinématographique v2).
 * Isolé du contenu du parcours (`analysis`) pour ne pas toucher au quiz.
 * Ton premium, affirmatif, orienté conversion.
 */

export const CTA_PRIMARY = "Tester l'éligibilité de ma propriété";
export const CTA_NAV = "Tester mon éligibilité";
export const MICROCOPY = "Analyse confidentielle — environ 1 minute";
export const CTA_SUB = "1 minute · Confidentiel · Sans engagement";

export const marqueeItems = [
  "Immobilier d'exception",
  "Mise en marché active",
  "Créer le coup de cœur",
  "1 bien · 1 écrin",
  "En France comme à l'étranger",
];

export const hero = {
  brand: "PRODIGIO",
  tagline: "Immobilier d'exception",
  eyebrow: "Immobilier d'exception — Mise en marché active",
  titleLine1: "Votre propriété mérite",
  titleLine2: "plus qu'une annonce.",
  subtitle:
    "Prodigio transforme chaque bien sélectionné en une marque singulière et " +
    "déploie une stratégie active pour aller chercher ses futurs acquéreurs, en " +
    "France comme à l'étranger.",
  scrollCue: "Découvrir le système",
} as const;

/** Moment signature — la phrase que le client aime. */
export const statement = {
  kicker: "La différence",
  line1: "Prodigio ne met pas votre bien en vente.",
  line2: "Prodigio le vend.",
  support:
    "Une méthode active, née du marketing. On ne publie pas une annonce et on " +
    "ne l'attend pas : nous créons les conditions du coup de cœur, puis nous " +
    "allons chercher l'acheteur.",
} as const;

export const constat = {
  index: "01",
  kicker: "Le constat",
  title: "Vos biens méritent un meilleur écrin.",
  body:
    "Sur les portails, même une demeure d'exception est présentée comme une " +
    "annonce ordinaire : quelques photos, un descriptif, un prix, un formulaire. " +
    "Un bien rare mérite son propre récit et sa propre stratégie de mise en marché.",
  card: {
    label: "Annonce standard",
    lines: ["Photographies", "Descriptif", "Caractéristiques", "Formulaire de contact"],
  },
} as const;

/** Comparaison interactive « annonce standard ↔ écrin Prodigio » + illustrations. */
export const ecrin = {
  beforeLabel: "Annonce standard",
  afterLabel: "Écrin Prodigio",
  hint: "Glissez pour comparer",
  gallery: [
    { key: "ecrinIdentite", caption: "Carte d'identité du bien" },
    { key: "ecrinBrochureCover", caption: "Brochure confidentielle" },
    { key: "ecrinPublicites", caption: "≈ 15 publicités par bien" },
  ],
} as const;

export const systeme = {
  index: "02",
  kicker: "Le Système Prodigio",
  titleLine1: "Nous n'attendons pas le coup de cœur.",
  titleLine2: "Nous créons les conditions pour qu'il se produise.",
  phases: [
    {
      n: "I",
      title: "Comprendre",
      lead: "L'étude au sniper",
      text: "Identifier l'acheteur idéal du bien : qui il est, où il vit, ce qui déclenche son intérêt.",
    },
    {
      n: "II",
      title: "Concevoir",
      lead: "Une marque, pas une fiche",
      text: "Stratégie, angles de désir et récit sur mesure — le bien devient une identité à part entière.",
    },
    {
      n: "III",
      title: "Produire",
      lead: "Film, image, narration",
      text: "Captation cinématographique, écrin éditorial et site dédié : 1 bien, 1 univers.",
    },
    {
      n: "IV",
      title: "Acquérir",
      lead: "Aller chercher l'acheteur",
      text: "Campagnes ciblées en France et à l'étranger, puis qualification avant la moindre visite.",
    },
  ],
} as const;

export const modele = {
  index: "03",
  kicker: "Le modèle",
  title: "Nous finançons la visibilité.",
  emphasis: "Rémunérés au résultat.",
  text:
    "Sur les biens éligibles, Prodigio avance les campagnes d'acquisition " +
    "d'acheteurs. Notre intérêt est simple et aligné sur le vôtre : la vente.",
} as const;

export const preuve = {
  index: "04",
  kicker: "La preuve",
  title: "Un cas réel, présenté sans promesse.",
  intro: "De l'exposition à la signature — l'entonnoir d'une mise en marché active.",
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

export const comparaison = {
  index: "05",
  kicker: "Avant / Avec Prodigio",
  title: "La même propriété, deux trajectoires.",
  before: {
    label: "Sans Prodigio",
    items: [
      "Une fiche parmi d'autres",
      "Diffusion passive",
      "Audience déjà en recherche",
      "Présentation standardisée",
    ],
  },
  after: {
    label: "Avec Prodigio",
    items: [
      "Un écrin dédié",
      "Une stratégie active",
      "Des audiences ciblées",
      "Une qualification avant les visites",
      "Une mise en marché conçue autour du bien",
    ],
  },
} as const;

export const selection = {
  index: "06",
  kicker: "Sélection & confidentialité",
  title: "Nous ne travaillons pas avec toutes les propriétés.",
  text:
    "Chaque demande fait l'objet d'une première analyse confidentielle. Nous " +
    "étudions le bien, sa localisation, son positionnement et son potentiel de " +
    "mise en marché avant de confirmer son éligibilité au système Prodigio.",
} as const;

export const finalCta = {
  eyebrow: "Analyse confidentielle",
  title: "Votre propriété est-elle éligible au Système Prodigio ?",
  text: "Une première lecture confidentielle, sans engagement — environ une minute.",
} as const;

export const footer = {
  brand: "PRODIGIO",
  tagline: "Immobilier d'exception — mise en marché active",
} as const;
