import { CTA_LABEL, CTA_LABEL_SHORT } from "@/config/cta";
import { EXPERIENCE_LABEL, SYSTEM_NAME } from "@/config/credentials";

/**
 * Contenu éditorial de la landing propriétaire.
 *
 * **La doctrine, en une ligne :** expertise immobilière traditionnelle **plus**
 * Système Prodigio™. Prodigio ne se positionne jamais *contre* l'immobilier de
 * prestige — il ajoute une capacité que celui-ci n'a pas : aller chercher les
 * acheteurs qui ne cherchent pas encore.
 *
 * **Deux marchés.** Le marché **actif** (déjà en recherche : portails, fichiers
 * acquéreurs, réseau, alertes) est très bien travaillé par les meilleures
 * agences, et Prodigio s'en sert aussi. Le marché **latent** — le patrimoine, le
 * budget, le profil, le timing, mais pas encore la recherche — n'est atteint par
 * personne. C'est celui-là que le Système va chercher.
 *
 * **Deux thèses de rupture, jamais des attaques :**
 * 1. *Le coup de cœur peut précéder la recherche.*
 * 2. *Visibilité ≠ acquisition.* Une publication est diffusée ; une campagne
 *    Prodigio apprend.
 *
 * Règles d'écriture :
 * - **La VSL explique, la landing démontre et rassure.** Ne jamais transcrire le
 *   film : le visiteur qui l'a regardé ne doit pas relire la même chose.
 * - Le visiteur qui ne lit **que les grands titres** doit comprendre l'offre.
 * - La cible connaît le métier. **Aucune caricature des agences de prestige** —
 *   elles ont des fichiers acquéreurs, des réseaux, des partenaires, de belles
 *   images et une vraie présence sociale. Tout cela fonctionne.
 * - Aucun jargon marketing, aucun vocabulaire d'achat média face au
 *   propriétaire : on vend une commercialisation immobilière.
 * - Aucune statistique inventée, aucun délai promis, aucune condition
 *   économique chiffrée (paramètres contractuels versionnés).
 */

/**
 * Libellé d'action unique. Les formulations candidates vivent dans
 * `@/config/cta`, sélectionnables par variable d'environnement, et la variante
 * active accompagne chaque `cta_click`.
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

/**
 * Preuve immédiate — quatre nombres, rien d'autre.
 *
 * Son unique rôle est de provoquer « d'accord… comment ? ». Tout ce qui
 * expliquerait ici affaiblirait la question.
 */
export const proofStrip = {
  eyebrow: "Le système en action",
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
 * Le marché invisible — la section la plus courte et la plus conceptuelle.
 *
 * Elle ne démontre rien : elle installe une question que le propriétaire ne
 * s'était pas posée. La démonstration vient juste après.
 */
export const marcheInvisible = {
  eyebrow: "Le marché invisible",
  title: "Et ceux qui pourraient acheter votre bien… sans encore le chercher ?",
  traits: ["Le patrimoine.", "Le budget.", "Le profil.", "Le timing."],
  body: "Ils ne savent simplement pas encore que votre propriété existe.",
  statement: "Le coup de cœur peut précéder la recherche.",
} as const;

/**
 * Marché actif + marché latent — le positionnement, énoncé sans opposition.
 *
 * ⚠️ La colonne « marché actif » décrit le travail réel des meilleures agences,
 * **et Prodigio s'en sert aussi**. Aucune formule accusatoire n'a sa place ici :
 * un test échoue si l'une réapparaît.
 */
export const marches = {
  eyebrow: "Deux marchés",
  title: "Les meilleures agences savent déjà très bien travailler le marché actif.",
  body:
    "Fichiers acquéreurs qualifiés, partenaires, réseau, portails, off-market, " +
    "images soignées, présence sur les réseaux sociaux.",
  aside: "Tout cela fonctionne. Et nous l'utilisons également.",
  actif: {
    label: "Marché actif",
    hint: "Ceux qui cherchent déjà",
    items: ["Fichiers acquéreurs", "Partenaires", "Réseau", "Portails", "Alertes"],
  },
  latent: {
    label: "Marché latent",
    hint: "Ceux qui ne cherchent pas encore",
    items: ["Le patrimoine", "Le budget", "Le profil", "Le timing"],
  },
  punchLine1: "Nous ne remplaçons pas ce qui fonctionne.",
  punchLine2: "Nous allons chercher ceux qui ne cherchent pas encore.",
} as const;

/**
 * Visibilité ≠ acquisition — l'un des deux messages les plus importants.
 *
 * ⚠️ Ne jamais écrire que les réseaux sociaux ou l'organique « ne marchent
 * pas ». Ils marchent. La question n'est pas le nombre de vues : c'est qui les a
 * faites, et ce que la diffusion a appris.
 *
 * Les 50 000 vues sont une **hypothèse de raisonnement**, jamais un résultat
 * Prodigio — la formulation doit le laisser évident.
 */
export const acquisition = {
  eyebrow: "Visibilité ≠ acquisition",
  title: "50 000 vues. Mais combien d'acheteurs ?",
  body:
    "Une belle vidéo peut atteindre des dizaines de milliers de personnes. " +
    "C'est excellent pour la visibilité. Reste la seule question qui compte pour " +
    "vous : combien avaient le budget, le profil et l'intérêt pour votre bien ?",
  publication: {
    label: "Une publication",
    items: ["Vues", "Engagement", "Un pic, puis plus rien"],
  },
  campagne: {
    label: `Une campagne ${SYSTEM_NAME}`,
    items: [
      "Profils",
      "Demandes",
      "Budgets déclarés",
      "Angles testés",
      "Moyens reconcentrés",
    ],
  },
  punchLine1: "Une publication est diffusée.",
  punchLine2: "Une campagne Prodigio apprend.",
  adMock: {
    sponsored: "Sponsorisé",
    caption: "Une propriété d'exception vient d'arriver sur le marché.",
    cta: "En savoir plus",
    note: "Illustration d'une publicité Prodigio.",
  },
} as const;

/** Le système, en sept temps. Sept lignes, pas sept pavés. */
export const systeme = {
  eyebrow: SYSTEM_NAME,
  title: "Une stratégie construite autour d'un seul bien : le vôtre.",
  phases: [
    { n: "01", title: "Comprendre", text: "Le bien, son marché, son acheteur." },
    { n: "02", title: "Positionner", text: "Identifier ce qui peut créer le déclic." },
    { n: "03", title: "Créer", text: "Construire son univers." },
    { n: "04", title: "Diffuser", text: "Aller chercher activement son marché." },
    { n: "05", title: "Apprendre", text: "Comprendre ce que les données révèlent." },
    { n: "06", title: "Optimiser", text: "Concentrer les moyens sur ce qui fonctionne." },
    { n: "07", title: "Qualifier", text: "Projet · délai · budget." },
  ],
  outcome: { from: "Visites qualifiées", to: "Vente" },
} as const;

/**
 * Création — le positionnement, pas la jolie image.
 *
 * « Nous faisons de belles photos » ne différencie rien : les meilleures agences
 * en font aussi. Ce qui différencie, c'est le travail en amont — trouver l'angle
 * qui fera désirer ce bien-là, auprès de ces profils-là.
 */
export const creation = {
  eyebrow: "Avant la diffusion",
  title: "Nous ne cherchons pas seulement à montrer votre bien.",
  emphasis: "Nous cherchons l'angle qui le fera désirer.",
  triggers: [
    "Une vue.",
    "Une architecture.",
    "Un art de vivre.",
    "Un emplacement.",
    "Un potentiel patrimonial.",
    "Un rendement.",
  ],
  body: "Chaque propriété possède ses propres déclencheurs.",
  chain: [
    "Positionnement",
    "Film",
    "Photographie",
    "Site dédié",
    "Brochure",
    "Créations publicitaires",
  ],
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
  title: "Ne nous croyez pas sur parole. Ouvrez-le.",
  site: { label: "Le site dédié", hint: "Parcourir l'expérience", open: "Ouvrir le site" },
  brochure: {
    label: "La brochure",
    hint: "Feuilleter la brochure",
    open: "Feuilleter en grand",
  },
} as const;

/**
 * Skin in the game — l'argument économique, en rupture visuelle.
 *
 * Trois familles de postes engagés, puis la **diffusion** en climax : c'est le
 * poste que le propriétaire ne voit jamais, et le seul qui décide si son bien
 * est vu.
 *
 * ⚠️ Vocabulaire de commercialisation immobilière, jamais d'achat média : ni
 * CPC, ni CPM, ni ROAS, ni nom de régie.
 */
export const engagement = {
  eyebrow: "Notre engagement",
  title: "Nous ne nous contentons pas de prendre votre mandat.",
  reveal: "Nous investissons dans sa réussite.",
  groups: [
    { label: "Production", items: ["Film", "Photographie", "Montage"] },
    { label: "Expérience", items: ["Site dédié", "Brochure", "Créations"] },
    { label: "Diffusion", items: ["Campagnes", "Tests", "Budget de diffusion"] },
  ],
  climax: {
    label: "Et surtout, nous finançons la diffusion.",
    text:
      "Aller chercher activement le marché d'une propriété demande un véritable " +
      "budget. Prodigio l'engage.",
  },
  punch: "Nos intérêts sont alignés : vendre.",
  note: "Rémunération au succès, selon les conditions prévues au mandat.",
} as const;

/** La data — le propriétaire voit son marché réagir. */
export const transparence = {
  eyebrow: "La data",
  title: "Voyez votre marché réagir.",
  intro: "La commercialisation de votre propriété devient mesurable.",
  metrics: [
    { label: "Personnes touchées" },
    { label: "Demandes" },
    { label: "Budgets compatibles" },
    { label: "Profils qualifiés" },
    { label: "Visites" },
  ],
  body: "Suivez la commercialisation. Comprenez la réaction du marché. Mesurez l'intérêt réel.",
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
    { n: 23, value: null, label: "acquéreurs · budget déclaré > 1 M€" },
    { n: 6, value: null, label: "visites qualifiées" },
    { n: null, value: "1 vente", label: "" },
  ],
  conclusion:
    "Nous avons créé les conditions pour que le chalet trouve son acheteur.",
  disclaimer:
    "Il s'agit d'un cas réel. Les résultats dépendent du bien, du marché et de " +
    "la stratégie déployée, et ne constituent pas une garantie de performance.",
} as const;

/**
 * Sélectivité — elle découle de l'investissement, elle ne le précède pas.
 *
 * L'enchaînement est le nerf de la fin de page : *nous investissons réellement,
 * donc nous ne pouvons pas tout accepter, donc vérifiez.*
 */
export const selection = {
  eyebrow: "Sélectif par nature",
  title: "Nous investissons dans chaque propriété.",
  emphasis: "Nous ne pouvons donc pas toutes les accepter.",
  body:
    "Chaque bien est étudié selon sa valeur, son potentiel de mise en marché et " +
    `l'existence d'un marché que le ${SYSTEM_NAME} peut réellement activer.`,
  criteria: ["Valeur", "Potentiel", "Marché"],
} as const;

/** FAQ — lever les dernières objections, rien de plus. */
export const faq = {
  eyebrow: "Questions fréquentes",
  title: "Ce que vous voudrez probablement savoir avant de nous confier votre propriété.",
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
        "réussite — production, expérience et diffusion comprises.",
    },
    {
      q: "En quoi est-ce différent d'être présent sur les réseaux sociaux ?",
      a:
        "Une publication cherche de la visibilité ; une campagne cherche des " +
        "acheteurs. Nous testons plusieurs angles, nous observons quels profils " +
        "réagissent réellement, puis nous concentrons les moyens sur ce qui " +
        "fonctionne pour votre bien.",
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

/** Dernier écran — la boucle se referme sur la question d'ouverture. */
export const finalCta = {
  title: "Votre futur acheteur est peut-être déjà là.",
  subtitle: "Il ne sait simplement pas encore que votre propriété existe.",
  closing: "À nous de créer la rencontre.",
  brand: "PRODIGIO",
  brandLine: "Votre bien mérite mieux qu'une annonce.",
} as const;

export const footer = {
  brand: "PRODIGIO",
  tagline: "Immobilier d'exception — mise en marché active",
} as const;
