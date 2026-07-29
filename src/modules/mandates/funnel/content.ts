import type { MediaKey } from "@/lib/media";
import {
  CONSENT_NOTICE_VERSION,
  type MandateSituation,
  type PropertyType,
  type SaleHorizon,
  type ValueBand,
} from "./schema";

/**
 * Contenu éditorial du funnel Mandats (français). Source unique des libellés
 * publics : la landing et l'analyse d'éligibilité s'y réfèrent, les valeurs
 * normalisées (tokens) restant définies dans `schema.ts`.
 *
 * Vocabulaire imposé : « propriété », « analyse confidentielle », « étude
 * d'éligibilité », « Système Prodigio », « interlocuteur Prodigio ». Jamais :
 * quiz, formulaire, lead, scoring, prospect, tunnel de vente.
 */

// --- Landing propriétaire ----------------------------------------------------
export const landing = {
  signature: "PRODIGIO — IMMOBILIER D'EXCEPTION",
  hero: {
    title: "Votre propriété mérite mieux qu'une annonce.",
    text:
      "Le Système Prodigio transforme chaque propriété en une mise en marché à " +
      "part entière. Nous créons son écrin, identifions les acheteurs " +
      "susceptibles d'y être sensibles et déployons une stratégie active pour " +
      "aller à leur rencontre.",
    ctaPrimary: "Vérifier l'éligibilité de ma propriété",
    ctaMicro: "Analyse confidentielle · Environ 1 minute",
  },
  constat: {
    kicker: "Le constat",
    title:
      "Même les plus belles propriétés finissent par se ressembler lorsqu'elles " +
      "sont présentées dans le même cadre.",
    text:
      "Sur les portails traditionnels, même une propriété exceptionnelle finit " +
      "souvent présentée selon le même format que toutes les autres.",
    items: [
      "Une galerie photographique",
      "Une liste de caractéristiques",
      "Une description",
      "Un prix",
      "Un formulaire de contact",
    ],
    closing:
      "Ce cadre uniforme dessert les biens rares. Il ne les distingue pas, il " +
      "les aligne.",
  },
  difference: {
    kicker: "La différence Prodigio",
    title: "Trois principes, une même exigence.",
    principles: [
      {
        index: "01",
        title: "Comprendre la propriété",
        lead:
          "Avant toute mise en marché, nous cherchons à comprendre ce qui rend " +
          "cette propriété réellement désirable.",
        questions: [
          "Qui est l'acheteur idéal de cette propriété ?",
          "Où vit-il ?",
          "Quel est son projet ?",
          "Quels éléments peuvent réellement provoquer le déclic chez lui ?",
        ],
      },
      {
        index: "02",
        title: "Créer son écrin",
        lead:
          "Votre propriété ne devient pas une annonce supplémentaire. Elle " +
          "bénéficie de son propre univers.",
        deliverables: [
          "Photographie",
          "Film",
          "Narration",
          "Site dédié",
          "Brochure",
          "Publicités adaptées aux différents profils d'acheteurs",
        ],
      },
      {
        index: "03",
        title: "Aller chercher l'acheteur",
        lead:
          "Nous n'attendons pas uniquement que l'acheteur consulte un portail.",
        body:
          "Grâce au Système Prodigio, la propriété vient à la rencontre des " +
          "profils susceptibles d'y être sensibles. Nous ne nous contentons pas " +
          "de capter un intérêt existant : nous créons les conditions du déclic.",
      },
    ],
  },
  proof: {
    kicker: "La preuve",
    title: "Un cas réel, présenté sans promesse.",
    context:
      "Résultats observés sur un chalet d'environ 1,6 million d'euros. Il s'agit " +
      "d'un cas réel et ne constitue en aucun cas une garantie de performance.",
    stats: [
      { value: "312", label: "demandes générées en 14 jours" },
      { value: "172", label: "budgets déclarés" },
      { value: "23", label: "acheteurs au budget supérieur à 1 M€" },
      { value: "6", label: "visites" },
      { value: "1", label: "vente" },
    ],
    disclaimer:
      "Chaque propriété est différente. Ces chiffres décrivent une opération " +
      "précise et ne préjugent pas des résultats d'une autre mise en marché.",
  },
  selectivity: {
    kicker: "Sélectivité",
    title: "Le Système Prodigio ne convient pas à toutes les propriétés.",
    text:
      "Chaque demande est étudiée individuellement. Notre accompagnement suppose " +
      "une propriété et un projet compatibles avec notre manière de travailler.",
    ctaPrimary: "Soumettre ma propriété à l'analyse Prodigio",
    ctaMicro: "Confidentiel · Sans engagement",
  },
} as const;

// --- Libellés des options (tokens → français) --------------------------------
export const propertyTypeLabels: Record<
  PropertyType,
  { label: string; image: MediaKey }
> = {
  villa_architecte: { label: "Villa ou maison d'architecte", image: "categoryVilla" },
  appartement_exception: {
    label: "Appartement d'exception",
    image: "categoryAppartement",
  },
  chalet: { label: "Chalet", image: "categoryChalet" },
  domaine_caractere: {
    label: "Domaine ou propriété de caractère",
    image: "categoryDomaine",
  },
  autre: { label: "Autre propriété", image: "categoryAutre" },
};

export const valueBandLabels: Record<ValueBand, string> = {
  moins_500k: "Moins de 500 000 €",
  "500k_800k": "Entre 500 000 € et 800 000 €",
  "800k_1_2m": "Entre 800 000 € et 1,2 million d'euros",
  "1_2m_2m": "Entre 1,2 et 2 millions d'euros",
  plus_2m: "Plus de 2 millions d'euros",
  accompagnement_estimation: "Je souhaite être accompagné pour l'estimer",
};

export const saleHorizonLabels: Record<SaleHorizon, string> = {
  des_que_possible: "Dès que les conditions sont réunies",
  trois_mois: "Dans les trois prochains mois",
  six_mois: "Dans les six prochains mois",
  en_reflexion: "Je suis encore en réflexion",
};

export const mandateSituationLabels: Record<MandateSituation, string> = {
  aucun_mandat: "Non, aucun mandat n'est en cours",
  mandat_simple: "Oui, avec un mandat simple",
  mandat_exclusif: "Oui, avec un mandat exclusif",
  autre: "Autre situation",
};

// --- Textes de l'analyse (intro, étapes, confirmation) -----------------------
export const analysis = {
  intro: {
    eyebrow: "Analyse confidentielle",
    title: "Commençons par votre propriété.",
    text:
      "Quelques informations nous permettront de déterminer si le Système " +
      "Prodigio est adapté à votre projet. Chaque demande est étudiée " +
      "individuellement.",
    cta: "Commencer l'analyse",
    reassurance: "Confidentiel · Environ 1 minute · Sans engagement",
  },
  steps: {
    propertyType: {
      question: "Quelle propriété souhaitez-vous nous présenter ?",
    },
    location: {
      question: "Où se situe votre propriété ?",
      secondary:
        "La localisation nous permet d'étudier son marché et les profils " +
        "d'acheteurs susceptibles d'y être sensibles.",
      cityLabel: "Ville",
      postalLabel: "Code postal",
      countryLabel: "Pays",
      note: "Nous ne demandons pas l'adresse exacte à ce stade.",
    },
    valueBand: {
      question: "Quelle valeur attribuez-vous aujourd'hui à votre propriété ?",
    },
    saleHorizon: {
      question: "Dans quel horizon envisagez-vous la vente ?",
    },
    mandateSituation: {
      question: "Votre propriété est-elle actuellement confiée à un professionnel ?",
    },
    contact: {
      title: "À qui devons-nous adresser notre retour ?",
      text:
        "Ces informations resteront confidentielles et seront utilisées pour " +
        "étudier votre demande et vous recontacter au sujet de votre projet.",
      firstNameLabel: "Prénom",
      lastNameLabel: "Nom",
      phoneLabel: "Téléphone",
      emailLabel: "E-mail",
      preferenceLabel: "Préférence de contact (facultatif)",
      preferenceOptions: [
        { value: "telephone", label: "Par téléphone" },
        { value: "email", label: "Par e-mail" },
        { value: "indifferent", label: "Peu importe" },
      ],
      recallLabel: "Quand préférez-vous être recontacté ?",
      recallOptions: [
        { value: "des_que_possible", label: "Dès que possible" },
        { value: "matin", label: "Le matin" },
        { value: "apres_midi", label: "L'après-midi" },
        { value: "debut_soiree", label: "En début de soirée" },
      ],
    },
  },
  submitCta: "Adresser ma demande à Prodigio",
  submitting: "Transmission de votre demande…",
  // --- Écran final : pré-analyse terminée (appréciation qualitative seule) -----
  preAnalysis: {
    eyebrow: "Pré-analyse terminée",
    title: "Votre pré-analyse est terminée",
    // Appréciation publique — seul résultat montré au propriétaire (jamais de
    // score numérique, jamais de « non éligible »).
    appreciationLabels: {
      fort_potentiel: "Fort potentiel de compatibilité",
      a_confirmer: "Potentiel à confirmer",
      analyse_personnalisee: "Analyse personnalisée nécessaire",
    },
    text:
      "Les informations transmises nous permettent d'effectuer une première " +
      "lecture de votre projet. Cependant, un questionnaire ne peut pas apprécier " +
      "pleinement le caractère de votre propriété, la cohérence de son " +
      "positionnement ni les particularités de votre vente. Un entretien " +
      "confidentiel avec un expert Prodigio est indispensable pour confirmer son " +
      "éligibilité.",
    nextStepTitle: "Prochaine étape — Votre entretien d'éligibilité",
    nextStepPoints: [
      "comprendre précisément votre projet de vente",
      "étudier les particularités de votre propriété",
      "identifier ses acheteurs potentiels",
      "déterminer si le Système Prodigio est adapté",
    ],
    recallEcho: "Vous préférez être recontacté :",
    cta: "Demander mon entretien d'éligibilité",
    // Après clic : accusé HONNÊTE — aucune réservation de créneau (pas de
    // synchronisation Calendar à ce stade).
    ctaConfirmedTitle: "Votre demande d'entretien est enregistrée.",
    ctaConfirmedText:
      "Un interlocuteur Prodigio vous recontactera pour convenir de cet " +
      "entretien confidentiel. Aucun créneau n'est encore réservé.",
    backHome: "Revenir à l'accueil",
  },
  errors: {
    generic:
      "Un incident est survenu lors de la transmission. Vos réponses sont " +
      "conservées : vous pouvez réessayer.",
    unavailable:
      "Le dépôt des demandes n'est pas encore activé sur cet environnement. " +
      "Vos réponses sont conservées ; réessayez ultérieurement.",
    validation: "Merci de vérifier les informations saisies.",
  },
} as const;

// --- Consentement (formulation PROVISOIRE, à valider juridiquement) ----------
export const consent = {
  noticeVersion: CONSENT_NOTICE_VERSION,
  // ⚠️ Formulation provisoire. Une validation juridique est requise avant toute
  // mise en production (base légale, responsables, destinataires, durée).
  label:
    "J'accepte d'être recontacté par Prodigio au sujet de mon projet de vente et " +
    "que ces informations soient utilisées pour étudier ma demande.",
  helper:
    "Formulation provisoire, en cours de validation juridique. Vos données sont " +
    "traitées de manière confidentielle ; vous pourrez demander leur suppression.",
} as const;

export const STEP_COUNT = 6;
