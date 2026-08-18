/**
 * Catalogue des **événements transactionnels** de la V1.
 *
 * Chaque entrée documente, de manière vérifiable : qui est destinataire, pourquoi
 * le message est transactionnel, le canal, la condition d'envoi, la règle
 * d'idempotence, et les cas où AUCUN message ne doit être créé.
 *
 * ⚠️ Ce fichier est **descriptif**. L'autorité reste la base : les déclencheurs
 * SQL enfilent les événements, et `crm_comm_prepare_message` applique la
 * politique. Rien ici ne décide d'un envoi.
 */

import type { Category, Channel, CommunicationEvent } from "./types";

export interface EventDefinition {
  event: CommunicationEvent;
  label: string;
  /** Qui reçoit le message. Toujours un **contact**, jamais un utilisateur interne. */
  recipient: string;
  /** Pourquoi il est transactionnel (et non marketing). */
  rationale: string;
  channel: Channel;
  category: Category;
  templateKey: string;
  /** Ce qui déclenche l'enfilement, côté base. */
  trigger: string;
  /** Comment un rejeu est neutralisé. */
  idempotency: string;
  /** Cas où AUCUN message ne doit exister. */
  noMessageWhen: readonly string[];
}

export const EVENT_DEFINITIONS: readonly EventDefinition[] = [
  {
    event: "demande_mandat_enregistree",
    label: "Demande de mandat enregistrée",
    recipient: "Le propriétaire vendeur ayant déposé la demande (contact rattaché à la soumission).",
    rationale:
      "Accusé de réception d'une demande formulée par la personne elle-même. Ne promeut rien, ne propose aucune offre.",
    channel: "email",
    category: "transactionnel",
    templateKey: "mandat_demande_accusee",
    trigger: "Déclencheur `after insert` sur `funnel_submissions`, dans la transaction du dépôt.",
    idempotency: "event_key = `demande_mandat_enregistree:<submission_id>` — unique en base.",
    noMessageWhen: [
      "la soumission n'est rattachée à aucun contact (`contact_id` absent)",
      "le contact n'a pas d'adresse e-mail exploitable",
      "une opposition « ne plus contacter » ou une suppression active existe",
      "aucun modèle actif pour cette clé et ce canal",
    ],
  },
  {
    event: "interet_acquereur_enregistre",
    label: "Intérêt acquéreur enregistré",
    recipient: "L'acquéreur ayant manifesté son intérêt sur un bien.",
    rationale:
      "Accusé de réception d'une demande d'information sollicitée par la personne. Aucune prospection.",
    channel: "email",
    category: "transactionnel",
    templateKey: "acquereur_interet_accuse",
    trigger: "Déclencheur `after insert` sur `buyer_interests`.",
    idempotency: "event_key = `interet_acquereur_enregistre:<interest_id>`.",
    noMessageWhen: [
      "l'intérêt n'est rattaché à aucun contact",
      "le contact n'a pas d'adresse e-mail exploitable",
      "une opposition bloque le canal",
      "aucun modèle actif",
    ],
  },
  {
    event: "estimation_planifiee",
    label: "Estimation planifiée",
    recipient: "Le propriétaire concerné par le rendez-vous (`owner_contact_id`).",
    rationale: "Confirmation d'un rendez-vous demandé et accepté par la personne.",
    channel: "email",
    category: "transactionnel",
    templateKey: "estimation_planifiee",
    trigger:
      "Déclencheur `after update` sur `estimation_appointments`, au moment où l'événement Google est rattaché (confirmation).",
    idempotency: "event_key = `estimation_planifiee:<appointment_id>`.",
    noMessageWhen: [
      "⚠️ **Google Calendar envoie déjà l'invitation** : si l'événement existe ET que le propriétaire y est invité, le message est bloqué en `google_couvre_l_envoi`",
      "le rendez-vous n'a pas de contact propriétaire",
      "le créneau est abandonné avant confirmation (aucun événement n'est enfilé à l'insertion)",
    ],
  },
  {
    event: "estimation_reportee",
    label: "Estimation reportée",
    recipient: "Le propriétaire concerné par le rendez-vous.",
    rationale: "Information indispensable à l'exécution du service demandé.",
    channel: "email",
    category: "transactionnel",
    templateKey: "estimation_reportee",
    trigger: "Changement de `starts_at` sur un rendez-vous déjà confirmé.",
    idempotency:
      "event_key = `estimation_reportee:<appointment_id>:<nouvel horodatage>` — chaque report distinct est enfilé une seule fois.",
    noMessageWhen: [
      "⚠️ **Google Calendar envoie déjà la mise à jour** lorsque le propriétaire est invité",
      "le rendez-vous n'était pas encore confirmé",
    ],
  },
  {
    event: "estimation_annulee",
    label: "Estimation annulée",
    recipient: "Le propriétaire concerné par le rendez-vous.",
    rationale: "Information indispensable : la personne doit savoir que le rendez-vous n'aura pas lieu.",
    channel: "email",
    category: "transactionnel",
    templateKey: "estimation_annulee",
    trigger: "Passage du statut à `annule`.",
    idempotency: "event_key = `estimation_annulee:<appointment_id>`.",
    noMessageWhen: [
      "⚠️ **Google Calendar envoie déjà l'annulation** lorsque le propriétaire est invité",
      "le rendez-vous n'a pas de contact propriétaire",
    ],
  },
  {
    event: "estimation_rappel",
    label: "Rappel de rendez-vous",
    recipient: "Le propriétaire concerné par le rendez-vous à venir.",
    rationale:
      "Exécution du service : réduire l'absence au rendez-vous. **Responsabilité Prodigio** — Google ne garantit aucun rappel côté destinataire (les rappels dépendent des réglages de l'invité).",
    channel: "email",
    category: "transactionnel",
    templateKey: "estimation_rappel",
    trigger: "`crm_comm_schedule_reminders(<heures>)`, sur les rendez-vous à venir.",
    idempotency:
      "event_key = `estimation_rappel:<appointment_id>:<horodatage du créneau>` — un report crée un nouveau rappel, sans jamais dupliquer l'ancien.",
    noMessageWhen: [
      "le rendez-vous est annulé ou passé",
      "le rendez-vous n'a pas de contact propriétaire",
      "une opposition bloque le canal",
    ],
  },
] as const;

/** Définition d'un événement, ou `null` s'il n'est pas couvert par la V1. */
export function eventDefinition(event: string): EventDefinition | null {
  return EVENT_DEFINITIONS.find((d) => d.event === event) ?? null;
}

/**
 * Événements pour lesquels Google Calendar assume déjà l'envoi au propriétaire.
 * Le rappel en est **volontairement exclu**.
 */
export const GOOGLE_COVERED_EVENTS: readonly CommunicationEvent[] = [
  "estimation_planifiee",
  "estimation_reportee",
  "estimation_annulee",
];
