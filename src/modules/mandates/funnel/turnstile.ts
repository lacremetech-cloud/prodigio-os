/**
 * Vérification serveur d'un jeton Cloudflare Turnstile (anti-abus du dépôt
 * public de demande — funnel Mandats).
 *
 * Ce module est **pur** : il ne lit jamais `process.env` et ne journalise
 * jamais le jeton (ni aucune donnée). Le secret et les options sont **injectés**
 * par l'appelant serveur (`submit.ts`), ce qui rend la logique entièrement
 * testable sans réseau ni environnement (fetch injectable).
 *
 * Contrat de sécurité :
 * - le navigateur ne transmet **que le jeton** ; toute la vérification est ici ;
 * - le jeton n'est **jamais** stocké, journalisé, ni renvoyé au client ;
 * - le dépôt Supabase ne doit avoir lieu **que** si `ok: true`.
 */

/** Action Turnstile attendue (déclarée à la fois au widget et à la vérification). */
export const TURNSTILE_ACTION = "mandate_submission" as const;

/** Point de vérification officiel Cloudflare (siteverify). */
export const TURNSTILE_SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify" as const;

/** Délai maximal (ms) accordé à l'appel siteverify avant de renoncer. */
export const TURNSTILE_DEFAULT_TIMEOUT_MS = 4000;

/** Codes d'erreur Cloudflare signalant un jeton expiré ou déjà consommé. */
const DUPLICATE_OR_EXPIRED_CODES = new Set<string>([
  "timeout-or-duplicate",
  "token-already-spent",
]);

/**
 * Motif d'échec de vérification (jamais montré tel quel à l'utilisateur : le
 * message public reste neutre et identique quel que soit le motif).
 */
export type TurnstileFailureReason =
  | "missing-token"
  | "invalid-token"
  | "duplicate-or-expired"
  | "action-mismatch"
  | "hostname-mismatch"
  | "unavailable";

export type TurnstileVerification =
  | { ok: true; hostname: string | null; action: string | null }
  | { ok: false; reason: TurnstileFailureReason };

/** Forme de la réponse siteverify réellement exploitée (le reste est ignoré). */
export interface SiteverifyResponse {
  success: boolean;
  "error-codes"?: string[];
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
}

export interface VerifyTurnstileOptions {
  /** Secret serveur Cloudflare (jamais exposé au client). */
  secret: string;
  /** Jeton fourni par le navigateur (unique élément transmis). */
  token: string | null | undefined;
  /** Action attendue ; comparée à `response.action`. */
  expectedAction?: string | null;
  /** Hostname attendu ; comparé à `response.hostname` si `enforceHostname`. */
  expectedHostname?: string | null;
  /** Impose le contrôle de hostname (typiquement en production). */
  enforceHostname?: boolean;
  /**
   * Tolère une action VIDE renvoyée par Cloudflare (cas des clés de TEST, qui
   * ne renvoient pas d'action). À n'activer **qu'hors production**. Une action
   * non vide et différente reste toujours refusée.
   */
  allowEmptyAction?: boolean;
  /** IP distante éventuelle (non requise ; jamais journalisée ici). */
  remoteIp?: string | null;
  /** Délai maximal de l'appel réseau. */
  timeoutMs?: number;
  /** Surcharge d'URL (tests). */
  siteverifyUrl?: string;
  /** Implémentation de fetch injectable (tests). */
  fetchImpl?: typeof fetch;
}

/**
 * Vérifie un jeton Turnstile auprès de Cloudflare. Renvoie un résultat
 * discriminé ; ne lève jamais (les erreurs réseau / timeouts deviennent
 * `unavailable`). N'écrit aucun journal : c'est à l'appelant de décider quoi
 * tracer, **sans** le jeton.
 */
export async function verifyTurnstileToken(
  options: VerifyTurnstileOptions,
): Promise<TurnstileVerification> {
  const {
    secret,
    token,
    expectedAction = null,
    expectedHostname = null,
    enforceHostname = false,
    allowEmptyAction = false,
    remoteIp = null,
    timeoutMs = TURNSTILE_DEFAULT_TIMEOUT_MS,
    siteverifyUrl = TURNSTILE_SITEVERIFY_URL,
    fetchImpl = fetch,
  } = options;

  // 1) Jeton absent : jamais de dépôt. (Contrôle avant tout appel réseau.)
  if (typeof token !== "string" || token.length === 0) {
    return { ok: false, reason: "missing-token" };
  }

  // 2) Appel siteverify avec délai maximal (protège contre une indisponibilité).
  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  if (remoteIp) body.set("remoteip", remoteIp);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let data: SiteverifyResponse;
  try {
    const res = await fetchImpl(siteverifyUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      return { ok: false, reason: "unavailable" };
    }
    data = (await res.json()) as SiteverifyResponse;
  } catch {
    // Timeout, coupure réseau, JSON illisible : indisponibilité côté vérif.
    return { ok: false, reason: "unavailable" };
  } finally {
    clearTimeout(timer);
  }

  // 3) Cloudflare a-t-il validé le jeton ?
  if (data.success !== true) {
    const codes = Array.isArray(data["error-codes"]) ? data["error-codes"] : [];
    if (codes.some((c) => DUPLICATE_OR_EXPIRED_CODES.has(c))) {
      return { ok: false, reason: "duplicate-or-expired" };
    }
    return { ok: false, reason: "invalid-token" };
  }

  // 4) L'action doit correspondre (défense contre le rejeu inter-formulaires).
  const action = typeof data.action === "string" ? data.action : "";
  if (expectedAction) {
    const emptyTolerated = action === "" && allowEmptyAction;
    if (!emptyTolerated && action !== expectedAction) {
      return { ok: false, reason: "action-mismatch" };
    }
  }

  // 5) En production, le hostname doit correspondre à l'origine attendue.
  const hostname = typeof data.hostname === "string" ? data.hostname : "";
  if (enforceHostname && expectedHostname) {
    if (hostname !== expectedHostname) {
      return { ok: false, reason: "hostname-mismatch" };
    }
  }

  return {
    ok: true,
    hostname: hostname || null,
    action: action || null,
  };
}
