import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/config";
import type { Database } from "./types";

/**
 * Client Supabase **serveur** (Server Components, Route Handlers, Server
 * Actions). N'utilise que l'URL publique et la clé PUBLIABLE (anon) — jamais de
 * clé service_role ni de secret de base. La séparation client/serveur suit les
 * conventions `@supabase/ssr` pour l'App Router.
 *
 * Le funnel public est anonyme : la gestion des cookies reste inoffensive mais
 * est câblée proprement pour rester compatible avec une future authentification.
 */
export async function createSupabaseServerClient() {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase non configuré (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).",
    );
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // `setAll` appelé depuis un Server Component : sans middleware d'écriture
          // de cookies, on ignore silencieusement (aucune session à rafraîchir
          // pour le funnel anonyme).
        }
      },
    },
  });
}
