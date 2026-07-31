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

/**
 * Formatte une clé de journée civile `YYYY-MM-DD` (indépendante du fuseau) en
 * libellé. On construit un instant à midi UTC et on rend en UTC pour éviter tout
 * décalage de jour, quel que soit le fuseau du serveur.
 */
function dayKeyToUtcNoon(dayKey: string): Date | null {
  const [y, m, d] = dayKey.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

/** « lundi 4 août 2026 ». */
export function formatDayKeyLong(dayKey: string): string {
  const d = dayKeyToUtcNoon(dayKey);
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

/** « lun. 4 ». */
export function formatDayKeyShort(dayKey: string): string {
  const d = dayKeyToUtcNoon(dayKey);
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(d);
}

/** « 4 » (numéro du jour seul). */
export function formatDayKeyNum(dayKey: string): string {
  const d = dayKeyToUtcNoon(dayKey);
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", timeZone: "UTC" }).format(d);
}

/** « août 2026 ». */
export function formatMonthYear(dayKey: string): string {
  const d = dayKeyToUtcNoon(dayKey);
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

/** Libellés courts des jours de semaine (lundi → dimanche). */
export const WEEKDAY_SHORT_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

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
