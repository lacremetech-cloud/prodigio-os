"use client";

import { useEffect } from "react";
import { COOKIE_PERIODE } from "@/modules/pilotage/periode-choisie";

/**
 * Retient la période proposée affichée : la page Pilotage rouvrira dessus,
 * comme le cockpit de l'iMac — qui ne retient pas des dates au choix (`null` :
 * rien à retenir, la dernière période proposée reste en mémoire). Un cookie de
 * préférence, limité aux pages du pilotage ; il ne porte qu'une période
 * (« periode=hier »), relue avec la même validation qu'une adresse. Sans
 * cookie, la page s'ouvre simplement sur toute la période.
 */
export function MemoriserPeriode({ requete }: { requete: string | null }) {
  useEffect(() => {
    if (requete === null) return;
    try {
      const securise = window.location.protocol === "https:" ? "; secure" : "";
      document.cookie = `${COOKIE_PERIODE}=${encodeURIComponent(requete)}; path=/crm/pilotage; max-age=31536000; samesite=lax${securise}`;
    } catch {
      // Cookies refusés : rien à retenir, la page reste utilisable.
    }
  }, [requete]);
  return null;
}
