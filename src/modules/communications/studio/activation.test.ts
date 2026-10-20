import { describe, expect, it } from "vitest";
import {
  MARKETING_DECISIONS,
  RGPD_STATEMENT,
  canOfferMarketingActivation,
  marketingActivation,
  transactionalReadiness,
  type TransactionalReadinessInput,
} from "./activation";

const READY: TransactionalReadinessInput = {
  emailProviderConfigured: true,
  smsProviderConfigured: true,
  dispatchEnabled: true,
  activeTemplateCount: 3,
  templateCount: 8,
  queueProcessable: true,
  deliveryProofAvailable: true,
};

const NOTHING: TransactionalReadinessInput = {
  emailProviderConfigured: false,
  smsProviderConfigured: false,
  dispatchEnabled: false,
  activeTemplateCount: 0,
  templateCount: 6,
  queueProcessable: false,
  deliveryProofAvailable: false,
};

describe("préparation transactionnelle", () => {
  it("énonce les cinq constats attendus, plus le canal SMS", () => {
    expect(transactionalReadiness(READY).map((c) => c.key)).toEqual([
      "fournisseur_email",
      "fournisseur_sms",
      "dispatcher",
      "modeles",
      "file",
      "preuve",
    ]);
  });

  it("reflète fidèlement l'état, sans jamais l'embellir", () => {
    for (const check of transactionalReadiness(READY)) expect(check.ready).toBe(true);
    for (const check of transactionalReadiness(NOTHING)) expect(check.ready).toBe(false);
  });

  it("dit, pour chaque constat, ce qu'il signifie et ce qu'il reste à faire", () => {
    for (const check of transactionalReadiness(NOTHING)) {
      expect(check.meaning.length).toBeGreaterThan(20);
      expect(check.todo.length).toBeGreaterThan(10);
    }
  });

  it("ne déclare pas les modèles prêts tant qu'aucune version n'est active", () => {
    const check = transactionalReadiness({ ...READY, activeTemplateCount: 0 }).find(
      (c) => c.key === "modeles",
    );
    expect(check?.ready).toBe(false);
  });
});

describe("activation marketing", () => {
  it("liste les sept décisions bloquantes attendues", () => {
    expect(MARKETING_DECISIONS.map((d) => d.key)).toEqual([
      "base_legale",
      "texte_information",
      "duree_conservation",
      "opposition",
      "exercice_droits",
      "suppression",
      "liste_opposition",
    ]);
  });

  it("est TOUJOURS bloquée en V1 : aucune décision n'est tranchée", () => {
    const state = marketingActivation();
    expect(state.blocked).toBe(true);
    expect(state.settled).toHaveLength(0);
    expect(state.pending).toHaveLength(MARKETING_DECISIONS.length);
    expect(state.statement).toMatch(/Activation bloquée/);
  });

  it("ne peut jamais être proposée dans l'interface en V1", () => {
    expect(canOfferMarketingActivation()).toBe(false);
  });

  it("reste conservatrice : l'absence de décision vaut blocage, jamais autorisation", () => {
    expect(marketingActivation([]).blocked).toBe(false);
    expect(
      marketingActivation([{ key: "x", label: "x", question: "x ?", settled: false }]).blocked,
    ).toBe(true);
  });

  it("n'affirme JAMAIS une conformité, même toutes décisions tranchées", () => {
    const state = marketingActivation(MARKETING_DECISIONS.map((d) => ({ ...d, settled: true })));
    expect(state.blocked).toBe(false);
    expect(state.statement).not.toMatch(/conforme/i);
    expect(state.statement).toMatch(/validation juridique/i);
  });
});

describe("formulation RGPD", () => {
  it("ne contient jamais le mot « conforme »", () => {
    expect(RGPD_STATEMENT).not.toMatch(/conforme/i);
    for (const decision of MARKETING_DECISIONS) {
      expect(decision.question).not.toMatch(/conforme/i);
      expect(decision.label).not.toMatch(/conforme/i);
    }
  });

  it("dit explicitement que la validation juridique reste à obtenir", () => {
    expect(RGPD_STATEMENT).toMatch(/validation juridique/i);
  });
});
