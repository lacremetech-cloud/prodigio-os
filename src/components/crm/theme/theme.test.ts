import { describe, expect, it } from "vitest";
import {
  DEFAULT_PREFERENCE,
  normalizePreference,
  resolveTheme,
  themeCookieString,
  themeNoFlashScript,
  THEME_COOKIE,
} from "./theme";

describe("normalizePreference", () => {
  it("accepte les valeurs valides", () => {
    expect(normalizePreference("light")).toBe("light");
    expect(normalizePreference("dark")).toBe("dark");
    expect(normalizePreference("system")).toBe("system");
  });
  it("retombe sur le défaut (sombre) pour toute autre valeur", () => {
    expect(normalizePreference(undefined)).toBe("dark");
    expect(normalizePreference(null)).toBe("dark");
    expect(normalizePreference("bidon")).toBe("dark");
    expect(DEFAULT_PREFERENCE).toBe("dark");
  });
});

describe("resolveTheme", () => {
  it("light/dark explicites ignorent le système", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("light", false)).toBe("light");
    expect(resolveTheme("dark", true)).toBe("dark");
  });
  it("système suit prefers-color-scheme", () => {
    expect(resolveTheme("system", true)).toBe("light");
    expect(resolveTheme("system", false)).toBe("dark");
  });
  it("système sans information (SSR) retombe sur sombre", () => {
    expect(resolveTheme("system", null)).toBe("dark");
  });
});

describe("themeCookieString", () => {
  it("écrit le cookie avec path et max-age", () => {
    const c = themeCookieString("light");
    expect(c).toContain(`${THEME_COOKIE}=light`);
    expect(c).toContain("path=/");
    expect(c).toMatch(/max-age=\d+/);
    expect(c.toLowerCase()).toContain("samesite=lax");
  });
});

describe("themeNoFlashScript", () => {
  it("est statique (aucune donnée dynamique → pas de divergence d'hydratation)", () => {
    expect(themeNoFlashScript()).toBe(themeNoFlashScript());
  });
  it("référence le cookie, le défaut et prefers-color-scheme", () => {
    const s = themeNoFlashScript();
    expect(s).toContain(THEME_COOKIE);
    expect(s).toContain("prefers-color-scheme");
    expect(s).toContain("data-crm-theme");
    expect(s).toContain("colorScheme");
  });
  it("est enveloppé dans un try/catch (robuste)", () => {
    expect(themeNoFlashScript()).toContain("try");
    expect(themeNoFlashScript()).toContain("catch");
  });
});
