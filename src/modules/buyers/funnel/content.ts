import { BUYER_CONSENT_NOTICE_VERSION } from "./schema";
import type {
  Availability,
  BudgetBand,
  DecisionMode,
  Financing,
  ProjectNature,
  PurchaseHorizon,
} from "./schema";

/**
 * Contenu éditorial FRANÇAIS du funnel Acquéreur (libellés des tokens, textes
 * du parcours, mentions de consentement, messages neutres). Aucune règle métier
 * ni couleur ici : uniquement de l'éditorial externalisé (i18n prête).
 *
 * La réponse finale est TOUJOURS neutre et premium : jamais de « refusé » ni de
 * « non qualifié », quel que soit le score interne.
 */

export const BUYER_STEP_COUNT = 8;

export const projectNatureLabels: Record<ProjectNature, string> = {
  residence_principale: "Résidence principale",
  residence_secondaire: "Résidence secondaire",
  investissement: "Investissement",
  autre: "Autre projet",
};

export const budgetBandLabels: Record<BudgetBand, string> = {
  moins_800k: "Moins de 800 000 €",
  "800k_1_2m": "800 000 € – 1,2 M€",
  "1_2m_2m": "1,2 M€ – 2 M€",
  "2m_3m": "2 M€ – 3 M€",
  plus_3m: "Plus de 3 M€",
  a_definir: "À définir ensemble",
};

export const financingLabels: Record<Financing, string> = {
  fonds_propres: "Fonds disponibles",
  accord_bancaire: "Accord bancaire obtenu",
  financement_a_organiser: "Financement à organiser",
};

export const purchaseHorizonLabels: Record<PurchaseHorizon, string> = {
  immediat: "Dès que possible",
  trois_mois: "Sous trois mois",
  six_mois: "Sous six mois",
  en_reflexion: "En réflexion",
};

export const decisionModeLabels: Record<DecisionMode, string> = {
  seul: "Je décide seul(e)",
  avec_autres: "À plusieurs décideurs",
};

export const availabilityLabels: Record<Availability, string> = {
  disponible_visite: "Disponible pour une visite",
  disponible_echange: "Disponible pour un échange",
  a_convenir: "À convenir",
};

export const contactPreferenceLabels: Record<string, string> = {
  telephone: "Téléphone",
  email: "E-mail",
  indifferent: "Indifférent",
};

export const recallPreferenceLabels: Record<string, string> = {
  des_que_possible: "Dès que possible",
  matin: "Le matin",
  apres_midi: "L’après-midi",
  debut_soiree: "En début de soirée",
};

/** Mentions de consentement (preuve conservée avec la soumission). */
export const buyerConsent = {
  noticeVersion: BUYER_CONSENT_NOTICE_VERSION,
  label:
    "J’accepte d’être recontacté(e) au sujet de cette propriété et de mon projet " +
    "d’acquisition. Mes informations sont traitées de façon confidentielle.",
  helper:
    "Vos coordonnées ne servent qu’à vous recontacter au sujet de ce bien. Aucune " +
    "diffusion à des tiers non habilités.",
} as const;

/** Réponses neutres (jamais de score, jamais de refus). */
export const buyerFunnel = {
  errors: {
    validation: "Certaines réponses sont incomplètes. Vérifiez le formulaire.",
    turnstile: "Vérification de sécurité à recommencer. Merci de réessayer.",
    unavailable:
      "Le dépôt de votre intérêt est momentanément indisponible. Réessayez dans un instant.",
    generic: "Une erreur est survenue. Merci de réessayer.",
  },
  securityNote: "Formulaire protégé contre les soumissions automatisées.",
  confirmation: {
    title: "Votre intérêt a bien été transmis",
    body:
      "Merci. Un conseiller dédié à cette propriété reviendra vers vous pour échanger " +
      "sur votre projet et, le cas échéant, organiser la suite.",
    reassurance: "Chaque demande est étudiée avec attention et confidentialité.",
  },
} as const;
