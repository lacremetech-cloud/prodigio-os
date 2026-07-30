import { randomBytes } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import {
  canonicalSiteUrl,
  isGoogleCalendarConfigured,
  isSupabaseAdminConfigured,
} from "@/config";
import { getCrmSession } from "@/modules/crm/auth/session";
import { canConnectCalendar } from "@/modules/crm/auth/roles";
import { buildGoogleAuthUrl } from "@/modules/calendar/google/oauth";
import { OAUTH_STATE_COOKIE, OAUTH_STATE_COOKIE_PATH } from "@/modules/calendar/oauth-state";

/**
 * Démarre le flux OAuth Google Calendar pour l'utilisateur connecté.
 *
 * Sécurité :
 *  - Session CRM requise + rôle autorisé (administrateur / manager / agent).
 *  - `state` anti-CSRF aléatoire, déposé dans un cookie httpOnly re-vérifié au
 *    callback. Aucun secret dans l'URL de redirection Prodigio.
 *  - Aucune configuration → retour propre vers l'écran avec un code d'erreur.
 */
const SETTINGS = "/crm/parametres/calendrier";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const base = canonicalSiteUrl();
  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`${SETTINGS}?error=${reason}`, base));

  const session = await getCrmSession();
  if (!session) {
    return NextResponse.redirect(
      new URL(`/connexion?redirect=${encodeURIComponent(SETTINGS)}`, base),
    );
  }
  if (!canConnectCalendar(session.roles)) return fail("role");
  if (!isGoogleCalendarConfigured() || !isSupabaseAdminConfigured()) {
    return fail("config");
  }

  const state = randomBytes(32).toString("hex");
  const response = NextResponse.redirect(buildGoogleAuthUrl(state));
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: OAUTH_STATE_COOKIE_PATH,
    maxAge: 600,
  });
  return response;
}
