import "server-only";

import { isSupabaseAdminConfigured } from "@/config";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { enregistrerOuverture, estUnRobot, slugValide } from "@/modules/buyers/notifications/lien-brochure";

/**
 * Lien court d'une brochure : `brochure.prodigio.fr/<slug>` → la brochure.
 *
 * POURQUOI UNE REDIRECTION plutôt que l'adresse directe dans le SMS :
 *
 *  • **Un SMS ne se corrige pas.** Il est reçu, archivé, rouvert des mois plus
 *    tard. L'adresse qu'il porte doit survivre à un changement d'hébergeur, à
 *    une refonte, à un renommage. Ici la cible se lit en base : elle se change
 *    sans toucher aux messages déjà partis.
 *  • **Le lien se lit.** « brochure.prodigio.fr/verdun » annonce son contenu et
 *    son expéditeur. Reçue d'un numéro inconnu, une suite de caractères opaque
 *    a la forme exacte d'une arnaque — et c'est une décision à sept chiffres
 *    qu'on demande à la personne de prendre.
 *  • **Il est plus court** de dix-huit caractères, ce qui maintient l'accusé
 *    dans un seul SMS.
 *
 * Cette route est **publique et sans secret** : la brochure l'est déjà, toute
 * personne ayant déposé le formulaire en détient l'adresse et peut la
 * transmettre. La redirection n'ajoute ni exposition ni protection.
 *
 * Elle est placée à la RACINE pour que le lien reste court. Les routes fixes
 * (`/crm`, `/bien`, `/connexion`, `/api`…) gardent la priorité dans Next : un
 * slug ne peut donc pas en masquer une.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteProps {
  params: Promise<{ slug: string }>;
}

/** 404 sobre : un slug inconnu n'apprend rien de plus qu'un slug inexistant. */
function introuvable(): Response {
  return new Response("Brochure introuvable.", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function GET(request: Request, { params }: RouteProps): Promise<Response> {
  const { slug } = await params;
  if (!slugValide(slug)) return introuvable();
  if (!isSupabaseAdminConfigured()) return introuvable();

  let cible: string;
  let propertyId: string;
  try {
    const admin = getSupabaseAdminClient();
    const { data, error } = await admin.rpc("brochure_cible", { p_slug: slug });
    const ligne = Array.isArray(data) ? data[0] : null;
    if (error || !ligne?.brochure_url || !ligne?.property_id) return introuvable();
    cible = ligne.brochure_url;
    propertyId = ligne.property_id;
  } catch (cause) {
    console.warn("lien brochure : cible illisible", {
      name: cause instanceof Error ? cause.name : "unknown",
    });
    return introuvable();
  }

  /* Le comptage ne doit jamais retarder la redirection : la personne a cliqué,
     elle attend sa brochure. On n'attend pas l'écriture, et un échec d'écriture
     ne lui est jamais visible. */
  if (!estUnRobot(request.headers.get("user-agent"))) {
    void enregistrerOuverture({
      propertyId,
      slug,
      userAgent: request.headers.get("user-agent"),
      referer: request.headers.get("referer"),
    });
  }

  /* 302 et non 301 : la cible peut changer (déménagement d'une vitrine), et un
     301 resterait gravé dans le cache des navigateurs et des opérateurs. */
  return new Response(null, {
    status: 302,
    headers: { location: cible, "cache-control": "no-store" },
  });
}

/* Les messageries pré-chargent les liens pour en faire un aperçu. On répond,
   sans jamais compter : sinon chaque envoi compterait une ouverture que
   personne n'a faite. */
export async function HEAD(request: Request, ctx: RouteProps): Promise<Response> {
  const reponse = await GET(request, ctx);
  return new Response(null, { status: reponse.status, headers: reponse.headers });
}
