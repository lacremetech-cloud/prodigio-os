import { describe, expect, it } from "vitest";
import { formatCentsToEuros, parseEurosToCents } from "./money";

describe("parseEurosToCents", () => {
  it("renvoie null pour une saisie vide", () => {
    expect(parseEurosToCents("")).toBeNull();
    expect(parseEurosToCents("   ")).toBeNull();
    expect(parseEurosToCents(null)).toBeNull();
    expect(parseEurosToCents(undefined)).toBeNull();
  });

  it("convertit un entier simple en centimes", () => {
    expect(parseEurosToCents("850000")).toBe(85_000_000);
    expect(parseEurosToCents("0")).toBe(0);
  });

  it("tolère les séparateurs de milliers (espaces, insécables, points)", () => {
    expect(parseEurosToCents("850 000")).toBe(85_000_000);
    expect(parseEurosToCents("850 000")).toBe(85_000_000);
    expect(parseEurosToCents("850.000")).toBe(85_000_000);
    expect(parseEurosToCents("1 250 000 €")).toBe(125_000_000);
  });

  it("gère la virgule et le point décimal", () => {
    expect(parseEurosToCents("850000,50")).toBe(85_000_050);
    expect(parseEurosToCents("850000.5")).toBe(85_000_050);
  });

  it("gère milliers + décimale combinés", () => {
    expect(parseEurosToCents("1.250.000,75")).toBe(125_000_075);
    expect(parseEurosToCents("1,250,000.75")).toBe(125_000_075);
  });

  it("renvoie undefined pour une saisie non interprétable", () => {
    expect(parseEurosToCents("abc")).toBeUndefined();
    expect(parseEurosToCents("12,,3")).toBeUndefined();
    expect(parseEurosToCents("-100")).toBeUndefined();
  });
});

describe("formatCentsToEuros", () => {
  it("affiche un montant sans décimales quand elles sont nulles", () => {
    expect(formatCentsToEuros(85_000_000)).toContain("850");
    expect(formatCentsToEuros(85_000_000)).toContain("€");
  });

  it("affiche les décimales quand elles existent", () => {
    expect(formatCentsToEuros(85_000_050)).toMatch(/,50/);
  });

  it("renvoie un tiret pour une valeur absente", () => {
    expect(formatCentsToEuros(null)).toBe("—");
    expect(formatCentsToEuros(undefined)).toBe("—");
  });

  it("est réversible avec parseEurosToCents pour un entier", () => {
    const cents = parseEurosToCents("850 000");
    expect(cents).toBe(85_000_000);
    expect(formatCentsToEuros(cents as number)).toContain("850");
  });
});
