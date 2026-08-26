/**
 * Contenu éditorial de la landing propriétaire.
 *
 * POSITIONNEMENT (source de vérité) — « Traditionnel + Système Prodigio™ ».
 * Prodigio ne dit PAS que les agences de prestige sont inefficaces : elles ont
 * un réseau, un fichier acquéreurs, des portails, de l'off-market, de
 * l'international, des photographes et une vraie expertise transactionnelle.
 * Prodigio conserve ces leviers et ajoute une couche d'acquisition, de création,
 * de budget média, de data et d'optimisation appliquée à UN seul bien.
 *
 * INTERDITS DE TON (ne jamais réintroduire) :
 *   - « les agences prennent des photos, publient une annonce et attendent » ;
 *   - « la même fiche partout », « annonce ordinaire », « partout ailleurs » ;
 *   - « Instagram ne sert à rien » ;
 *   - toute promesse de délai ou de prix (« vend deux fois plus vite »…) tant
 *     qu'elle n'est pas statistiquement démontrée.
 *
 * Isolé du contenu du parcours d'analyse (`funnel/content.ts`) : ce fichier ne
 * touche NI aux questions, NI aux réponses, NI au contrat de données du CRM.
 */

/* -------------------------------------------------------------------------- */
/* Valeurs facilement modifiables (données non figées)                         */
/* -------------------------------------------------------------------------- */

/**
 * Ancienneté revendiquée dans l'immobilier. Donnée NON DÉFINITIVEMENT VALIDÉE :
 * elle est isolée ici pour être modifiable en un seul endroit.
 */
export const EXPERIENCE_ANNEES = "plus de 25 ans";

/** Appels à l'action — wording centralisé (un seul endroit pour tous les CTA). */
export const CTA_PRIMARY = "Découvrir ce que Prodigio peut faire pour mon bien";
export const CTA_NAV = "Étudier mon bien";
export const MICROCOPY = "Questionnaire d'une minute · Étude confidentielle · Sans engagement";
export const CTA_SUB = MICROCOPY;

export const marqueeItems = [
  "Immobilier d'exception",
  "Acquisition active",
  "Budget média engagé",
  "Data & optimisation",
  "France · Europe · International",
];

/* -------------------------------------------------------------------------- */
/* Hero                                                                        */
/* -------------------------------------------------------------------------- */

export const hero = {
  brand: "PRODIGIO",
  tagline: "Immobilier d'exception",
  eyebrow: "Système Prodigio™",
  titleLine1: "Et si, au lieu d'attendre votre acheteur,",
  titleLine2: "nous allions le chercher ?",
  subtitle:
    `Après ${EXPERIENCE_ANNEES} dans l'immobilier, nous avons créé le Système ` +
    "Prodigio™ pour trouver activement les bons acheteurs et vendre votre bien " +
    "plus vite, au prix qu'il mérite.",
  scrollCue: "Le système",
  vslLabel: "Le film",
  vslOpen: "Voir le film",
} as const;

/* -------------------------------------------------------------------------- */
/* 1. Preuve immédiate — très courte, elle doit faire naître « comment ? »      */
/* -------------------------------------------------------------------------- */

export const preuveFlash = {
  eyebrow: "Le système en action",
  title: "14 jours de campagne.",
  stats: [
    { value: 312, label: "demandes" },
    { value: 23, label: "budgets déclarés > 1 M€" },
    { value: 6, label: "visites qualifiées" },
    { value: 1, label: "vente" },
  ],
  microcopy: "Bien proposé à 1,6 M€ · Font-Romeu",
} as const;

/* -------------------------------------------------------------------------- */
/* 2. Reconnaître les forces de l'immobilier d'exception                       */
/* -------------------------------------------------------------------------- */

export const forces = {
  eyebrow: "L'immobilier d'exception a déjà ses forces",
  title: "Réseau. Fichier acquéreurs. Portails. Off-market. International.",
  body:
    "Les bonnes agences de prestige disposent déjà de puissants leviers pour " +
    "commercialiser une propriété. Prodigio ne les remplace pas. Nous les " +
    "utilisons aussi.",
  body2:
    "Mais nous avons identifié un marché supplémentaire : celui des personnes " +
    "qui ont le profil, le patrimoine et le budget… sans être encore en " +
    "recherche active.",
  statement: "Le coup de cœur peut précéder l'intention d'achat.",
  closing:
    "Votre futur acheteur n'a peut-être encore contacté aucune agence, créé " +
    "aucune alerte ou consulté aucun portail. Cela ne signifie pas qu'il ne " +
    "peut pas acheter.",
  leviers: [
    "Réseau",
    "Fichier acquéreurs",
    "Portails spécialisés",
    "Off-market",
    "Diffusion internationale",
    "Expertise transactionnelle",
  ],
} as const;

/* -------------------------------------------------------------------------- */
/* 3. Visibilité ≠ Acquisition                                                 */
/* -------------------------------------------------------------------------- */

export const visibilite = {
  eyebrow: "Visibilité ≠ Acquisition",
  title: "Faire des vues n'est pas la même chose que trouver des acheteurs.",
  body:
    "Aujourd'hui, les propriétés d'exception sont déjà présentes sur Instagram " +
    "et les réseaux sociaux. Certaines vidéos réalisent des milliers, parfois " +
    "beaucoup plus, de vues. C'est de la visibilité. Et c'est utile.",
  body2:
    "Mais une vue ne nous dit ni le budget, ni le projet, ni l'intention de " +
    "celui qui regarde.",
  organique: {
    label: "Publication organique",
    steps: ["Publication", "Diffusion algorithmique", "Pic d'attention", "Portée qui décroît"],
  },
  campagne: {
    label: "Campagne Prodigio™",
    steps: [
      "Plusieurs angles",
      "Budget de diffusion",
      "Données",
      "Optimisation",
      "Nouvelle diffusion",
      "Demandes",
      "Qualification",
    ],
  },
  statementA: "Une publication est diffusée.",
  statementB: "Une campagne Prodigio apprend.",
  closing:
    "Nous observons les profils qui réagissent, les angles qui déclenchent " +
    "l'intérêt et les créations qui génèrent des demandes. Puis nous faisons " +
    "évoluer la campagne en fonction des données recueillies.",
} as const;

/* -------------------------------------------------------------------------- */
/* 4. Au-delà des fichiers                                                     */
/* -------------------------------------------------------------------------- */

/**
 * ⚠️ Volumétrie d'audience : AUCUN chiffre n'est affiché tant qu'il n'est pas
 * sourcé. Renseigner `chiffres` uniquement avec des données vérifiables et leur
 * source (la section s'affiche correctement sans eux).
 */
export const marche = {
  eyebrow: "Au-delà des fichiers",
  title: "Votre marché potentiel est plus grand que votre marché visible.",
  body:
    "Des millions de personnes utilisent chaque jour les plateformes sur " +
    "lesquelles nous pouvons diffuser une propriété. Parmi elles se trouvent " +
    "aussi des acquéreurs potentiels qui ne figurent encore dans aucun fichier " +
    "immobilier.",
  statementA: "Nous n'attendons pas qu'ils entrent sur le marché.",
  statementB: "Nous pouvons aller chercher leur attention.",
  portee: ["France", "Europe", "International"],
  microcopy: "Lorsque le profil du bien et son marché le justifient.",
  /** Chiffres d'audience — à remplir uniquement s'ils sont sourcés et validés. */
  chiffres: [] as ReadonlyArray<{ value: string; label: string; source: string }>,
} as const;

/* -------------------------------------------------------------------------- */
/* 5. La création                                                              */
/* -------------------------------------------------------------------------- */

export const creation = {
  eyebrow: "La création",
  title: "Pour arrêter le regard, il faut créer le désir.",
  body:
    "Chaque propriété possède quelque chose capable de provoquer le déclic.",
  angles: [
    "Une architecture",
    "Une vue",
    "Une histoire",
    "Un emplacement",
    "Un usage",
    "Une rentabilité",
    "Une manière d'y vivre",
  ],
  body2:
    "Notre travail consiste à identifier cet angle, puis à construire sa mise " +
    "en marché autour de lui.",
  avant: { label: "Annonce immobilière", caption: "Le format standard du marché" },
  apres: { label: "Expérience Prodigio", caption: "Un univers construit pour un seul bien" },
  livrables: ["Film", "Photographie", "Storytelling", "Site dédié", "Brochure"],
  statement: "Chaque propriété devient son propre univers.",
} as const;

/* -------------------------------------------------------------------------- */
/* 6. L'écrin, en vrai                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Liens vers les livrables réels. Laissés VIDES tant que les URL publiques ne
 * sont pas confirmées : un lien est rendu uniquement s'il est renseigné (jamais
 * de lien mort, jamais d'URL inventée).
 */
export const ecrinReel = {
  eyebrow: "L'écrin, en vrai",
  title: "Ne nous croyez pas sur parole. Ouvrez-le.",
  bien: "Chalet Mitja · Font-Romeu · Pyrénées",
  pieces: [
    {
      label: "Le site dédié",
      action: "Parcourir l'expérience",
      href: "",
      caption: "Site dédié au bien",
    },
    {
      label: "La brochure confidentielle",
      action: "Feuilleter la brochure",
      href: "",
      caption: "Brochure confidentielle",
    },
  ],
} as const;

/* -------------------------------------------------------------------------- */
/* 7. Système Prodigio™                                                        */
/* -------------------------------------------------------------------------- */

export const systeme = {
  eyebrow: "Système Prodigio™",
  title: "Une stratégie construite autour d'un seul bien : le vôtre.",
  phases: [
    { n: "01", title: "Comprendre", text: "Le bien, son marché, son acheteur." },
    { n: "02", title: "Positionner", text: "Identifier ce qui peut créer le déclic." },
    { n: "03", title: "Créer", text: "Construire son univers." },
    { n: "04", title: "Diffuser", text: "Aller chercher activement son marché." },
    { n: "05", title: "Optimiser", text: "Laisser les données améliorer la campagne." },
    { n: "06", title: "Qualifier", text: "Projet · délai · budget." },
  ],
  resultatA: "Visites qualifiées",
  resultatB: "Vente",
} as const;

/* -------------------------------------------------------------------------- */
/* 8. Notre engagement — l'investissement Prodigio                             */
/* -------------------------------------------------------------------------- */

export const engagement = {
  eyebrow: "Notre engagement",
  title: "Nous ne nous contentons pas de prendre votre mandat.",
  statement: "Nous investissons dans sa réussite.",
  familles: [
    { titre: "Production", items: ["Photographie", "Film", "Montage"] },
    { titre: "Expérience", items: ["Site dédié", "Brochure", "Création"] },
    { titre: "Acquisition", items: ["Campagnes", "Tests", "Budget média"] },
  ],
  climaxTitle: "Et surtout, nous finançons la diffusion.",
  climaxBody:
    "Parce qu'aller chercher activement le marché d'une propriété nécessite un " +
    "véritable budget.",
  climaxStatement: "Nos intérêts sont alignés : vendre.",
} as const;

/* -------------------------------------------------------------------------- */
/* 9. La data                                                                  */
/* -------------------------------------------------------------------------- */

export const data = {
  eyebrow: "La data",
  title: "Voyez votre marché réagir.",
  body:
    "Pour la première fois, la commercialisation de votre propriété devient " +
    "mesurable.",
  indicateurs: [
    { label: "Personnes touchées", value: "184 200" },
    { label: "Demandes", value: "312" },
    { label: "Budgets compatibles", value: "172" },
    { label: "Profils qualifiés", value: "23" },
    { label: "Visites", value: "6" },
  ],
  lignes: [
    "Suivez la commercialisation.",
    "Comprenez la réaction du marché.",
    "Mesurez l'intérêt réel.",
  ],
  disclaimer: "Illustration d'interface — valeurs fictives.",
} as const;

/* -------------------------------------------------------------------------- */
/* 10. Étude de cas — Font-Romeu                                               */
/* -------------------------------------------------------------------------- */

export const caseStudy = {
  eyebrow: "Font-Romeu · 1,6 M€",
  title: "Nous n'avons pas attendu son acheteur.",
  duree: { value: 14, label: "jours de campagne" },
  stats: [
    { value: 312, label: "demandes" },
    { value: 172, label: "budgets déclarés" },
    { value: 23, label: "acquéreurs potentiels avec un budget déclaré > 1 M€" },
    { value: 6, label: "visites qualifiées" },
  ],
  climax: { value: 1, label: "vente" },
  statement:
    "Nous avons créé les conditions pour que le chalet trouve son acheteur.",
  disclaimer:
    "Il s'agit d'un cas réel. Les résultats dépendent du bien, du marché et de " +
    "la stratégie déployée, et ne constituent pas une garantie de performance.",
} as const;

/* -------------------------------------------------------------------------- */
/* 11. Manifeste — le meilleur des deux mondes                                 */
/* -------------------------------------------------------------------------- */

export const manifeste = {
  eyebrow: "Le meilleur des deux mondes",
  titleLine1: "Nous n'avons pas remplacé l'immobilier traditionnel.",
  titleLine2: "Nous avons augmenté sa puissance.",
  expertise: {
    label: "Expertise immobilière",
    items: [
      "Réseau",
      "Fichier acquéreurs",
      "Portails spécialisés",
      "Off-market",
      "Négociation",
      "Transaction",
    ],
  },
  systeme: {
    label: "Système Prodigio™",
    items: [
      "Positionnement",
      "Création",
      "Acquisition active",
      "Budget média",
      "Data",
      "Optimisation continue",
      "Qualification",
    ],
  },
  resultat: "Commercialisation augmentée",
  statementA: "Nous conservons ce qui fonctionne.",
  statementB: "Nous ajoutons ce qui manquait.",
} as const;

/* -------------------------------------------------------------------------- */
/* 12. Sélectivité                                                             */
/* -------------------------------------------------------------------------- */

export const selection = {
  eyebrow: "Sélectif par nature",
  titleLine1: "Nous investissons dans chaque propriété.",
  titleLine2: "Nous ne pouvons donc pas toutes les accepter.",
  body:
    "Chaque bien est étudié selon sa valeur, son potentiel de mise en marché et " +
    "l'existence d'un marché que le Système Prodigio™ peut réellement activer.",
  criteres: ["Valeur", "Potentiel", "Marché"],
} as const;

/* -------------------------------------------------------------------------- */
/* 13. FAQ                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * ⚠️ Aucune condition contractuelle précise n'est affirmée ici (pas de taux, pas
 * de durée, pas de clause d'exclusivité chiffrée) : ces éléments relèvent du
 * mandat, porté par une agence immobilière habilitée, et ne sont pas figés.
 */
export const faq = {
  eyebrow: "Questions fréquentes",
  title:
    "Ce que vous voudrez probablement savoir avant de nous confier votre propriété.",
  items: [
    {
      q: "Concrètement, qu'est-ce que le Système Prodigio™ ajoute à une agence ?",
      a:
        "Une couche d'acquisition active. L'agence apporte son réseau, son " +
        "fichier, ses portails et son expertise transactionnelle. Prodigio " +
        "ajoute le positionnement du bien, la création (film, photographie, " +
        "site dédié, brochure), des campagnes financées, la mesure des " +
        "résultats et leur optimisation continue — appliqués à un seul bien.",
    },
    {
      q: "Qui finance les campagnes ?",
      a:
        "Prodigio engage ses propres moyens sur les biens sélectionnés : " +
        "production, création et budget média de diffusion. C'est ce qui rend " +
        "nos intérêts alignés avec les vôtres — et ce qui nous oblige à être " +
        "sélectifs.",
    },
    {
      q: "Pourquoi ne travaillez-vous pas avec toutes les propriétés ?",
      a:
        "Parce que nous investissons réellement sur chaque bien accompagné. " +
        "Nous étudions la valeur, le potentiel de mise en marché et l'existence " +
        "d'un marché que le système peut activer. Si ce n'est pas le cas, nous " +
        "le disons.",
    },
    {
      q: "Est-ce que vous remplacez mon agence ?",
      a:
        "Non. Notre position est « traditionnel + Système Prodigio™ ». Les " +
        "fondamentaux de l'immobilier de prestige restent indispensables : nous " +
        "nous ajoutons à eux, nous ne prétendons pas les rendre inutiles.",
    },
    {
      q: "Qui porte le mandat ?",
      a:
        "Le mandat immobilier est porté par une agence immobilière habilitée, " +
        "distincte du Système Prodigio. Les conditions vous sont présentées " +
        "avant toute signature.",
    },
    {
      q: "Mon bien peut-il être diffusé à l'étranger ?",
      a:
        "Oui, lorsque le profil du bien et son marché le justifient. La " +
        "diffusion est décidée à partir de l'acheteur visé, pas par principe.",
    },
    {
      q: "Que se passe-t-il après le questionnaire ?",
      a:
        "Votre demande fait l'objet d'une première étude confidentielle. Nous " +
        "revenons vers vous pour comprendre le bien et votre projet, puis nous " +
        "vous disons si le système peut réellement apporter quelque chose.",
    },
  ],
} as const;

/* -------------------------------------------------------------------------- */
/* 14. CTA final & pied de page                                                */
/* -------------------------------------------------------------------------- */

export const finalCta = {
  title: "Votre futur acheteur est peut-être déjà là.",
  subtitle: "Faisons en sorte que votre propriété arrive jusqu'à lui.",
} as const;

export const footer = {
  brand: "PRODIGIO",
  tagline: "Immobilier d'exception — commercialisation augmentée",
} as const;
