import { describe, expect, it } from "vitest";
import { compterPourCommercial } from "./tableau-commercial";
import type { BuyerListItem } from "@/modules/buyers/crm/queries";

/** Dossier minimal : seuls les champs que le comptage regarde sont renseignés. */
function dossier(p: {
  lastInterestAt?: string | null;
  stage?: string;
  outcome?: string | null;
  overdue?: boolean;
  noNextAction?: boolean;
}): BuyerListItem {
  return {
    profile: {
      last_interest_at: p.lastInterestAt ?? null,
      pipeline_stage: p.stage ?? "nouveau",
      outcome: p.outcome ?? null,
    },
    overdue: p.overdue ?? false,
    noNextAction: p.noNextAction ?? false,
  } as unknown as BuyerListItem;
}

const maintenant = new Date().toISOString();
const hier = new Date(Date.now() - 36 * 3600 * 1000).toISOString();

describe("compterPourCommercial", () => {
  it("ne compte comme arrivé aujourd’hui que ce qui date du jour", () => {
    const c = compterPourCommercial([
      dossier({ lastInterestAt: maintenant }),
      dossier({ lastInterestAt: hier }),
      dossier({ lastInterestAt: null }),
    ]);
    expect(c.nouveauxAujourdhui).toBe(1);
  });

  it("appelle au rappel aussi bien le retard que l’absence de prochaine action", () => {
    const c = compterPourCommercial([
      dossier({ overdue: true }),
      dossier({ noNextAction: true }),
      dossier({ overdue: true, noNextAction: true }), // compté une fois
      dossier({}),
    ]);
    expect(c.aRappeler).toBe(3);
  });

  it("compte les visites sur le stade du pipeline", () => {
    const c = compterPourCommercial([
      dossier({ stage: "visite_planifiee" }),
      dossier({ stage: "visite_a_planifier" }),
      dossier({ stage: "suivi_apres_visite" }),
    ]);
    expect(c.visitesPlanifiees).toBe(1);
  });

  it("écarte les dossiers clos de tous les chiffres", () => {
    // Un dossier perdu ne demande plus rien : le faire figurer gonflerait une
    // liste de travail qui doit rester exacte.
    const c = compterPourCommercial([
      dossier({ lastInterestAt: maintenant, overdue: true, stage: "visite_planifiee" }),
      dossier({
        lastInterestAt: maintenant,
        overdue: true,
        stage: "visite_planifiee",
        outcome: "perdu",
      }),
    ]);
    expect(c).toEqual({
      nouveauxAujourdhui: 1,
      aRappeler: 1,
      visitesPlanifiees: 1,
      dossiers: 1,
    });
  });
});
