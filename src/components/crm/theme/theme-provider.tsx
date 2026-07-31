"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import {
  normalizePreference,
  resolveTheme,
  themeCookieString,
  type ResolvedTheme,
  type ThemePreference,
} from "./theme";

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (p: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const LIGHT_QUERY = "(prefers-color-scheme: light)";

/** Abonnement réactif à `prefers-color-scheme` (sans setState dans un effet). */
function subscribeSystem(callback: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mql = window.matchMedia(LIGHT_QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}
function getSystemLight(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia
    ? window.matchMedia(LIGHT_QUERY).matches
    : false;
}

/**
 * Fournit le thème au CRM et applique `data-crm-theme` + `color-scheme` sur
 * l'élément racine (`rootRef`) via un effet (aucun rendu React de l'attribut →
 * pas de divergence d'hydratation). Suit `prefers-color-scheme` en mode
 * « système » grâce à `useSyncExternalStore`. Persiste dans un cookie (survit au
 * rechargement et à une nouvelle session).
 */
export function ThemeProvider({
  initialPreference,
  rootRef,
  children,
}: {
  initialPreference: ThemePreference;
  rootRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
}) {
  const [preference, setPreferenceState] = useState<ThemePreference>(initialPreference);

  // Système : réactif ; SSR → false (le script en ligne a déjà posé le bon thème).
  const systemLight = useSyncExternalStore(subscribeSystem, getSystemLight, () => false);
  const resolved: ResolvedTheme = resolveTheme(
    preference,
    preference === "system" ? systemLight : null,
  );

  // Applique le thème résolu à l'élément racine (effet de bord uniquement).
  useEffect(() => {
    const el = rootRef.current;
    if (el) {
      el.setAttribute("data-crm-theme", resolved);
      el.style.colorScheme = resolved;
    }
  }, [resolved, rootRef]);

  const setPreference = useCallback((p: ThemePreference) => {
    const pref = normalizePreference(p);
    if (typeof document !== "undefined") {
      document.cookie = themeCookieString(pref);
    }
    setPreferenceState(pref);
  }, []);

  return (
    <ThemeContext.Provider value={{ preference, resolved, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme doit être utilisé dans un ThemeProvider.");
  }
  return ctx;
}
