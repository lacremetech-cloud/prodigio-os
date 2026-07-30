/**
 * Point d'extension métier des rendez-vous d'estimation.
 *
 * V1 : l'invitation Google Calendar sert de confirmation e-mail au propriétaire.
 * Aucune notification externe supplémentaire (ni Twilio/SMS/WhatsApp, ni Slack)
 * n'est déclenchée ici — c'est le périmètre d'une mission ultérieure.
 *
 * Ce module fournit le SEUL point d'ancrage `estimation_appointment_created`
 * pour brancher plus tard ces canaux (SMS de confirmation, rappels J-1 / H-2,
 * notification Slack interne) SANS réécrire le module de réservation : il suffira
 * d'enregistrer un gestionnaire ci-dessous. En l'état, l'émission est un no-op
 * volontaire (aucun effet de bord, aucune donnée personnelle journalisée).
 */

export interface EstimationAppointmentCreatedEvent {
  appointmentId: string;
  opportunityId: string;
  agentUserId: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  city: string | null;
  ownerName: string | null;
  /** Présence d'un e-mail invité (jamais la valeur elle-même dans les logs). */
  ownerInvited: boolean;
}

export type EstimationEventHandler = (
  event: EstimationAppointmentCreatedEvent,
) => void | Promise<void>;

// Registre des gestionnaires (vide en V1). Une future mission y branchera
// SMS/WhatsApp/Slack sans toucher au module de réservation.
const handlers: EstimationEventHandler[] = [];

/** Enregistre un gestionnaire (extension future). */
export function onEstimationAppointmentCreated(handler: EstimationEventHandler): void {
  handlers.push(handler);
}

/**
 * Émet l'événement métier « rendez-vous d'estimation créé ». Best-effort : une
 * défaillance d'un gestionnaire ne remet jamais en cause le rendez-vous déjà
 * enregistré (dans Prodigio et Google).
 */
export async function emitEstimationAppointmentCreated(
  event: EstimationAppointmentCreatedEvent,
): Promise<void> {
  for (const handler of handlers) {
    try {
      await handler(event);
    } catch {
      // Les notifications sont non bloquantes : on n'échoue jamais la réservation.
    }
  }
}
