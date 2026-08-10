import type { MetadataRoute } from "next";
import { canonicalSiteUrl } from "@/config";
import { getIndexableProperties } from "@/modules/buyers/public/public-queries";

/**
 * Sitemap public. N'inclut QUE des pages publiques indexables : la page d'accueil,
 * la landing propriétaire, et les biens **publiés ET indexables** (index=true).
 * JAMAIS les brouillons, prévisualisations, pages CRM, funnels ou données
 * acquéreurs (voir `public_indexable_properties`).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = canonicalSiteUrl().replace(/\/+$/, "");
  const entries: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/proprietaire`, changeFrequency: "monthly", priority: 0.8 },
  ];

  try {
    const properties = await getIndexableProperties();
    for (const p of properties) {
      entries.push({
        url: `${base}/bien/${p.slug}`,
        lastModified: p.publishedAt ? new Date(p.publishedAt) : undefined,
        changeFrequency: "weekly",
        priority: 0.9,
      });
    }
  } catch {
    // Sans Supabase configuré (ou erreur), on renvoie au moins les pages statiques.
  }

  return entries;
}
