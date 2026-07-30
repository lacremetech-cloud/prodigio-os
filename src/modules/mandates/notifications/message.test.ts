import { describe, expect, it } from "vitest";
import { buildMandateSlackMessage, crmDeepLink, escapeSlack } from "./message";
import type { MandateNotificationInput } from "./message";
import type { SubmissionRequest } from "../funnel/payload";
import { scoreFromAnswers } from "../scoring";

function makeRequest(over?: {
  attribution?: boolean;
  firstName?: string;
  lastName?: string;
}): SubmissionRequest {
  const last = over?.attribution
    ? {
        utm_source: "Meta",
        utm_medium: "cpc",
        utm_campaign: "Acquisition Mandats",
        utm_term: "adset-A",
        utm_content: "creative-42",
        fbclid: "fbx",
        gclid: null,
        url: "https://go.prodigio.fr/proprietaire",
        referrer: null,
        at: "2026-07-30T12:00:00.000Z",
      }
    : null;
  return {
    answers: {
      propertyType: "appartement_exception",
      location: { city: "Montpellier", postalCode: "34000", country: "France" },
      valueBand: "1_2m_2m",
      saleHorizon: "six_mois",
      mandateSituation: "aucun_mandat",
      contact: {
        firstName: over?.firstName ?? "Rayyan",
        lastName: over?.lastName ?? "Djeridi",
        phoneRaw: "06 25 77 35 92",
        phoneCountry: "FR",
        emailRaw: "Rayyan.Djeridi@Example.com",
        preference: "telephone",
        recallPreference: "des_que_possible",
        consent: true,
      },
      company: "",
    } as SubmissionRequest["answers"],
    context: {
      idempotencyKey: "idem-key-secret-123",
      originUrl: "https://go.prodigio.fr/proprietaire/analyse?x=1",
      referrer: "https://facebook.com/",
      userAgent: "SENSITIVE-UA-Mozilla/5.0",
      firstTouch: null,
      lastTouch: last,
      variant: null,
      submittedAt: "2026-07-30T12:00:00.000Z",
    },
  };
}

function build(over?: Parameters<typeof makeRequest>[0]): MandateNotificationInput {
  const request = makeRequest(over);
  return {
    request,
    score: scoreFromAnswers(request.answers),
    opportunityId: "7c0bb596-5f16-42cb-8327-eabf5e36bd59",
    crmBaseUrl: "https://go.prodigio.fr",
    receivedAt: new Date("2026-07-30T12:34:00.000Z"),
  };
}

function serialize(msg: { text: string; blocks: unknown[] }): string {
  return JSON.stringify(msg);
}

describe("crmDeepLink", () => {
  it("construit le lien exact vers la fiche", () => {
    expect(crmDeepLink("https://go.prodigio.fr", "abc-123")).toBe(
      "https://go.prodigio.fr/crm/mandats/abc-123",
    );
    expect(crmDeepLink("https://go.prodigio.fr/", "abc-123")).toBe(
      "https://go.prodigio.fr/crm/mandats/abc-123",
    );
  });
});

describe("buildMandateSlackMessage", () => {
  it("contient l'en-tête et le bouton vers la fiche exacte", () => {
    const msg = buildMandateSlackMessage(build());
    const s = serialize(msg);
    expect(s).toContain("Nouvelle demande de mandat");
    const actions = (msg.blocks as { type: string; elements?: { url?: string; text?: { text?: string } }[] }[]).find(
      (b) => b.type === "actions",
    );
    expect(actions?.elements?.[0]?.url).toBe(
      "https://go.prodigio.fr/crm/mandats/7c0bb596-5f16-42cb-8327-eabf5e36bd59",
    );
    expect(actions?.elements?.[0]?.text?.text).toBe("Ouvrir le dossier dans Prodigio CRM");
  });

  it("présente les coordonnées complètes, téléphone au format international", () => {
    const s = serialize(buildMandateSlackMessage(build()));
    expect(s).toContain("Rayyan Djeridi");
    expect(s).toContain("+33 6 25 77 35 92"); // international, non tronqué
    expect(s).toContain("rayyan.djeridi@example.com"); // e-mail normalisé
  });

  it("présente les réponses du quiz en libellés humains (pas de tokens)", () => {
    const s = serialize(buildMandateSlackMessage(build()));
    expect(s).toContain("Appartement d'exception");
    expect(s).toContain("Montpellier");
    expect(s).toContain("Entre 1,2 et 2 millions d'euros");
    expect(s).toContain("Dans les six prochains mois");
    expect(s).not.toContain("appartement_exception");
    expect(s).not.toContain("1_2m_2m");
  });

  it("présente le scoring et la priorité en libellés humains", () => {
    const input = build();
    const s = serialize(buildMandateSlackMessage(input));
    expect(s).toContain(`${input.score.compatibility.score}/100`);
    expect(s).toContain(`${input.score.maturity.score}/100`);
    // Priorité/appréciation humaines, jamais les codes techniques.
    expect(s).not.toContain("rappel_prioritaire");
    expect(s).not.toContain("fort_potentiel");
    expect(s).toContain("mandate-scoring-v1"); // version de scoring (audit discret)
  });

  it("présente la préférence de contact et de rappel", () => {
    const s = serialize(buildMandateSlackMessage(build()));
    expect(s).toContain("Téléphone");
    expect(s).toContain("Dès que possible");
  });

  it("affiche l'attribution marketing quand elle existe", () => {
    const s = serialize(buildMandateSlackMessage(build({ attribution: true })));
    expect(s).toContain("Acquisition");
    expect(s).toContain("Meta");
    expect(s).toContain("Acquisition Mandats");
    expect(s).toContain("adset-A");
    expect(s).toContain("creative-42");
  });

  it("omet l'attribution quand elle est absente (pas de champs vides)", () => {
    const s = serialize(buildMandateSlackMessage(build({ attribution: false })));
    expect(s).not.toContain("Acquisition —");
  });

  it("n'inclut JAMAIS : user agent, referrer, clé d'idempotence, URL d'origine, consentement", () => {
    const s = serialize(buildMandateSlackMessage(build({ attribution: true })));
    expect(s).not.toContain("SENSITIVE-UA");
    expect(s).not.toContain("idem-key-secret-123");
    expect(s).not.toContain("analyse?x=1");
    expect(s.toLowerCase()).not.toContain("consent");
    expect(s).not.toContain("fbx"); // fbclid non affiché
    expect(s).not.toContain("user_agent");
  });

  it("échappe les valeurs utilisateur (anti-mention / anti-injection)", () => {
    const s = serialize(
      buildMandateSlackMessage(build({ firstName: "<b>", lastName: "A&B <@U123>" })),
    );
    expect(s).toContain("&lt;b&gt;");
    expect(s).toContain("A&amp;B");
    expect(s).not.toContain("<@U123>");
  });
});

describe("escapeSlack", () => {
  it("échappe &, < et > dans le bon ordre", () => {
    expect(escapeSlack("a & b < c > d")).toBe("a &amp; b &lt; c &gt; d");
    expect(escapeSlack("<!channel>")).toBe("&lt;!channel&gt;");
  });
});
