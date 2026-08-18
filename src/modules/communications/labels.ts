/**
 * Libellés français du module Communications. Externalisés ici pour préparer
 * l'internationalisation : aucun texte d'interface n'est codé en dur ailleurs.
 */

import type {
  Category,
  Channel,
  CommunicationEvent,
  ErrorCode,
  MessageStatus,
  OutboxStatus,
  SuppressionReason,
} from "./types";

export const channelLabels: Record<Channel, string> = {
  email: "E-mail",
  sms: "SMS",
};

export const categoryLabels: Record<Category, string> = {
  transactionnel: "Transactionnel",
  marketing: "Marketing",
};

export const categoryHints: Record<Category, string> = {
  transactionnel:
    "Répond à une demande de la personne ou exécute le service attendu. Ne promeut rien.",
  marketing:
    "Finalité distincte. Exige une base légale établie et un canal explicitement autorisé.",
};

export const messageStatusLabels: Record<MessageStatus, string> = {
  planifie: "Planifié",
  en_attente: "En attente d'envoi",
  en_file_fournisseur: "En file chez le fournisseur",
  livre: "Livré",
  echec: "Échec",
  bloque: "Bloqué",
  annule: "Annulé",
};

export const outboxStatusLabels: Record<OutboxStatus, string> = {
  en_attente: "En attente",
  en_cours: "En cours",
  traite: "Traité",
  ignore: "Ignoré",
  echec: "Échec",
  abandonne: "Abandonné",
};

export const errorCodeLabels: Record<ErrorCode, string> = {
  configuration_absente: "Fournisseur non configuré",
  authentification_refusee: "Authentification refusée par le fournisseur",
  destinataire_invalide: "Destinataire invalide",
  domaine_non_verifie: "Domaine expéditeur non vérifié",
  limite_debit: "Limite de débit atteinte",
  indisponible: "Fournisseur indisponible",
  delai_depasse: "Délai dépassé",
  rejet_permanent: "Rejet définitif",
  erreur_inconnue: "Erreur inconnue",
};

export const eventLabels: Record<CommunicationEvent, string> = {
  demande_mandat_enregistree: "Demande de mandat enregistrée",
  interet_acquereur_enregistre: "Intérêt acquéreur enregistré",
  estimation_planifiee: "Estimation planifiée",
  estimation_reportee: "Estimation reportée",
  estimation_annulee: "Estimation annulée",
  estimation_rappel: "Rappel de rendez-vous",
};

export const suppressionReasonLabels: Record<SuppressionReason, string> = {
  rebond_definitif: "Rebond définitif",
  plainte: "Plainte pour spam",
  desinscription: "Désinscription",
  demande_personne: "Demande de la personne",
  erreur_permanente: "Erreur permanente",
  decision_interne: "Décision interne",
};

export const templateStatusLabels: Record<string, string> = {
  brouillon: "Brouillon",
  actif: "Actif",
  archive: "Archivé",
};

export const automationStatusLabels: Record<string, string> = {
  brouillon: "Brouillon",
  actif: "Actif",
  en_pause: "En pause",
  archive: "Archivé",
};

/**
 * Correspondance statut → visuel. Réutilise les variables de thème DÉJÀ
 * définies dans `crm.css` : aucune couleur brute, cohérence clair/sombre
 * garantie. La couleur n'est jamais le seul signal — chaque statut porte aussi
 * une icône et un libellé.
 */
export function messageStatusVisual(status: MessageStatus): { cssVar: string; icon: string } {
  switch (status) {
    case "livre":
      return { cssVar: "--crm-st-signe", icon: "✓" };
    case "en_file_fournisseur":
      return { cssVar: "--crm-st-nouveau", icon: "→" };
    case "en_attente":
    case "planifie":
      return { cssVar: "--crm-st-a_contacter", icon: "◷" };
    case "bloque":
      return { cssVar: "--crm-st-eligibilite", icon: "⦸" };
    case "echec":
      return { cssVar: "--crm-st-perdu", icon: "!" };
    case "annule":
      return { cssVar: "--crm-st-neutre", icon: "×" };
  }
}
