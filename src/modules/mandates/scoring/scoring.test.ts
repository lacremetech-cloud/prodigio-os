import { describe, expect, it } from "vitest";
import { SCORE_VERSION, ECONOMIC_RULESET_VERSION } from "./config";
import {
  computeScoreResult,
  scoreFromAnswers,
  type ScoringInput,
} from "./scoring";

const base: ScoringInput = {
  propertyType: "villa_architecte",
  valueBand: "1_2m_2m",
  saleHorizon: "trois_mois",
  mandateSituation: "aucun_mandat",
};

describe("computeScoreResult — bornes et déterminisme", () => {
  it("produit deux scores distincts bornés 0–100", () => {
    const r = computeScoreResult(base);
    expect(r.compatibility.score).toBeGreaterThanOrEqual(0);
    expect(r.compatibility.score).toBeLessThanOrEqual(100);
    expect(r.maturity.score).toBeGreaterThanOrEqual(0);
    expect(r.maturity.score).toBeLessThanOrEqual(100);
    // Jamais fusionnés en un score unique.
    expect(r.compatibility.score).not.toBe(r.maturity.score);
  });

  it("est déterministe (mêmes entrées → mêmes sorties)", () => {
    expect(computeScoreResult(base)).toEqual(computeScoreResult(base));
  });

  it("porte la version de score et la référence économique", () => {
    const r = computeScoreResult(base);
    expect(r.scoreVersion).toBe(SCORE_VERSION);
    expect(r.economicRulesetVersion).toBe(ECONOMIC_RULESET_VERSION);
  });

  it("maximum atteignable = 100 sur chaque axe", () => {
    const r = computeScoreResult({
      propertyType: "villa_architecte", // 30
      valueBand: "plus_2m", // 70
      saleHorizon: "des_que_possible", // 70
      mandateSituation: "mandat_simple", // 30
    });
    expect(r.compatibility.score).toBe(100);
    expect(r.maturity.score).toBe(100);
  });

  it("minimum plancher raisonnable (jamais négatif)", () => {
    const r = computeScoreResult({
      propertyType: "autre", // 18
      valueBand: "moins_500k", // 12
      saleHorizon: "en_reflexion", // 15
      mandateSituation: "autre", // 14
    });
    expect(r.compatibility.score).toBe(30);
    expect(r.maturity.score).toBe(29);
  });
});

describe("score_breakdown exploitable", () => {
  it("expose les facteurs de chaque axe", () => {
    const r = computeScoreResult(base);
    expect(r.compatibility.factors.map((f) => f.key)).toEqual([
      "value_band",
      "property_type",
    ]);
    expect(r.maturity.factors.map((f) => f.key)).toEqual([
      "sale_horizon",
      "mandate_situation",
    ]);
    for (const f of [...r.compatibility.factors, ...r.maturity.factors]) {
      expect(f.points).toBeLessThanOrEqual(f.max);
    }
  });
});

describe("priorité opérationnelle — matrice 2×2", () => {
  it("forte compatibilité + forte maturité → rappel prioritaire", () => {
    expect(
      computeScoreResult({
        propertyType: "villa_architecte",
        valueBand: "plus_2m",
        saleHorizon: "des_que_possible",
        mandateSituation: "mandat_simple",
      }).priority,
    ).toBe("rappel_prioritaire");
  });

  it("forte compatibilité + faible maturité → nurturing", () => {
    expect(
      computeScoreResult({
        propertyType: "villa_architecte",
        valueBand: "plus_2m",
        saleHorizon: "en_reflexion",
        mandateSituation: "autre",
      }).priority,
    ).toBe("nurturing");
  });

  it("faible compatibilité + forte maturité → circuit partenaire", () => {
    expect(
      computeScoreResult({
        propertyType: "autre",
        valueBand: "moins_500k",
        saleHorizon: "des_que_possible",
        mandateSituation: "mandat_simple",
      }).priority,
    ).toBe("circuit_partenaire");
  });

  it("faible compatibilité + faible maturité → suivi long terme", () => {
    expect(
      computeScoreResult({
        propertyType: "autre",
        valueBand: "moins_500k",
        saleHorizon: "en_reflexion",
        mandateSituation: "autre",
      }).priority,
    ).toBe("suivi_long_terme");
  });
});

describe("appréciation publique (jamais « non éligible »)", () => {
  it("compatibilité forte → fort potentiel", () => {
    expect(
      computeScoreResult({ ...base, valueBand: "plus_2m" }).appreciation,
    ).toBe("fort_potentiel");
  });

  it("compatibilité intermédiaire → potentiel à confirmer", () => {
    // 500k_800k (32) + appartement_exception (27) = 59 → [35,60)
    const r = computeScoreResult({
      propertyType: "appartement_exception",
      valueBand: "500k_800k",
      saleHorizon: "trois_mois",
      mandateSituation: "aucun_mandat",
    });
    expect(r.compatibility.score).toBe(59);
    expect(r.appreciation).toBe("a_confirmer");
  });

  it("compatibilité faible → analyse personnalisée (jamais rejet automatique)", () => {
    const r = computeScoreResult({
      propertyType: "autre",
      valueBand: "moins_500k",
      saleHorizon: "trois_mois",
      mandateSituation: "aucun_mandat",
    });
    expect(r.appreciation).toBe("analyse_personnalisee");
  });

  it("valeur inconnue (à estimer) → analyse personnalisée, sans fausse précision", () => {
    const r = computeScoreResult({
      propertyType: "villa_architecte",
      valueBand: "accompagnement_estimation",
      saleHorizon: "des_que_possible",
      mandateSituation: "mandat_simple",
    });
    expect(r.needsEstimation).toBe(true);
    // Le score de compatibilité peut être élevé, mais l'appréciation reste prudente.
    expect(r.appreciation).toBe("analyse_personnalisee");
  });

  it("ne renvoie jamais de clé signifiant « non éligible »", () => {
    const keys = new Set<string>();
    const propertyTypes = [
      "villa_architecte",
      "appartement_exception",
      "chalet",
      "domaine_caractere",
      "autre",
    ] as const;
    const valueBands = [
      "moins_500k",
      "500k_800k",
      "800k_1_2m",
      "1_2m_2m",
      "plus_2m",
      "accompagnement_estimation",
    ] as const;
    for (const p of propertyTypes) {
      for (const v of valueBands) {
        keys.add(
          computeScoreResult({
            propertyType: p,
            valueBand: v,
            saleHorizon: "trois_mois",
            mandateSituation: "aucun_mandat",
          }).appreciation,
        );
      }
    }
    expect([...keys].sort()).toEqual([
      "a_confirmer",
      "analyse_personnalisee",
      "fort_potentiel",
    ]);
    expect(keys.has("non_eligible")).toBe(false);
  });
});

describe("résistance à la manipulation depuis le navigateur", () => {
  it("ignore tout champ de score injecté (calcul depuis les seuls tokens)", () => {
    const rogue = {
      propertyType: "autre",
      valueBand: "moins_500k",
      saleHorizon: "en_reflexion",
      mandateSituation: "autre",
      // Champs hostiles injectés par un client :
      compatibility: 100,
      maturity: 100,
      appreciation: "fort_potentiel",
      priority: "rappel_prioritaire",
      score: 100,
    } as unknown as Parameters<typeof scoreFromAnswers>[0];

    const r = scoreFromAnswers(rogue);
    // Le résultat reflète les VRAIES réponses, pas les champs injectés.
    expect(r.compatibility.score).toBe(30);
    expect(r.maturity.score).toBe(29);
    expect(r.appreciation).toBe("analyse_personnalisee");
    expect(r.priority).toBe("suivi_long_terme");
  });
});
