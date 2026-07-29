import { describe, expect, it } from "vitest";
import {
  normalizeEmail,
  normalizePhone,
  normalizePostalCode,
  normalizeText,
} from "./normalize";

describe("normalizeEmail", () => {
  it("découpe et met en minuscule un e-mail valide", () => {
    expect(normalizeEmail("  Foo.Bar@Example.COM ")).toBe("foo.bar@example.com");
  });

  it("rejette les e-mails invalides", () => {
    expect(normalizeEmail("invalide")).toBeNull();
    expect(normalizeEmail("a@b")).toBeNull(); // pas de point après @
    expect(normalizeEmail("")).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
  });
});

describe("normalizePhone", () => {
  it("normalise un numéro français national en E.164", () => {
    expect(normalizePhone("06 12 34 56 78")).toBe("+33612345678");
    expect(normalizePhone("06.12.34.56.78")).toBe("+33612345678");
  });

  it("conserve un préfixe international", () => {
    expect(normalizePhone("+33 6 12 34 56 78")).toBe("+33612345678");
    expect(normalizePhone("+1 (415) 555-2671")).toBe("+14155552671");
  });

  it("convertit un préfixe 00 en +", () => {
    expect(normalizePhone("0033612345678")).toBe("+33612345678");
  });

  it("suppose la France pour 9 chiffres sans 0 initial", () => {
    expect(normalizePhone("612345678")).toBe("+33612345678");
  });

  it("rejette les entrées manifestement invalides", () => {
    expect(normalizePhone("12")).toBeNull();
    expect(normalizePhone("abc")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });
});

describe("normalizePostalCode", () => {
  it("nettoie et met en majuscules", () => {
    expect(normalizePostalCode(" 34000 ")).toBe("34000");
    expect(normalizePostalCode("gu1 1aa")).toBe("GU1 1AA");
  });

  it("renvoie null pour une entrée vide", () => {
    expect(normalizePostalCode("")).toBeNull();
    expect(normalizePostalCode(null)).toBeNull();
  });
});

describe("normalizeText", () => {
  it("réduit les espaces multiples et découpe", () => {
    expect(normalizeText("  Le   Château  du  Lac ")).toBe("Le Château du Lac");
  });

  it("borne la longueur", () => {
    expect(normalizeText("abcdef", 3)).toBe("abc");
  });

  it("renvoie null pour une entrée vide", () => {
    expect(normalizeText("   ")).toBeNull();
    expect(normalizeText(undefined)).toBeNull();
  });
});
