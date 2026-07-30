/**
 * Calcul **pur** des créneaux disponibles (aucune dépendance réseau, donc
 * testable unitairement). Les intervalles occupés viennent de l'API Google
 * FreeBusy (mockée dans les tests). Toute la logique horaire — fuseau, horaires
 * de travail, délai minimum, marges tampon — est appliquée ici.
 *
 * Les instants sont manipulés en UTC (millisecondes / ISO). La conversion des
 * heures « murales » locales (ex. 9 h à Paris) vers des instants UTC gère l'heure
 * d'été via `Intl.DateTimeFormat` (aucune dépendance de dates ajoutée).
 */

import type { EstimationSchedulingConfig } from "./config";

export interface Interval {
  /** Début (ISO 8601, de préférence en UTC/Z). */
  start: string;
  /** Fin (ISO 8601, de préférence en UTC/Z). */
  end: string;
}

export interface FreeSlot {
  /** Début du créneau (ISO 8601 UTC). */
  start: string;
  /** Fin du créneau (ISO 8601 UTC). */
  end: string;
}

/**
 * Décalage (en ms) du fuseau `timeZone` à l'instant donné : positif à l'est de
 * l'UTC (Europe/Paris = +1 h / +2 h en été).
 */
export function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(instant);
  const get = (type: string): number =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const rawHour = get("hour");
  const hour = rawHour === 24 ? 0 : rawHour;
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    hour,
    get("minute"),
    get("second"),
  );
  return asUtc - instant.getTime();
}

/**
 * Convertit une heure « murale » locale (année/mois/jour/heure/minute dans
 * `timeZone`) en instant UTC. Deux passes pour être robuste aux transitions
 * d'heure d'été.
 */
export function zonedWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const offset1 = timeZoneOffsetMs(new Date(guess), timeZone);
  let utc = guess - offset1;
  const offset2 = timeZoneOffsetMs(new Date(utc), timeZone);
  if (offset2 !== offset1) utc = guess - offset2;
  return new Date(utc);
}

/** Jour de la semaine (0 = dimanche … 6 = samedi) d'une date `YYYY-MM-DD` dans un fuseau. */
export function zonedWeekday(dateStr: string, timeZone: string): number {
  const [y = 0, m = 0, d = 0] = dateStr.split("-").map(Number);
  // Midi local pour éviter tout effet de bord aux bornes de journée.
  const noon = zonedWallTimeToUtc(y, m, d, 12, 0, timeZone);
  const wd = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(noon);
  return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[wd] ?? 0;
}

function parseHm(hhmm: string): { h: number; m: number } {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  return { h: h || 0, m: m || 0 };
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && aEnd > bStart;
}

export interface ComputeSlotsInput {
  /** Jour cible au format `YYYY-MM-DD` (interprété dans le fuseau de la config). */
  date: string;
  /** Intervalles occupés (Google FreeBusy), en ISO. */
  busy: Interval[];
  /** Configuration de planification (durée, horaires, marges, délai minimum…). */
  config: EstimationSchedulingConfig;
  /** Instant « maintenant » (défaut : Date courante). Injecté pour les tests. */
  now?: Date;
  /** Durée souhaitée (minutes) ; défaut = `config.defaultDurationMinutes`. */
  durationMinutes?: number;
}

/**
 * Calcule les créneaux libres d'une journée pour un agent, en respectant :
 *   - les horaires de travail (heure locale du fuseau) ;
 *   - les intervalles occupés (élargis des marges avant/après) ;
 *   - le délai minimum avant rendez-vous ;
 *   - les jours ouvrés.
 * Renvoie une liste de créneaux (ISO UTC), possiblement vide.
 */
export function computeAvailableSlots(input: ComputeSlotsInput): FreeSlot[] {
  const { date, busy, config } = input;
  const now = input.now ?? new Date();
  const duration = (input.durationMinutes ?? config.defaultDurationMinutes) * 60_000;
  const granularity = config.slotGranularityMinutes * 60_000;
  const marginBefore = config.marginBeforeMinutes * 60_000;
  const marginAfter = config.marginAfterMinutes * 60_000;
  const minStart = now.getTime() + config.minLeadMinutes * 60_000;

  // Jour non ouvré → aucun créneau.
  const weekday = zonedWeekday(date, config.timeZone);
  if (!config.workingDays.includes(weekday)) return [];

  const [y = 0, m = 0, d = 0] = date.split("-").map(Number);
  const { h: sh, m: sm } = parseHm(config.workingHours.start);
  const { h: eh, m: em } = parseHm(config.workingHours.end);
  const dayStart = zonedWallTimeToUtc(y, m, d, sh, sm, config.timeZone).getTime();
  const dayEnd = zonedWallTimeToUtc(y, m, d, eh, em, config.timeZone).getTime();
  if (dayEnd <= dayStart) return [];

  // Intervalles occupés en ms (ignore ceux invalides).
  const busyMs = busy
    .map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) }))
    .filter((b) => Number.isFinite(b.start) && Number.isFinite(b.end) && b.end > b.start);

  const slots: FreeSlot[] = [];
  for (let s = dayStart; s + duration <= dayEnd; s += granularity) {
    const e = s + duration;
    if (s < minStart) continue;
    // Fenêtre élargie des marges : doit être libre de tout intervalle occupé.
    const guardStart = s - marginBefore;
    const guardEnd = e + marginAfter;
    const conflict = busyMs.some((b) => overlaps(guardStart, guardEnd, b.start, b.end));
    if (conflict) continue;
    slots.push({ start: new Date(s).toISOString(), end: new Date(e).toISOString() });
  }
  return slots;
}

/**
 * Vrai si un créneau précis `[start, end]` est encore libre au regard des
 * intervalles occupés (marges incluses). Utilisé pour re-vérifier juste avant la
 * réservation (le créneau a pu être pris entre-temps).
 */
export function isSlotStillFree(
  start: string,
  end: string,
  busy: Interval[],
  config: EstimationSchedulingConfig,
): boolean {
  const s = Date.parse(start);
  const e = Date.parse(end);
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return false;
  const guardStart = s - config.marginBeforeMinutes * 60_000;
  const guardEnd = e + config.marginAfterMinutes * 60_000;
  return !busy
    .map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) }))
    .filter((b) => Number.isFinite(b.start) && Number.isFinite(b.end) && b.end > b.start)
    .some((b) => overlaps(guardStart, guardEnd, b.start, b.end));
}
