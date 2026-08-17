import { describe, expect, it } from "vitest";
import {
  budgetBandBounds,
  centsToEuros,
  eurosToCents,
  formatBudgetRange,
  parseList,
} from "./criteria";

/**
 * ⚠️ Ces bornes doivent rester le MIROIR EXACT de `public.buyer_band_bounds`
 * en base (elles-mêmes alignées sur `compute_buyer_scores`). Toute divergence
 * ferait diverger l'amorçage des critères et l'affichage.
 */
describe("budgetBandBounds — miroir des bornes SQL", () => {
  it("reprend les bornes de chaque tranche du funnel", () => {
    expect(budgetBandBounds("moins_800k")).toEqual({ minCents: 0, maxCents: 80_000_000 });
    expect(budgetBandBounds("800k_1_2m")).toEqual({
      minCents: 80_000_000,
      maxCents: 120_000_000,
    });
    expect(budgetBandBounds("1_2m_2m")).toEqual({
      minCents: 120_000_000,
      maxCents: 200_000_000,
    });
    expect(budgetBandBounds("2m_3m")).toEqual({
      minCents: 200_000_000,
      maxCents: 300_000_000,
    });
  });

  it("laisse la tranche haute non bornée (jamais de plafond inventé)", () => {
    expect(budgetBandBounds("plus_3m")).toEqual({ minCents: 300_000_000, maxCents: null });
  });

  it("n'invente aucune borne pour « à définir » ou une valeur inconnue", () => {
    expect(budgetBandBounds("a_definir")).toEqual({ minCents: null, maxCents: null });
    expect(budgetBandBounds(null)).toEqual({ minCents: null, maxCents: null });
    expect(budgetBandBounds("inconnu")).toEqual({ minCents: null, maxCents: null });
  });

  it("les tranches se chaînent sans trou", () => {
    const chain = ["moins_800k", "800k_1_2m", "1_2m_2m", "2m_3m", "plus_3m"];
    for (let i = 0; i < chain.length - 1; i += 1) {
      expect(budgetBandBounds(chain[i]!).maxCents).toBe(budgetBandBounds(chain[i + 1]!).minCents);
    }
  });
});

describe("conversions euros / centimes", () => {
  it("convertit sans perte de précision", () => {
    expect(eurosToCents(1_200_000)).toBe(120_000_000);
    expect(centsToEuros(120_000_000)).toBe(1_200_000);
  });

  it("préserve l'absence de valeur", () => {
    expect(eurosToCents(null)).toBeNull();
    expect(centsToEuros(undefined)).toBeNull();
  });
});

describe("formatBudgetRange — distingue « non renseigné » d'une vraie borne", () => {
  it("affiche une fourchette complète", () => {
    const text = formatBudgetRange(120_000_000, 200_000_000);
    expect(text).toContain("–");
  });

  it("nomme explicitement une borne unique", () => {
    expect(formatBudgetRange(300_000_000, null)).toContain("À partir de");
    expect(formatBudgetRange(null, 80_000_000)).toContain("Jusqu’à");
  });

  it("n'invente pas de fourchette quand rien n'est renseigné", () => {
    expect(formatBudgetRange(null, null)).toBe("Budget non renseigné");
  });
});

describe("parseList", () => {
  it("découpe sur virgules, points-virgules et retours à la ligne", () => {
    expect(parseList("villa, chalet; domaine\nappartement")).toEqual([
      "villa",
      "chalet",
      "domaine",
      "appartement",
    ]);
  });

  it("dédoublonne et ignore les entrées vides", () => {
    expect(parseList("villa, , villa,  ")).toEqual(["villa"]);
  });

  it("met les localisations en minuscules (comparaison explicite en base)", () => {
    expect(parseList("Megève, COURCHEVEL", true)).toEqual(["megève", "courchevel"]);
  });

  it("préserve la casse quand ce n'est pas demandé", () => {
    expect(parseList("Megève")).toEqual(["Megève"]);
  });
});
