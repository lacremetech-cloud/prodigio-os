import "server-only";

/**
 * Service de réservation des rendez-vous d'estimation (côté serveur uniquement).
 *
 * Cohérence à deux enregistrements (Prodigio + Google) — stratégie sûre :
 *   1. RÉSERVATION idempotente (claim atomique de la clé) : un double-clic ne
 *      crée jamais deux rendez-vous ni deux événements Google.
 *   2. RE-VÉRIFICATION du créneau (il a pu être pris entre-temps).
 *   3. CRÉATION de l'événement Google (sendUpdates=all → invitation au propriétaire).
 *   4. CONFIRMATION en base (rattache l'événement, avance le dossier, journalise).
 * Compensation : si l'étape Google échoue, la réservation sans effet externe est
 * abandonnée (clé libérée). Si la confirmation échoue APRÈS création Google,
 * l'événement Google est supprimé. Aucune confirmation n'est renvoyée si l'un des
 * deux enregistrements n'a pas réellement abouti.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mandateCrmBaseUrl } from "@/config";
import type { CalendarConnectionRow } from "@/lib/supabase/types";
import type { EstimationAppointmentRow } from "@/lib/supabase/types";
import {
  computeAvailableSlots,
  isSlotStillFree,
  zonedWallTimeToUtc,
  type FreeSlot,
} from "./availability";
import { resolveSchedulingConfig } from "./config";
import { getFreshAccessToken, CalendarReconnectRequiredError } from "./google/credentials";
import { deleteEvent, insertEvent, patchEvent, queryFreeBusy } from "./google/client";
import { GoogleApiError } from "./google/errors";
import { emitEstimationAppointmentCreated } from "./events";

async function getAgentConnection(
  agentUserId: string,
): Promise<CalendarConnectionRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("calendar_connections")
    .select("*")
    .eq("user_id", agentUserId)
    .eq("provider", "google")
    .maybeSingle();
  return (data as CalendarConnectionRow | null) ?? null;
}

async function fetchDayBusy(
  connection: CalendarConnectionRow,
  date: string,
  timeZone: string,
): Promise<{ busy: { start: string; end: string }[]; calendarId: string }> {
  const calendarId = connection.google_calendar_id ?? "primary";
  const accessToken = await getFreshAccessToken(connection.id);
  const [y = 0, m = 0, d = 0] = date.split("-").map(Number);
  const dayStart = zonedWallTimeToUtc(y, m, d, 0, 0, timeZone);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const busy = await queryFreeBusy(
    accessToken,
    calendarId,
    dayStart.toISOString(),
    dayEnd.toISOString(),
    timeZone,
  );
  return { busy, calendarId };
}

export interface AvailabilityResult {
  ok: boolean;
  slots?: FreeSlot[];
  error?: string;
  code?: "not_connected" | "needs_reconnect" | "calendar_error" | "unknown";
}

/** Calcule les créneaux disponibles d'un agent pour une journée donnée. */
export async function getAgentAvailability(
  agentUserId: string,
  date: string,
  durationMinutes?: number,
): Promise<AvailabilityResult> {
  const config = resolveSchedulingConfig();
  const connection = await getAgentConnection(agentUserId);
  if (!connection || connection.status !== "connecte") {
    return { ok: false, code: "not_connected", error: "L'agent n'a pas de calendrier connecté." };
  }
  try {
    const { busy } = await fetchDayBusy(connection, date, config.timeZone);
    const slots = computeAvailableSlots({ date, busy, config, durationMinutes });
    return { ok: true, slots };
  } catch (err) {
    if (err instanceof CalendarReconnectRequiredError) {
      return { ok: false, code: "needs_reconnect", error: "La connexion Google de l'agent doit être rétablie." };
    }
    if (err instanceof GoogleApiError) {
      if (err.kind === "unauthorized") {
        return { ok: false, code: "needs_reconnect", error: "La connexion Google de l'agent a expiré." };
      }
      return { ok: false, code: "calendar_error", error: "Calendrier de l'agent inaccessible." };
    }
    return { ok: false, code: "unknown", error: "Impossible de récupérer les disponibilités." };
  }
}

export interface BookEstimationInput {
  idempotencyKey: string;
  opportunityId: string;
  agentUserId: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  address: string | null;
  city: string | null;
  ownerContactId: string | null;
  ownerEmail: string | null;
  ownerName: string | null;
  notes: string | null;
}

export interface BookEstimationResult {
  ok: boolean;
  appointmentId?: string;
  htmlLink?: string | null;
  alreadyBooked?: boolean;
  processing?: boolean;
  error?: string;
  code?:
    | "slot_taken"
    | "not_connected"
    | "needs_reconnect"
    | "google_failed"
    | "conflict"
    | "denied"
    | "unknown";
}

function eventTitle(city: string | null, ownerName: string | null): string {
  const parts = ["Estimation Prodigio"];
  if (city) parts.push(city);
  if (ownerName) parts.push(ownerName);
  return parts.join(" — ");
}

/** Réserve et crée un rendez-vous d'estimation (idempotent, avec compensation). */
export async function bookEstimation(
  input: BookEstimationInput,
): Promise<BookEstimationResult> {
  const supabase = await createSupabaseServerClient();
  const config = resolveSchedulingConfig();

  // 1. Réservation idempotente (claim atomique).
  const { data: reserveData, error: reserveError } = await supabase.rpc(
    "crm_reserve_estimation_appointment",
    {
      p_idempotency_key: input.idempotencyKey,
      p_opportunity_id: input.opportunityId,
      p_agent_user_id: input.agentUserId,
      p_starts_at: input.startsAt,
      p_ends_at: input.endsAt,
      p_timezone: input.timezone,
      p_address: input.address,
      p_owner_contact_id: input.ownerContactId,
      p_owner_email: input.ownerEmail,
      p_owner_name: input.ownerName,
      p_calendar_id: null,
      p_notes: input.notes,
    },
  );

  if (reserveError) {
    const code = reserveError.code === "42501" ? "denied" : "unknown";
    return { ok: false, code, error: reserveError.message || "Réservation impossible." };
  }

  const reserve = (reserveData ?? {}) as {
    id?: string;
    created?: boolean;
    google_event_id?: string | null;
  };
  const appointmentId = reserve.id ?? "";
  if (!appointmentId) return { ok: false, code: "unknown", error: "Réservation invalide." };

  // Réservation déjà existante (double-clic / rejeu).
  if (!reserve.created) {
    if (reserve.google_event_id) {
      // Rendez-vous déjà entièrement créé : succès idempotent.
      return { ok: true, appointmentId, alreadyBooked: true };
    }
    // Réservation en cours de traitement par la première requête : ne PAS créer
    // un second événement Google.
    return { ok: true, appointmentId, processing: true };
  }

  // 2. Re-vérifie la disponibilité (le créneau a pu être pris entre-temps).
  const connection = await getAgentConnection(input.agentUserId);
  if (!connection || connection.status !== "connecte") {
    await supabase.rpc("crm_discard_pending_appointment", { p_id: appointmentId });
    return { ok: false, code: "not_connected", error: "L'agent n'a pas de calendrier connecté." };
  }

  let calendarId = connection.google_calendar_id ?? "primary";
  try {
    const date = input.startsAt.slice(0, 10);
    const day = await fetchDayBusy(connection, date, input.timezone || config.timeZone);
    calendarId = day.calendarId;
    if (!isSlotStillFree(input.startsAt, input.endsAt, day.busy, config)) {
      await supabase.rpc("crm_discard_pending_appointment", { p_id: appointmentId });
      return { ok: false, code: "slot_taken", error: "Ce créneau vient d'être pris. Choisissez-en un autre." };
    }
  } catch (err) {
    await supabase.rpc("crm_discard_pending_appointment", { p_id: appointmentId });
    if (err instanceof CalendarReconnectRequiredError || (err instanceof GoogleApiError && err.kind === "unauthorized")) {
      await supabase.rpc("calendar_mark_connection_state", {
        p_user_id: input.agentUserId,
        p_status: "erreur",
        p_error: "verification_indisponible",
      });
      return { ok: false, code: "needs_reconnect", error: "La connexion Google de l'agent doit être rétablie." };
    }
    return { ok: false, code: "google_failed", error: "Calendrier de l'agent inaccessible." };
  }

  // 3. Crée l'événement Google (invitation au propriétaire via sendUpdates=all).
  const crmUrl = `${mandateCrmBaseUrl()}/crm/mandats/${input.opportunityId}`;
  let accessToken: string;
  try {
    accessToken = await getFreshAccessToken(connection.id);
  } catch {
    await supabase.rpc("crm_discard_pending_appointment", { p_id: appointmentId });
    return { ok: false, code: "needs_reconnect", error: "La connexion Google de l'agent doit être rétablie." };
  }

  const description = [
    "Rendez-vous d'estimation avec Prodigio.",
    input.address ? `Adresse : ${input.address}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  let event: { id: string; htmlLink: string | null };
  try {
    event = await insertEvent(
      accessToken,
      calendarId,
      {
        summary: eventTitle(input.city, input.ownerName),
        description,
        location: input.address ?? undefined,
        start: input.startsAt,
        end: input.endsAt,
        timeZone: input.timezone || config.timeZone,
        attendees: input.ownerEmail
          ? [{ email: input.ownerEmail, displayName: input.ownerName ?? undefined }]
          : undefined,
        // Lien CRM en propriété PRIVÉE (invisible pour le propriétaire invité).
        privateProperties: { prodigio_crm_url: crmUrl, prodigio_opportunity_id: input.opportunityId },
      },
      "all",
    );
  } catch (err) {
    // Échec Google → compensation : abandonner la réservation (aucun effet externe).
    await supabase.rpc("crm_discard_pending_appointment", { p_id: appointmentId });
    if (err instanceof GoogleApiError && err.kind === "unauthorized") {
      await supabase.rpc("calendar_mark_connection_state", {
        p_user_id: input.agentUserId,
        p_status: "revoque",
        p_error: "creation_refusee",
      });
      return { ok: false, code: "needs_reconnect", error: "La connexion Google de l'agent a expiré." };
    }
    return { ok: false, code: "google_failed", error: "La création de l'événement Google a échoué. Rien n'a été enregistré." };
  }

  if (!event.id) {
    await supabase.rpc("crm_discard_pending_appointment", { p_id: appointmentId });
    return { ok: false, code: "google_failed", error: "Réponse Google inattendue. Rien n'a été enregistré." };
  }

  // 4. Confirmation en base (rattache l'événement + avance le dossier + audit).
  const { error: confirmError } = await supabase.rpc("crm_confirm_estimation_appointment", {
    p_id: appointmentId,
    p_google_event_id: event.id,
    p_google_calendar_id: calendarId,
    p_html_link: event.htmlLink,
  });

  if (confirmError) {
    // Compensation : supprimer l'événement Google (best-effort) puis abandonner.
    try {
      await deleteEvent(accessToken, calendarId, event.id, "all");
    } catch {
      // best-effort
    }
    await supabase.rpc("crm_discard_pending_appointment", { p_id: appointmentId });
    return { ok: false, code: "conflict", error: "Enregistrement Prodigio impossible. L'événement Google a été annulé." };
  }

  // Événement métier (seam pour SMS/WhatsApp/Slack — no-op en V1).
  await emitEstimationAppointmentCreated({
    appointmentId,
    opportunityId: input.opportunityId,
    agentUserId: input.agentUserId,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    timezone: input.timezone || config.timeZone,
    city: input.city,
    ownerName: input.ownerName,
    ownerInvited: Boolean(input.ownerEmail),
  });

  return { ok: true, appointmentId, htmlLink: event.htmlLink };
}

async function getAppointment(
  appointmentId: string,
): Promise<EstimationAppointmentRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("estimation_appointments")
    .select("*")
    .eq("id", appointmentId)
    .maybeSingle();
  return (data as EstimationAppointmentRow | null) ?? null;
}

export interface ManageResult {
  ok: boolean;
  error?: string;
  code?: "not_found" | "denied" | "google_failed" | "needs_reconnect" | "unknown";
}

/**
 * Reporte un rendez-vous : met à jour l'événement Google puis les horaires en
 * base. Si l'événement Google a été supprimé manuellement (404), il est recréé.
 */
export async function rescheduleEstimation(
  appointmentId: string,
  startsAt: string,
  endsAt: string,
): Promise<ManageResult> {
  const supabase = await createSupabaseServerClient();
  const config = resolveSchedulingConfig();
  const appt = await getAppointment(appointmentId);
  if (!appt) return { ok: false, code: "not_found", error: "Rendez-vous introuvable." };

  const connection = await getAgentConnection(appt.agent_user_id);
  const calendarId = appt.google_calendar_id ?? connection?.google_calendar_id ?? "primary";
  const tz = appt.timezone || config.timeZone;

  if (connection && connection.status === "connecte") {
    try {
      const accessToken = await getFreshAccessToken(connection.id);
      if (appt.google_event_id) {
        try {
          await patchEvent(
            accessToken,
            calendarId,
            appt.google_event_id,
            { start: startsAt, end: endsAt, timeZone: tz },
            "all",
          );
        } catch (err) {
          if (err instanceof GoogleApiError && (err.status === 404 || err.status === 410)) {
            // Événement supprimé manuellement → on le recrée, puis on rattache l'id.
            const recreated = await insertEvent(
              accessToken,
              calendarId,
              {
                summary: eventTitle(appt.owner_name, appt.owner_name),
                description: "Rendez-vous d'estimation avec Prodigio.",
                location: appt.address ?? undefined,
                start: startsAt,
                end: endsAt,
                timeZone: tz,
                attendees: appt.owner_email
                  ? [{ email: appt.owner_email, displayName: appt.owner_name ?? undefined }]
                  : undefined,
              },
              "all",
            );
            await supabase.rpc("crm_confirm_estimation_appointment", {
              p_id: appointmentId,
              p_google_event_id: recreated.id,
              p_google_calendar_id: calendarId,
              p_html_link: recreated.htmlLink,
            });
          } else {
            throw err;
          }
        }
      }
    } catch (err) {
      if (err instanceof CalendarReconnectRequiredError) {
        return { ok: false, code: "needs_reconnect", error: "La connexion Google de l'agent doit être rétablie." };
      }
      return { ok: false, code: "google_failed", error: "La mise à jour de l'événement Google a échoué. Rien n'a été modifié." };
    }
  }

  const { error } = await supabase.rpc("crm_reschedule_estimation_appointment", {
    p_id: appointmentId,
    p_starts_at: startsAt,
    p_ends_at: endsAt,
  });
  if (error) {
    const code = error.code === "42501" ? "denied" : "unknown";
    return { ok: false, code, error: error.message || "Report impossible." };
  }
  return { ok: true };
}

/**
 * Annule un rendez-vous : enregistre l'annulation en base (source de vérité) puis
 * supprime l'événement Google (best-effort, idempotent si déjà supprimé).
 */
export async function cancelEstimation(
  appointmentId: string,
  reason: string | null,
): Promise<ManageResult> {
  const supabase = await createSupabaseServerClient();
  const appt = await getAppointment(appointmentId);
  if (!appt) return { ok: false, code: "not_found", error: "Rendez-vous introuvable." };

  const { error } = await supabase.rpc("crm_cancel_estimation_appointment", {
    p_id: appointmentId,
    p_reason: reason,
  });
  if (error) {
    const code = error.code === "42501" ? "denied" : "unknown";
    return { ok: false, code, error: error.message || "Annulation impossible." };
  }

  // Best-effort : supprimer l'événement Google (ne remet pas en cause l'annulation).
  if (appt.google_event_id) {
    const connection = await getAgentConnection(appt.agent_user_id);
    if (connection && connection.status === "connecte") {
      try {
        const accessToken = await getFreshAccessToken(connection.id);
        await deleteEvent(
          accessToken,
          appt.google_calendar_id ?? connection.google_calendar_id ?? "primary",
          appt.google_event_id,
          "all",
        );
      } catch {
        // L'événement Google pourra être retiré manuellement ; le CRM est à jour.
      }
    }
  }
  return { ok: true };
}
