/**
 * Contenu éditorial de la landing propriétaire (refonte cinématographique).
 * Isolé du contenu du parcours (`analysis`) pour ne pas toucher au quiz.
 * Français ; ton premium, sélectif, sans jargon « startup ».
 */

export const CTA_PRIMARY = "Tester l'éligibilité de ma propriété";
export const CTA_NAV = "Tester mon éligibilité";
export const MICROCOPY = "Analyse confidentielle — environ 1 minute";

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
} as const;

export const constat = {
  index: "01",
  kicker: "Le constat",
  title:
    "Même les plus belles demeures finissent encore présentées comme des annonces ordinaires.",
  body:
    "Un bien d'exception ne devrait pas être noyé dans un catalogue. Il mérite " +
    "son propre écrin, son propre récit et sa propre stratégie de mise en marché.",
  card: {
    label: "Annonce standard",
    lines: ["Photographies", "Descriptif", "Caractéristiques", "Formulaire de contact"],
  },
} as const;

export const systeme = {
  index: "02",
  kicker: "Le Système Prodigio",
  titleLine1: "Nous n'attendons pas le coup de cœur.",
  titleLine2: "Nous créons les conditions pour qu'il se produise.",
  steps: [
    {
      n: "01",
      title: "Transformer votre propriété en marque",
      text: "Film, photographie, narration, identité et site dédié.",
    },
    {
      n: "02",
      title: "Aller chercher son futur acquéreur",
      text: "Campagnes ciblées en France et à l'étranger.",
    },
    {
      n: "03",
      title: "Qualifier avant la visite",
      text: "Budget, projet, temporalité et intérêt réel.",
    },
  ],
} as const;

export const preuve = {
  index: "03",
  kicker: "La preuve",
  title: "Un cas réel, présenté sans promesse.",
  stats: [
    { value: "312", label: "demandes générées en 14 jours" },
    { value: "172", label: "budgets déclarés" },
    { value: "23", label: "acquéreurs à plus de 1 M€" },
    { value: "6", label: "visites organisées" },
    { value: "1", label: "vente" },
  ],
  disclaimer:
    "Il s'agit d'un cas réel. Les résultats dépendent du bien, du marché et de " +
    "la stratégie déployée, et ne constituent pas une garantie de performance.",
} as const;

export const comparaison = {
  index: "04",
  kicker: "Avant / Avec Prodigio",
  title: "La même propriété, deux trajectoires.",
  before: {
    label: "Avant",
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
  index: "05",
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
  note:
    "Prodigio est un système de commercialisation active de biens immobiliers " +
    "d'exception. Les mandats sont portés par une entité immobilière habilitée.",
} as const;
