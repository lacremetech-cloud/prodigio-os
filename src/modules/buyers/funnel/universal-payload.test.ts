import { describe, expect, it } from "vitest";
import { buildUniversalPayload, universalSubmissionRequestSchema } from "./universal-payload";
import { UNIVERSAL_FUNNEL_VERSION } from "./universal";

const BASE = {
  slug: "villa-jean-jaures",
  answers: {
    budgetChoice: "1m_2m" as const,
    firstName: "  Camille ",
    lastName: "Durand",
    emailRaw: "  Camille.Durand@Example.TEST ",
    phoneRaw: "06 12 34 56 78",
    phoneCountry: "FR",
  },
  context: {
    idempotencyKey: "abcdefgh12345678",
    originUrl: "https://villa-jeanjaures-cassis.vercel.app/brochure/",
    referrer: "https://www.facebook.com/",
    userAgent: "Mozilla/5.0",
    firstTouch: null,
    lastTouch: {
      utm_source: "meta",
      utm_medium: "paid",
      utm_campaign: "jj-sept",
      utm_term: null,
      utm_content: "video-a",
      fbclid: "abc123",
      gclid: null,
      url: "https://villa-jeanjaures-cassis.vercel.app/?fbclid=abc123",
      referrer: "https://www.facebook.com/",
      at: "2026-09-22T09:00:00.000Z",
    },
    submittedAt: "2026-09-22T09:01:00.000Z",
  },
};

function build(overrides: Record<string, unknown> = {}) {
  const parsed = universalSubmissionRequestSchema.parse({
    ...BASE,
    ...overrides,
    answers: { ...BASE.answers, ...(overrides.answers as object | undefined) },
  });
  return buildUniversalPayload(parsed);
}

describe("buildUniversalPayload", () => {
  it("envoie la réponse dans budget_choice et JAMAIS dans budget_band", () => {
    const payload = build();
    expect(payload.budget_choice).toBe("1m_2m");
    expect(payload.budget_band).toBeUndefined();
  });

  it("transmet « aucun projet » tel quel — c'est une réponse, pas une absence", () => {
    expect(build({ answers: { budgetChoice: "aucun_projet" } }).budget_choice).toBe("aucun_projet");
  });

  it("sépare la valeur brute (preuve) de la valeur normalisée (dédoublonnage)", () => {
    const payload = build();
    expect(payload.contact_email_raw).toBe("  Camille.Durand@Example.TEST ".trim());
    expect(payload.contact_email).toBe("camille.durand@example.test");
    expect(payload.contact_first_name).toBe("Camille");
  });

  it("conserve l'attribution complète : UTM, fbclid, origine, referrer, touches", () => {
    const payload = build();
    expect(payload.utm_source).toBe("meta");
    expect(payload.utm_campaign).toBe("jj-sept");
    expect(payload.utm_content).toBe("video-a");
    expect(payload.fbclid).toBe("abc123");
    expect(payload.origin_url).toBe(BASE.context.originUrl);
    expect(payload.referrer).toBe("https://www.facebook.com/");
    expect(payload.last_touch).toEqual(BASE.context.lastTouch);
  });

  it("marque sa propre version de funnel", () => {
    expect(build().funnel_version).toBe(UNIVERSAL_FUNNEL_VERSION);
  });

  it("ne fabrique AUCUN consentement marketing", () => {
    const payload = build();
    // `false` est la seule valeur honnête : rien n'a été demandé.
    expect(payload.consent_given).toBe(false);
    const proof = payload.consent_proof as Record<string, unknown>;
    expect(proof.given).toBe(false);
    expect(proof.marketing_consent_requested).toBe(false);
    // La distinction « refusé » / « jamais demandé » est écrite noir sur blanc,
    // parce que `privacy_records.choice` ne sait pas la porter.
    expect(String(proof.note)).toMatch(/jamais|aucun/i);
  });

  it("ne laisse pas un client fabriquer un accord marketing", () => {
    const payload = build({ answers: { marketingOptIn: true } });
    expect(payload.consent_given).toBe(false);
    expect(JSON.stringify(payload)).not.toContain("marketing_opt_in");
  });

  it("garde la trace de la notice affichée", () => {
    const payload = build();
    expect(payload.consent_notice_version).toBeTruthy();
    expect(String(payload.consent_notice_text)).toContain("brochure");
    // Courte : une information, pas un pavé juridique.
    expect(String(payload.consent_notice_text).length).toBeLessThan(220);
  });
});
