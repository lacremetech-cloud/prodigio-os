"use client";

import { useEffect } from "react";
import {
  ATTRIBUTION_STORAGE_KEY,
  buildTouch,
  mergeAttribution,
  type StoredAttribution,
} from "@/modules/mandates/funnel";

/**
 * Capte l'attribution marketing dès l'arrivée du visiteur (premier contact
 * persistant + dernier contact actualisé) et la conserve en `sessionStorage`.
 * Ne rend rien. L'analyse d'éligibilité relira ces données au moment du dépôt.
 */
export function AttributionCapture() {
  useEffect(() => {
    try {
      const nowIso = new Date().toISOString();
      const touch = buildTouch(
        window.location.href,
        document.referrer || null,
        nowIso,
      );

      let previous: StoredAttribution | null = null;
      const stored = window.sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);
      if (stored) {
        previous = JSON.parse(stored) as StoredAttribution;
      }

      const merged = mergeAttribution(previous, touch);
      window.sessionStorage.setItem(
        ATTRIBUTION_STORAGE_KEY,
        JSON.stringify(merged),
      );
    } catch {
      // Stockage indisponible (navigation privée stricte) : on ignore sans casser.
    }
  }, []);

  return null;
}
