import { describe, expect, it } from "vitest";
import {
  arrondi,
  centimesArrondis,
  decimal,
  divise,
  egal,
  entier,
  eurosArrondis,
  fois,
  fraction,
  moins,
  plus,
  pourcent,
  somme,
} from "./exact";

const b = (x: number) => BigInt(x);

describe("fractions exactes", () => {
  it("se réduisent et gardent un dénominateur positif", () => {
    expect(fraction(b(6), b(-8))).toEqual({ n: b(-3), d: b(4) });
    expect(fraction(b(0), b(5))).toEqual({ n: b(0), d: b(1) });
  });

  it("refusent la division par zéro", () => {
    expect(() => fraction(b(1), b(0))).toThrow(RangeError);
    expect(() => divise(entier(1), entier(0))).toThrow(RangeError);
  });

  it("calculent sans perte : 1/3 + 1/3 + 1/3 = 1", () => {
    const tiers = fraction(b(1), b(3));
    expect(egal(somme([tiers, tiers, tiers]), entier(1))).toBe(true);
    expect(egal(moins(plus(tiers, tiers), tiers), tiers)).toBe(true);
    expect(egal(fois(tiers, entier(3)), entier(1))).toBe(true);
  });

  it("refusent un entier non sûr plutôt que de l'approcher", () => {
    expect(() => entier(0.5)).toThrow(RangeError);
  });
});

describe("décimaux lus en base", () => {
  it("lisent un nombre JSON à la précision de la colonne", () => {
    expect(decimal(3.75, 4)).toEqual({ n: b(15), d: b(4) });
    // 0,1 n'a pas d'écriture binaire exacte ; relu à 2 décimales, il redevient 1/10.
    expect(decimal(0.1, 2)).toEqual({ n: b(1), d: b(10) });
  });

  it("lisent un numeric renvoyé en texte", () => {
    expect(decimal("3.7500", 4)).toEqual({ n: b(15), d: b(4) });
    expect(decimal("70.00", 2)).toEqual({ n: b(70), d: b(1) });
  });

  it("laissent manquant ce qui manque ou ne se lit pas", () => {
    expect(decimal(null, 2)).toBeNull();
    expect(decimal(undefined, 2)).toBeNull();
    expect(decimal("abc", 2)).toBeNull();
    expect(decimal("3,75", 2)).toBeNull();
    expect(decimal(Number.NaN, 2)).toBeNull();
  });

  it("refusent un texte plus précis que la colonne", () => {
    expect(decimal("3.75001", 4)).toBeNull();
  });

  it("un pourcentage devient un taux", () => {
    expect(egal(pourcent(entier(20)), fraction(b(1), b(5)))).toBe(true);
  });
});

describe("l'arrondi, seulement à l'affichage", () => {
  it("demi arrondi en s'éloignant de zéro", () => {
    expect(arrondi(fraction(b(5), b(2)))).toBe(b(3));
    expect(arrondi(fraction(b(-5), b(2)))).toBe(b(-3));
    expect(arrondi(fraction(b(7), b(3)))).toBe(b(2));
    expect(arrondi(fraction(b(8), b(3)))).toBe(b(3));
  });

  it("au centime et à l'euro, depuis des centimes exacts", () => {
    const x = fraction(b(134_939_759_036), b(1000)); // 134 939 759,036 centimes
    expect(centimesArrondis(x)).toBe(134_939_759);
    expect(eurosArrondis(x)).toBe(1_349_398);
    expect(eurosArrondis(entier(50))).toBe(1); // 0,50 € → 1 €
    expect(eurosArrondis(entier(49))).toBe(0);
  });
});
