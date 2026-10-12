import { describe, expect, it } from "vitest";
import { lireSignal, porteLeSignal, type Signal } from "./signaux";
import type { BuyerInboxRow } from "./queries";

function dossier(p: Partial<BuyerInboxRow>): BuyerInboxRow {
  return {
    stage: "en_discussion",
    overdue: false,
    highPotential: false,
    noNextAction: false,
    unassigned: false,
    ...p,
  } as BuyerInboxRow;
}

describe("lireSignal", () => {
  it("accepte les signaux connus", () => {
    expect(lireSignal("en_retard")).toBe("en_retard");
    expect(lireSignal("non_affectes")).toBe("non_affectes");
  });

  it("ne filtre rien sur une valeur inconnue ou absente", () => {
    // Un paramètre d'URL vient de l'extérieur : une valeur fantaisiste doit
    // rendre la liste complète, jamais une liste vide inexplicable.
    expect(lireSignal("n_importe_quoi")).toBe("tous");
    expect(lireSignal(undefined)).toBe("tous");
    expect(lireSignal([])).toBe("tous");
  });

  it("retient la première valeur quand le paramètre est répété", () => {
    expect(lireSignal(["en_retard", "nouveaux"])).toBe("en_retard");
  });
});

describe("porteLeSignal", () => {
  it("fait correspondre chaque signal au bon champ", () => {
    const cas: [Signal, Partial<BuyerInboxRow>][] = [
      ["nouveaux", { stage: "nouveau" }],
      ["en_retard", { overdue: true }],
      ["fort_potentiel", { highPotential: true }],
      ["sans_action", { noNextAction: true }],
      ["non_affectes", { unassigned: true }],
    ];
    for (const [signal, champ] of cas) {
      expect(porteLeSignal(dossier(champ), signal)).toBe(true);
      expect(porteLeSignal(dossier({}), signal)).toBe(false);
    }
  });

  it("laisse tout passer sur « tous »", () => {
    expect(porteLeSignal(dossier({}), "tous")).toBe(true);
  });
});
