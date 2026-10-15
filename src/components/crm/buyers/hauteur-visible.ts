"use client";

import { useEffect } from "react";

/**
 * Pose `--crm-vh` à la hauteur du viewport VISUEL, clavier compris.
 *
 * LE DÉFAUT QU'ELLE CORRIGE. Sur iOS, ouvrir le clavier ne redimensionne pas
 * la page : un élément `position: fixed; bottom: 0` reste placé par rapport à
 * une fenêtre qui, elle, n'a pas bougé. Le pied du panneau — donc
 * « Enregistrer » — se retrouve sous le clavier. On dicte une note au
 * téléphone, on cherche le bouton, il n'est pas là.
 *
 * `100dvh` ne suffit pas : il suit les barres d'outils du navigateur, pas le
 * clavier. `visualViewport` est la seule mesure qui recule quand le clavier
 * monte, et c'est pour cela qu'on l'écoute plutôt que de s'en remettre à une
 * unité CSS.
 *
 * Le repli est le CSS : sans `visualViewport`, `--crm-vh` reste absente et la
 * feuille retombe sur `100svh`. Aucun écran ne dépend donc de ce hook pour
 * s'afficher — il ne fait que resserrer la hauteur quand il peut.
 */
export function useHauteurVisible(): void {
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : undefined;
    if (!vv) return;

    const appliquer = () => {
      document.documentElement.style.setProperty("--crm-vh", `${Math.round(vv.height)}px`);
    };
    appliquer();
    vv.addEventListener("resize", appliquer);
    /* `scroll` aussi : sur iOS, le viewport visuel se DÉPLACE quand le clavier
       pousse la page, sans changer de hauteur. */
    vv.addEventListener("scroll", appliquer);
    return () => {
      vv.removeEventListener("resize", appliquer);
      vv.removeEventListener("scroll", appliquer);
      /* Nettoyée à la fermeture : laissée en place, elle contraindrait la
         hauteur d'écrans qui n'ont rien demandé. */
      document.documentElement.style.removeProperty("--crm-vh");
    };
  }, []);
}
