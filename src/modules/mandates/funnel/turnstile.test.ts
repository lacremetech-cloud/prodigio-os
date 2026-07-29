import { describe, expect, it, vi } from "vitest";
import {
  TURNSTILE_ACTION,
  TURNSTILE_SITEVERIFY_URL,
  verifyTurnstileToken,
  type SiteverifyResponse,
} from "./turnstile";

/** Fabrique une `Response`-like minimale pour l'injection de fetch. */
function jsonResponse(body: SiteverifyResponse, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

function fetchReturning(body: SiteverifyResponse, ok = true) {
  return vi.fn(async () => jsonResponse(body, ok));
}

const OK_BODY: SiteverifyResponse = {
  success: true,
  action: TURNSTILE_ACTION,
  hostname: "prodigio.fr",
  "error-codes": [],
};

describe("verifyTurnstileToken", () => {
  it("accepte un jeton valide (action et hostname corrects)", async () => {
    const fetchImpl = fetchReturning(OK_BODY);
    const result = await verifyTurnstileToken({
      secret: "server-secret",
      token: "valid-token",
      expectedAction: TURNSTILE_ACTION,
      expectedHostname: "prodigio.fr",
      enforceHostname: true,
      fetchImpl,
    });
    expect(result).toEqual({ ok: true, hostname: "prodigio.fr", action: TURNSTILE_ACTION });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("refuse un jeton absent SANS appeler siteverify", async () => {
    const fetchImpl = fetchReturning(OK_BODY);
    for (const token of [null, undefined, ""]) {
      const result = await verifyTurnstileToken({
        secret: "server-secret",
        token,
        fetchImpl,
      });
      expect(result).toEqual({ ok: false, reason: "missing-token" });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refuse un jeton invalide (success=false)", async () => {
    const result = await verifyTurnstileToken({
      secret: "s",
      token: "bad",
      fetchImpl: fetchReturning({
        success: false,
        "error-codes": ["invalid-input-response"],
      }),
    });
    expect(result).toEqual({ ok: false, reason: "invalid-token" });
  });

  it("distingue un jeton expiré / déjà utilisé (timeout-or-duplicate)", async () => {
    const result = await verifyTurnstileToken({
      secret: "s",
      token: "dup",
      fetchImpl: fetchReturning({
        success: false,
        "error-codes": ["timeout-or-duplicate"],
      }),
    });
    expect(result).toEqual({ ok: false, reason: "duplicate-or-expired" });
  });

  it("traite « token-already-spent » comme déjà utilisé", async () => {
    const result = await verifyTurnstileToken({
      secret: "s",
      token: "spent",
      fetchImpl: fetchReturning({
        success: false,
        "error-codes": ["token-already-spent"],
      }),
    });
    expect(result).toEqual({ ok: false, reason: "duplicate-or-expired" });
  });

  it("refuse une action qui ne correspond pas", async () => {
    const result = await verifyTurnstileToken({
      secret: "s",
      token: "t",
      expectedAction: TURNSTILE_ACTION,
      fetchImpl: fetchReturning({
        success: true,
        action: "autre_action",
        hostname: "prodigio.fr",
      }),
    });
    expect(result).toEqual({ ok: false, reason: "action-mismatch" });
  });

  it("refuse un hostname incorrect lorsque le contrôle est imposé", async () => {
    const result = await verifyTurnstileToken({
      secret: "s",
      token: "t",
      expectedAction: TURNSTILE_ACTION,
      expectedHostname: "prodigio.fr",
      enforceHostname: true,
      fetchImpl: fetchReturning({
        success: true,
        action: TURNSTILE_ACTION,
        hostname: "phishing.example",
      }),
    });
    expect(result).toEqual({ ok: false, reason: "hostname-mismatch" });
  });

  it("n'impose PAS le hostname lorsque enforceHostname est faux", async () => {
    const result = await verifyTurnstileToken({
      secret: "s",
      token: "t",
      expectedAction: TURNSTILE_ACTION,
      expectedHostname: "prodigio.fr",
      enforceHostname: false,
      fetchImpl: fetchReturning({
        success: true,
        action: TURNSTILE_ACTION,
        hostname: "localhost",
      }),
    });
    expect(result.ok).toBe(true);
  });

  it("tolère une action vide UNIQUEMENT si allowEmptyAction (clés de test)", async () => {
    const body: SiteverifyResponse = { success: true, action: "", hostname: "" };

    const tolerated = await verifyTurnstileToken({
      secret: "s",
      token: "t",
      expectedAction: TURNSTILE_ACTION,
      allowEmptyAction: true,
      fetchImpl: fetchReturning(body),
    });
    expect(tolerated.ok).toBe(true);

    const rejected = await verifyTurnstileToken({
      secret: "s",
      token: "t",
      expectedAction: TURNSTILE_ACTION,
      allowEmptyAction: false,
      fetchImpl: fetchReturning(body),
    });
    expect(rejected).toEqual({ ok: false, reason: "action-mismatch" });
  });

  it("renvoie « unavailable » sur timeout (abort)", async () => {
    const fetchImpl = vi.fn(
      (_url: string, init?: { signal?: AbortSignal }) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    ) as unknown as typeof fetch;

    const result = await verifyTurnstileToken({
      secret: "s",
      token: "t",
      timeoutMs: 5,
      fetchImpl,
    });
    expect(result).toEqual({ ok: false, reason: "unavailable" });
  });

  it("renvoie « unavailable » sur erreur réseau", async () => {
    const result = await verifyTurnstileToken({
      secret: "s",
      token: "t",
      fetchImpl: vi.fn(async () => {
        throw new Error("network down");
      }) as unknown as typeof fetch,
    });
    expect(result).toEqual({ ok: false, reason: "unavailable" });
  });

  it("renvoie « unavailable » sur réponse HTTP non 2xx", async () => {
    const result = await verifyTurnstileToken({
      secret: "s",
      token: "t",
      fetchImpl: fetchReturning({ success: true }, false),
    });
    expect(result).toEqual({ ok: false, reason: "unavailable" });
  });

  it("appelle le bon endpoint et transmet secret + response en form-urlencoded", async () => {
    let capturedUrl = "";
    let capturedBody: URLSearchParams | null = null;
    const fetchImpl = vi.fn(async (url: string, init?: { body?: BodyInit }) => {
      capturedUrl = url;
      capturedBody = init?.body as URLSearchParams;
      return jsonResponse(OK_BODY);
    }) as unknown as typeof fetch;

    await verifyTurnstileToken({
      secret: "server-secret",
      token: "the-token",
      expectedAction: TURNSTILE_ACTION,
      fetchImpl,
    });

    expect(capturedUrl).toBe(TURNSTILE_SITEVERIFY_URL);
    expect(capturedBody).toBeInstanceOf(URLSearchParams);
    expect(capturedBody!.get("secret")).toBe("server-secret");
    expect(capturedBody!.get("response")).toBe("the-token");
  });
});
