/**
 * Métadonnées de base de l'application, centralisées pour éviter la
 * duplication (layout, pages, API). Interface française au lancement.
 */
export const site = {
  name: "Prodigio OS",
  description:
    "Le Système Prodigio transforme chaque propriété d'exception en une mise en " +
    "marché à part entière : écrin sur mesure, acheteurs qualifiés, stratégie active.",
  locale: "fr",
  service: "prodigio-os",
  // URL canonique (surchargée par NEXT_PUBLIC_SITE_URL le moment venu).
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://prodigio.example",
} as const;
