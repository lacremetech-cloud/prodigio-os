import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests d'intégration de l'action serveur `submitMandateFunnelAction`.
 *
 * Objectif central : garantir qu'AUCUN dépôt Supabase n'a lieu si Turnstile
 * échoue, et qu'un dépôt a bien lieu lorsqu'il réussit. On isole la
 * configuration, le client Supabase et la vérification Turnstile via des mocks
 * (aucun réseau, aucune variable d'environnement réelle requise).
 */

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  createClient: vi.fn(),
  verify: vi.fn(),
  flags: { supabase: true, turnstile: true, prodSafe: true },
  env: {
    NODE_ENV: "test" as string,
    TURNSTILE_SECRET_KEY: "server-secret" as string | undefined,
    TURNSTILE_EXPECTED_HOSTNAME: undefined as string | undefined,
  },
}));

vi.mock("@/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config")>();
  return {
    ...actual,
    env: h.env,
    isSupabaseConfigured: () => h.flags.supabase,
    isTurnstileConfigured: () => h.flags.turnstile,
    isTurnstileProductionSafe: () => h.flags.prodSafe,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: h.createClient,
}));

vi.mock("./turnstile", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./turnstile")>();
  return { ...actual, verifyTurnstileToken: h.verify };
});

import { submitMandateFunnelAction } from "./submit";

function validInput(turnstileToken: string | null = "browser-token") {
  return {
    answers: {
      propertyType: "villa_architecte",
      location: { city: "Cannes", postalCode: "06400", country: "France" },
      valueBand: "plus_2m",
      saleHorizon: "des_que_possible",
      mandateSituation: "aucun_mandat",
      contact: {
        firstName: "Marie",
        lastName: "Martin",
        phoneRaw: "06 12 34 56 78",
        emailRaw: "marie.martin@example.com",
        recallPreference: "matin",
        consent: true,
      },
      company: "",
    },
    context: {
      idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
      originUrl: "https://prodigio.example/proprietaire/analyse",
      referrer: null,
      userAgent: "vitest",
      firstTouch: null,
      lastTouch: null,
      variant: null,
      submittedAt: "2026-07-10T00:00:00.000Z",
    },
    turnstileToken,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.flags = { supabase: true, turnstile: true, prodSafe: true };
  h.env.NODE_ENV = "test";
  h.env.TURNSTILE_SECRET_KEY = "server-secret";
  h.env.TURNSTILE_EXPECTED_HOSTNAME = undefined;
  h.createClient.mockResolvedValue({ rpc: h.rpc });
  h.rpc.mockResolvedValue({ data: { accepted: true }, error: null });
  h.verify.mockResolvedValue({ ok: true, hostname: null, action: "mandate_submission" });
});

describe("submitMandateFunnelAction — Turnstile gate", () => {
  it("dépose dans Supabase lorsque Turnstile réussit", async () => {
    const result = await submitMandateFunnelAction(validInput());

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.appreciation).toBeTypeOf("string");
    expect(h.verify).toHaveBeenCalledOnce();
    expect(h.rpc).toHaveBeenCalledOnce();
    expect(h.rpc).toHaveBeenCalledWith("submit_mandate_funnel", {
      payload: expect.any(Object),
    });
  });

  it("vérifie avec l'action mandate_submission et le secret serveur", async () => {
    await submitMandateFunnelAction(validInput());
    expect(h.verify).toHaveBeenCalledWith(
      expect.objectContaining({
        secret: "server-secret",
        token: "browser-token",
        expectedAction: "mandate_submission",
      }),
    );
  });

  it("NE dépose PAS dans Supabase lorsque Turnstile échoue (jeton invalide)", async () => {
    h.verify.mockResolvedValue({ ok: false, reason: "invalid-token" });

    const result = await submitMandateFunnelAction(validInput());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("turnstile");
      expect(result.resetChallenge).toBe(true);
    }
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("NE dépose PAS lorsque le jeton est absent", async () => {
    h.verify.mockResolvedValue({ ok: false, reason: "missing-token" });

    const result = await submitMandateFunnelAction(validInput(null));

    expect(result.ok).toBe(false);
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("NE dépose PAS lorsque Turnstile est indisponible (siteverify KO)", async () => {
    h.verify.mockResolvedValue({ ok: false, reason: "unavailable" });

    const result = await submitMandateFunnelAction(validInput());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("turnstile");
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("NE vérifie NI ne dépose lorsque Turnstile n'est pas configuré", async () => {
    h.flags.turnstile = false;

    const result = await submitMandateFunnelAction(validInput());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("unavailable");
    expect(h.verify).not.toHaveBeenCalled();
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("NE vérifie NI ne dépose lorsque Supabase n'est pas configuré", async () => {
    h.flags.supabase = false;

    const result = await submitMandateFunnelAction(validInput());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("unavailable");
    expect(h.verify).not.toHaveBeenCalled();
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("refuse (sans siteverify ni dépôt) si des clés de test sont utilisées en production", async () => {
    h.flags.prodSafe = false;

    const result = await submitMandateFunnelAction(validInput());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("turnstile");
    expect(h.verify).not.toHaveBeenCalled();
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("honeypot rempli : rejeté (schéma), aucune vérif ni dépôt", async () => {
    // Le honeypot `company` est contraint à une chaîne vide par le schéma : une
    // valeur non vide est rejetée avant toute vérification ou dépôt.
    const input = validInput();
    input.answers.company = "rempli-par-un-robot";

    const result = await submitMandateFunnelAction(input);

    expect(result.ok).toBe(false);
    expect(h.verify).not.toHaveBeenCalled();
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("impose le hostname en production quand TURNSTILE_EXPECTED_HOSTNAME est défini", async () => {
    h.env.NODE_ENV = "production";
    h.env.TURNSTILE_EXPECTED_HOSTNAME = "prodigio.fr";

    await submitMandateFunnelAction(validInput());

    expect(h.verify).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedHostname: "prodigio.fr",
        enforceHostname: true,
        allowEmptyAction: false,
      }),
    );
  });

  it("renvoie une erreur générique si la RPC échoue (Turnstile OK)", async () => {
    h.rpc.mockResolvedValue({ data: null, error: { code: "23505" } });

    const result = await submitMandateFunnelAction(validInput());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("error");
    expect(h.rpc).toHaveBeenCalledOnce();
  });
});
