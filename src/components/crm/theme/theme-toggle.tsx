"use client";

import { useTheme } from "./theme-provider";
import { THEME_HINTS, THEME_LABELS, THEME_PREFERENCES, type ThemePreference } from "./theme";

const ICON: Record<ThemePreference, string> = {
  dark: "🌙",
  light: "☀️",
  system: "🖥️",
};

/**
 * Sélecteur de thème (Sombre / Clair / Système). Boutons radio natifs :
 * navigables au clavier (flèches), état annoncé aux lecteurs d'écran via
 * `aria-checked` implicite du radiogroup. Aucune couleur seule : libellé + icône.
 */
export function ThemeToggle() {
  const { preference, resolved, setPreference } = useTheme();
  return (
    <div>
      <div className="crm-segmented" role="radiogroup" aria-label="Thème de l’interface">
        {THEME_PREFERENCES.map((p) => {
          const active = preference === p;
          return (
            <label key={p} className={`crm-segment ${active ? "crm-segment--active" : ""}`}>
              <input
                type="radio"
                name="crm-theme"
                value={p}
                checked={active}
                onChange={() => setPreference(p)}
                className="crm-sr-only"
              />
              <span aria-hidden>{ICON[p]}</span>
              <span>{THEME_LABELS[p]}</span>
            </label>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-[var(--crm-text-faint)]">
        {THEME_HINTS[preference]}
        {preference === "system" ? ` Actuellement : ${resolved === "light" ? "clair" : "sombre"}.` : ""}
      </p>
    </div>
  );
}
