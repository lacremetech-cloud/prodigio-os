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
  it("normalise un numéro français national en E.164 (France par défaut)", () => {
    expect(normalizePhone("06 25 77 35 92")).toBe("+33625773592");
    expect(normalizePhone("06.25.77.35.92")).toBe("+33625773592");
    expect(normalizePhone("0625773592")).toBe("+33625773592");
  });

  it("accepte une saisie nationale FR quand la France est sélectionnée", () => {
    expect(normalizePhone("06 25 77 35 92", "FR")).toBe("+33625773592");
    // 9 chiffres sans 0 initial, France sélectionnée.
    expect(normalizePhone("612345678", "FR")).toBe("+33612345678");
  });

  it("conserve un préfixe international quel que soit le pays par défaut", () => {
    expect(normalizePhone("+33 6 25 77 35 92")).toBe("+33625773592");
    expect(normalizePhone("+33 6 25 77 35 92", "US")).toBe("+33625773592");
    expect(normalizePhone("+44 20 7946 0018", "FR")).toBe("+442079460018");
  });

  it("interprète une saisie nationale selon le pays sélectionné", () => {
    expect(normalizePhone("020 7946 0018", "GB")).toBe("+442079460018");
    expect(normalizePhone("212 555 0100", "US")).toBe("+12125550100");
    expect(normalizePhone("044 668 18 00", "CH")).toBe("+41446681800");
  });

  it("convertit un préfixe 00 international en +", () => {
    expect(normalizePhone("0033625773592")).toBe("+33625773592");
  });

  it("rejette un numéro incomplet ou invalide (validation réelle)", () => {
    expect(normalizePhone("06 25 77 35")).toBeNull(); // trop court pour la FR
    expect(normalizePhone("06 25")).toBeNull();
    expect(normalizePhone("12")).toBeNull();
    expect(normalizePhone("abc")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });

  it("rejette une saisie nationale FR interprétée comme US invalide", () => {
    // « 06 25 77 35 92 » n'est pas un numéro valide aux États-Unis.
    expect(normalizePhone("06 25 77 35 92", "US")).toBeNull();
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
