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

  it("sépare le retard de l’absence de prochaine action", () => {
    // Un seul compteur additionnait les deux sous le libellé « À rappeler » :
    // un dossier sans tâche n'a pourtant aucun rappel à honorer, et la tuile
    // ouvrait une liste filtrée sur une moitié seulement du chiffre annoncé.
    const c = compterPourCommercial([
      dossier({ overdue: true }),
      dossier({ noNextAction: true }),
      dossier({ noNextAction: true }),
      dossier({}),
    ]);
    expect(c.enRetard).toBe(1);
    expect(c.sansAction).toBe(2);
  });

  it("compte les visites sur le stade du pipeline", () => {
    const c = compterPourCommercial([
      dossier({ stage: "visite" }),
      dossier({ stage: "en_discussion" }),
      dossier({ stage: "offre" }),
    ]);
    expect(c.visitesPlanifiees).toBe(1);
  });

  it("écarte les dossiers clos de tous les chiffres", () => {
    // Un dossier perdu ne demande plus rien : le faire figurer gonflerait une
    // liste de travail qui doit rester exacte.
    const c = compterPourCommercial([
      dossier({ lastInterestAt: maintenant, overdue: true, stage: "visite" }),
      dossier({
        lastInterestAt: maintenant,
        overdue: true,
        stage: "visite",
        outcome: "perdu",
      }),
    ]);
    expect(c).toEqual({
      nouveauxAujourdhui: 1,
      enRetard: 1,
      sansAction: 0,
      visitesPlanifiees: 1,
      dossiers: 1,
    });
  });
});
