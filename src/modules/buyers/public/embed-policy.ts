/**
 * Politique d'intégration du formulaire acquéreur — **logique pure**, testable
 * sans requête ni framework.
 *
 * Qui a le droit d'embarquer le formulaire dans une iframe est décidé par
 * `frame-ancestors`, et par rien d'autre. En particulier **pas** par
 * `postMessage`, qui ne transporte qu'une hauteur et dont l'origine n'est pas
 * une garantie d'identité.
 *
 * Règle : liste vide ⇒ `'self'` seul. Autrement dit, par défaut **aucun site
 * tiers** ne peut encadrer la page ; elle reste consultable en direct. Ouvrir
 * l'intégration est un geste explicite, bien par bien.
 */

/** Chemin du formulaire public, tel qu'exposé. */
export const BUYER_FORM_PATH = /^\/bien\/([^/]+)\/interet\/?$/;

/** Extrait le slug d'un chemin de formulaire, ou `null` si ce n'en est pas un. */
export function buyerFormSlugFromPath(pathname: string): string | null {
  const match = BUYER_FORM_PATH.exec(pathname);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/**
 * Normalise une origine déclarée en `schéma://hôte[:port]`. Rejette tout ce qui
 * n'est pas http(s), ce qui porte un chemin, des identifiants ou un caractère
 * blanc — une entrée douteuse est **écartée**, jamais « réparée » au jugé.
 */
export function normalizeOrigin(input: string): string | null {
  const raw = input.trim();
  if (!raw || /\s/.test(raw)) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  // Un chemin, une requête ou un fragment n'ont aucun sens dans une origine :
  // les ignorer silencieusement autoriserait plus que ce que l'auteur a écrit.
  if ((url.pathname && url.pathname !== "/") || url.search || url.hash) return null;
  if (!url.hostname) return null;
  return url.port ? `${url.protocol}//${url.hostname}:${url.port}` : `${url.protocol}//${url.hostname}`;
}

/** Nettoie une liste d'origines : normalise, écarte l'invalide, dédoublonne. */
export function sanitizeOrigins(inputs: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const input of inputs) {
    const origin = normalizeOrigin(input);
    if (!origin || seen.has(origin)) continue;
    seen.add(origin);
    out.push(origin);
  }
  return out;
}

/**
 * Valeur de `Content-Security-Policy` pour la route du formulaire. `'self'` est
 * toujours présent : la page doit rester consultable en direct, même sans
 * intégration autorisée.
 */
export function buildFrameAncestorsPolicy(allowedOrigins: readonly string[]): string {
  const origins = sanitizeOrigins(allowedOrigins);
  return `frame-ancestors 'self'${origins.length ? ` ${origins.join(" ")}` : ""}`;
}
