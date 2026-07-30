import "server-only";

/**
 * Flux OAuth Google (côté serveur uniquement). Construit l'URL de consentement,
 * échange le code contre des jetons, rafraîchit et révoque. Aucune de ces valeurs
 * (client secret, jetons) ne transite par le navigateur ni les logs.
 */

import { env, googleOAuthRedirectUri } from "@/config";
import { GOOGLE_OAUTH_SCOPE_STRING } from "./scopes";
import { GoogleApiError, googleErrorKindFromStatus } from "./errors";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";

export interface GoogleTokens {
  accessToken: string;
  /** Présent uniquement au premier consentement (access_type=offline + prompt=consent). */
  refreshToken: string | null;
  /** Instant d'expiration de l'access token (ISO). */
  expiresAt: string;
  scope: string | null;
  tokenType: string | null;
  idToken: string | null;
}

function requireOAuthConfig(): { clientId: string; clientSecret: string } {
  const clientId = env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth non configuré (client id / secret absents).");
  }
  return { clientId, clientSecret };
}

/**
 * Construit l'URL de consentement Google. `state` doit être imprévisible et lié
 * à la session (anti-CSRF) : il est re-vérifié au callback.
 */
export function buildGoogleAuthUrl(state: string): string {
  const { clientId } = requireOAuthConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleOAuthRedirectUri(),
    response_type: "code",
    scope: GOOGLE_OAUTH_SCOPE_STRING,
    access_type: "offline", // pour obtenir un refresh_token
    prompt: "consent", // force un refresh_token même si déjà autorisé
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

function tokensFromResponse(data: Record<string, unknown>): GoogleTokens {
  const expiresIn = typeof data.expires_in === "number" ? data.expires_in : 3600;
  return {
    accessToken: String(data.access_token ?? ""),
    refreshToken: typeof data.refresh_token === "string" ? data.refresh_token : null,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    scope: typeof data.scope === "string" ? data.scope : null,
    tokenType: typeof data.token_type === "string" ? data.token_type : null,
    idToken: typeof data.id_token === "string" ? data.id_token : null,
  };
}

async function postForm(
  endpoint: string,
  body: Record<string, string>,
): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body).toString(),
    });
  } catch {
    throw new GoogleApiError("Échec réseau OAuth Google.", 0, "network");
  }
  const text = await res.text();
  if (!res.ok) {
    // Ne jamais journaliser le corps (peut contenir des détails de jeton).
    throw new GoogleApiError(
      "Échec de l'échange OAuth Google.",
      res.status,
      googleErrorKindFromStatus(res.status),
    );
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new GoogleApiError("Réponse OAuth Google illisible.", res.status, "network");
  }
}

/** Échange le code d'autorisation contre des jetons. */
export async function exchangeCodeForTokens(code: string): Promise<GoogleTokens> {
  const { clientId, clientSecret } = requireOAuthConfig();
  const data = await postForm(TOKEN_ENDPOINT, {
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: googleOAuthRedirectUri(),
    grant_type: "authorization_code",
  });
  return tokensFromResponse(data);
}

/** Rafraîchit l'access token à partir du refresh token (jamais renvoyé au client). */
export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
  const { clientId, clientSecret } = requireOAuthConfig();
  const data = await postForm(TOKEN_ENDPOINT, {
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const tokens = tokensFromResponse(data);
  // Google ne renvoie pas de nouveau refresh_token au refresh : on conserve l'ancien.
  return { ...tokens, refreshToken: tokens.refreshToken ?? refreshToken };
}

/** Révoque un jeton auprès de Google (best-effort : n'échoue pas la déconnexion). */
export async function revokeToken(token: string): Promise<void> {
  try {
    await fetch(REVOKE_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }).toString(),
    });
  } catch {
    // Révocation best-effort : l'utilisateur reste déconnecté côté Prodigio.
  }
}
