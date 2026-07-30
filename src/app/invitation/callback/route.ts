import { type NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canonicalSiteUrl, isSupabaseConfigured, safeInternalPath } from "@/config";

/**
 * Callback d'authentification pour les liens d'INVITATION Supabase (et, plus
 * généralement, les liens e-mail : invite / recovery / magiclink). Établit la
 * session (cookies) à partir du lien, puis redirige vers l'écran d'acceptation
 * `/invitation`.
 *
 * Sécurité :
 *  - N'utilise QUE l'URL publique + la clé publiable (aucun secret ici).
 *  - Redirection interne uniquement (`safeInternalPath`) → aucun open redirect.
 *  - En cas d'échec (lien absent / invalide / expiré), redirige vers
 *    `/invitation?error=lien` (écran Prodigio, jamais d'écran Supabase brut).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const base = canonicalSiteUrl();

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const authError = searchParams.get("error_description") ?? searchParams.get("error");
  // Destination finale interne (par défaut l'écran d'acceptation).
  const next = safeInternalPath(searchParams.get("next"), "/invitation");

  const fail = (reason = "lien") =>
    NextResponse.redirect(new URL(`/invitation?error=${reason}`, base));

  if (authError) return fail();
  if (!isSupabaseConfigured()) return fail("config");

  const supabase = await createSupabaseServerClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail();
    return NextResponse.redirect(new URL(next, base));
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return fail();
    return NextResponse.redirect(new URL(next, base));
  }

  return fail();
}
