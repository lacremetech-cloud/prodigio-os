import "server-only";

import type { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env, isSupabaseConfigured } from "@/config";
import {
  buildFrameAncestorsPolicy,
  buyerFormSlugFromPath,
} from "@/modules/buyers/public/embed-policy";

/**
 * Mémoire courte des origines autorisées, par bien.
 *
 * Sans elle, chaque ouverture du formulaire payait un aller-retour vers la
 * base AVANT le premier octet de la page — et un second, identique, depuis la
 * page elle-même. Deux allers-retours pour une liste qui ne change que le jour
 * où quelqu'un modifie la configuration d'un bien.
 *
 * Une minute : assez pour que les visiteurs d'une même publicité se la
 * partagent, assez court pour qu'un changement de configuration se voie
 * presque tout de suite. La mémoire est locale à l'instance ; une instance
 * fraîche repart simplement de la base.
 */
const DUREE_MEMOIRE_MS = 60_000;
const memoire = new Map<string, { origines: string[]; expire: number }>();

/**
 * En-têtes d'intégration de la route du formulaire acquéreur.
 *
 * `frame-ancestors` est la SEULE autorité sur qui peut embarquer la page. La
 * liste est propre à chaque bien : l'en-tête se calcule donc par bien. On
 * retire aussi `X-Frame-Options`, qui ne sait pas exprimer une liste et dont un
 * `SAMEORIGIN` résiduel bloquerait toute intégration pourtant autorisée.
 *
 * Une lecture qui échoue ne doit jamais ouvrir le cadre : en cas de doute, on
 * retombe sur la politique la plus fermée (`'self'` seul) — et on ne met JAMAIS
 * un échec en mémoire, pour qu'une base momentanément injoignable ne ferme pas
 * l'intégration pendant une minute.
 */
export async function applyBuyerFormEmbedHeaders(
  request: NextRequest,
  response: NextResponse,
): Promise<void> {
  const slug = buyerFormSlugFromPath(request.nextUrl.pathname);
  if (!slug) return;

  const connu = memoire.get(slug);
  if (connu && connu.expire > Date.now()) {
    response.headers.set("Content-Security-Policy", buildFrameAncestorsPolicy(connu.origines));
    response.headers.delete("X-Frame-Options");
    return;
  }

  let origins: string[] = [];
  let lue = false;
  if (isSupabaseConfigured()) {
    try {
      const supabase = createServerClient(
        env.NEXT_PUBLIC_SUPABASE_URL as string,
        env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string,
        { cookies: { getAll: () => [], setAll: () => {} } },
      );
      const { data } = await supabase.rpc("buyer_form_context", { p_slug: slug });
      const row = data as Record<string, unknown> | null;
      if (row && Array.isArray(row.allowed_origins)) {
        origins = row.allowed_origins.filter((o): o is string => typeof o === "string");
        lue = true;
      }
    } catch {
      origins = [];
    }
  }

  if (lue) memoire.set(slug, { origines: origins, expire: Date.now() + DUREE_MEMOIRE_MS });

  response.headers.set("Content-Security-Policy", buildFrameAncestorsPolicy(origins));
  response.headers.delete("X-Frame-Options");
}
