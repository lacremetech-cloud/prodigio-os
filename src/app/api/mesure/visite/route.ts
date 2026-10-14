import "server-only";

import { conversionVisite } from "@/modules/analytics/meta/conversions";
import { getBuyerFormContext } from "@/modules/buyers/public/public-queries";

/**
 * Comptage des visites d'une page de bien.
 *
 * Les vitrines sont des sites STATIQUES : aucun serveur ne tourne derrière
 * elles, elles ne peuvent donc rien rapporter d'elles-mêmes. Une balise posée
 * sur la page appelle ce point d'entrée, qui relaie la visite à Meta côté
 * serveur. Aucun script de Meta ne s'exécute chez le visiteur, et aucun cookie
 * tiers n'est déposé.
 *
 * Ce qui part : l'adresse IP, le navigateur, l'adresse de la page, et le
 * `fbclid` quand la visite vient d'une publicité. Rien d'autre — pas de nom,
 * pas d'e-mail, pas de téléphone : le visiteur n'en a encore donné aucun.
 *
 * Trois gardes, parce qu'un point d'entrée ouvert qui écrit dans un compte
 * publicitaire est une cible :
 *
 *  1. le bien doit exister et avoir un formulaire actif ;
 *  2. l'appel doit venir d'une origine autorisée POUR CE BIEN — la même liste
 *     qui décide qui a le droit d'encadrer son formulaire ;
 *  3. le corps est plafonné, et tout écart renvoie le même 204 muet qu'un
 *     succès : ce point d'entrée ne raconte rien à qui le sonde.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Assez pour une adresse longue et un `fbclid`, trop peu pour autre chose. */
const TAILLE_MAX = 2048;

/** Réponse unique : vide, courte, et identique en cas de succès ou de refus. */
function recu(): Response {
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}

function texteCourt(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 && t.length <= max ? t : null;
}

/**
 * Première adresse de `x-forwarded-for` : c'est celle du visiteur, les
 * suivantes sont les relais traversés.
 */
function adresseDuVisiteur(request: Request): string | null {
  const entete = request.headers.get("x-forwarded-for");
  if (!entete) return null;
  const premiere = entete.split(",")[0]?.trim();
  return premiere && premiere.length <= 64 ? premiere : null;
}

export async function POST(request: Request): Promise<Response> {
  try {
    /* `sendBeacon` envoie un corps `text/plain` : c'est ce qui évite une
       requête préalable de vérification, donc ce qui permet à la balise de
       partir même si l'onglet se ferme dans la seconde. */
    const brut = await request.text();
    if (brut.length > TAILLE_MAX) return recu();

    let charge: Record<string, unknown>;
    try {
      charge = JSON.parse(brut) as Record<string, unknown>;
    } catch {
      return recu();
    }

    const slug = texteCourt(charge.slug, 120);
    const eventId = texteCourt(charge.id, 100);
    if (!slug || !eventId) return recu();

    const contexte = await getBuyerFormContext(slug);
    if (!contexte) return recu();

    const origine = request.headers.get("origin");
    if (!origine || !contexte.allowedOrigins.includes(origine)) return recu();

    const at = typeof charge.at === "number" && Number.isFinite(charge.at) ? charge.at : null;

    await conversionVisite({
      eventId,
      sourceUrl: texteCourt(charge.url, 500),
      propertyName: contexte.publicName,
      identity: {
        /* Meme plafond large que le depot : un `fbclid` tronque est refuse
           par Meta, qui signale alors une « valeur modifiee ». */
        fbclid: texteCourt(charge.fbclid, 1000),
        clickedAt: at ? new Date(at) : null,
        clientIpAddress: adresseDuVisiteur(request),
        clientUserAgent: texteCourt(request.headers.get("user-agent"), 500),
      },
    });
  } catch (cause) {
    /* Une mesure ratée n'est jamais un incident : on le note, et le visiteur
       n'en saura jamais rien. */
    console.warn("visite non comptée", {
      name: cause instanceof Error ? cause.name : "unknown",
    });
  }
  return recu();
}
