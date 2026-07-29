import { describe, expect, it } from "vitest";
import { funnelAnswersSchema } from "./schema";

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
