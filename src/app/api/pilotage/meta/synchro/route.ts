import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { env, isPilotageCronConfigured } from "@/config";
import { lancerLectureMeta } from "@/modules/pilotage/meta/lancer";

/**
 * LA LECTURE DU MATIN, appelée par Vercel Cron (voir `vercel.json`).
 *
 * Vercel envoie lui-même `Authorization: Bearer <CRON_SECRET>` à chaque appel
 * planifié, et uniquement sur le déploiement de production : un aperçu ne lit
 * jamais Meta tout seul. Sans secret configuré, la route n'existe pas ; avec,
 * tout appel qui ne le porte pas est refusé.
 *
 * La réponse est un bilan chiffré, sans aucune valeur sensible : ni jeton, ni
 * identifiant de compte, ni montant détaillé.
 */

export const dynamic = "force-dynamic";
/** Une première lecture remonte tout l'historique : elle peut être longue. */
export const maxDuration = 300;

/** Comparaison à durée constante : une égalité naïve fuite la longueur. */
function secretValide(fourni: string, attendu: string): boolean {
  const a = createHash("sha256").update(fourni).digest();
  const b = createHash("sha256").update(attendu).digest();
  return timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!isPilotageCronConfigured()) {
    return NextResponse.json({ ok: false, raison: "non configure" }, { status: 404 });
  }
  const entete = request.headers.get("authorization") ?? "";
  const fourni = entete.replace(/^Bearer\s+/i, "").trim();
  if (!secretValide(fourni, env.CRON_SECRET as string)) {
    return NextResponse.json({ ok: false, raison: "refuse" }, { status: 401 });
  }

  const resultat = await lancerLectureMeta("matin", null);
  if (!resultat.ok) {
    // Pas une panne de la route : une configuration manquante, dite en clair.
    return NextResponse.json({ ok: false, raison: resultat.raison }, { status: 200 });
  }
  const b = resultat.bilan;
  return NextResponse.json(
    {
      ok: b.statut === "reussie" || b.statut === "partielle",
      statut: b.statut,
      periode: b.periode,
      tranches: b.tranches,
      lignes: b.lignes,
      appels: b.appels,
      couverture: b.couverture,
      ecarts_de_controle: b.ecarts.length,
      message: b.message,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
