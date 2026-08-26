/**
 * Contenu éditorial de la landing propriétaire.
 *
 * **Big Idea : l'acquisition active.** Prodigio ne remplace pas les portails,
 * le réseau ni le fichier acquéreurs — il ajoute une couche qui manque : aller
 * chercher l'attention d'acheteurs qui ne cherchent pas encore.
 *
 * Règles d'écriture :
 * - Le visiteur qui ne lit **que les grands titres** doit comprendre l'offre.
 *   L'enchaînement des `title` de ce fichier raconte l'histoire complète.
 * - Montrer plutôt qu'expliquer : si une idée demande trois paragraphes, elle
 *   est mal posée.
 * - Jamais de caricature de la profession immobilière. L'adversaire est la
 *   commercialisation **passive**, pas l'agent immobilier.
 * - Aucune statistique inventée, aucun pays inventé, aucun délai promis,
 *   aucune condition économique chiffrée (paramètres contractuels versionnés).
 */

/** Libellé d'action unique — la phrase prononcée à la fin de la VSL. */
export const CTA_PRIMARY = "Vérifier l'éligibilité de ma propriété";
/** Variante courte, réservée à l'en-tête (contrainte de largeur). */
export const CTA_NAV = "Vérifier mon éligibilité";
/** Réassurance courte, sous le CTA du hero. */
export const CTA_SUB = "1 minute · Confidentiel · Sans engagement";
/** Réassurance complète, sous les CTA de fin de page. */
export const MICROCOPY = "Questionnaire d'une minute · Étude confidentielle · Sans engagement";

export const hero = {
  brand: "PRODIGIO",
  tagline: "Immobilier d'exception",
  eyebrow: "L'immobilier d'exception, autrement.",
  title: "Et si votre futur acheteur ne cherchait pas encore votre propriété ?",
  subtitle:
    "Prodigio ne se contente pas d'attendre qu'un acquéreur trouve votre bien. " +
    "Nous allons chercher son attention.",
  /** Barre de réassurance, sous le CTA. Quatre repères, aucun superlatif. */
  reassurance: [
    "France & International",
    "Acquisition active",
    "Commercialisation financée par Prodigio",
    "Rémunération au succès",
  ],
} as const;

/** Preuve immédiate — comprise en trois secondes, juste après la VSL. */
export const proofStrip = {
  eyebrow: "Une campagne Prodigio",
  title: "14 jours. Une propriété à 1,6 M€.",
  stats: [
    { value: 312, label: "demandes" },
    { value: 23, label: "budgets > 1 M€" },
    { value: 6, label: "visites qualifiées" },
    { value: 1, label: "vente" },
  ],
  note: "Font-Romeu · Résultats issus d'une campagne Prodigio",
} as const;

/** Big Idea — le problème invisible : la demande existante ne fait pas tout. */
export const bigIdea = {
  eyebrow: "Mettre en vente ≠ commercialiser",
  title: "Votre propriété est visible par ceux qui la cherchent.",
  emphasis: "Et tous les autres ?",
  traditional: {
    label: "Méthodes traditionnelles",
    items: ["Portails", "Google", "Fichier acquéreurs", "Réseau"],
    outcome: "Acheteurs déjà en recherche",
  },
  prodigio: {
    label: "Prodigio",
    items: ["Méthodes traditionnelles", "+ Acquisition active"],
    outcome: "Nouveaux acheteurs potentiels",
  },
  body:
    "Les méthodes traditionnelles captent une demande existante. Prodigio " +
    "ajoute une stratégie pour aller chercher de nouvelles intentions.",
  punch:
    "Pourquoi attendre que votre acheteur cherche votre propriété quand nous " +
    "pouvons la lui présenter ?",
} as const;

/**
 * Prolongement visuel de la Big Idea : où se trouve l'attention.
 *
 * ⚠️ Les deux volumes ci-dessous sont des données publiques d'audience.
 * `sourceNote` doit être **confirmée** (source et millésime exacts) avant toute
 * mise en production : aucune statistique ne doit être publiée sans référence
 * vérifiable.
 */
export const audience = {
  title: "Votre acheteur est peut-être déjà devant nous.",
  stats: [
    { value: "51,5 M", label: "d'identités actives sur les réseaux sociaux en France" },
    { value: "5,79 Md", label: "dans le monde" },
  ],
  punch:
    "Pourquoi attendre qu'il cherche votre propriété quand nous pouvons la lui " +
    "présenter ?",
  reach: "France · Europe · International",
  reachNote:
    "Lorsque le profil du bien le justifie, nos campagnes peuvent dépasser les " +
    "frontières.",
  sourceNote: "Sources : données publiques d'audience des réseaux sociaux.",
  adMock: {
    sponsored: "Sponsorisé",
    caption: "Une propriété d'exception vient d'arriver sur le marché.",
    cta: "En savoir plus",
    note: "Illustration d'une publicité Prodigio.",
  },
} as const;

/** Création — la raison d'être de l'écrin : donner envie de regarder. */
export const creation = {
  eyebrow: "La création",
  title: "Votre propriété mérite mieux qu'une annonce.",
  subtitle: "Pour capter l'attention, encore faut-il donner envie de regarder.",
  disciplines: ["Film", "Photographie", "Storytelling", "Expérience digitale"],
  punch: "Chaque propriété devient son propre univers.",
  classique: { label: "Annonce classique" },
  prodigio: {
    label: "Expérience Prodigio",
    captions: {
      ecrinProdigio: "Site dédié au bien",
      ecrinIdentite: "Carte d'identité",
      ecrinBrochureCover: "Brochure confidentielle",
    },
  },
} as const;

/** Vitrine — l'écrin d'un bien réel, ouvert en direct dans la page. */
export const vitrine = {
  eyebrow: "L'écrin, en vrai",
  title: "Ouvrez-le. C'est un bien réel.",
  site: { label: "Le site dédié", hint: "Parcourez la page du bien", open: "Ouvrir le site" },
  brochure: {
    label: "La brochure confidentielle",
    hint: "Tournez les pages",
    open: "Feuilleter en grand",
  },
} as const;

/** Le système, en six temps. Six lignes, pas six pavés. */
export const systeme = {
  eyebrow: "Le Système Prodigio",
  title: "Une stratégie construite autour d'un seul bien : le vôtre.",
  phases: [
    { n: "01", title: "Comprendre", text: "Le bien. Son marché. Son acheteur." },
    { n: "02", title: "Créer", text: "L'angle. L'image. Le désir." },
    { n: "03", title: "Diffuser", text: "France & international." },
    { n: "04", title: "Qualifier", text: "Projet. Budget. Timing." },
    { n: "05", title: "Visiter", text: "Les profils pertinents." },
    { n: "06", title: "Vendre", text: "" },
  ],
} as const;

/** Skin in the game — l'argument économique, en rupture visuelle. */
export const engagement = {
  eyebrow: "Notre engagement",
  title: "Nous ne vous demandons pas seulement de croire en notre stratégie.",
  reveal: "Nous investissons nous-mêmes dedans.",
  items: ["Création", "Technologie", "Acquisition", "Diffusion"],
  body: "Prodigio finance la commercialisation des propriétés sélectionnées.",
  punch: "Nos intérêts sont alignés : vendre.",
  note: "Rémunération au succès, selon les conditions prévues au mandat.",
} as const;

/** Transparence — le propriétaire voit ce qui est fait pour vendre son bien. */
export const transparence = {
  eyebrow: "Transparence",
  title: "Ne vous demandez plus ce qui est fait pour vendre votre propriété.",
  metrics: [
    { label: "Personnes touchées" },
    { label: "Demandes" },
    { label: "Budgets compatibles" },
    { label: "Profils qualifiés" },
    { label: "Visites" },
  ],
  body: "Suivez la commercialisation. Comprenez le marché. Mesurez l'intérêt.",
  /** Mention obligatoire : l'interface est une illustration, pas un résultat. */
  disclaimer: "Illustration d'interface — les valeurs présentées sont fictives.",
} as const;

/** Case study — la démonstration complète du mécanisme. */
export const caseStudy = {
  eyebrow: "Font-Romeu · 1,6 M€",
  title: "Nous n'avons pas attendu son acheteur.",
  steps: [
    { value: "14 jours", label: "de campagne" },
    { value: "312", label: "demandes" },
    { value: "172", label: "budgets déclarés" },
    { value: "23", label: "budgets > 1 M€" },
    { value: "6", label: "visites" },
    { value: "Vendu", label: "" },
  ],
  conclusion:
    "Nous avons créé les conditions pour que le chalet trouve son acheteur.",
  disclaimer:
    "Il s'agit d'un cas réel. Les résultats dépendent du bien, du marché et de " +
    "la stratégie déployée, et ne constituent pas une garantie de performance.",
} as const;

/** Comparaison — additive, jamais accusatrice. */
export const comparaison = {
  eyebrow: "Ce que nous ajoutons",
  traditional: {
    label: "Commercialisation traditionnelle",
    items: ["Portails", "Réseau", "Fichier acquéreurs", "Expertise immobilière"],
  },
  prodigio: {
    label: "Prodigio",
    lead: "Tout cela, plus :",
    items: [
      "Acquisition active",
      "Campagnes dédiées",
      "Expérience propre au bien",
      "Qualification",
      "Data",
      "Diffusion internationale lorsque pertinente",
    ],
  },
  punchLine1: "Nous ne remplaçons pas ce qui fonctionne.",
  punchLine2: "Nous ajoutons ce qui manque.",
} as const;

/** Sélectivité — la montée en gamme avant le dernier CTA. */
export const selection = {
  eyebrow: "Système Prodigio",
  title: "Toutes les propriétés n'intègrent pas Prodigio.",
  emphasis: "Et c'est volontaire.",
  body:
    "Nous sélectionnons les propriétés pour lesquelles notre système peut " +
    "réellement faire la différence.",
  criteria: ["Valeur", "Potentiel", "Marché"],
} as const;

/** FAQ — lever les dernières objections, rien de plus. */
export const faq = {
  eyebrow: "Questions fréquentes",
  title: "Avant de nous confier votre propriété.",
  items: [
    {
      q: "Combien coûte le système Prodigio ?",
      a:
        "Rien à l'avance. Prodigio finance la création et la diffusion des " +
        "propriétés sélectionnées, et n'est rémunéré qu'au succès, selon les " +
        "conditions prévues au mandat.",
    },
    {
      q: "Dois-je signer un mandat exclusif ?",
      a:
        "Une stratégie dans laquelle nous investissons réellement suppose un " +
        "engagement réciproque. Les modalités exactes sont définies avec " +
        "l'agence porteuse du mandat, et vous sont présentées avant toute " +
        "signature.",
    },
    {
      q: "Qui finance les campagnes publicitaires ?",
      a:
        "Nous. C'est le sens du modèle : nous engageons nos propres moyens dans " +
        "la commercialisation, donc notre intérêt est le même que le vôtre — " +
        "la vente.",
    },
    {
      q: "Mon bien peut-il être présenté à l'étranger ?",
      a:
        "Oui, lorsque le profil du bien le justifie. La diffusion s'étend alors " +
        "au-delà de la France, en fonction de l'endroit où se trouvent " +
        "réellement les acheteurs de ce type de propriété.",
    },
    {
      q: "Comment sélectionnez-vous les propriétés ?",
      a:
        "Sur la valeur, le potentiel de mise en marché et le marché visé. Un " +
        "refus n'est pas un jugement sur votre bien : c'est un aveu sur ce que " +
        "notre système sait faire, et sur ce qu'il ne sait pas faire.",
    },
  ],
} as const;

/** Dernier écran — une propriété plein cadre, une question, un geste. */
export const finalCta = {
  title: "Votre futur acheteur est peut-être déjà là.",
  subtitle: "Faisons en sorte que votre propriété arrive jusqu'à lui.",
  brand: "PRODIGIO",
  brandLine: "Votre propriété mérite mieux qu'une annonce.",
} as const;

export const footer = {
  brand: "PRODIGIO",
  tagline: "Immobilier d'exception — mise en marché active",
} as const;
