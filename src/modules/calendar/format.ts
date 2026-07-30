/**
 * Formatage **pur** des dates de rendez-vous, TOUJOURS dans le fuseau du
 * rendez-vous (par défaut Europe/Paris). Important : le serveur peut tourner en
 * UTC ; on force donc `timeZone` pour ne jamais afficher une heure décalée.
 */

const DEFAULT_TZ = "Europe/Paris";

export function formatSlotTime(iso: string, timeZone: string = DEFAULT_TZ): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(d);
}

export function formatSlotDate(iso: string, timeZone: string = DEFAULT_TZ): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone,
  }).format(d);
}

/** « mer. 05 août 2026, 14:00 » */
export function formatAppointmentDateTime(
  iso: string,
  timeZone: string = DEFAULT_TZ,
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(d);
}

/** « mer. 05 août 2026, 14:00 – 15:30 » */
export function formatAppointmentRange(
  startIso: string,
  endIso: string,
  timeZone: string = DEFAULT_TZ,
): string {
  return `${formatAppointmentDateTime(startIso, timeZone)} – ${formatSlotTime(endIso, timeZone)}`;
}

/** Clé de journée `YYYY-MM-DD` dans le fuseau (pour regrouper « aujourd'hui »). */
export function zonedDayKey(iso: string, timeZone: string = DEFAULT_TZ): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
