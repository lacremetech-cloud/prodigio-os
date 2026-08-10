import { describe, expect, it } from "vitest";
import { buildBuyerSlackMessage } from "./message";
import type { BuyerSubmissionRequest } from "../funnel/payload";
import { computeBuyerScore } from "../scoring";

function input() {
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
        preference: "telephone",
        recallPreference: "matin",
        consent: true,
      },
      company: "",
    },
    context: {
      idempotencyKey: "buyer-idem-123456",
      originUrl: null,
      referrer: null,
      userAgent: "secret-user-agent",
      firstTouch: null,
      lastTouch: {
        utm_source: "meta",
        utm_medium: "cpc",
        utm_campaign: "villa",
        utm_term: null,
        utm_content: "ad1",
        fbclid: "fb-secret",
        gclid: null,
        url: null,
        referrer: null,
        at: "2026-08-02T10:00:00.000Z",
      },
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
    crmBaseUrl: "https://go.prodigio.fr",
    receivedAt: new Date("2026-08-02T10:05:00.000Z"),
  };
}

describe("buildBuyerSlackMessage", () => {
  it("inclut la propriété, l'identité, les coordonnées et le projet", () => {
    const msg = buildBuyerSlackMessage(input());
    const s = JSON.stringify(msg);
    expect(s).toContain("Villa Belvédère");
    expect(s).toContain("Léa Bernard");
    expect(s).toContain("lea.bernard@example.com");
    expect(s).toContain("+33 6 25 77 35 92");
    expect(s).toContain("Résidence principale");
  });

  it("porte un lien profond vers l'intérêt dans Prodigio OS", () => {
    const msg = buildBuyerSlackMessage(input());
    const s = JSON.stringify(msg);
    expect(s).toContain("/crm/biens/prop-xyz?interet=int-abc");
  });

  it("n'expose JAMAIS le user agent, fbclid, ni le JSON brut", () => {
    const s = JSON.stringify(buildBuyerSlackMessage(input()));
    expect(s).not.toContain("secret-user-agent");
    expect(s).not.toContain("fb-secret");
    expect(s).not.toContain("raw_answers");
  });

  it("montre le score interne (Slack interne), jamais côté visiteur", () => {
    const s = JSON.stringify(buildBuyerSlackMessage(input()));
    expect(s).toContain("Score global");
  });
});
