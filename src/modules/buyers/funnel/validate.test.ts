import { describe, expect, it } from "vitest";
import { validateBuyerAnswers } from "./validate";

function valid(overrides: Record<string, unknown> = {}) {
  return {
    projectNature: "residence_secondaire",
    budgetBand: "2m_3m",
    financing: "accord_bancaire",
    purchaseHorizon: "trois_mois",
    availability: "disponible_visite",
    decisionMode: "seul",
    residence: { country: "France", area: "Paris" },
    contact: {
      firstName: "Camille",
      lastName: "Martin",
      phoneRaw: "06 25 77 35 92",
      phoneCountry: "FR",
      emailRaw: "camille.martin@example.com",
      recallPreference: "matin",
      consent: true,
    },
    company: "",
    ...overrides,
  };
}

describe("validateBuyerAnswers", () => {
  it("accepte des réponses complètes valides", () => {
    const res = validateBuyerAnswers(valid());
    expect(res.ok).toBe(true);
  });

  it("neutralise le honeypot rempli par autofill (humain jamais bloqué)", () => {
    const res = validateBuyerAnswers(valid({ company: "ACME Corp" }));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.honeypotNeutralized).toBe(true);
  });

  it("signale un téléphone invalide sur le champ contact.phoneRaw", () => {
    const res = validateBuyerAnswers(valid({ contact: { ...valid().contact, phoneRaw: "12" } }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.fieldErrors["contact.phoneRaw"]).toBeTruthy();
  });

  it("signale un e-mail invalide sur le champ contact.emailRaw", () => {
    const res = validateBuyerAnswers(
      valid({ contact: { ...valid().contact, emailRaw: "pas-un-email" } }),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.fieldErrors["contact.emailRaw"]).toBeTruthy();
  });

  it("exige le consentement (contact.consent)", () => {
    const res = validateBuyerAnswers(valid({ contact: { ...valid().contact, consent: false } }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.fieldErrors["contact.consent"]).toBeTruthy();
  });

  it("rejette une valeur d'énumération inconnue", () => {
    const res = validateBuyerAnswers(valid({ budgetBand: "1_milliard" }));
    expect(res.ok).toBe(false);
  });
});
