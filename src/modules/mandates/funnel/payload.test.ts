import { describe, expect, it } from "vitest";
import { buildTouch } from "./attribution";
import {
  buildSubmissionPayload,
  submissionRequestSchema,
  submitActionInputSchema,
} from "./payload";

interface PayloadShape {
  idempotency_key: string;
  funnel_version: string;
  property_type: string;
  contact_email: string | null;
  contact_email_raw: string;
  contact_phone: string | null;
  contact_phone_raw: string;
  consent_given: boolean;
  consent_notice_version: string;
  utm_source: string | null;
  utm_campaign: string | null;
  first_touch: unknown;
  last_touch: unknown;
  consent_proof: { given: boolean; notice_version: string };
  contact_recall_preference: string;
  raw_answers: {
    contact: {
      phone: string;
      phone_country: string;
      email: string;
      recall_preference: string;
    };
  };
  normalized_answers: {
    contact: { phone: string | null; phone_country: string; email: string | null };
  };
}

function buildRequest(overrides?: {
  preference?: "telephone" | "email" | "indifferent";
}) {
  const first = buildTouch(
    "https://prodigio.example/proprietaire?utm_source=meta&utm_campaign=chalets",
    "https://facebook.com/",
    "2026-07-01T00:00:00.000Z",
  );
  const last = buildTouch(
    "https://prodigio.example/proprietaire?utm_source=google&utm_campaign=villas",
    null,
    "2026-07-10T00:00:00.000Z",
  );

  return submissionRequestSchema.parse({
    answers: {
      propertyType: "villa_architecte",
      location: { city: "Montpellier", postalCode: "34000", country: "France" },
      valueBand: "1_2m_2m",
      saleHorizon: "trois_mois",
      mandateSituation: "aucun_mandat",
      contact: {
        firstName: "Jean",
        lastName: "Dupont",
        phoneRaw: "06 12 34 56 78",
        emailRaw: "Jean.Dupont@Example.com",
        preference: overrides?.preference,
        recallPreference: "matin",
        consent: true,
      },
      company: "",
    },
    context: {
      idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
      originUrl: "https://prodigio.example/proprietaire/analyse",
      referrer: "https://facebook.com/",
      userAgent: "vitest",
      firstTouch: first,
      lastTouch: last,
      variant: null,
      submittedAt: "2026-07-10T00:05:00.000Z",
    },
  });
}

describe("buildSubmissionPayload", () => {
  it("porte la clé d'idempotence et la version du funnel", () => {
    const p = buildSubmissionPayload(buildRequest()) as unknown as PayloadShape;
    expect(p.idempotency_key).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(p.funnel_version).toBe("v1");
    expect(p.property_type).toBe("villa_architecte");
  });

  it("porte la préférence de rappel (plat + réponses brutes)", () => {
    const p = buildSubmissionPayload(buildRequest()) as unknown as PayloadShape;
    expect(p.contact_recall_preference).toBe("matin");
    expect(p.raw_answers.contact.recall_preference).toBe("matin");
  });

  it("sépare la valeur brute et la valeur normalisée", () => {
    const p = buildSubmissionPayload(buildRequest()) as unknown as PayloadShape;
    // Brut conservé
    expect(p.contact_phone_raw).toBe("06 12 34 56 78");
    expect(p.contact_email_raw).toBe("Jean.Dupont@Example.com");
    expect(p.raw_answers.contact.phone).toBe("06 12 34 56 78");
    // Normalisé E.164 pour dédoublonnage
    expect(p.contact_phone).toBe("+33612345678");
    expect(p.contact_email).toBe("jean.dupont@example.com");
    expect(p.normalized_answers.contact.phone).toBe("+33612345678");
    expect(p.normalized_answers.contact.email).toBe("jean.dupont@example.com");
  });

  it("capture le pays du téléphone (défaut FR) dans les réponses", () => {
    const p = buildSubmissionPayload(buildRequest()) as unknown as PayloadShape;
    expect(p.raw_answers.contact.phone_country).toBe("FR");
    expect(p.normalized_answers.contact.phone_country).toBe("FR");
  });

  it("enregistre le consentement et sa version de notice", () => {
    const p = buildSubmissionPayload(buildRequest()) as unknown as PayloadShape;
    expect(p.consent_given).toBe(true);
    expect(p.consent_notice_version).toBe("v1-2026-07");
  });

  it("reprend l'attribution du dernier contact et conserve premier/dernier", () => {
    const p = buildSubmissionPayload(buildRequest()) as unknown as PayloadShape;
    expect(p.utm_source).toBe("google"); // dernier contact
    expect(p.utm_campaign).toBe("villas");
    expect(p.first_touch).not.toBeNull();
    expect(p.last_touch).not.toBeNull();
  });

  it("transmet la preuve de consentement (les canaux/finalité sont fixés côté SQL)", () => {
    const p = buildSubmissionPayload(buildRequest()) as unknown as PayloadShape;
    expect(p.consent_proof.given).toBe(true);
    expect(p.consent_proof.notice_version).toBe("v1-2026-07");
    // Les canaux autorisés ne sont plus dérivés côté client (dérivés en SQL).
    expect(
      (buildSubmissionPayload(buildRequest()) as Record<string, unknown>)
        .authorized_channels,
    ).toBeUndefined();
  });

  it("n'inscrit JAMAIS le jeton Turnstile dans le payload persistant", () => {
    const token = "TURNSTILE.SECRET.TOKEN.MUST.NOT.LEAK.0123456789";
    const parsed = submitActionInputSchema.parse({
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
        submittedAt: "2026-07-10T00:00:00.000Z",
      },
      turnstileToken: token,
    });

    // Le jeton est bien porté à part…
    expect(parsed.turnstileToken).toBe(token);

    // …mais n'apparaît nulle part dans le payload envoyé à Supabase.
    const payload = buildSubmissionPayload({
      answers: parsed.answers,
      context: parsed.context,
    });
    expect(JSON.stringify(payload).includes(token)).toBe(false);
    expect("turnstileToken" in (payload as object)).toBe(false);
    expect("turnstile_token" in (payload as object)).toBe(false);
  });
});
