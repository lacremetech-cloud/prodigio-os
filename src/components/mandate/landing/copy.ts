import { CTA_LABEL, CTA_LABEL_SHORT } from "@/config/cta";
import { EXPERIENCE_LABEL, SYSTEM_NAME } from "@/config/credentials";

/**
 * Contenu éditorial de la landing propriétaire.
 *
 * **Big Idea : le Système Prodigio va chercher l'acheteur.** Prodigio ne
 * remplace pas les portails, le réseau ni le fichier acquéreurs — il ajoute ce
 * qui manque : aller chercher activement les bons acheteurs.
 *
 * **Trois promesses, et rien d'autre :** vendre plus vite, trouver les bons
 * acheteurs, défendre la valeur du bien. Jamais de délai ni de prix garantis —
 * « au prix qu'il mérite » est une promesse de valorisation, pas un engagement
 * contractuel.
 *
 * **Zéro jargon face au propriétaire.** Pas de « lead », « funnel », « avatar »,
 * « ciblage », « acquisition digitale » : chaque notion marketing est traduite
 * en bénéfice immobilier. Il doit penser « ils ont une manière différente de
 * trouver mon acheteur », pas « ils ont une belle machine publicitaire ».
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

/**
 * Libellé d'action unique. Il n'est **pas** figé ici : les formulations en
 * attente d'arbitrage vivent dans `@/config/cta`, sélectionnables par variable
 * d'environnement, et la variante active accompagne chaque `cta_click`.
 */
export const CTA_PRIMARY = CTA_LABEL;
/** Variante courte, réservée à l'en-tête (contrainte de largeur). */
export const CTA_NAV = CTA_LABEL_SHORT;
/** Réassurance courte, sous le CTA du hero. */
export const CTA_SUB = "Questionnaire d'une minute · Étude confidentielle · Sans engagement";
/** Réassurance complète, sous les CTA de fin de page. */
export const MICROCOPY = "Questionnaire d'une minute · Étude confidentielle · Sans engagement";

export const hero = {
  brand: "PRODIGIO",
  tagline: "Immobilier d'exception",
  /** Cartouche d'ouverture : le nom de la méthode, en capitales. */
  badge: SYSTEM_NAME,
  title: "Et si, au lieu d'attendre votre acheteur, nous allions le chercher ?",
  /**
   * Sous-titre en trois morceaux : le nom de la méthode est mis en valeur au
   * milieu de la phrase, sans la casser.
   */
  subtitleBefore: `Après ${EXPERIENCE_LABEL} dans l'immobilier, nous avons créé le `,
  systemName: SYSTEM_NAME,
  subtitleAfter:
    " pour trouver activement les bons acheteurs et vendre votre bien plus " +
    "vite, au prix qu'il mérite.",
  /** Annotation manuscrite qui désigne le film. Formulation validée — ne pas réécrire. */
  vslNote: "En moins de 5 min, on vous explique tout.",
  /** Invitation portée par l'affiche du film, sur l'image elle-même. */
  vslInvite: `Découvrez comment le ${SYSTEM_NAME} va chercher activement l'acheteur de votre bien.`,
  /** Repère de durée — ⚠️ à ajuster lors du montage de la VSL définitive. */
  vslDuration: "4 min",
} as const;

/** Preuve immédiate — comprise en trois secondes, juste après la VSL. */
export const proofStrip = {
  eyebrow: "Une campagne Prodigio",
  title: "14 jours de campagne.",
  stats: [
    { value: 312, label: "demandes" },
    { value: 23, label: "budgets déclarés > 1 M€" },
    { value: 6, label: "visites qualifiées" },
    { value: 1, label: "vente" },
  ],
  note: "Bien proposé à 1,6 M€ · Font-Romeu",
} as const;

/**
 * L'angle mort — puis où se trouve l'attention.
 *
 * Une seule section : le constat (« et tous les autres ? »), les volumes
 * d'audience, la portée géographique. La comparaison détaillée avec la
 * commercialisation traditionnelle vit plus bas ; elle n'a pas à être faite
 * deux fois.
 *
 * ⚠️ Les deux volumes ci-dessous sont des données publiques d'audience.
 * `sourceNote` doit être **confirmée** (source et millésime exacts) avant toute
 * mise en production : aucune statistique ne doit être publiée sans référence
 * vérifiable.
 */
export const audience = {
  eyebrow: "Mettre en vente n'est pas commercialiser",
  title: "Votre bien est visible par ceux qui le cherchent.",
  emphasis: "Et tous les autres ?",
  body:
    "Les méthodes traditionnelles touchent les acheteurs déjà en recherche. " +
    "Beaucoup d'autres ont le budget et l'envie, mais ne cherchent pas encore.",
  subtitle: "Votre acheteur est peut-être déjà devant nous.",
  stats: [
    { value: "51,5 M", label: "d'identités actives sur les réseaux sociaux en France" },
    { value: "5,79 Md", label: "dans le monde" },
  ],
  punch:
    "Pourquoi attendre qu'il cherche votre bien quand nous pouvons le lui " +
    "présenter ?",
  reach: "France · Europe · International",
  reachNote: "En France comme à l'étranger, lorsque le profil du bien le justifie.",
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
  subtitle: "Pour attirer le bon acheteur, encore faut-il lui donner envie de s'arrêter.",
  disciplines: ["Film", "Photographie", "Storytelling", "Expérience digitale"],
  punch: "Chaque propriété devient son propre univers.",
  classique: { label: "Annonce immobilière classique" },
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
  eyebrow: SYSTEM_NAME,
  title: "Une stratégie construite autour d'un seul bien : le vôtre.",
  phases: [
    { n: "01", title: "Comprendre", text: "Le bien et son marché." },
    { n: "02", title: "Créer", text: "Créer le désir." },
    { n: "03", title: "Diffuser", text: "Aller chercher son marché." },
    { n: "04", title: "Qualifier", text: "Projet · délai · budget." },
    { n: "05", title: "Visiter", text: "Les profils pertinents." },
    { n: "06", title: "Vendre", text: "" },
  ],
} as const;

/** Skin in the game — l'argument économique, en rupture visuelle. */
export const engagement = {
  eyebrow: "Notre engagement",
  title: "Nous ne nous contentons pas de prendre votre mandat.",
  reveal: "Nous investissons dans sa réussite.",
  /**
   * Ce que Prodigio engage réellement sur un bien sélectionné. La **diffusion**
   * ferme la liste et porte le poids visuel : c'est le poste que le propriétaire
   * ne voit jamais, et le seul qui décide si son bien est vu.
   *
   * ⚠️ Vocabulaire de commercialisation immobilière, jamais d'achat média : ni
   * CPC, ni CPM, ni ROAS, ni nom de régie. On vend une mise en marché, pas une
   * prestation publicitaire.
   */
  items: [
    "Photographie",
    "Production vidéo",
    "Site dédié",
    "Brochure",
    "Création publicitaire",
  ],
  climax: {
    label: "Diffusion",
    text: "Le budget qui décide si votre bien est vu — ou pas.",
  },
  punch: "Nos intérêts sont alignés : vendre.",
  note: "Rémunération au succès, selon les conditions prévues au mandat.",
} as const;

/** Transparence — le propriétaire voit ce qui est fait pour vendre son bien. */
export const transparence = {
  eyebrow: "Transparence",
  title: "Ne vous demandez plus ce qui est fait pour vendre votre bien.",
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
  /**
   * L'entonnoir, dans l'ordre. `n` porte les paliers chiffrés (animés) ;
   * `value` porte les paliers écrits. Le dernier est le climax.
   */
  steps: [
    { n: null, value: "14 jours", label: "de campagne" },
    { n: 312, value: null, label: "demandes" },
    { n: 172, value: null, label: "budgets déclarés" },
    { n: 23, value: null, label: "acquéreurs · budget > 1 M€" },
    { n: 6, value: null, label: "visites qualifiées" },
    { n: null, value: "1 vente", label: "" },
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
    intro: "Tout cela, plus :",
    items: [
      "Acquisition active",
      "Campagnes dédiées",
      "Expérience propre au bien",
      "Qualification",
      "Data",
      "Diffusion internationale lorsque pertinente",
    ],
  },
  body: "Les méthodes traditionnelles fonctionnent. Prodigio leur ajoute une dimension.",
  punchLine1: "Nous ne remplaçons pas ce qui fonctionne.",
  punchLine2: "Nous ajoutons ce qui manque.",
} as const;

/** Sélectivité — la montée en gamme avant le dernier CTA. */
export const selection = {
  eyebrow: SYSTEM_NAME,
  title: `Toutes les propriétés n'intègrent pas le ${SYSTEM_NAME}`,
  emphasis: "Et c'est volontaire.",
  body:
    "Nous sélectionnons les propriétés pour lesquelles nous pensons pouvoir " +
    "construire une stratégie capable de faire la différence.",
  criteria: ["Valeur", "Potentiel", "Marché"],
} as const;

/** FAQ — lever les dernières objections, rien de plus. */
export const faq = {
  eyebrow: "Questions fréquentes",
  title: "Avant de nous confier votre bien.",
  items: [
    {
      q: `Combien coûte le ${SYSTEM_NAME} ?`,
      a:
        "Rien à l'avance. Nous engageons nos propres moyens sur les biens " +
        "sélectionnés, et ne sommes rémunérés qu'au succès, selon les " +
        "conditions prévues au mandat.",
    },
    {
      q: "Qui finance la commercialisation et les campagnes ?",
      a:
        "Nous. C'est le sens du modèle : si nous vous demandons de nous confier " +
        "votre bien, nous devons être prêts à investir nous-mêmes dans sa " +
        "réussite.",
    },
    {
      q: "Dois-je confier mon bien en exclusivité ?",
      a:
        "Une stratégie dans laquelle nous investissons réellement suppose un " +
        "engagement réciproque. Les modalités exactes sont définies avec " +
        "l'agence porteuse du mandat et vous sont présentées avant toute " +
        "signature.",
    },
    {
      q: "Mon bien peut-il être présenté à des acheteurs étrangers ?",
      a:
        "Oui, lorsque le profil du bien le justifie. Nous cherchons les " +
        "acheteurs là où ils se trouvent réellement — en France comme à " +
        "l'étranger.",
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
  subtitle: "Faisons en sorte que votre bien arrive jusqu'à lui.",
  brand: "PRODIGIO",
  brandLine: "Votre bien mérite mieux qu'une annonce.",
} as const;

export const footer = {
  brand: "PRODIGIO",
  tagline: "Immobilier d'exception — mise en marché active",
} as const;
