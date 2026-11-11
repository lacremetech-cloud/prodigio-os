import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    /**
     * LE CACHE DE NAVIGATION DU ROUTEUR.
     *
     * Par défaut, Next ne garde RIEN d'une page dynamique côté navigateur :
     * revenir d'une fiche vers la liste refait l'intégralité des requêtes,
     * comme si on la découvrait. Avec une base à Paris et des fonctions qui
     * tournaient aux États-Unis, chaque retour en arrière coûtait un nouvel
     * aller-retour transatlantique — d'où l'impression que le CRM « rame »
     * alors qu'il ne fait que re-télécharger ce qu'on vient de lire.
     *
     * 30 secondes : assez pour que naviguer entre une liste et trois fiches
     * soit instantané, assez court pour ne jamais travailler sur des données
     * vieilles d'une minute.
     *
     * Ce cache n'introduit AUCUN risque de voir du périmé après une action :
     * `revalidatePath` et `router.refresh()` l'invalident de toute façon.
     * C'est la navigation seule qui est mise en cache, jamais les écritures.
     */
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};

export default nextConfig;
