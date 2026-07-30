import "server-only";

/**
 * Client REST minimal de l'API Google Calendar (côté serveur uniquement). Utilise
 * `fetch` (aucune dépendance `googleapis` ajoutée — versions verrouillées). Tout
 * appel prend un access token en clair EN MÉMOIRE, fourni par le gestionnaire de
 * jetons ; il n'est jamais journalisé ni renvoyé au client.
 */

import type { Interval } from "../availability";
import { GoogleApiError, googleErrorKindFromStatus } from "./errors";

const CAL_BASE = "https://www.googleapis.com/calendar/v3";
const USERINFO = "https://www.googleapis.com/oauth2/v3/userinfo";

async function googleFetch(
  url: string,
  accessToken: string,
  init?: RequestInit,
): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        authorization: `Bearer ${accessToken}`,
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new GoogleApiError("Échec réseau Google Calendar.", 0, "network");
  }
  const text = await res.text();
  if (!res.ok) {
    throw new GoogleApiError(
      `Appel Google Calendar en échec (${res.status}).`,
      res.status,
      googleErrorKindFromStatus(res.status),
    );
  }
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new GoogleApiError("Réponse Google Calendar illisible.", res.status, "network");
  }
}

// --- Compte connecté ---------------------------------------------------------

export interface GoogleUserInfo {
  email: string | null;
  emailVerified: boolean;
}

export async function getUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const data = (await googleFetch(USERINFO, accessToken)) as Record<string, unknown>;
  return {
    email: typeof data.email === "string" ? data.email : null,
    emailVerified: data.email_verified === true,
  };
}

// --- Liste des calendriers ---------------------------------------------------

export interface GoogleCalendarEntry {
  id: string;
  summary: string;
  primary: boolean;
  accessRole: string;
}

export async function listCalendars(accessToken: string): Promise<GoogleCalendarEntry[]> {
  const data = (await googleFetch(
    `${CAL_BASE}/users/me/calendarList?minAccessRole=writer&maxResults=250`,
    accessToken,
  )) as { items?: unknown[] };
  const items = Array.isArray(data.items) ? data.items : [];
  return items.map((raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      id: String(o.id ?? ""),
      summary: String(o.summaryOverride ?? o.summary ?? o.id ?? ""),
      primary: o.primary === true,
      accessRole: String(o.accessRole ?? ""),
    };
  });
}

// --- FreeBusy ----------------------------------------------------------------

/**
 * Interroge les plages occupées d'un calendrier entre deux instants. `timeMin` /
 * `timeMax` sont des ISO. Renvoie les intervalles occupés (UTC ISO).
 */
export async function queryFreeBusy(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string,
  timeZone = "Europe/Paris",
): Promise<Interval[]> {
  const data = (await googleFetch(`${CAL_BASE}/freeBusy`, accessToken, {
    method: "POST",
    body: JSON.stringify({
      timeMin,
      timeMax,
      timeZone,
      items: [{ id: calendarId }],
    }),
  })) as { calendars?: Record<string, { busy?: Interval[]; errors?: unknown[] }> };

  const cal = data.calendars?.[calendarId];
  if (cal?.errors && cal.errors.length > 0) {
    throw new GoogleApiError("Calendrier inaccessible (FreeBusy).", 403, "forbidden");
  }
  return Array.isArray(cal?.busy) ? cal.busy : [];
}

// --- Événements --------------------------------------------------------------

export interface GoogleEventAttendee {
  email: string;
  displayName?: string;
}

export interface GoogleEventInput {
  summary: string;
  description?: string;
  location?: string;
  start: string; // ISO
  end: string; // ISO
  timeZone: string;
  attendees?: GoogleEventAttendee[];
  /**
   * Propriétés PRIVÉES de l'événement (non visibles par les invités, dont le
   * propriétaire) : on y place le lien vers la fiche CRM Prodigio. La description
   * partagée ne contient QUE des informations opérationnelles.
   */
  privateProperties?: Record<string, string>;
}

export interface GoogleEventResult {
  id: string;
  htmlLink: string | null;
  status: string | null;
}

function eventBody(input: GoogleEventInput): Record<string, unknown> {
  return {
    summary: input.summary,
    description: input.description,
    location: input.location,
    start: { dateTime: input.start, timeZone: input.timeZone },
    end: { dateTime: input.end, timeZone: input.timeZone },
    attendees: input.attendees?.map((a) => ({ email: a.email, displayName: a.displayName })),
    reminders: { useDefault: true },
    ...(input.privateProperties
      ? { extendedProperties: { private: input.privateProperties } }
      : {}),
  };
}

/** Crée un événement. `sendUpdates` = 'all' pour que Google envoie l'invitation. */
export async function insertEvent(
  accessToken: string,
  calendarId: string,
  input: GoogleEventInput,
  sendUpdates: "all" | "none" = "all",
): Promise<GoogleEventResult> {
  const data = (await googleFetch(
    `${CAL_BASE}/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=${sendUpdates}`,
    accessToken,
    { method: "POST", body: JSON.stringify(eventBody(input)) },
  )) as Record<string, unknown>;
  return {
    id: String(data.id ?? ""),
    htmlLink: typeof data.htmlLink === "string" ? data.htmlLink : null,
    status: typeof data.status === "string" ? data.status : null,
  };
}

/** Met à jour un événement (report : nouveaux horaires). */
export async function patchEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  patch: Partial<GoogleEventInput>,
  sendUpdates: "all" | "none" = "all",
): Promise<GoogleEventResult> {
  const body: Record<string, unknown> = {};
  if (patch.summary !== undefined) body.summary = patch.summary;
  if (patch.description !== undefined) body.description = patch.description;
  if (patch.location !== undefined) body.location = patch.location;
  if (patch.start && patch.timeZone) body.start = { dateTime: patch.start, timeZone: patch.timeZone };
  if (patch.end && patch.timeZone) body.end = { dateTime: patch.end, timeZone: patch.timeZone };

  const data = (await googleFetch(
    `${CAL_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=${sendUpdates}`,
    accessToken,
    { method: "PATCH", body: JSON.stringify(body) },
  )) as Record<string, unknown>;
  return {
    id: String(data.id ?? eventId),
    htmlLink: typeof data.htmlLink === "string" ? data.htmlLink : null,
    status: typeof data.status === "string" ? data.status : null,
  };
}

/**
 * Supprime un événement. Un événement déjà supprimé manuellement (404 / 410) est
 * traité comme un succès (idempotent) : l'objectif « il n'existe plus » est atteint.
 */
export async function deleteEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  sendUpdates: "all" | "none" = "all",
): Promise<void> {
  try {
    await googleFetch(
      `${CAL_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=${sendUpdates}`,
      accessToken,
      { method: "DELETE" },
    );
  } catch (err) {
    if (err instanceof GoogleApiError && (err.status === 404 || err.status === 410)) {
      return; // déjà supprimé : idempotent
    }
    throw err;
  }
}
