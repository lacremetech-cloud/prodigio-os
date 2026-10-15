import { describe, expect, it } from "vitest";
import { comptesDeLaFile, estEnTraitementActif, porteLeSignal } from "./signaux";
import type { BuyerInboxRow } from "./queries";

function ligne(over: Partial<BuyerInboxRow> = {}): BuyerInboxRow {
  return {
    interestId: "int-1",
    buyerProfileId: "bp-1",
    name: "Camille Durand",
    emailMasked: "c@example.test",
    phoneMasked: "+33612345678",
    city: "Cassis",
    properties: [{ id: "prop-1", label: "Villa Verdun" }],
    projets: [{ interestId: "int-1", label: "Villa Verdun" }],
    stage: "a_contacter",
    qualificationStatus: "non_qualifie",
    recommendedPriority: null,
    bestScore: null,
    interestCount: 1,
    lastInterestAt: null,
    createdAt: "2026-10-10T09:00:00.000Z",
    lastPropertyId: "prop-1",
    lastPropertyLabel: "Villa Verdun",
    assigneeNames: [],
    assigneeIds: [],
    nextActionAt: null,
    nextActionTitle: null,
    nextActionId: null,
    nextActionKind: null,
    overdue: false,
    noNextAction: true,
    newInterest: true,
    highPotential: false,
    unassigned: true,
    budgetMinCents: null,
    budgetMaxCents: null,
    budgetChoice: null,
    qualification: "a_qualifier",
    qualificationReason: null,
    callAttempts: 0,
    lastCallAt: null,
    lastCallOutcome: null,
    lastNote: null,
    lastNoteAt: null,
    lastNoteBy: null,
    phoneInvalid: false,
    ...over,
  };
}

describe("sortie de la file active", () => {
  it("une personne non qualifiée sort de la file sans changer d'étape", () => {
    const r = ligne({ qualification: "non_qualifie", stage: "a_contacter" });
    expect(estEnTraitementActif(r)).toBe(false);
    // Elle garde son étape : c'est ce qui laisse lisible où en était la
    // conversation le jour où on la requalifie.
    expect(r.stage).toBe("a_contacter");
  });

  it("« pas intéressé » et « mauvais numéro » sortent de la file", () => {
    expect(estEnTraitementActif(ligne({ stage: "pas_interesse" }))).toBe(false);
    expect(estEnTraitementActif(ligne({ stage: "mauvais_numero" }))).toBe(false);
  });

  it("une personne qualifiée ET pas intéressée reste retrouvable", () => {
    // La combinaison validée par l'agence : la qualification est un jugement,
    // l'étape un état de la conversation. Les deux coexistent.
    const r = ligne({ qualification: "qualifie", stage: "pas_interesse" });
    expect(porteLeSignal(r, "tous")).toBe(true);
    expect(porteLeSignal(r, "non_qualifies")).toBe(false);
    expect(estEnTraitementActif(r)).toBe(false);
  });

  it("le vivier reste dans le traitement actif", () => {
    expect(estEnTraitementActif(ligne({ stage: "vivier" }))).toBe(true);
  });
});

describe("comptes de la file", () => {
  it("sépare les actifs, les non qualifiés et les sortis", () => {
    const rows = [
      ligne({ buyerProfileId: "a", stage: "a_contacter" }),
      ligne({ buyerProfileId: "b", stage: "a_rappeler" }),
      ligne({ buyerProfileId: "c", stage: "vivier" }),
      ligne({ buyerProfileId: "d", qualification: "non_qualifie" }),
      ligne({ buyerProfileId: "e", qualification: "non_qualifie", stage: "pas_interesse" }),
      ligne({ buyerProfileId: "f", qualification: "qualifie", stage: "mauvais_numero" }),
    ];
    expect(comptesDeLaFile(rows)).toEqual({ actifs: 3, nonQualifies: 2, sorties: 1 });
  });

  it("les trois nombres s'additionnent au total : un bandeau qui ne boucle pas est un bandeau qui ment", () => {
    const rows = [
      ligne({ buyerProfileId: "a" }),
      ligne({ buyerProfileId: "b", qualification: "non_qualifie" }),
      ligne({ buyerProfileId: "c", stage: "pas_interesse" }),
      ligne({ buyerProfileId: "d", stage: "en_discussion" }),
    ];
    const { actifs, nonQualifies, sorties } = comptesDeLaFile(rows);
    expect(actifs + nonQualifies + sorties).toBe(rows.length);
  });

  it("une non qualifiée n'est comptée qu'une fois, même sortie par l'étape", () => {
    const { actifs, nonQualifies, sorties } = comptesDeLaFile([
      ligne({ qualification: "non_qualifie", stage: "mauvais_numero" }),
    ]);
    expect([actifs, nonQualifies, sorties]).toEqual([0, 1, 0]);
  });
});
