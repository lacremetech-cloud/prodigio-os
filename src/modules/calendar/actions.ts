"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireCrmSession } from "@/modules/crm/auth/session";
import {
  canConnectCalendar,
  canManageAppointments,
  canPlanEstimation,
} from "@/modules/crm/auth/roles";
import { disconnectGoogle, listMyCalendars } from "./service";
import {
  bookEstimation,
  cancelEstimation,
  getAgentAvailability,
  rescheduleEstimation,
  type BookEstimationResult,
} from "./booking";
import type { FreeSlot } from "./availability";
import type { GoogleCalendarEntry } from "./google/client";
import { CalendarReconnectRequiredError } from "./google/credentials";

/**
 * Actions serveur de gestion de la connexion Google Calendar (sélection du
 * calendrier, déconnexion, liste des calendriers). L'autorité de rôle est en
 * base (fonctions SECURITY DEFINER) ; on ajoute une garde de session (défense en
 * profondeur) et l'invalidation du cache. Aucun jeton n'est jamais renvoyé au
 * client — seulement des métadonnées non sensibles.
 */

export interface CalendarActionResult {
  ok: boolean;
  error?: string;
}

const SETTINGS = "/crm/parametres/calendrier";

function humanize(code: string | undefined, message: string): string {
  switch (code) {
    case "28000":
      return "Session expirée. Reconnectez-vous.";
    case "42501":
      return message || "Droits insuffisants pour cette action.";
    case "22023":
      return message || "Données invalides.";
    default:
      return message || "Une erreur est survenue. Réessayez.";
  }
}

const selectSchema = z.object({
  calendarId: z.string().trim().min(1, "Calendrier requis.").max(1024),
  summary: z.string().trim().max(512).optional().default(""),
});

export async function selectCalendarAction(input: {
  calendarId: string;
  summary?: string;
}): Promise<CalendarActionResult> {
  const session = await requireCrmSession(SETTINGS);
  if (!canConnectCalendar(session.roles)) {
    return { ok: false, error: "Droits insuffisants." };
  }
  const parsed = selectSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("calendar_select_estimation_calendar", {
    p_calendar_id: parsed.data.calendarId,
    p_calendar_summary: parsed.data.summary || null,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };

  revalidatePath(SETTINGS);
  return { ok: true };
}

export async function disconnectCalendarAction(): Promise<CalendarActionResult> {
  const session = await requireCrmSession(SETTINGS);
  if (!canConnectCalendar(session.roles)) {
    return { ok: false, error: "Droits insuffisants." };
  }
  try {
    await disconnectGoogle();
  } catch {
    return {
      ok: false,
      error: "La déconnexion a échoué. Réessayez dans un instant.",
    };
  }
  revalidatePath(SETTINGS);
  return { ok: true };
}

export interface ListCalendarsResult {
  ok: boolean;
  calendars?: GoogleCalendarEntry[];
  error?: string;
  needsReconnect?: boolean;
}

export async function listMyCalendarsAction(): Promise<ListCalendarsResult> {
  const session = await requireCrmSession(SETTINGS);
  if (!canConnectCalendar(session.roles)) {
    return { ok: false, error: "Droits insuffisants." };
  }
  try {
    const calendars = await listMyCalendars();
    return { ok: true, calendars };
  } catch (err) {
    if (err instanceof CalendarReconnectRequiredError) {
      return {
        ok: false,
        needsReconnect: true,
        error: "Connexion Google expirée : reconnectez votre calendrier.",
      };
    }
    return { ok: false, error: "Impossible de récupérer vos calendriers Google." };
  }
}

// --- Planification des rendez-vous d'estimation ------------------------------

const RDV_PATH = "/crm/rendez-vous";

function revalidateAppointment(opportunityId?: string) {
  revalidatePath(RDV_PATH);
  revalidatePath("/crm/mandats");
  revalidatePath("/crm/mandats/pipeline");
  if (opportunityId) revalidatePath(`/crm/mandats/${opportunityId}`);
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.");
const uuid = z.string().uuid("Identifiant invalide.");
const isoDateTime = z.string().datetime({ offset: true }).or(z.string().datetime());

export interface AvailabilityActionResult {
  ok: boolean;
  slots?: FreeSlot[];
  error?: string;
  code?: string;
}

export async function getAvailabilityAction(input: {
  agentUserId: string;
  date: string;
  durationMinutes?: number;
}): Promise<AvailabilityActionResult> {
  const session = await requireCrmSession();
  if (!canPlanEstimation(session.roles)) {
    return { ok: false, error: "Droits insuffisants pour planifier une estimation." };
  }
  const parsed = z
    .object({ agentUserId: uuid, date: isoDate, durationMinutes: z.number().int().positive().max(600).optional() })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }
  const res = await getAgentAvailability(
    parsed.data.agentUserId,
    parsed.data.date,
    parsed.data.durationMinutes,
  );
  return { ok: res.ok, slots: res.slots, error: res.error, code: res.code };
}

const bookSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(200),
  opportunityId: uuid,
  agentUserId: uuid,
  startsAt: isoDateTime,
  endsAt: isoDateTime,
  timezone: z.string().trim().max(64).default("Europe/Paris"),
  address: z.string().trim().max(500).nullable().optional(),
  city: z.string().trim().max(200).nullable().optional(),
  ownerContactId: uuid.nullable().optional(),
  ownerEmail: z.string().trim().email().max(320).nullable().optional(),
  ownerName: z.string().trim().max(200).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export async function bookEstimationAction(
  input: unknown,
): Promise<BookEstimationResult> {
  const session = await requireCrmSession();
  if (!canPlanEstimation(session.roles)) {
    return { ok: false, code: "denied", error: "Droits insuffisants pour planifier une estimation." };
  }
  const parsed = bookSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "unknown", error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }
  const d = parsed.data;
  const res = await bookEstimation({
    idempotencyKey: d.idempotencyKey,
    opportunityId: d.opportunityId,
    agentUserId: d.agentUserId,
    startsAt: d.startsAt,
    endsAt: d.endsAt,
    timezone: d.timezone,
    address: d.address ?? null,
    city: d.city ?? null,
    ownerContactId: d.ownerContactId ?? null,
    ownerEmail: d.ownerEmail ?? null,
    ownerName: d.ownerName ?? null,
    notes: d.notes ?? null,
  });
  if (res.ok) revalidateAppointment(d.opportunityId);
  return res;
}

export async function rescheduleAppointmentAction(input: {
  appointmentId: string;
  startsAt: string;
  endsAt: string;
  opportunityId?: string;
}): Promise<CalendarActionResult> {
  const session = await requireCrmSession();
  if (!canManageAppointments(session.roles)) {
    return { ok: false, error: "Droits insuffisants pour reporter." };
  }
  const parsed = z
    .object({ appointmentId: uuid, startsAt: isoDateTime, endsAt: isoDateTime })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }
  const res = await rescheduleEstimation(parsed.data.appointmentId, parsed.data.startsAt, parsed.data.endsAt);
  if (res.ok) revalidateAppointment(input.opportunityId);
  return { ok: res.ok, error: res.error };
}

export async function cancelAppointmentAction(input: {
  appointmentId: string;
  reason?: string;
  opportunityId?: string;
}): Promise<CalendarActionResult> {
  const session = await requireCrmSession();
  if (!canManageAppointments(session.roles)) {
    return { ok: false, error: "Droits insuffisants pour annuler." };
  }
  const parsed = z
    .object({ appointmentId: uuid, reason: z.string().trim().max(500).optional() })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }
  const res = await cancelEstimation(parsed.data.appointmentId, parsed.data.reason ?? null);
  if (res.ok) revalidateAppointment(input.opportunityId);
  return { ok: res.ok, error: res.error };
}

const RESULT_STATUSES = ["planifie", "confirme", "realise", "absent", "a_replanifier"] as const;

export async function setAppointmentResultAction(input: {
  appointmentId: string;
  status: string;
  notes?: string;
  opportunityId?: string;
}): Promise<CalendarActionResult> {
  const session = await requireCrmSession();
  // Gestionnaires OU agent (la base restreint l'agent à SES rendez-vous).
  const allowed =
    canManageAppointments(session.roles) || session.roles.includes("agent_immobilier");
  if (!allowed) {
    return { ok: false, error: "Droits insuffisants." };
  }
  const parsed = z
    .object({
      appointmentId: uuid,
      status: z.enum(RESULT_STATUSES),
      notes: z.string().trim().max(2000).optional(),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_set_appointment_result", {
    p_id: parsed.data.appointmentId,
    p_status: parsed.data.status,
    p_notes: parsed.data.notes ?? null,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };

  revalidateAppointment(input.opportunityId);
  return { ok: true };
}
