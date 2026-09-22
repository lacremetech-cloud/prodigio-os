import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Action serveur du formulaire universel. Ce qui compte ici : aucun dépôt sans
 * Turnstile, la brochure jamais délivrée sans intérêt réel, et l'accusé qui
 * reste neutre quoi qu'il arrive.
 */

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  verify: vi.fn(),
  flags: { supabase: true, turnstile: true, prodSafe: true },
}));

vi.mock("@/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config")>();
  return {
    ...actual,
    env: { NODE_ENV: "test", TURNSTILE_SECRET_KEY: "s", TURNSTILE_EXPECTED_HOSTNAME: undefined },
    isSupabaseConfigured: () => h.flags.supabase,
    isTurnstileConfigured: () => h.flags.turnstile,
    isTurnstileProductionSafe: () => h.flags.prodSafe,
  };
});
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ rpc: h.rpc }),
}));
vi.mock("./turnstile", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./turnstile")>();
  return { ...actual, verifyTurnstileToken: h.verify };
});

const { submitUniversalInterestAction } = await import("./universal-submit");

const REQUEST = {
  slug: "villa-jean-jaures",
  answers: {
    budgetChoice: "1m_2m",
    firstName: "Camille",
    lastName: "Durand",
    emailRaw: "camille@example.test",
    phoneRaw: "0612345678",
    phoneCountry: "FR",
    marketingOptIn: false,
  },
  context: { idempotencyKey: "abcdefgh12345678", submittedAt: "2026-09-22T09:00:00.000Z" },
  turnstileToken: "token",
};

beforeEach(() => {
  h.rpc.mockReset();
  h.verify.mockReset();
  h.flags = { supabase: true, turnstile: true, prodSafe: true };
  h.verify.mockResolvedValue({ ok: true });
});

describe("submitUniversalInterestAction", () => {
  it("dépose puis remet la brochure", async () => {
    h.rpc.mockResolvedValueOnce({ data: { accepted: true, created: true, interest_id: "i-1" }, error: null });
    h.rpc.mockResolvedValueOnce({ data: "https://exemple.test/brochure.pdf", error: null });
    const res = await submitUniversalInterestAction(REQUEST);
    expect(res.ok).toBe(true);
    expect(res.ok && res.brochureUrl).toBe("https://exemple.test/brochure.pdf");
    expect(h.rpc.mock.calls[0]?.[0]).toBe("submit_buyer_interest");
    expect(h.rpc.mock.calls[1]?.[0]).toBe("buyer_form_brochure");
  });

  it("aboutit même quand la personne refuse le marketing", async () => {
    h.rpc.mockResolvedValueOnce({ data: { accepted: true, created: true, interest_id: "i-2" }, error: null });
    h.rpc.mockResolvedValueOnce({ data: "https://exemple.test/b.pdf", error: null });
    const res = await submitUniversalInterestAction({
      ...REQUEST,
      answers: { ...REQUEST.answers, marketingOptIn: false },
    });
    expect(res.ok).toBe(true);
    expect(res.ok && res.brochureUrl).toBeTruthy();
  });

  it("ne dépose RIEN si Turnstile refuse", async () => {
    h.verify.mockResolvedValue({ ok: false, reason: "invalid" });
    const res = await submitUniversalInterestAction(REQUEST);
    expect(res.ok).toBe(false);
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("ne réclame aucune brochure quand rien n'a été créé (accusé neutre)", async () => {
    h.rpc.mockResolvedValueOnce({ data: { accepted: true, created: false }, error: null });
    const res = await submitUniversalInterestAction(REQUEST);
    expect(res.ok).toBe(true);
    expect(res.ok && res.brochureUrl).toBeNull();
    expect(h.rpc).toHaveBeenCalledTimes(1);
  });

  it("absorbe silencieusement un pot de miel rempli", async () => {
    const res = await submitUniversalInterestAction({
      ...REQUEST,
      answers: { ...REQUEST.answers, company: "robot" },
    });
    expect(res.ok).toBe(true);
    expect(h.rpc).not.toHaveBeenCalled();
    expect(h.verify).not.toHaveBeenCalled();
  });

  it("refuse un budget étranger au vocabulaire, sans le rapprocher d'un voisin", async () => {
    const res = await submitUniversalInterestAction({
      ...REQUEST,
      answers: { ...REQUEST.answers, budgetChoice: "800k_1_2m" },
    });
    expect(res.ok).toBe(false);
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("refuse une saisie incomplète", async () => {
    const res = await submitUniversalInterestAction({
      ...REQUEST,
      answers: { ...REQUEST.answers, emailRaw: "" },
    });
    expect(res.ok).toBe(false);
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("ne divulgue rien quand la base échoue", async () => {
    h.rpc.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "interdit" } });
    const res = await submitUniversalInterestAction(REQUEST);
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.message).not.toContain("42501");
  });
});
