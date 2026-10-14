import "server-only";

import { brochureBaseUrl, isSupabaseAdminConfigured } from "@/config";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Lien court de brochure : fabrication, validation, comptage des ouvertures.
 *
 * Séparé de la route pour être testable sans serveur HTTP — c'est la partie qui
 * décide ce qui compte comme une ouverture, et cette décision mérite des tests.
 */

/**
 * Slugs acceptés. Volontairement étroit : ce segment vient de l'URL et sert
 * d'argument à une fonction en base. Minuscules, chiffres et tirets, rien
 * d'autre — ni point, ni barre oblique, ni encodage.
 */
const FORME_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,118}[a-z0-9])?$/;

export function slugValide(slug: unknown): slug is string {
  return typeof slug === "string" && FORME_SLUG.test(slug);
}

/** `https://brochure.prodigio.fr/verdun`. Null si le slug est inexploitable. */
export function lienBrochure(slug: string | null | undefined): string | null {
  const s = (slug ?? "").trim().toLowerCase();
  if (!slugValide(s)) return null;
  return `${brochureBaseUrl()}/${s}`;
}

/**
 * Ce qui n'est PAS une ouverture.
 *
 * Une messagerie qui affiche un aperçu, un antivirus qui vérifie le lien, un
 * moteur qui l'indexe : tous chargent l'adresse sans qu'aucun humain n'ait
 * cliqué. Les compter ferait croire à un intérêt qui n'existe pas, et le
 * commercial rappellerait pour rien — un faux signal est pire que pas de
 * signal.
 *
 * Ce filtre est imparfait par nature : il reconnaît ce qui s'annonce. Un robot
 * qui se déguise en navigateur passera. On préfère ça à l'inverse, parce qu'une
 * ouverture manquée ne coûte qu'une information, quand une fausse coûte un
 * appel et un peu de crédit.
 */
const SIGNES_DE_ROBOT =
  /bot|crawler|spider|crawling|preview|fetcher|facebookexternalhit|whatsapp|telegram|twitterbot|slackbot|discordbot|linkedinbot|skypeuripreview|applebot|bingpreview|curl|wget|python-requests|okhttp|headless|lighthouse|pingdom|uptime|monitor/i;

export function estUnRobot(userAgent: string | null | undefined): boolean {
  const ua = (userAgent ?? "").trim();
  /* Aucun agent déclaré : un navigateur en annonce toujours un. */
  if (ua.length === 0) return true;
  return SIGNES_DE_ROBOT.test(ua);
}

/** Tronque sans jamais lever — ces valeurs viennent d'en-têtes arbitraires. */
function court(v: string | null | undefined, max: number): string | null {
  const t = (v ?? "").trim();
  if (t.length === 0) return null;
  return t.slice(0, max);
}

/**
 * Note une ouverture. Ne lève jamais, n'est jamais attendue par la redirection :
 * la personne attend sa brochure, pas notre écriture.
 */
export async function enregistrerOuverture(input: {
  propertyId: string;
  slug: string;
  userAgent?: string | null;
  referer?: string | null;
}): Promise<void> {
  if (!isSupabaseAdminConfigured()) return;
  try {
    const admin = getSupabaseAdminClient();
    const { error } = await admin.from("brochure_opens").insert({
      property_id: input.propertyId,
      slug: input.slug,
      user_agent: court(input.userAgent, 500),
      referer: court(input.referer, 500),
    });
    if (error) {
      console.warn("ouverture de brochure non enregistree", { code: error.code });
    }
  } catch (cause) {
    console.warn("ouverture de brochure non enregistree", {
      name: cause instanceof Error ? cause.name : "unknown",
    });
  }
}
