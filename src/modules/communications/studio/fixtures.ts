/**
 * **Données synthétiques du simulateur.**
 *
 * ⚠️ Rien ici n'est réel et rien ici ne peut le devenir : ces destinataires sont
 * des personnages fictifs, explicitement marqués, avec des coordonnées en
 * `.invalid` (TLD réservé par la RFC 2606 — non routable) et des numéros de la
 * plage française réservée à la fiction (`+3363998xx xx`).
 *
 * Le simulateur n'accepte **aucune** autre source : il ne lit jamais `contacts`,
 * jamais `privacy_records`, jamais un message existant.
 */

import type { Channel } from "../types";
import type { PrivacySignal, SuppressionSignal } from "../policy";
import { UNSETTLED_LEGAL_BASIS } from "../policy";

/** Marqueur porté par chaque valeur affichée, pour lever toute ambiguïté. */
export const SYNTHETIC_MARKER = "FICTIF";

export interface SyntheticRecipient {
  id: string;
  label: string;
  /** Ce que ce personnage permet de démontrer. */
  purpose: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  privacy: readonly PrivacySignal[];
  suppressions: readonly SuppressionSignal[];
  /** Valeurs de variables, toutes fictives. */
  variables: Readonly<Record<string, string>>;
  /** Contexte servant à évaluer les conditions déclaratives. */
  context: Readonly<Record<string, string | number | boolean>>;
}

/** Base légale non tranchée : la valeur par défaut du projet, jamais un consentement. */
const unsettled: PrivacySignal = {
  choice: "accorde",
  legalBasis: UNSETTLED_LEGAL_BASIS,
  authorizedChannels: ["email"],
  doNotContact: false,
};

export const SYNTHETIC_RECIPIENTS: readonly SyntheticRecipient[] = [
  {
    id: "fictif_nominal",
    label: "Camille Fictive — cas nominal",
    purpose: "Coordonnée disponible, aucune opposition, base légale non tranchée.",
    displayName: `Camille Fictive (${SYNTHETIC_MARKER})`,
    email: "camille.fictive@exemple.invalid",
    phone: "+33639980001",
    privacy: [unsettled],
    suppressions: [],
    variables: {
      prenom: "Camille",
      nom: "Fictive",
      ville: "Ville-Exemple",
      nom_bien: "Villa Démonstration",
      date_rdv: "12 mars 2027",
      heure_rdv: "14 h 30",
      adresse: "1 rue de l'Exemple, Ville-Exemple",
    },
    context: {
      segment: "cible_prodigio_premium",
      stade: "qualification_en_cours",
      source: "campagne_demonstration",
      canal_autorise: true,
      sans_opposition: true,
      sans_message_recent: 72,
    },
  },
  {
    id: "fictif_sans_coordonnee",
    label: "Dominique Fictif — sans coordonnée",
    purpose: "Aucune adresse exploitable : démontre le blocage « coordonnée absente ».",
    displayName: `Dominique Fictif (${SYNTHETIC_MARKER})`,
    email: null,
    phone: null,
    privacy: [unsettled],
    suppressions: [],
    variables: { prenom: "Dominique", nom: "Fictif", ville: "Ville-Exemple" },
    context: {
      segment: "hors_cible_premium",
      stade: "a_contacter",
      source: "saisie_manuelle",
      canal_autorise: true,
      sans_opposition: true,
      sans_message_recent: 12,
    },
  },
  {
    id: "fictif_opposition_email",
    label: "Alex Fictif — opposition e-mail",
    purpose: "Opposition active sur l'e-mail marketing : démontre le blocage par opposition.",
    displayName: `Alex Fictif (${SYNTHETIC_MARKER})`,
    email: "alex.fictif@exemple.invalid",
    phone: "+33639980002",
    privacy: [unsettled],
    suppressions: [{ channel: "email", scope: "marketing", active: true }],
    variables: { prenom: "Alex", nom: "Fictif", ville: "Ville-Exemple", nom_bien: "Villa Démonstration" },
    context: {
      segment: "cible_prodigio_premium",
      stade: "rendez_vous_planifie",
      source: "campagne_demonstration",
      canal_autorise: true,
      sans_opposition: false,
      sans_message_recent: 48,
    },
  },
  {
    id: "fictif_opposition_globale",
    label: "Sacha Fictif — opposition globale",
    purpose:
      "Opposition « tout canal / toute portée » : démontre qu'une opposition globale prévaut sur tout.",
    displayName: `Sacha Fictif (${SYNTHETIC_MARKER})`,
    email: "sacha.fictif@exemple.invalid",
    phone: "+33639980003",
    privacy: [unsettled],
    suppressions: [{ channel: "tout", scope: "tout", active: true }],
    variables: { prenom: "Sacha", nom: "Fictif", ville: "Ville-Exemple" },
    context: {
      segment: "hors_cible_premium",
      stade: "qualification_en_cours",
      source: "campagne_demonstration",
      canal_autorise: false,
      sans_opposition: false,
      sans_message_recent: 6,
    },
  },
  {
    id: "fictif_ne_plus_contacter",
    label: "Gabriel Fictif — ne plus contacter",
    purpose: "Demande absolue de ne plus être contacté : prévaut sur toute autre règle.",
    displayName: `Gabriel Fictif (${SYNTHETIC_MARKER})`,
    email: "gabriel.fictif@exemple.invalid",
    phone: "+33639980004",
    privacy: [{ ...unsettled, doNotContact: true }],
    suppressions: [],
    variables: { prenom: "Gabriel", nom: "Fictif", ville: "Ville-Exemple" },
    context: {
      segment: "non_determine",
      stade: "perdu",
      source: "saisie_manuelle",
      canal_autorise: false,
      sans_opposition: true,
      sans_message_recent: 0,
    },
  },
  {
    id: "fictif_variable_manquante",
    label: "Noa Fictif — variable manquante",
    purpose: "Variables incomplètes : démontre le refus de rendu plutôt qu'un envoi approximatif.",
    displayName: `Noa Fictif (${SYNTHETIC_MARKER})`,
    email: "noa.fictif@exemple.invalid",
    phone: "+33639980005",
    privacy: [unsettled],
    suppressions: [],
    variables: { prenom: "Noa" },
    context: {
      segment: "cible_prodigio_premium",
      stade: "estimation_realisee",
      source: "campagne_demonstration",
      canal_autorise: true,
      sans_opposition: true,
      sans_message_recent: 24,
    },
  },
];

export function syntheticRecipient(id: string): SyntheticRecipient | null {
  return SYNTHETIC_RECIPIENTS.find((r) => r.id === id) ?? null;
}

/**
 * Destinataire fictif par défaut. Exposé explicitement pour que l'interface
 * n'ait jamais à indexer le tableau « en espérant » qu'il ne soit pas vide.
 */
export const DEFAULT_SYNTHETIC_RECIPIENT: SyntheticRecipient = SYNTHETIC_RECIPIENTS[0]!;

/** Coordonnée fictive utilisée pour le canal demandé. */
export function syntheticAddress(
  recipient: SyntheticRecipient,
  channel: Channel,
): string | null {
  return channel === "sms" ? recipient.phone : recipient.email;
}

/**
 * Vrai si une valeur provient bien du jeu synthétique. Utilisé comme garde-fou :
 * le simulateur refuse toute donnée qui n'en vient pas.
 */
export function isSyntheticRecipientId(id: unknown): boolean {
  return typeof id === "string" && SYNTHETIC_RECIPIENTS.some((r) => r.id === id);
}
