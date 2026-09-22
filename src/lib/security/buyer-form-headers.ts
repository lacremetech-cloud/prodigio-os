import "server-only";

import type { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env, isSupabaseConfigured } from "@/config";
import {
  buildFrameAncestorsPolicy,
  buyerFormSlugFromPath,
} from "@/modules/buyers/public/embed-policy";

/**
 * En-têtes d'intégration de la route du formulaire acquéreur.
 *
 * `frame-ancestors` est la SEULE autorité sur qui peut embarquer la page. La
 * liste est propre à chaque bien : l'en-tête se calcule donc par requête. On
 * retire aussi `X-Frame-Options`, qui ne sait pas exprimer une liste et dont un
 * `SAMEORIGIN` résiduel bloquerait toute intégration pourtant autorisée.
 *
 * Une lecture qui échoue ne doit jamais ouvrir le cadre : en cas de doute, on
 * retombe sur la politique la plus fermée (`'self'` seul).
 */
export async function applyBuyerFormEmbedHeaders(
  request: NextRequest,
  response: NextResponse,
): Promise<void> {
  const slug = buyerFormSlugFromPath(request.nextUrl.pathname);
  if (!slug) return;

  let origins: string[] = [];
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
      }
    } catch {
      origins = [];
    }
  }

  response.headers.set("Content-Security-Policy", buildFrameAncestorsPolicy(origins));
  response.headers.delete("X-Frame-Options");
}
