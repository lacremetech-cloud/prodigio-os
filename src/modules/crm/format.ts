/**
 * Fonctions de formatage **pures** (aucune dépendance serveur/navigateur), donc
 * testables. Dates et durées en français, avec une référence `now` injectable.
 */

/**
 * Horodatage courant (ms). Encapsulé ici pour lire l'heure serveur au moment du
 * rendu d'un Server Component sans appeler `Date.now()` directement dans le corps
 * d'un composant.
 */
export function nowMs(): number {
  return Date.now();
}

/**
 * Le fuseau de l'agence, écrit une fois.
 *
 * SANS LUI, la MÊME date s'affichait différemment selon l'écran : la fiche est
 * rendue sur le serveur, dont l'horloge est en UTC, et le panneau dans le
 * navigateur du commercial, à Paris. Un appel passé à 20 h 38 apparaissait
 * donc « 18:38 » sur la fiche et « 20:38 » dans le panneau — deux heures
 * d'écart sur le même événement, de quoi douter de tout l'historique.
 *
 * Prodigio vend à Cassis depuis Marseille : l'heure de référence est celle de
 * l'agence, pas celle de la machine qui rend la page.
 */
export const FUSEAU_AGENCE = "Europe/Paris";

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: FUSEAU_AGENCE,
  }).format(d);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: FUSEAU_AGENCE,
  }).format(d);
}

/**
 * Temps écoulé depuis `iso`, en français concis (« il y a 3 h », « il y a 2 j »).
 * Renvoie « à l'instant » sous une minute. `now` injectable pour les tests.
 */
export function timeSince(
  iso: string | null | undefined,
  now: number = Date.now(),
): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = Math.max(0, now - t);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `il y a ${days} j`;
  const months = Math.floor(days / 30);
  if (months < 12) return `il y a ${months} mois`;
  return `il y a ${Math.floor(months / 12)} an(s)`;
}

/** Niveau d'urgence visuel selon l'ancienneté (pour la pastille de temps). */
export function agingLevel(
  iso: string | null | undefined,
  now: number = Date.now(),
): "frais" | "tiede" | "chaud" {
  if (!iso) return "frais";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "frais";
  const hours = (now - t) / 3600000;
  if (hours < 24) return "frais";
  if (hours < 72) return "tiede";
  return "chaud";
}

/** Nom lisible d'un contact (prénom + nom), sinon « Contact sans nom ». */
export function contactName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string {
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();
  return name.length > 0 ? name : "Contact sans nom";
}

/** Initiales pour un avatar. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) return "?";
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1] ?? first;
  return ((first[0] ?? "") + (last[0] ?? "")).toUpperCase() || "?";
}

/**
 * Date courte avec l'heure — « 14 oct., 20:38 ». Même fuseau que tout le
 * reste : c'est la fonction du panneau de traitement, qui affichait sa propre
 * heure avant qu'elles ne soient réunies ici.
 */
export function formatDateCourte(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: FUSEAU_AGENCE,
  }).format(d);
}

/**
 * Un JOUR, sans l'heure : « 17 oct. 2026 ».
 *
 * `formatDateCourte` porte l'heure et tait l'année — bon pour un rappel de la
 * semaine, mauvais pour la date d'arrivée d'un lead, qu'on lit en balayant une
 * liste et qu'on compare à des semaines de distance. L'heure y est du bruit,
 * l'année devient vite nécessaire.
 */
export function formatJour(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: FUSEAU_AGENCE,
  }).format(d);
}
