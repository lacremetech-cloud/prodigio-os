import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env, isSupabaseConfigured } from "@/config";
import type { Database } from "./types";

/**
 * Rafraîchit la session Supabase (cookies) et **protège les routes `/crm/*`**.
 *
 * Principe de sécurité : l'autorisation d'accès au CRM est vérifiée **côté
 * serveur** (ici + dans les Server Components), jamais uniquement dans le
 * navigateur. Un visiteur non authentifié qui vise `/crm/*` est redirigé vers
 * la page de connexion ; un·e utilisateur·rice déjà connecté·e qui vise
 * `/connexion` est renvoyé·e vers le CRM.
 *
 * On n'utilise QUE l'URL publique + la clé publiable (anon) : la session est
 * portée par le JWT de l'utilisateur, et les permissions réelles restent
 * appliquées par la RLS PostgreSQL.
 */
export async function updateSession(
  request: NextRequest,
): Promise<NextResponse> {
  const response = NextResponse.next({ request });

  const isCrm = request.nextUrl.pathname.startsWith("/crm");
  const isLogin = request.nextUrl.pathname === "/connexion";

  // Sans configuration Supabase, on ne peut pas authentifier : on protège quand
  // même `/crm/*` en renvoyant vers la connexion (jamais d'accès par défaut).
  if (!isSupabaseConfigured()) {
    if (isCrm) {
      const url = request.nextUrl.clone();
      url.pathname = "/connexion";
      url.searchParams.set("redirect", request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
    return response;
  }

  /*
   * Aucun cookie d'authentification : il n'y a rien à rafraîchir.
   *
   * `getUser()` revalide le jeton AUPRÈS DU SERVEUR AUTH — un aller-retour
   * réseau. Il s'exécutait pour chaque visiteur anonyme, donc pour chaque
   * ouverture du formulaire acquéreur public, et s'ajoutait au temps avant le
   * premier octet d'une page que le visiteur attend, les yeux sur un cadre
   * vide. Sans cookie, la réponse de ce serveur est connue d'avance : pas de
   * session.
   */
  const aUnCookieAuth = request.cookies.getAll().some((c) => c.name.startsWith("sb-"));
  if (!aUnCookieAuth) {
    if (isCrm) {
      const url = request.nextUrl.clone();
      url.pathname = "/connexion";
      url.searchParams.set("redirect", request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
    return response;
  }

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL as string,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // IMPORTANT : ne rien exécuter entre createServerClient et getUser (règle
  // @supabase/ssr) — getUser revalide le jeton auprès du serveur Auth.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isCrm && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    url.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (isLogin && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/crm";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
