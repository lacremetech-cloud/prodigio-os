/**
 * Contenu éditorial de la page d'accueil publique (`/`).
 *
 * Porte d'entrée premium vers l'écosystème Prodigio — volontairement COURTE :
 * elle présente Prodigio en quelques secondes puis oriente chaque visiteur vers
 * le bon parcours. Elle ne duplique pas la landing propriétaire (`/proprietaire`).
 *
 * Ton affirmatif, sans promesse juridiquement risquée, sans délai garanti ni
 * superlatif invérifiable.
 */

export const homeCopy = {
  nav: {
    /** Lien discret en haut à droite vers l'espace authentifié. */
    privateAccess: "Accès privé",
  },

  hero: {
    eyebrow: "Le Système Prodigio",
    /** Signature — sert de H1 unique de la page. */
    signatureLine1: "Prodigio ne met pas votre bien en vente.",
    signatureLine2: "Prodigio le vend.",
    description:
      "Prodigio est un système de mise en marché active conçu pour les " +
      "propriétés d'exception. Nous transformons chaque bien sélectionné en une " +
      "marque singulière, finançons sa visibilité et allons chercher ses futurs " +
      "acquéreurs en France comme à l'étranger.",
    ctaPrimary: "Voir si mon bien est éligible",
    ctaSecondary: "Découvrir le Système Prodigio",
    ctaSub: "1 minute · Confidentiel · Sans engagement",
    scrollCue: "Choisir mon accès",
  },

  /** Positionnement — ce qu'est (et n'est pas) Prodigio, en points courts. */
  positioning: {
    eyebrow: "Ce qu'est Prodigio",
    title: "Pas une agence. Un système de mise en marché active.",
    pillars: [
      {
        title: "Pas une agence classique",
        text: "Prodigio est un système de commercialisation active, pas une vitrine d'annonces.",
      },
      {
        title: "Chaque bien devient une marque",
        text: "La propriété sélectionnée reçoit son récit, son écrin éditorial et son site dédié.",
      },
      {
        title: "Nous finançons la visibilité",
        text: "Sur les biens éligibles, Prodigio avance les campagnes qui exposent votre propriété.",
      },
      {
        title: "En France et à l'étranger",
        text: "Nous allons chercher les acquéreurs là où ils se trouvent, sans attendre qu'ils viennent.",
      },
      {
        title: "Une mise en marché active",
        text: "On ne publie pas une annonce : on crée les conditions du coup de cœur.",
      },
      {
        title: "Un accès sur sélection",
        text: "Chaque projet fait l'objet d'une première analyse confidentielle avant d'entrer dans le système.",
      },
    ],
  },

  /** Aiguillage — « Choisissez votre accès ». */
  access: {
    eyebrow: "Choisissez votre accès",
    title: "Par où souhaitez-vous entrer ?",
    owner: {
      label: "Propriétaire d'un bien",
      text:
        "Vous envisagez la vente d'une propriété d'exception ? Découvrez la " +
        "méthode Prodigio et demandez une première analyse de votre projet.",
      linkSystem: "Découvrir le système",
      linkEligibility: "Vérifier mon éligibilité",
    },
    secure: {
      label: "Espace sécurisé",
      text:
        "Vous êtes déjà client, partenaire ou membre de l'équipe Prodigio ? " +
        "Accédez à votre environnement sécurisé.",
      link: "Accéder à Prodigio OS",
    },
  },
} as const;
