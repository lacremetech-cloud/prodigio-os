/**
 * Système de thème du CRM (privé) — logique **pure**, testable sans DOM.
 *
 * Préférence stockée dans un cookie lisible côté serveur (`crm-theme`) pour
 * éviter tout flash et toute erreur d'hydratation : le serveur rend déjà le bon
 * `data-crm-theme`, un script en ligne corrige le cas « système » avant le
 * premier rendu. Aucune migration : la préférence est purement locale.
 *
 * Le thème **sombre** reste le défaut. Limité aux interfaces privées `/crm` :
 * les pages publiques et le funnel ne sont pas concernés.
 */

export type ThemePreference = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

export const THEME_PREFERENCES: ThemePreference[] = ["dark", "light", "system"];

export const THEME_COOKIE = "crm-theme";
export const DEFAULT_PREFERENCE: ThemePreference = "dark";

export const THEME_LABELS: Record<ThemePreference, string> = {
  dark: "Sombre",
  light: "Clair",
  system: "Système",
};

export const THEME_HINTS: Record<ThemePreference, string> = {
  dark: "Interface sombre premium (par défaut).",
  light: "Interface claire, contrastée.",
  system: "Suit le réglage clair/sombre de votre appareil.",
};

/** Normalise une valeur inconnue vers une préférence valide (défaut : sombre). */
export function normalizePreference(value: string | null | undefined): ThemePreference {
  return value === "light" || value === "dark" || value === "system" ? value : DEFAULT_PREFERENCE;
}

/**
 * Résout la préférence en thème concret. Pour « système », `systemPrefersLight`
 * tranche (côté client : `matchMedia`). Côté serveur, on ne connaît pas l'OS →
 * on retombe sur le défaut sombre (le script en ligne corrigera avant le paint).
 */
export function resolveTheme(
  preference: ThemePreference,
  systemPrefersLight: boolean | null,
): ResolvedTheme {
  if (preference === "light") return "light";
  if (preference === "dark") return "dark";
  // système
  if (systemPrefersLight == null) return "dark";
  return systemPrefersLight ? "light" : "dark";
}

/** Chaîne cookie (1 an, SameSite=Lax) pour persister la préférence. */
export function themeCookieString(preference: ThemePreference): string {
  const maxAge = 60 * 60 * 24 * 365;
  return `${THEME_COOKIE}=${preference}; path=/; max-age=${maxAge}; samesite=lax`;
}

/**
 * Script en ligne (chaîne) exécuté AVANT le premier paint : lit le cookie et,
 * pour « système », applique le thème de l'OS sur `data-crm-theme` de l'élément
 * parent. Identique côté serveur et client (aucune donnée dynamique) → pas de
 * divergence d'hydratation. Sûr même si le cookie/`matchMedia` échoue.
 */
export function themeNoFlashScript(): string {
  return `(function(){try{
var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=([^;]+)/);
var p=m?decodeURIComponent(m[1]):'${DEFAULT_PREFERENCE}';
var t=p==='light'?'light':p==='dark'?'dark':(window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');
var el=document.currentScript&&document.currentScript.parentElement;
if(el){el.setAttribute('data-crm-theme',t);el.style.colorScheme=t;}
}catch(e){}})();`;
}
