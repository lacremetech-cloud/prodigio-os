import "server-only";

/**
 * Service de connexion Google Calendar (côté serveur uniquement). Orchestration
 * de l'OAuth, du dépôt chiffré des jetons et des métadonnées de connexion.
 *
 * Les métadonnées passent par les fonctions SECURITY DEFINER (autorité de rôle
 * en base) via le client serveur (JWT de l'utilisateur) ; les jetons chiffrés
 * passent par le client admin (rôle de service) sur `calendar_credentials`.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CalendarConnectionRow } from "@/lib/supabase/types";
import { exchangeCodeForTokens } from "./google/oauth";
import { getUserInfo, listCalendars, type GoogleCalendarEntry } from "./google/client";
import {
  deleteCredentials,
  getFreshAccessToken,
  getRefreshTokenForRevoke,
  storeCredentials,
} from "./google/credentials";
import { revokeToken } from "./google/oauth";

/** Connexion Google de l'utilisateur courant (métadonnées, sous RLS). */
export async function getMyConnection(): Promise<CalendarConnectionRow | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("calendar_connections")
    .select("*")
    .eq("user_id", user.id)
    .eq("provider", "google")
    .maybeSingle();
  return (data as CalendarConnectionRow | null) ?? null;
}

/**
 * Finalise la connexion après le retour OAuth : échange le code, identifie le
 * compte, choisit un calendrier par défaut (le calendrier principal), enregistre
 * la connexion (RPC) puis stocke les jetons chiffrés (admin). En cas d'échec du
 * stockage des jetons, marque la connexion en erreur.
 */
export async function completeGoogleConnect(code: string): Promise<{ ok: true }> {
  const tokens = await exchangeCodeForTokens(code);

  const info = await getUserInfo(tokens.accessToken);
  let calendars: GoogleCalendarEntry[] = [];
  try {
    calendars = await listCalendars(tokens.accessToken);
  } catch {
    // La liste des calendriers n'est pas bloquante : on retombe sur « primary ».
    calendars = [];
  }
  const primary =
    calendars.find((c) => c.primary) ??
    calendars.find((c) => c.id === info.email) ??
    calendars[0] ??
    null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("calendar_upsert_connection", {
    p_account_email: info.email ?? "",
    p_scope: tokens.scope,
    p_calendar_id: primary?.id ?? "primary",
    p_calendar_summary: primary?.summary ?? "Calendrier principal",
  });
  if (error) {
    throw new Error(`Enregistrement de la connexion impossible (${error.code ?? "?"}).`);
  }
  const connectionId =
    data && typeof data === "object" && "id" in data
      ? String((data as { id: string }).id)
      : null;
  if (!connectionId) {
    throw new Error("Connexion enregistrée sans identifiant.");
  }

  try {
    await storeCredentials(connectionId, tokens);
  } catch (err) {
    // Marque la connexion en erreur (le compte est identifié mais inutilisable).
    await supabase.rpc("calendar_mark_connection_state", {
      p_user_id: (await supabase.auth.getUser()).data.user?.id ?? "",
      p_status: "erreur",
      p_error: "jetons non enregistrés",
    });
    throw err;
  }

  return { ok: true };
}

/** Liste les calendriers accessibles (écriture) de l'utilisateur courant. */
export async function listMyCalendars(): Promise<GoogleCalendarEntry[]> {
  const connection = await getMyConnection();
  if (!connection || connection.status !== "connecte") return [];
  const accessToken = await getFreshAccessToken(connection.id);
  return listCalendars(accessToken);
}

/**
 * Déconnecte le calendrier de l'utilisateur courant : révoque le jeton chez
 * Google (best-effort), supprime les jetons chiffrés, marque la connexion
 * déconnectée (RPC). Idempotent.
 */
export async function disconnectGoogle(): Promise<{ ok: true }> {
  const connection = await getMyConnection();
  if (!connection) return { ok: true };

  const refreshToken = await getRefreshTokenForRevoke(connection.id);
  if (refreshToken) await revokeToken(refreshToken);
  await deleteCredentials(connection.id);

  const supabase = await createSupabaseServerClient();
  await supabase.rpc("calendar_disconnect");
  return { ok: true };
}
