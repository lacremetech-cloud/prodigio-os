import "server-only";

/**
 * Dépôt des jetons Google, CHIFFRÉS au repos. Accès EXCLUSIVEMENT via le client
 * admin Supabase (rôle de service, hors RLS) : la table `calendar_credentials`
 * n'accorde aucun privilège à `authenticated`. Les jetons ne quittent jamais le
 * serveur et ne sont jamais journalisés.
 *
 * Gère aussi le rafraîchissement transparent de l'access token expiré à partir
 * du refresh token.
 */

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { decryptToken, encryptToken } from "./crypto";
import { refreshAccessToken, type GoogleTokens } from "./oauth";

/** Erreur « la connexion doit être rétablie » (jeton absent / révoqué / expiré sans refresh). */
export class CalendarReconnectRequiredError extends Error {
  readonly reason: string;
  constructor(reason: string) {
    super("Connexion Google Calendar à rétablir.");
    this.name = "CalendarReconnectRequiredError";
    this.reason = reason;
  }
}

/** Enregistre (chiffre) les jetons d'une connexion. Le refresh token est conservé s'il est absent. */
export async function storeCredentials(
  connectionId: string,
  tokens: GoogleTokens,
): Promise<void> {
  const admin = getSupabaseAdminClient();

  const row: Record<string, unknown> = {
    connection_id: connectionId,
    access_token_encrypted: tokens.accessToken ? encryptToken(tokens.accessToken) : null,
    token_type: tokens.tokenType,
    scope: tokens.scope,
    access_token_expires_at: tokens.expiresAt,
  };
  // N'écrase le refresh token QUE si un nouveau est fourni (Google ne le renvoie
  // qu'au premier consentement).
  if (tokens.refreshToken) {
    row.refresh_token_encrypted = encryptToken(tokens.refreshToken);
  }

  const { error } = await admin
    .from("calendar_credentials")
    .upsert(row as never, { onConflict: "connection_id" });
  if (error) {
    throw new Error(`Échec d'enregistrement des jetons (${error.code ?? "?"}).`);
  }
}

/** Supprime les jetons d'une connexion (déconnexion). Best-effort silencieux si absent. */
export async function deleteCredentials(connectionId: string): Promise<void> {
  const admin = getSupabaseAdminClient();
  await admin.from("calendar_credentials").delete().eq("connection_id", connectionId);
}

/** Renvoie le refresh token en clair (pour révocation à la déconnexion), ou null. */
export async function getRefreshTokenForRevoke(
  connectionId: string,
): Promise<string | null> {
  const admin = getSupabaseAdminClient();
  const { data } = await admin
    .from("calendar_credentials")
    .select("refresh_token_encrypted")
    .eq("connection_id", connectionId)
    .maybeSingle();
  const enc = (data as { refresh_token_encrypted: string | null } | null)?.refresh_token_encrypted;
  if (!enc) return null;
  try {
    return decryptToken(enc);
  } catch {
    return null;
  }
}

const REFRESH_SKEW_MS = 60_000; // rafraîchit 60 s avant l'expiration

/**
 * Renvoie un access token valide pour la connexion, en rafraîchissant si besoin.
 * Lève `CalendarReconnectRequiredError` si aucun jeton exploitable n'existe.
 */
export async function getFreshAccessToken(connectionId: string): Promise<string> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("calendar_credentials")
    .select("access_token_encrypted, refresh_token_encrypted, access_token_expires_at")
    .eq("connection_id", connectionId)
    .maybeSingle();

  if (error) throw new Error(`Lecture des jetons impossible (${error.code ?? "?"}).`);
  if (!data) throw new CalendarReconnectRequiredError("aucun jeton");

  const cred = data as {
    access_token_encrypted: string | null;
    refresh_token_encrypted: string | null;
    access_token_expires_at: string | null;
  };

  const expiresAt = cred.access_token_expires_at
    ? Date.parse(cred.access_token_expires_at)
    : 0;
  const stillValid =
    cred.access_token_encrypted != null && expiresAt - REFRESH_SKEW_MS > Date.now();

  if (stillValid && cred.access_token_encrypted) {
    return decryptToken(cred.access_token_encrypted);
  }

  // Access token expiré / absent → rafraîchir via le refresh token.
  if (!cred.refresh_token_encrypted) {
    throw new CalendarReconnectRequiredError("refresh token absent");
  }
  let refreshToken: string;
  try {
    refreshToken = decryptToken(cred.refresh_token_encrypted);
  } catch {
    throw new CalendarReconnectRequiredError("jeton illisible");
  }

  const refreshed = await refreshAccessToken(refreshToken);
  await storeCredentials(connectionId, refreshed);
  return refreshed.accessToken;
}
