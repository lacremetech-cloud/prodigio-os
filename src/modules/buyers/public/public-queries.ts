import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/config";
import type { PublicPropertyContent, PublicPropertySnapshot } from "./snapshot";

/**
 * Lectures PUBLIQUES (anon) de l'expérience publiée. Passent par la fonction
 * SECURITY DEFINER `public_property_by_slug`, qui ne renvoie QUE le snapshot EN
 * LIGNE d'un bien PUBLIÉ — jamais un brouillon, une prévisualisation ou un bien
 * dépublié, et jamais de donnée privée. Aucune table n'est lue directement.
 */

function isContent(value: unknown): value is PublicPropertyContent {
  return !!value && typeof value === "object";
}

/** Renvoie le snapshot publié pour un slug, ou `null` (bien inexistant/dépublié). */
export async function getPublishedProperty(
  slug: string,
): Promise<PublicPropertySnapshot | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("public_property_by_slug", { p_slug: slug });
  if (error || !data || typeof data !== "object") return null;
  const env = data as Record<string, unknown>;
  if (!isContent(env.content)) return null;
  return {
    slug: String(env.slug ?? slug),
    version: typeof env.version === "number" ? env.version : 0,
    seo_index: env.seo_index === true,
    published_at: typeof env.published_at === "string" ? env.published_at : "",
    content: env.content,
  };
}

/** Slugs publiés & indexables (sitemap). Vide si Supabase non configuré. */
export async function getIndexableProperties(): Promise<
  { slug: string; publishedAt: string | null }[]
> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("public_indexable_properties");
  if (error || !Array.isArray(data)) return [];
  return (data as { slug: string; published_at: string | null }[]).map((r) => ({
    slug: r.slug,
    publishedAt: r.published_at,
  }));
}
