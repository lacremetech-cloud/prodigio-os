import { describe, it, expect } from "vitest";
import {
  isEstimationSlackConfigured,
  canonicalSiteUrl,
  googleOAuthRedirectUri,
  isCalendarEncryptionConfigured,
  isGoogleCalendarConfigured,
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

describe("Google Calendar (planification des estimations)", () => {
  // 32 octets encodés base64 (openssl rand -base64 32) — factice, pour les tests.
  const KEY32 = Buffer.alloc(32, 7).toString("base64");

  it("aucune variable Google n'est préfixée NEXT_PUBLIC_ (jamais dans le bundle client)", () => {
    const shape = parseEnv({
      GOOGLE_OAUTH_CLIENT_ID: "id",
      GOOGLE_OAUTH_CLIENT_SECRET: "secret",
      CALENDAR_TOKEN_ENCRYPTION_KEY: KEY32,
    }) as Record<string, unknown>;
    expect("NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID" in shape).toBe(false);
    expect("NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_SECRET" in shape).toBe(false);
    expect("NEXT_PUBLIC_CALENDAR_TOKEN_ENCRYPTION_KEY" in shape).toBe(false);
    expect(shape.GOOGLE_OAUTH_CLIENT_SECRET).toBe("secret");
  });

  it("isCalendarEncryptionConfigured exige une clé de 32 octets (base64)", () => {
    expect(isCalendarEncryptionConfigured({} as never)).toBe(false);
    expect(
      isCalendarEncryptionConfigured({ CALENDAR_TOKEN_ENCRYPTION_KEY: "trop-court" }),
    ).toBe(false);
    expect(
      isCalendarEncryptionConfigured({
        CALENDAR_TOKEN_ENCRYPTION_KEY: Buffer.alloc(16, 1).toString("base64"),
      }),
    ).toBe(false);
    expect(
      isCalendarEncryptionConfigured({ CALENDAR_TOKEN_ENCRYPTION_KEY: KEY32 }),
    ).toBe(true);
  });

  it("isGoogleCalendarConfigured exige client id, secret ET clé de chiffrement", () => {
    expect(isGoogleCalendarConfigured({} as never)).toBe(false);
    expect(
      isGoogleCalendarConfigured({
        GOOGLE_OAUTH_CLIENT_ID: "id",
        GOOGLE_OAUTH_CLIENT_SECRET: "secret",
      } as never),
    ).toBe(false);
    expect(
      isGoogleCalendarConfigured({
        GOOGLE_OAUTH_CLIENT_ID: "id",
        GOOGLE_OAUTH_CLIENT_SECRET: "secret",
        CALENDAR_TOKEN_ENCRYPTION_KEY: KEY32,
      }),
    ).toBe(true);
  });

  it("googleOAuthRedirectUri : valeur explicite prioritaire, sinon dérivée du domaine", () => {
    expect(
      googleOAuthRedirectUri({
        GOOGLE_OAUTH_REDIRECT_URI: "https://x.fr/api/calendar/google/callback",
      } as never),
    ).toBe("https://x.fr/api/calendar/google/callback");
    expect(
      googleOAuthRedirectUri({ NODE_ENV: "production" } as never),
    ).toBe("https://go.prodigio.fr/api/calendar/google/callback");
  });
});

describe("Slack — alertes des rendez-vous d'estimation", () => {
  it("le webhook n'est JAMAIS préfixé NEXT_PUBLIC_ (jamais dans le bundle client)", () => {
    const shape = parseEnv({
      SLACK_ESTIMATION_APPOINTMENTS_WEBHOOK_URL: "https://hooks.slack.com/services/xxx",
    }) as Record<string, unknown>;
    expect("NEXT_PUBLIC_SLACK_ESTIMATION_APPOINTMENTS_WEBHOOK_URL" in shape).toBe(false);
    expect(shape.SLACK_ESTIMATION_APPOINTMENTS_WEBHOOK_URL).toBe(
      "https://hooks.slack.com/services/xxx",
    );
  });

  it("isEstimationSlackConfigured exige un webhook https présent", () => {
    expect(isEstimationSlackConfigured({} as never)).toBe(false);
    expect(
      isEstimationSlackConfigured({ SLACK_ESTIMATION_APPOINTMENTS_WEBHOOK_URL: "" } as never),
    ).toBe(false);
    expect(
      isEstimationSlackConfigured({
        SLACK_ESTIMATION_APPOINTMENTS_WEBHOOK_URL: "http://insecure.example",
      }),
    ).toBe(false);
    expect(
      isEstimationSlackConfigured({
        SLACK_ESTIMATION_APPOINTMENTS_WEBHOOK_URL: "https://hooks.slack.com/services/xxx",
      }),
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
