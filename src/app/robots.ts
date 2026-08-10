import type { MetadataRoute } from "next";
import { canonicalSiteUrl } from "@/config";

/**
 * Robots. Autorise l'exploration des pages publiques mais interdit explicitement
 * les espaces privés / non indexables : CRM, prévisualisations, funnels (dépôt
 * acquéreur & analyse propriétaire), et les chemins d'authentification.
 */
export default function robots(): MetadataRoute.Robots {
  const base = canonicalSiteUrl().replace(/\/+$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/crm/",
        "/apercu-bien/",
        "/proprietaire/analyse",
        "/bien/*/interet",
        "/connexion",
        "/invitation",
        "/acces",
        "/api/",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
