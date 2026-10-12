import { NextResponse } from "next/server";
import { site } from "@/lib/site";

/**
 * Sonde de disponibilité. Ne dépend d'aucun service externe : renvoie un état
 * statique tant que la base et les intégrations ne sont pas connectées.
 *
 * Elle annonce aussi le commit réellement en ligne. Vercel manque parfois un
 * webhook de fusion : sans ce repère, « est-ce déployé ? » se devine, et on a
 * déjà cherché un bogue dans du code qui n'était pas celui qui tournait. Le
 * SHA court est un identifiant opaque, il ne révèle rien du dépôt.
 */
export const dynamic = "force-dynamic";

export function GET() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? null;
  return NextResponse.json(
    {
      status: "ok",
      service: site.service,
      commit: sha ? sha.slice(0, 7) : "local",
      env: process.env.VERCEL_ENV ?? "local",
    },
    { headers: { "cache-control": "no-store" } },
  );
}
