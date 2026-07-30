import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `slack.ts` importe "server-only" (garde de bundle) : neutralisé pour les tests.
vi.mock("server-only", () => ({}));

import { notifyNewMandateSubmission } from "./notify";
import type { NotifyDeps } from "./notify";
import type { Env } from "@/config";
import type { SubmissionRequest } from "../funnel/payload";
import { scoreFromAnswers } from "../scoring";

const WEBHOOK = "https://hooks.slack.com/services/T000/B000/XXXXXXXX";

function envWith(webhook: string | undefined): Env {
  return {
    NODE_ENV: "production",
    SLACK_MANDATES_WEBHOOK_URL: webhook,
    NEXT_PUBLIC_SITE_URL: undefined,
  } as unknown as Env;
}

function makeInput() {
  const request: SubmissionRequest = {
    answers: {
      propertyType: "villa_architecte",
      location: { city: "Annecy", postalCode: "74000", country: "France" },
      valueBand: "plus_2m",
      saleHorizon: "des_que_possible",
      mandateSituation: "mandat_simple",
      contact: {
        firstName: "Marie",
        lastName: "Dupont",
        phoneRaw: "06 25 77 35 92",
        phoneCountry: "FR",
        emailRaw: "marie.dupont@example.com",
        preference: "telephone",
        recallPreference: "matin",
        consent: true,
      },
      company: "",
    } as SubmissionRequest["answers"],
    context: {
      idempotencyKey: "idem-xyz",
      originUrl: null,
      referrer: null,
      userAgent: null,
      firstTouch: null,
      lastTouch: null,
      variant: null,
      submittedAt: "2026-07-30T12:00:00.000Z",
    },
  };
  return {
    request,
    score: scoreFromAnswers(request.answers),
    opportunityId: "opp-123",
  };
}

function okResponse() {
  return { ok: true, status: 200 } as Response;
}
function statusResponse(status: number) {
  return { ok: status >= 200 && status < 300, status } as Response;
}

let infoSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

const base: Partial<NotifyDeps> = { now: new Date("2026-07-30T12:00:00.000Z") };

describe("notifyNewMandateSubmission", () => {
  it("désactivé proprement quand le webhook est absent (preview/dev) — aucun appel", async () => {
    const fetchImpl = vi.fn();
    const res = await notifyNewMandateSubmission(makeInput(), {
      ...base,
      env: envWith(undefined),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(res.status).toBe("skipped");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("production avec webhook : transport activé, une seule requête, statut envoyé", async () => {
    const fetchImpl = vi.fn(async () => okResponse());
    const res = await notifyNewMandateSubmission(makeInput(), {
      ...base,
      env: envWith(WEBHOOK),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(res.status).toBe("sent");
    expect(res.attempts).toBe(1);
    expect(fetchImpl).toHaveBeenCalledOnce();
    const call = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[0]).toBe(WEBHOOK);
    expect(call[1].method).toBe("POST");
    // Le corps est bien un message Block Kit.
    const body = JSON.parse(call[1].body as string);
    expect(body.blocks).toBeInstanceOf(Array);
  });

  it("Slack indisponible (5xx) : réessaie puis échoue, sans jamais lever", async () => {
    const fetchImpl = vi.fn(async () => statusResponse(503));
    const res = await notifyNewMandateSubmission(makeInput(), {
      ...base,
      env: envWith(WEBHOOK),
      fetchImpl: fetchImpl as unknown as typeof fetch,
      maxAttempts: 2,
    });
    expect(res.status).toBe("failed");
    expect(res.attempts).toBe(2);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("erreur réseau : réessaie puis échoue, sans lever", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("network down");
    });
    const res = await notifyNewMandateSubmission(makeInput(), {
      ...base,
      env: envWith(WEBHOOK),
      fetchImpl: fetchImpl as unknown as typeof fetch,
      maxAttempts: 2,
    });
    expect(res.status).toBe("failed");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("timeout : la requête est abandonnée et l'envoi échoue sans lever", async () => {
    const fetchImpl = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );
    const res = await notifyNewMandateSubmission(makeInput(), {
      ...base,
      env: envWith(WEBHOOK),
      fetchImpl: fetchImpl as unknown as typeof fetch,
      maxAttempts: 1,
      timeoutMs: 10,
    });
    expect(res.status).toBe("failed");
  });

  it("erreur client (4xx) : pas de réessai (payload invalide)", async () => {
    const fetchImpl = vi.fn(async () => statusResponse(400));
    const res = await notifyNewMandateSubmission(makeInput(), {
      ...base,
      env: envWith(WEBHOOK),
      fetchImpl: fetchImpl as unknown as typeof fetch,
      maxAttempts: 3,
    });
    expect(res.status).toBe("failed");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("ne journalise JAMAIS de coordonnées ni le webhook", async () => {
    const fetchImpl = vi.fn(async () => okResponse());
    await notifyNewMandateSubmission(makeInput(), {
      ...base,
      env: envWith(WEBHOOK),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const logged = JSON.stringify([
      ...infoSpy.mock.calls,
      ...errorSpy.mock.calls,
    ]);
    expect(logged).not.toContain("marie.dupont@example.com");
    expect(logged).not.toContain("Marie");
    expect(logged).not.toContain("35 92");
    expect(logged).not.toContain("hooks.slack.com");
    // Seul un identifiant interne est présent.
    expect(logged).toContain("opp-123");
  });
});
