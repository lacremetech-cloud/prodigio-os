import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { briefParSlug } from "@/modules/briefs/registre";
import { jetonValide, nomDuCookie } from "@/modules/briefs/code";

export const dynamic = "force-dynamic";

/**
 * LE DOCUMENT LUI-MÊME.
 *
 * Servi par une route, et non par une page React, pour une raison simple : le
 * brief est un document HTML complet, avec sa propre feuille de style qui pose
 * des règles sur `body`. L'encastrer dans la mise en page de l'application
 * ferait se battre deux chartes graphiques.
 *
 * LE CODE EST REVÉRIFIÉ ICI. La page d'à côté n'est qu'une porte : si cette
 * route se contentait de servir le document à qui la demande, l'adresse
 * `/briefs/<bien>/document` suffirait à tout lire, et le code ne serait qu'un
 * décor. Le jeton est signé par l'empreinte du code, donc infalsifiable, et
 * changer le code le périme sur-le-champ.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const brief = briefParSlug(slug);

  const magasin = await cookies();
  const autorise =
    brief !== null &&
    jetonValide(brief.slug, brief.empreinteDuCode, magasin.get(nomDuCookie(brief.slug))?.value);

  /* Sans jeton valide, on renvoie à la porte — y compris quand le bien
     n'existe pas, pour ne pas distinguer les deux cas. */
  if (!brief || !autorise) {
    return NextResponse.redirect(new URL(`/briefs/${encodeURIComponent(slug)}`, _req.url));
  }

  return new NextResponse(brief.document, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      /* Jamais en cache partagé : ce document porte le prix négociable, le nom
         du propriétaire et l'objection d'entretien. Il ne doit vivre que dans
         le navigateur qui a saisi le code. */
      "cache-control": "private, no-store, max-age=0",
      "x-robots-tag": "noindex, nofollow, noarchive",
      "referrer-policy": "no-referrer",
    },
  });
}
