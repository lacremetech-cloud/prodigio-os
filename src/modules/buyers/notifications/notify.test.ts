import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `slack.ts` (réutilisé) importe "server-only" : neutralisé pour les tests.
vi.mock("server-only", () => ({}));

import { notifyNewBuyerInterest, type BuyerNotifyDeps } from "./notify";
import type { Env } from "@/config";
import type { BuyerSubmissionRequest } from "../funnel/payload";
import { computeBuyerScore } from "../scoring";

const BUYER_WEBHOOK = "https://hooks.slack.com/services/T000/B000/BUYERS";
const MANDATE_WEBHOOK = "https://hooks.slack.com/services/T000/B000/MANDATES";

function envWith(buyerWebhook: string | undefined): Env {
  return {
    NODE_ENV: "production",
    SLACK_BUYER_LEADS_WEBHOOK_URL: buyerWebhook,
    // Le canal Mandats est présent : il ne doit JAMAIS être réutilisé.
    SLACK_MANDATES_WEBHOOK_URL: MANDATE_WEBHOOK,
    NEXT_PUBLIC_SITE_URL: undefined,
  } as unknown as Env;
}

function makeInput() {
  const request: BuyerSubmissionRequest = {
    slug: "villa-belvedere",
    answers: {
      projectNature: "residence_principale",
      budgetBand: "2m_3m",
      financing: "fonds_propres",
      purchaseHorizon: "immediat",
      availability: "disponible_visite",
      decisionMode: "seul",
      residence: { country: "France", area: "Nice" },
      contact: {
        firstName: "Léa",
        lastName: "Bernard",
        phoneRaw: "06 25 77 35 92",
        phoneCountry: "FR",
        emailRaw: "lea.bernard@example.com",
        recallPreference: "matin",
        consent: true,
      },
      company: "",
    },
    context: {
      idempotencyKey: "buyer-idem-123456",
      originUrl: null,
      referrer: null,
      userAgent: null,
      firstTouch: null,
      lastTouch: null,
      variant: null,
      submittedAt: "2026-08-02T10:05:00.000Z",
    },
  };
  return {
    request,
    score: computeBuyerScore({
      budgetBand: "2m_3m",
      financing: "fonds_propres",
      purchaseHorizon: "immediat",
      projectNature: "residence_principale",
      decisionMode: "seul",
      availability: "disponible_visite",
      referenceValueCents: 240_000_000,
    }),
    interestId: "int-abc",
    propertyId: "prop-xyz",
    propertyName: "Villa Belvédère",
  };
}

const base: Partial<BuyerNotifyDeps> = { now: new Date("2026-08-02T10:05:00.000Z") };

let infoSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("notifyNewBuyerInterest", () => {
  it("désactivé proprement quand le webhook acquéreur est absent — aucun appel", async () => {
    const fetchImpl = vi.fn();
    const res = await notifyNewBuyerInterest(makeInput(), {
      ...base,
      env: envWith(undefined),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(res.status).toBe("skipped");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("utilise le canal DÉDIÉ acquéreurs, jamais le canal Mandats", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200 }) as Response);
    const res = await notifyNewBuyerInterest(makeInput(), {
      ...base,
      env: envWith(BUYER_WEBHOOK),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(res.status).toBe("sent");
    const call = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[0]).toBe(BUYER_WEBHOOK);
    expect(call[0]).not.toBe(MANDATE_WEBHOOK);
  });

  it("panne Slack (5xx) : réessaie puis échoue sans jamais lever (dépôt déjà enregistré)", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 503 }) as Response);
    const res = await notifyNewBuyerInterest(makeInput(), {
      ...base,
      env: envWith(BUYER_WEBHOOK),
      fetchImpl: fetchImpl as unknown as typeof fetch,
      maxAttempts: 2,
    });
    expect(res.status).toBe("failed");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("ne journalise jamais de coordonnées ni le webhook", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200 }) as Response);
    await notifyNewBuyerInterest(makeInput(), {
      ...base,
      env: envWith(BUYER_WEBHOOK),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const logged = JSON.stringify([...infoSpy.mock.calls, ...errorSpy.mock.calls]);
    expect(logged).not.toContain("lea.bernard@example.com");
    expect(logged).not.toContain("hooks.slack.com");
    expect(logged).toContain("int-abc");
  });
});
