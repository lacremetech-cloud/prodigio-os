/**
 * Logique **pure** de l'agenda CRM (aucune dépendance serveur/navigateur), donc
 * testable. Source de vérité = `estimation_appointments` (jamais l'agenda Google
 * directement). Toute la conversion date/heure est faite dans le fuseau du
 * rendez-vous (par défaut Europe/Paris), y compris à travers les changements
 * d'heure été/hiver : on lit les composantes locales via `Intl` plutôt que les
 * getters UTC/locaux du serveur.
 */

export const AGENDA_TZ = "Europe/Paris";

export type AgendaView = "semaine" | "mois" | "jour" | "liste";
export const AGENDA_VIEWS: AgendaView[] = ["semaine", "mois", "jour", "liste"];

export interface AgendaEvent {
  id: string;
  opportunityId: string;
  agentUserId: string;
  agentName: string;
  contactLabel: string;
  city: string | null;
  address: string | null;
  ownerPhone: string | null;
  ownerEmail: string | null;
  startsAt: string; // ISO UTC
  endsAt: string; // ISO UTC
  timezone: string;
  status: string;
  googleHtmlLink: string | null;
  kind: "estimation";
}

/** Composantes locales d'un instant dans un fuseau donné (heures en h23). */
export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number;
  weekday: number; // 0 = lundi … 6 = dimanche
  dayKey: string; // YYYY-MM-DD (dans le fuseau)
  minutesOfDay: number; // hour*60 + minute
}

const WEEKDAY_INDEX: Record<string, number> = {
  Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
};

/** Décompose un instant ISO en composantes locales du fuseau (DST-correct). */
export function zonedParts(iso: string, timeZone: string = AGENDA_TZ): ZonedParts | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  let hour = Number(get("hour"));
  if (hour === 24) hour = 0; // certains environnements rendent minuit en 24
  const minute = Number(get("minute"));
  const weekday = WEEKDAY_INDEX[get("weekday")] ?? 0;
  const dayKey = `${pad4(year)}-${pad2(month)}-${pad2(day)}`;
  return { year, month, day, hour, minute, weekday, dayKey, minutesOfDay: hour * 60 + minute };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
function pad4(n: number): string {
  return String(n).padStart(4, "0");
}

/** Clé de journée `YYYY-MM-DD` d'un instant dans le fuseau. */
export function dayKeyOf(iso: string, timeZone: string = AGENDA_TZ): string {
  return zonedParts(iso, timeZone)?.dayKey ?? "";
}

/**
 * Arithmétique de calendrier **pure** sur une clé `YYYY-MM-DD` : ajoute `n`
 * jours. Indépendante du fuseau (on manipule une date civile), donc insensible
 * aux transitions d'heure d'été.
 */
export function addDaysToKey(dayKey: string, n: number): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const base = Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  const next = new Date(base + n * 86_400_000);
  return `${pad4(next.getUTCFullYear())}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())}`;
}

/** Jour de la semaine d'une clé (0 = lundi … 6 = dimanche). */
export function weekdayOfKey(dayKey: string): number {
  const [y, m, d] = dayKey.split("-").map(Number);
  const dow = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay(); // 0 = dim
  return (dow + 6) % 7; // → 0 = lundi
}

/** Lundi de la semaine contenant la clé. */
export function startOfWeekKey(dayKey: string): string {
  return addDaysToKey(dayKey, -weekdayOfKey(dayKey));
}

/** 7 clés (lundi → dimanche) de la semaine contenant l'ancre. */
export function weekKeys(anchorKey: string): string[] {
  const monday = startOfWeekKey(anchorKey);
  return Array.from({ length: 7 }, (_, i) => addDaysToKey(monday, i));
}

/**
 * Grille du mois : 6 semaines × 7 jours (42 clés), débutant au lundi de la
 * semaine contenant le 1er du mois. Couvre toujours le mois entier.
 */
export function monthGridKeys(anchorKey: string): string[] {
  const [y, m] = anchorKey.split("-").map(Number);
  const firstOfMonth = `${pad4(y ?? 1970)}-${pad2(m ?? 1)}-01`;
  const gridStart = startOfWeekKey(firstOfMonth);
  return Array.from({ length: 42 }, (_, i) => addDaysToKey(gridStart, i));
}

/** La clé appartient-elle au mois de l'ancre ? */
export function isSameMonth(dayKey: string, anchorKey: string): boolean {
  return dayKey.slice(0, 7) === anchorKey.slice(0, 7);
}

/** Clé du jour courant dans le fuseau. */
export function todayKey(nowIso: string, timeZone: string = AGENDA_TZ): string {
  return dayKeyOf(nowIso, timeZone);
}

// --- Filtrage (pur) ----------------------------------------------------------

export interface AgendaFilters {
  agentUserId: string; // "" = tous
  status: string; // "" = tous
  temporal: "tous" | "a_venir" | "passes";
  search: string; // propriétaire / ville / adresse
}

export const EMPTY_AGENDA_FILTERS: AgendaFilters = {
  agentUserId: "",
  status: "",
  temporal: "tous",
  search: "",
};

/** Applique les filtres agenda (respecte la casse-insensibilité pour la recherche). */
export function applyAgendaFilters(
  events: AgendaEvent[],
  filters: AgendaFilters,
  nowMs: number,
): AgendaEvent[] {
  const needle = filters.search.trim().toLowerCase();
  return events.filter((e) => {
    if (filters.agentUserId && e.agentUserId !== filters.agentUserId) return false;
    if (filters.status && e.status !== filters.status) return false;
    if (filters.temporal !== "tous") {
      const startMs = new Date(e.startsAt).getTime();
      if (filters.temporal === "a_venir" && startMs < nowMs) return false;
      if (filters.temporal === "passes" && startMs >= nowMs) return false;
    }
    if (needle) {
      const hay = [e.contactLabel, e.city, e.address, e.agentName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}

/** Regroupe les événements par clé de journée (fuseau), triés par heure de début. */
export function groupByDay(
  events: AgendaEvent[],
  timeZone: string = AGENDA_TZ,
): Map<string, AgendaEvent[]> {
  const map = new Map<string, AgendaEvent[]>();
  for (const e of events) {
    const key = dayKeyOf(e.startsAt, timeZone);
    const list = map.get(key) ?? [];
    list.push(e);
    map.set(key, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }
  return map;
}

/** Tri chronologique croissant (vue liste). */
export function sortByStart(events: AgendaEvent[]): AgendaEvent[] {
  return [...events].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** Durée en minutes entre deux instants (>= 0). */
export function durationMinutes(startIso: string, endIso: string): number {
  const s = new Date(startIso).getTime();
  const e = new Date(endIso).getTime();
  if (Number.isNaN(s) || Number.isNaN(e)) return 0;
  return Math.max(0, Math.round((e - s) / 60000));
}

/**
 * Position verticale d'un événement dans une grille horaire (en fraction 0..1
 * de la journée), bornée au jour affiché. Gère un événement qui traverse une
 * limite de journée en le rattachant à SON jour de début (jamais dupliqué) et en
 * bornant sa fin à la fin de journée pour l'affichage.
 */
export function dayLayout(
  event: AgendaEvent,
  dayKey: string,
  timeZone: string = AGENDA_TZ,
): { topPct: number; heightPct: number } | null {
  const startParts = zonedParts(event.startsAt, timeZone);
  if (!startParts) return null;
  if (startParts.dayKey !== dayKey) return null; // rattaché à son jour de début uniquement
  const endParts = zonedParts(event.endsAt, timeZone);
  const startMin = startParts.minutesOfDay;
  // Si la fin déborde sur un autre jour, on borne à minuit (1440).
  const endMin =
    endParts && endParts.dayKey === dayKey ? endParts.minutesOfDay : 1440;
  const top = startMin / 1440;
  const height = Math.max(1, endMin - startMin) / 1440;
  return { topPct: top * 100, heightPct: Math.min(100 - top * 100, height * 100) };
}
