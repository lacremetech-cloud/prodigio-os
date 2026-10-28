import {
  BUDGET_CHOICE_LABELS,
  BUDGET_QUESTION,
  UNIVERSAL_CONSENT_NOTICE_VERSION,
  UNIVERSAL_STEPS,
  type BuyerBudgetChoice,
} from "./universal";
import { UNIVERSAL_PRIVACY_NOTICE } from "./universal-payload";

/**
 * LA LANGUE DU FORMULAIRE ACQUÉREUR.
 *
 * Les publicités 9 à 12 des Airelles visent le Royaume-Uni, les Pays-Bas et
 * l'Europe de l'Est, et pointent sur la version anglaise de la landing. Un
 * formulaire français au bout d'un clic payé en anglais, c'est le clic perdu.
 *
 * Trois principes ont guidé ce module.
 *
 * 1. LE FRANÇAIS NE BOUGE PAS. Les textes français ne sont pas recopiés ici :
 *    ils sont RÉFÉRENCÉS depuis leurs modules d'origine. Il ne peut donc pas
 *    y avoir deux versions françaises qui divergent, et les deux villas de
 *    Cassis ne voient aucun changement.
 *
 * 2. LE CRM RESTE EN FRANÇAIS. `BUDGET_CHOICE_LABELS` sert aussi à la fiche du
 *    lead, pour montrer au commercial la question telle qu'elle a été posée.
 *    Elle n'est pas traduite : JC et Antoine lisent le français, quelle que
 *    soit la langue du prospect.
 *
 * 3. LA MENTION DE CONFIDENTIALITÉ EST UNE PREUVE. Le texte exact affiché est
 *    conservé avec la soumission (`consent_notice_text`). Si l'on montre un
 *    texte anglais, c'est le texte ANGLAIS qui doit être conservé — sinon la
 *    preuve atteste de ce que la personne n'a pas lu. D'où le numéro de
 *    version suffixé par la langue.
 */

export const LANGUES_FORMULAIRE = ["fr", "en"] as const;
export type LangueFormulaire = (typeof LANGUES_FORMULAIRE)[number];
export const LANGUE_PAR_DEFAUT: LangueFormulaire = "fr";

/**
 * Lit le paramètre d'URL. Tout ce qui n'est pas reconnu retombe sur le
 * français : une URL mal copiée affiche un formulaire valide, jamais une page
 * cassée. Accepte « en-GB » et « EN » aussi bien que « en ».
 */
export function normaliserLangue(brut: string | string[] | undefined | null): LangueFormulaire {
  const valeur = Array.isArray(brut) ? brut[0] : brut;
  if (typeof valeur !== "string") return LANGUE_PAR_DEFAUT;
  const code = valeur.trim().toLowerCase().slice(0, 2);
  return (LANGUES_FORMULAIRE as readonly string[]).includes(code)
    ? (code as LangueFormulaire)
    : LANGUE_PAR_DEFAUT;
}

/** Le numéro de version de la mention, qui porte la langue de ce qui a été vu. */
export function versionMention(langue: LangueFormulaire): string {
  return `${UNIVERSAL_CONSENT_NOTICE_VERSION}-${langue}`;
}

export interface TextesFormulaire {
  /** Titre de l'onglet. */
  titrePage: string;
  /** « Étape 1 / 2 · Votre projet ». */
  etape: (numero: number, titre: string) => string;
  etapeAria: (numero: number) => string;
  titresEtapes: readonly [string, string];

  questionBudget: string;
  choixBudget: Record<BuyerBudgetChoice, string>;

  continuer: string;
  retour: string;

  titreContact: string;
  prenom: string;
  nom: string;
  email: string;
  telephone: string;

  mentionConfidentialite: string;

  envoyer: string;
  envoiEnCours: string;
  verificationEnCours: string;

  erreurReponseRequise: string;
  erreurValidation: string;
  erreurVerification: string;
  erreurServeur: string;

  confirmationTitre: string;
  /** Le nom du bien est optionnel : la phrase doit tenir sans lui. */
  confirmationCorps: (bien: string | null) => string;
  accederBrochure: string;
  brochureAVenir: string;
}

const FR: TextesFormulaire = {
  titrePage: "Demander la brochure",
  etape: (n, titre) => `Étape ${n} / 2 · ${titre}`,
  etapeAria: (n) => `Étape ${n} sur 2`,
  titresEtapes: [UNIVERSAL_STEPS[0].title, UNIVERSAL_STEPS[1].title],

  questionBudget: BUDGET_QUESTION,
  choixBudget: BUDGET_CHOICE_LABELS,

  continuer: "Continuer",
  retour: "← Retour",

  titreContact: "Recevoir la brochure",
  prenom: "Prénom",
  nom: "Nom",
  email: "E-mail",
  telephone: "Téléphone",

  mentionConfidentialite: UNIVERSAL_PRIVACY_NOTICE,

  envoyer: "Recevoir la brochure",
  envoiEnCours: "Envoi…",
  verificationEnCours: "Vérification…",

  erreurReponseRequise: "Réponse requise.",
  erreurValidation: "Votre saisie n'a pas pu être validée. Vérifiez les champs.",
  erreurVerification:
    "La vérification de sécurité n'est pas terminée. Patientez un instant, puis réessayez.",
  erreurServeur: "Le serveur n'a pas répondu. Réessayez dans un instant. (réf. RES-SERVEUR)",

  confirmationTitre: "Votre demande est enregistrée.",
  confirmationCorps: (bien) =>
    bien
      ? `Merci. Nous revenons vers vous rapidement au sujet de ${bien}.`
      : "Merci. Nous revenons vers vous rapidement.",
  accederBrochure: "Accéder à la brochure",
  brochureAVenir: "La brochure vous sera transmise par votre interlocuteur.",
};

/**
 * L'anglais. Registre soutenu et sobre, celui d'une agence qui vend un bien à
 * plus de 500 000 € — pas celui d'un formulaire de newsletter.
 *
 * Deux choix d'écriture méritent d'être dits.
 *
 * LES MONTANTS RESTENT EN EUROS, et ce n'est pas un oubli. La réponse est
 * stockée sous forme de CODE (`500k_1m`), et ce code pilote le score, la règle
 * d'alerte au-dessus d'1 M€, le récapitulatif et le choix du modèle d'e-mail.
 * Des tranches en livres feraient dire au même code deux choses différentes
 * selon la langue — £500 000 valent environ 575 000 € — et la segmentation
 * cesserait d'être comparable. Un bien français se paie en euros ; les
 * acquéreurs britanniques de l'arc alpin le savent.
 *
 * EN REVANCHE LES NOMBRES CHANGENT D'ÉCRITURE. Le français sépare les milliers
 * par une espace et décime par une virgule ; l'anglais fait l'inverse. Laisser
 * « 1,2 M€ » dans un texte anglais, c'est écrire « 1.2 » au mieux et « 12 » au
 * pire. Et le symbole passe DEVANT le nombre : « €500,000 », jamais
 * « 500,000 € ».
 */
const EN: TextesFormulaire = {
  titrePage: "Request the brochure",
  etape: (n, titre) => `Step ${n} of 2 · ${titre}`,
  etapeAria: (n) => `Step ${n} of 2`,
  titresEtapes: ["Your project", "Getting back to you"],

  questionBudget: "Do you have a project in mind? If so, what is your budget?",
  choixBudget: {
    aucun_projet: "No, not at the moment",
    "500k_1m": "Yes, between €500,000 and €1 million",
    plus_1m: "More than €1 million",
    // Tranches retirées du formulaire, conservées pour les dossiers anciens.
    "1m_2m": "Yes, between €1 million and €2 million",
    "2m_3m": "Yes, between €2 million and €3 million",
    plus_3m: "More than €3 million",
  },

  continuer: "Continue",
  retour: "← Back",

  titreContact: "Request the brochure",
  prenom: "First name",
  nom: "Last name",
  email: "Email",
  telephone: "Phone",

  mentionConfidentialite:
    "Your details are used only to answer your enquiry and send you the brochure. " +
    "They are never shared with third parties.",

  envoyer: "Request the brochure",
  envoiEnCours: "Sending…",
  verificationEnCours: "Verifying…",

  erreurReponseRequise: "Please select an answer.",
  erreurValidation: "Some of your details could not be validated. Please check the fields.",
  erreurVerification:
    "The security check has not finished. Please wait a moment, then try again.",
  erreurServeur: "The server did not respond. Please try again shortly. (ref. RES-SERVEUR)",

  confirmationTitre: "Your request has been received.",
  confirmationCorps: (bien) =>
    bien
      ? `Thank you. We will get back to you shortly about ${bien}.`
      : "Thank you. We will get back to you shortly.",
  accederBrochure: "View the brochure",
  brochureAVenir: "Your contact will send you the brochure.",
};

export const TEXTES_FORMULAIRE: Record<LangueFormulaire, TextesFormulaire> = { fr: FR, en: EN };

export function textes(langue: LangueFormulaire): TextesFormulaire {
  return TEXTES_FORMULAIRE[langue];
}
