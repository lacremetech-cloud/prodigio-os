import { describe, expect, it } from "vitest";
import { UNSETTLED_LEGAL_BASIS, evaluatePolicy, type PolicyInput } from "./policy";

/**
 * La politique est un **garde-fou juridique**. Ces tests vérifient qu'elle ne
 * peut pas laisser passer un message marketing sans base légale, ni contourner
 * une opposition.
 */

const base: PolicyInput = {
  channel: "email",
  category: "transactionnel",
  hasAddress: true,
  privacy: [],
  suppressions: [],
  templateStatus: "actif",
  dispatchEnabled: true,
};

describe("evaluatePolicy — refus absolus", () => {
  it("refuse sans coordonnée exploitable", () => {
    expect(evaluatePolicy({ ...base, hasAddress: false })).toEqual({
      allowed: false,
      reason: "coordonnee_absente",
    });
  });

  it("refuse si « ne plus contacter » est enregistré, même en transactionnel", () => {
    const res = evaluatePolicy({
      ...base,
      privacy: [
        {
          choice: "accorde",
          legalBasis: "consentement",
          authorizedChannels: ["email"],
          doNotContact: true,
        },
      ],
    });
    expect(res).toEqual({ allowed: false, reason: "ne_plus_contacter" });
  });

  it("« ne plus contacter » prime sur un consentement accordé", () => {
    const res = evaluatePolicy({
      ...base,
      category: "marketing",
      privacy: [
        {
          choice: "accorde",
          legalBasis: "consentement",
          authorizedChannels: ["email"],
          doNotContact: true,
        },
      ],
    });
    expect(res.reason).toBe("ne_plus_contacter");
  });
});

describe("evaluatePolicy — oppositions", () => {
  it("bloque quand une opposition couvre le canal et la catégorie", () => {
    const res = evaluatePolicy({
      ...base,
      suppressions: [{ channel: "email", scope: "transactionnel", active: true }],
    });
    expect(res.reason).toBe("opposition_active");
  });

  it("bloque quand l'opposition porte sur « tout »", () => {
    const res = evaluatePolicy({
      ...base,
      suppressions: [{ channel: "tout", scope: "tout", active: true }],
    });
    expect(res.reason).toBe("opposition_active");
  });

  it("n'affecte pas un autre canal", () => {
    const res = evaluatePolicy({
      ...base,
      suppressions: [{ channel: "sms", scope: "tout", active: true }],
    });
    expect(res.allowed).toBe(true);
  });

  it("ignore une opposition levée", () => {
    const res = evaluatePolicy({
      ...base,
      suppressions: [{ channel: "email", scope: "tout", active: false }],
    });
    expect(res.allowed).toBe(true);
  });
});

describe("evaluatePolicy — base légale du marketing", () => {
  it("refuse le marketing sans aucune trace de consentement", () => {
    const res = evaluatePolicy({ ...base, category: "marketing" });
    expect(res).toEqual({ allowed: false, reason: "base_legale_insuffisante" });
  });

  it("refuse le marketing tant que la base légale reste à valider", () => {
    const res = evaluatePolicy({
      ...base,
      category: "marketing",
      privacy: [
        {
          choice: "accorde",
          legalBasis: UNSETTLED_LEGAL_BASIS,
          authorizedChannels: ["email"],
          doNotContact: false,
        },
      ],
    });
    expect(res.reason).toBe("base_legale_insuffisante");
  });

  it("refuse le marketing si le canal n'est pas explicitement autorisé", () => {
    const res = evaluatePolicy({
      ...base,
      channel: "sms",
      category: "marketing",
      privacy: [
        {
          choice: "accorde",
          legalBasis: "consentement",
          authorizedChannels: ["email"],
          doNotContact: false,
        },
      ],
    });
    expect(res.reason).toBe("base_legale_insuffisante");
  });

  it("refuse le marketing sur un choix refusé ou retiré", () => {
    for (const choice of ["refuse", "retire"] as const) {
      const res = evaluatePolicy({
        ...base,
        category: "marketing",
        privacy: [
          {
            choice,
            legalBasis: "consentement",
            authorizedChannels: ["email"],
            doNotContact: false,
          },
        ],
      });
      expect(res.reason, choice).toBe("base_legale_insuffisante");
    }
  });

  it("autorise le marketing quand tout est réuni", () => {
    const res = evaluatePolicy({
      ...base,
      category: "marketing",
      privacy: [
        {
          choice: "accorde",
          legalBasis: "consentement",
          authorizedChannels: ["email", "sms"],
          doNotContact: false,
        },
      ],
    });
    expect(res).toEqual({ allowed: true, reason: null });
  });

  it("n'exige PAS de consentement pour un transactionnel", () => {
    expect(evaluatePolicy(base).allowed).toBe(true);
  });
});

describe("evaluatePolicy — modèle, Google et interrupteur", () => {
  it("refuse un modèle absent", () => {
    expect(evaluatePolicy({ ...base, templateStatus: "absent" }).reason).toBe("modele_absent");
  });

  it("refuse un modèle en brouillon ou archivé", () => {
    expect(evaluatePolicy({ ...base, templateStatus: "brouillon" }).reason).toBe("modele_inactif");
    expect(evaluatePolicy({ ...base, templateStatus: "archive" }).reason).toBe("modele_inactif");
  });

  it("évite le doublon lorsque Google couvre déjà l'envoi", () => {
    expect(evaluatePolicy({ ...base, googleCovers: true }).reason).toBe("google_couvre_l_envoi");
  });

  it("refuse quand l'envoi réel est désactivé", () => {
    expect(evaluatePolicy({ ...base, dispatchEnabled: false }).reason).toBe("envoi_desactive");
  });

  it("ordonne les refus : l'opposition prime sur l'absence de modèle", () => {
    const res = evaluatePolicy({
      ...base,
      templateStatus: "absent",
      suppressions: [{ channel: "email", scope: "tout", active: true }],
    });
    expect(res.reason).toBe("opposition_active");
  });
});
