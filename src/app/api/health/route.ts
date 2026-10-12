import { NextResponse } from "next/server";
import { isBuyerSlackConfigured, isMetaCapiConfigured } from "@/config";
import { site } from "@/lib/site";

/**
 * Sonde de disponibilité. Ne dépend d'aucun service externe : renvoie un état
 * statique tant que la base et les intégrations ne sont pas connectées.
 *
 * Elle annonce aussi le commit réellement en ligne. Vercel manque parfois un
 * webhook de fusion : sans ce repère, « est-ce déployé ? » se devine, et on a
 * déjà cherché un bogue dans du code qui n'était pas celui qui tournait. Le
 * SHA court est un identifiant opaque, il ne révèle rien du dépôt.
 *
 * Et elle dit quelles intégrations sont **configurées**. Une variable posée
 * dans Vercel ne prend effet qu'au build suivant : sans ce repère, on croit
 * avoir branché Meta ou Slack alors que le déploiement en cours tourne encore
 * sans. Des booléens, jamais une valeur — ni jeton, ni URL, ni identifiant.
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
      integrations: {
        slack_acquereurs: isBuyerSlackConfigured(),
        meta_conversions: isMetaCapiConfigured(),
      },
    },
    { headers: { "cache-control": "no-store" } },
  );
}
