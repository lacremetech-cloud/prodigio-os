import { describe, expect, it } from "vitest";
import { buildBuyerPayload, type BuyerSubmissionRequest } from "./payload";
import { BUYER_CONSENT_NOTICE_VERSION } from "./schema";

function request(): BuyerSubmissionRequest {
  return {
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
        firstName: "  Léa ",
        lastName: "Bernard",
        phoneRaw: "06 25 77 35 92",
        phoneCountry: "FR",
        emailRaw: "Lea.Bernard@Example.COM",
        recallPreference: "matin",
        consent: true,
      },
      company: "",
    },
    context: {
      idempotencyKey: "buyer-idem-123456",
      originUrl: "https://go.prodigio.fr/bien/villa-belvedere/interet",
      referrer: null,
      userAgent: "UA",
      firstTouch: null,
      lastTouch: {
        utm_source: "meta",
        utm_medium: "cpc",
        utm_campaign: "villa",
        utm_term: null,
        utm_content: "ad1",
        fbclid: "fb123",
        gclid: null,
        url: "https://go.prodigio.fr/bien/villa-belvedere",
        referrer: null,
        at: "2026-08-02T10:00:00.000Z",
      },
      variant: null,
      submittedAt: "2026-08-02T10:05:00.000Z",
    },
  };
}

describe("buildBuyerPayload", () => {
  it("porte le slug du bien (résolution serveur, publié uniquement)", () => {
    expect(buildBuyerPayload(request()).slug).toBe("villa-belvedere");
  });

  it("conserve BOTH raw et normalized answers (preuve + dédoublonnage)", () => {
    const p = buildBuyerPayload(request()) as {
      raw_answers: { contact: Record<string, unknown> };
      normalized_answers: { contact: Record<string, unknown> };
    };
    const raw = p.raw_answers.contact;
    const norm = p.normalized_answers.contact;
    // Brut : valeur telle que saisie.
    expect(raw.email).toBe("Lea.Bernard@Example.COM");
    expect(raw.first_name).toBe("  Léa ");
    // Normalisé : e-mail minuscule, prénom borné/trim, téléphone E.164.
    expect(norm.email).toBe("lea.bernard@example.com");
    expect(norm.first_name).toBe("Léa");
    expect(norm.phone).toBe("+33625773592");
  });

  it("aplatit les colonnes et l'attribution last-touch", () => {
    const p = buildBuyerPayload(request()) as Record<string, unknown>;
    expect(p.budget_band).toBe("2m_3m");
    expect(p.contact_email).toBe("lea.bernard@example.com");
    expect(p.utm_source).toBe("meta");
    expect(p.utm_content).toBe("ad1");
    expect(p.fbclid).toBe("fb123");
  });

  it("porte la preuve de consentement et la version de notice (jamais le score)", () => {
    const p = buildBuyerPayload(request()) as Record<string, unknown>;
    expect(p.consent_given).toBe(true);
    expect(p.consent_notice_version).toBe(BUYER_CONSENT_NOTICE_VERSION);
    const proof = p.consent_proof as Record<string, unknown>;
    expect(proof.given).toBe(true);
    expect(p).not.toHaveProperty("overall");
    expect(p).not.toHaveProperty("priority");
  });
});
