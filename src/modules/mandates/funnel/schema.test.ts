import { describe, expect, it } from "vitest";
import { contactSchema, funnelAnswersSchema } from "./schema";

function validAnswers() {
  return {
    propertyType: "villa_architecte",
    location: { city: "Montpellier", postalCode: "34000", country: "France" },
    valueBand: "1_2m_2m",
    saleHorizon: "trois_mois",
    mandateSituation: "aucun_mandat",
    contact: {
      firstName: "Jean",
      lastName: "Dupont",
      phoneRaw: "06 12 34 56 78",
      emailRaw: "jean@example.com",
      recallPreference: "des_que_possible",
      consent: true,
    },
    company: "",
  };
}

function pathsOf(result: ReturnType<typeof funnelAnswersSchema.safeParse>) {
  if (result.success) return [];
  return result.error.issues.map((i) => i.path.join("."));
}

describe("funnelAnswersSchema", () => {
  it("accepte un parcours complet valide", () => {
    const result = funnelAnswersSchema.safeParse(validAnswers());
    expect(result.success).toBe(true);
  });

  it("exige un type de propriété", () => {
    const data = validAnswers();
    // @ts-expect-error suppression volontaire pour le test
    delete data.propertyType;
    const result = funnelAnswersSchema.safeParse(data);
    expect(result.success).toBe(false);
    expect(pathsOf(result)).toContain("propertyType");
  });

  it("exige un accord explicite (consentement)", () => {
    const data = validAnswers();
    data.contact.consent = false;
    const result = funnelAnswersSchema.safeParse(data);
    expect(result.success).toBe(false);
    expect(pathsOf(result)).toContain("contact.consent");
  });

  it("rejette un honeypot rempli (robot)", () => {
    const data = validAnswers();
    data.company = "Acme SarL";
    const result = funnelAnswersSchema.safeParse(data);
    expect(result.success).toBe(false);
    expect(pathsOf(result)).toContain("company");
  });

  it("rejette un téléphone invalide", () => {
    const data = validAnswers();
    data.contact.phoneRaw = "12";
    const result = funnelAnswersSchema.safeParse(data);
    expect(result.success).toBe(false);
    expect(pathsOf(result)).toContain("contact.phoneRaw");
  });

  it("rejette un e-mail invalide", () => {
    const data = validAnswers();
    data.contact.emailRaw = "pas-un-email";
    const result = funnelAnswersSchema.safeParse(data);
    expect(result.success).toBe(false);
    expect(pathsOf(result)).toContain("contact.emailRaw");
  });

  it("exige une ville", () => {
    const data = validAnswers();
    data.location.city = "";
    const result = funnelAnswersSchema.safeParse(data);
    expect(result.success).toBe(false);
    expect(pathsOf(result)).toContain("location.city");
  });
});

/** Contact isolé (validé dès l'étape 6 : la validité téléphone/e-mail y vit). */
function validContact(overrides: Record<string, unknown> = {}) {
  return {
    firstName: "Jean",
    lastName: "Dupont",
    phoneRaw: "06 25 77 35 92",
    emailRaw: "jean@example.com",
    recallPreference: "des_que_possible",
    consent: true,
    ...overrides,
  };
}

describe("contactSchema — téléphone international", () => {
  it("accepte un numéro français national (France par défaut)", () => {
    const r = contactSchema.safeParse(validContact());
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.phoneCountry).toBe("FR"); // défaut
  });

  it("accepte un numéro français avec la France explicitement sélectionnée", () => {
    const r = contactSchema.safeParse(
      validContact({ phoneRaw: "06 25 77 35 92", phoneCountry: "FR" }),
    );
    expect(r.success).toBe(true);
  });

  it("accepte un numéro international valide (Royaume-Uni sélectionné)", () => {
    const r = contactSchema.safeParse(
      validContact({ phoneRaw: "020 7946 0018", phoneCountry: "GB" }),
    );
    expect(r.success).toBe(true);
  });

  it("accepte un numéro saisi au format international avec « + »", () => {
    const r = contactSchema.safeParse(
      validContact({ phoneRaw: "+44 20 7946 0018", phoneCountry: "FR" }),
    );
    expect(r.success).toBe(true);
  });

  it("rejette un numéro incomplet AVEC un message précis sous le champ", () => {
    const r = contactSchema.safeParse(validContact({ phoneRaw: "06 25 77 35" }));
    expect(r.success).toBe(false);
    if (!r.success) {
      const phoneIssue = r.error.issues.find((i) => i.path.join(".") === "phoneRaw");
      expect(phoneIssue).toBeDefined();
      expect(phoneIssue?.message).toMatch(/valide/i);
    }
  });

  it("rejette une saisie FR interprétée sous un pays incompatible", () => {
    // « 06 25 77 35 92 » n'est pas un numéro valide aux États-Unis.
    const r = contactSchema.safeParse(
      validContact({ phoneRaw: "06 25 77 35 92", phoneCountry: "US" }),
    );
    expect(r.success).toBe(false);
  });

  it("normalise le code pays en majuscules", () => {
    const r = contactSchema.safeParse(validContact({ phoneCountry: "fr" }));
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.phoneCountry).toBe("FR");
  });
});
