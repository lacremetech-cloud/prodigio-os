import { type NextRequest, NextResponse } from "next/server";
import { canonicalSiteUrl, isGoogleCalendarConfigured } from "@/config";
import { getCrmSession } from "@/modules/crm/auth/session";
import { canConnectCalendar } from "@/modules/crm/auth/roles";
import { safeEqual } from "@/modules/calendar/google/crypto";
import { completeGoogleConnect } from "@/modules/calendar/service";
import { OAUTH_STATE_COOKIE, OAUTH_STATE_COOKIE_PATH } from "@/modules/calendar/oauth-state";

/**
 * Callback OAuth Google Calendar. Valide le `state` anti-CSRF, échange le code
 * et enregistre la connexion (jetons chiffrés côté serveur). Ne renvoie JAMAIS
 * d'écran Google brut : toute issue redirige vers l'écran Prodigio avec un code.
 */
const SETTINGS = "/crm/parametres/calendrier";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const base = canonicalSiteUrl();
  const { searchParams } = request.nextUrl;

  const clear = (res: NextResponse) => {
    res.cookies.set(OAUTH_STATE_COOKIE, "", { path: OAUTH_STATE_COOKIE_PATH, maxAge: 0 });
    return res;
  };
  const done = (query: string) =>
    clear(NextResponse.redirect(new URL(`${SETTINGS}?${query}`, base)));

  const oauthError = searchParams.get("error");
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const cookieState = request.cookies.get(OAUTH_STATE_COOKIE)?.value ?? "";

  // Autorisation refusée par l'utilisateur chez Google.
  if (oauthError) return done("error=refus");
  if (!isGoogleCalendarConfigured()) return done("error=config");
  if (!code || !state || !cookieState || !safeEqual(state, cookieState)) {
    return done("error=etat");
  }

  const session = await getCrmSession();
  if (!session || !canConnectCalendar(session.roles)) {
    return done("error=role");
  }

  try {
    await completeGoogleConnect(code);
  } catch {
    return done("error=connexion");
  }
  return done("connected=1");
}
