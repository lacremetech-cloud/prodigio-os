/**
 * Capture de l'attribution marketing (source / campagne / clic).
 *
 * Modèle multi-points de contact : on conserve un **premier contact** (first
 * touch, persistant sur la session) et un **dernier contact** (last touch, à la
 * soumission). Aucune donnée n'est réécrite ; l'historique est préservé.
 *
 * Fonctions pures : elles prennent une URL et un referrer en entrée et ne lisent
 * pas `window` directement, afin de rester testables côté serveur.
 */

export interface AttributionTouch {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  fbclid: string | null;
  gclid: string | null;
  url: string | null;
  referrer: string | null;
  at: string; // ISO 8601
}

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;

function pick(params: URLSearchParams, key: string): string | null {
  const value = params.get(key);
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed.slice(0, 300);
}

/**
 * Construit un « touch » d'attribution à partir d'une URL et d'un referrer.
 * `nowIso` est injecté pour la testabilité (aucun appel direct à l'horloge).
 */
export function buildTouch(
  urlString: string,
  referrer: string | null,
  nowIso: string,
): AttributionTouch {
  let params = new URLSearchParams();
  let cleanUrl: string | null = null;
  try {
    const url = new URL(urlString);
    params = url.searchParams;
    cleanUrl = url.toString();
  } catch {
    cleanUrl = null;
  }

  const touch: AttributionTouch = {
    utm_source: pick(params, "utm_source"),
    utm_medium: pick(params, "utm_medium"),
    utm_campaign: pick(params, "utm_campaign"),
    utm_term: pick(params, "utm_term"),
    utm_content: pick(params, "utm_content"),
    fbclid: pick(params, "fbclid"),
    gclid: pick(params, "gclid"),
    url: cleanUrl,
    referrer: referrer && referrer.trim().length > 0 ? referrer.slice(0, 500) : null,
    at: nowIso,
  };

  return touch;
}

/** Vrai si le touch porte au moins un signal d'attribution exploitable. */
export function hasSignal(touch: AttributionTouch): boolean {
  return (
    UTM_KEYS.some((k) => touch[k] !== null) ||
    touch.fbclid !== null ||
    touch.gclid !== null ||
    touch.referrer !== null
  );
}

export const ATTRIBUTION_STORAGE_KEY = "prodigio.attribution.v1";

interface StoredAttribution {
  first: AttributionTouch | null;
  last: AttributionTouch | null;
}

/**
 * Met à jour l'attribution stockée : le premier contact n'est écrit qu'une fois
 * (et seulement s'il porte un signal), le dernier contact est toujours actualisé.
 */
export function mergeAttribution(
  previous: StoredAttribution | null,
  current: AttributionTouch,
): StoredAttribution {
  const first =
    previous?.first ?? (hasSignal(current) ? current : null);
  return { first, last: current };
}

export type { StoredAttribution };
