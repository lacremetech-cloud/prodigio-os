import { describe, it, expect } from "vitest";
import {
  canonicalSiteUrl,
  isSupabaseAdminConfigured,
  isTurnstileConfigured,
  isTurnstileProductionSafe,
  isTurnstileTestSecretKey,
  isTurnstileTestSiteKey,
  parseEnv,
  safeInternalPath,
} from "./env";

describe("parseEnv", () => {
  it("fonctionne sans aucune variable et applique les valeurs par défaut", () => {
    const result = parseEnv({});
    expect(result.NODE_ENV).toBe("development");
  });

  it("accepte les environnements Node connus", () => {
    expect(parseEnv({ NODE_ENV: "production" }).NODE_ENV).toBe("production");
    expect(parseEnv({ NODE_ENV: "test" }).NODE_ENV).toBe("test");
  });

  it("rejette une valeur NODE_ENV inconnue", () => {
    expect(() => parseEnv({ NODE_ENV: "staging" })).toThrow();
  });

  it("lit les variables Turnstile lorsqu'elles sont fournies", () => {
    const result = parseEnv({
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "site",
      TURNSTILE_SECRET_KEY: "secret",
      TURNSTILE_EXPECTED_HOSTNAME: "prodigio.fr",
    });
    expect(result.NEXT_PUBLIC_TURNSTILE_SITE_KEY).toBe("site");
    expect(result.TURNSTILE_SECRET_KEY).toBe("secret");
    expect(result.TURNSTILE_EXPECTED_HOSTNAME).toBe("prodigio.fr");
  });
});

describe("configuration Turnstile", () => {
  const TEST_SITE = "1x00000000000000000000AA";
  const TEST_SECRET = "1x0000000000000000000000000000000AA";

  it("isTurnstileConfigured exige clé de site ET secret", () => {
    expect(isTurnstileConfigured({} as never)).toBe(false);
    expect(
      isTurnstileConfigured({
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: "site",
      } as never),
    ).toBe(false);
    expect(
      isTurnstileConfigured({
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: "site",
        TURNSTILE_SECRET_KEY: "secret",
      } as never),
    ).toBe(true);
  });

  it("reconnaît les clés de TEST officielles Cloudflare", () => {
    expect(isTurnstileTestSiteKey(TEST_SITE)).toBe(true);
    expect(isTurnstileTestSiteKey("2x00000000000000000000AB")).toBe(true);
    expect(isTurnstileTestSiteKey("3x00000000000000000000FF")).toBe(true);
    expect(isTurnstileTestSiteKey("real-production-site-key")).toBe(false);
    expect(isTurnstileTestSecretKey(TEST_SECRET)).toBe(true);
    expect(isTurnstileTestSecretKey("real-production-secret")).toBe(false);
  });

  it("hors production, les clés de test sont autorisées", () => {
    expect(
      isTurnstileProductionSafe({
        NODE_ENV: "development",
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: TEST_SITE,
        TURNSTILE_SECRET_KEY: TEST_SECRET,
      }),
    ).toBe(true);
    expect(
      isTurnstileProductionSafe({
        NODE_ENV: "test",
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: TEST_SITE,
        TURNSTILE_SECRET_KEY: TEST_SECRET,
      }),
    ).toBe(true);
  });

  it("EN PRODUCTION, une clé de test rend la configuration NON sûre", () => {
    // Site de test en prod → non sûr.
    expect(
      isTurnstileProductionSafe({
        NODE_ENV: "production",
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: TEST_SITE,
        TURNSTILE_SECRET_KEY: "real-production-secret",
      }),
    ).toBe(false);
    // Secret de test en prod → non sûr.
    expect(
      isTurnstileProductionSafe({
        NODE_ENV: "production",
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: "real-production-site",
        TURNSTILE_SECRET_KEY: TEST_SECRET,
      }),
    ).toBe(false);
  });

  it("EN PRODUCTION, des clés réelles sont sûres", () => {
    expect(
      isTurnstileProductionSafe({
        NODE_ENV: "production",
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: "real-production-site",
        TURNSTILE_SECRET_KEY: "real-production-secret",
      }),
    ).toBe(true);
  });
});

describe("Supabase Admin (invitations)", () => {
  it("le secret n'est JAMAIS préfixé NEXT_PUBLIC_ (jamais dans le bundle client)", () => {
    // Le schéma lit bien SUPABASE_SECRET_KEY côté serveur…
    expect(parseEnv({ SUPABASE_SECRET_KEY: "sb_secret_xxx" }).SUPABASE_SECRET_KEY).toBe(
      "sb_secret_xxx",
    );
    // …et n'expose aucune variante publique.
    const shape = parseEnv({}) as Record<string, unknown>;
    expect("NEXT_PUBLIC_SUPABASE_SECRET_KEY" in shape).toBe(false);
  });

  it("isSupabaseAdminConfigured exige URL ET secret serveur", () => {
    expect(isSupabaseAdminConfigured({} as never)).toBe(false);
    // Secret absent → NON configuré (aucun appel Admin ne sera tenté).
    expect(
      isSupabaseAdminConfigured({
        NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
      } as never),
    ).toBe(false);
    // URL absente → NON configuré.
    expect(
      isSupabaseAdminConfigured({ SUPABASE_SECRET_KEY: "sb_secret_x" } as never),
    ).toBe(false);
    // Les deux présents → configuré.
    expect(
      isSupabaseAdminConfigured({
        NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
        SUPABASE_SECRET_KEY: "sb_secret_x",
      } as never),
    ).toBe(true);
  });
});

describe("redirections sûres", () => {
  it("safeInternalPath refuse les redirections externes / protocol-relative", () => {
    expect(safeInternalPath("/crm")).toBe("/crm");
    expect(safeInternalPath("/invitation")).toBe("/invitation");
    expect(safeInternalPath("//evil.com")).toBe("/crm");
    expect(safeInternalPath("https://evil.com")).toBe("/crm");
    expect(safeInternalPath("/\\evil.com")).toBe("/crm");
    expect(safeInternalPath(undefined)).toBe("/crm");
    expect(safeInternalPath("relative", "/invitation")).toBe("/invitation");
  });

  it("canonicalSiteUrl : NEXT_PUBLIC_SITE_URL prioritaire, fallback prod go.prodigio.fr", () => {
    expect(canonicalSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://x.fr/", NODE_ENV: "production" })).toBe(
      "https://x.fr",
    );
    expect(canonicalSiteUrl({ NODE_ENV: "production" } as never)).toBe("https://go.prodigio.fr");
  });
});
