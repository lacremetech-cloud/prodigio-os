import { describe, expect, it } from "vitest";
import { isValidPhone, normalizePhone } from "./normalize";
import { validateFunnelAnswers } from "./validate";

/**
 * Reproduit la saisie réelle du formulaire de production (bien premium, contact
 * français avec +33) et couvre la cause racine « aucun POST » : un honeypot
 * `company` rempli par l'autofill bloquait la soumission.
 */

const answers = (over: Record<string, unknown> = {}) => ({
  propertyType: "appartement_exception",
  location: { city: "Paris", postalCode: "75008", country: "France" },
  valueBand: "plus_2m",
  saleHorizon: "des_que_possible",
  mandateSituation: "aucun_mandat",
  contact: {
    firstName: "Rayyân",
    lastName: "Djeridi",
    phoneRaw: "06 25 77 35 92",
    phoneCountry: "FR",
    emailRaw: "rayyan@indescale.com",
    preference: "telephone",
    recallPreference: "des_que_possible",
    consent: true,
  },
  company: "",
  ...over,
});

describe("Téléphone français (+33) — toutes les saisies plausibles sont valides", () => {
  const cases = [
    "06 25 77 35 92",
    "+33 6 25 77 35 92",
    "+33625773592",
    "0033 6 25 77 35 92",
    "06.25.77.35.92",
    "06-25-77-35-92",
  ];
  for (const phone of cases) {
    it(`« ${phone} » (FR) est valide et se normalise en E.164`, () => {
      expect(isValidPhone(phone, "FR")).toBe(true);
      expect(normalizePhone(phone, "FR")).toBe("+33625773592");
    });

    it(`« ${phone} » ne bloque pas la soumission`, () => {
      const contact = { ...answers().contact, phoneRaw: phone };
      const result = validateFunnelAnswers(answers({ contact }));
      expect(result.ok).toBe(true);
    });
  }
});

describe("Honeypot rempli par autofill — ne bloque plus la soumission", () => {
  it("une soumission valide et honeypot vide passe (sans neutralisation)", () => {
    const result = validateFunnelAnswers(answers());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.honeypotNeutralized).toBe(false);
      expect(result.data.company).toBe("");
    }
  });

  it("honeypot `company` rempli (autofill) est neutralisé, la soumission passe", () => {
    const result = validateFunnelAnswers(answers({ company: "Indescale SAS" }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.honeypotNeutralized).toBe(true);
      // Le champ leurre est vidé avant transmission au serveur.
      expect(result.data.company).toBe("");
    }
  });

  it("une VRAIE erreur de champ n'est PAS masquée par la neutralisation du honeypot", () => {
    const contact = { ...answers().contact, emailRaw: "pas-un-email" };
    const result = validateFunnelAnswers(answers({ contact, company: "Indescale" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // L'erreur e-mail est bien remontée (chemin aligné sur le champ visible).
      expect(result.fieldErrors["contact.emailRaw"]).toBeTruthy();
    }
  });

  it("un e-mail invalide seul renvoie une erreur ciblée (pas de POST)", () => {
    const contact = { ...answers().contact, emailRaw: "x@y" };
    const result = validateFunnelAnswers(answers({ contact }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors["contact.emailRaw"]).toBeTruthy();
    }
  });
});
