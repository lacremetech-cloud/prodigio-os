import { describe, expect, it } from "vitest";
import {
  computeBudgetScore,
  computeBuyerPriority,
  computeBuyerScore,
  computeMaturityScore,
  type BuyerScoringInput,
} from "./scoring";
import { BUYER_SCORE_VERSION } from "./config";

const base: BuyerScoringInput = {
  budgetBand: "plus_3m",
  financing: "fonds_propres",
  purchaseHorizon: "immediat",
  projectNature: "residence_principale",
  decisionMode: "seul",
  availability: "disponible_visite",
  referenceValueCents: 240_000_000, // 2,4 M€
};

describe("computeBudgetScore", () => {
  it("neutre (50) quand la référence est inconnue ou tranche « à définir »", () => {
    expect(computeBudgetScore("1_2m_2m", null)).toBe(50);
    expect(computeBudgetScore("a_definir", 240_000_000)).toBe(50);
  });

  it("fort quand la borne basse du budget couvre la référence", () => {
    // 2m_3m : min 2M€ ≥ 1,5 M€ de référence → fort.
    expect(computeBudgetScore("2m_3m", 150_000_000)).toBeGreaterThanOrEqual(90);
  });

  it("faible quand le budget est nettement en deçà de la référence", () => {
    // moins_800k (max 800k) face à une référence de 2,4 M€ → faible.
    expect(computeBudgetScore("moins_800k", 240_000_000)).toBeLessThanOrEqual(25);
  });

  it("plus_3m couvre toujours (borne haute infinie)", () => {
    expect(computeBudgetScore("plus_3m", 500_000_000)).toBeGreaterThanOrEqual(70);
  });
});

describe("computeMaturityScore", () => {
  it("borne à 100 et croît avec l'horizon / la décision / la nature", () => {
    const high = computeMaturityScore("immediat", "seul", "residence_principale");
    const low = computeMaturityScore("en_reflexion", "avec_autres", "autre");
    expect(high).toBeGreaterThan(low);
    expect(high).toBeLessThanOrEqual(100);
    expect(low).toBeGreaterThanOrEqual(0);
  });
});

describe("computeBuyerPriority", () => {
  it("prioritaire seulement si global élevé ET budget/financement suffisants", () => {
    expect(computeBuyerPriority(80, 90, 90)).toBe("prioritaire");
    expect(computeBuyerPriority(80, 40, 90)).toBe("a_qualifier"); // budget faible
    expect(computeBuyerPriority(30, 90, 90)).toBe("a_suivre");
  });
});

describe("computeBuyerScore", () => {
  it("déterministe et versionné (mêmes entrées → mêmes sorties)", () => {
    const a = computeBuyerScore(base);
    const b = computeBuyerScore(base);
    expect(a).toEqual(b);
    expect(a.scoreVersion).toBe(BUYER_SCORE_VERSION);
    expect(a.overall).toBeGreaterThanOrEqual(0);
    expect(a.overall).toBeLessThanOrEqual(100);
  });

  it("un profil idéal atteint la priorité « prioritaire »", () => {
    expect(computeBuyerScore(base).priority).toBe("prioritaire");
  });

  it("un profil très en retrait n'est jamais « refusé » — juste « à suivre »", () => {
    const weak = computeBuyerScore({
      budgetBand: "moins_800k",
      financing: "financement_a_organiser",
      purchaseHorizon: "en_reflexion",
      projectNature: "autre",
      decisionMode: "avec_autres",
      availability: "a_convenir",
      referenceValueCents: 240_000_000,
    });
    expect(["a_suivre", "a_qualifier"]).toContain(weak.priority);
    // Aucune notion de « refusé » n'existe dans le modèle.
    expect(weak).not.toHaveProperty("rejected");
  });

  it("n'utilise QUE les 6 tokens + la référence (un champ injecté est ignoré)", () => {
    // Un client malveillant tenterait d'injecter un score/priorité : ignoré.
    const injected = {
      ...base,
      overall: 100,
      priority: "prioritaire",
    } as unknown as BuyerScoringInput;
    const withInjection = computeBuyerScore(injected);
    // Le résultat reste celui calculé à partir des seuls tokens légitimes.
    expect(withInjection).toEqual(computeBuyerScore(base));
  });
});
