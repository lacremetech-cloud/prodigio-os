import { describe, expect, it } from "vitest";
import {
  fileDAppels,
  positionDansLaFile,
  rangDansLaFile,
  suivantDansLaFile,
} from "./file-appels";
import type { BuyerInboxRow } from "./queries";

const MAINTENANT = new Date("2026-10-13T14:00:00.000Z").getTime();

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

describe("rang dans la file", () => {
  it("un rappel passé est un retard", () => {
    expect(rangDansLaFile(ligne({ nextActionAt: "2026-10-12T10:00:00.000Z" }), MAINTENANT)).toBe(
      "retard",
    );
  });

  it("un rappel du jour, même plus tard dans la journée, est pour aujourd'hui", () => {
    expect(rangDansLaFile(ligne({ nextActionAt: "2026-10-13T18:00:00.000Z" }), MAINTENANT)).toBe(
      "aujourdhui",
    );
  });

  it("un lead jamais appelé et sans action est un nouveau", () => {
    expect(rangDansLaFile(ligne({ callAttempts: 0 }), MAINTENANT)).toBe("nouveau");
  });

  /* Le point qui compte : un rappel pris pour la semaine prochaine n'est pas
     un retard. L'afficher comme urgent discrédite toutes les échéances. */
  it("un rappel futur sort de la file sans devenir urgent", () => {
    expect(rangDansLaFile(ligne({ nextActionAt: "2026-10-20T10:00:00.000Z" }), MAINTENANT)).toBe(
      "plus_tard",
    );
  });

  it("un dossier déjà appelé, sans rappel prévu, n'encombre pas la file", () => {
    expect(rangDansLaFile(ligne({ callAttempts: 3 }), MAINTENANT)).toBe("plus_tard");
  });
});

describe("file d'appels", () => {
  it("ordonne retards, puis aujourd'hui, puis nouveaux", () => {
    const file = fileDAppels(
      [
        ligne({ interestId: "n", callAttempts: 0 }),
        ligne({ interestId: "auj", nextActionAt: "2026-10-13T16:00:00.000Z" }),
        ligne({ interestId: "retard", nextActionAt: "2026-10-11T10:00:00.000Z" }),
      ],
      MAINTENANT,
    );
    expect(file.map((f) => f.interestId)).toEqual(["retard", "auj", "n"]);
  });

  /* Rappeler un numéro qu'on sait faux ne produit qu'une tentative perdue de
     plus — mais le dossier n'est pas perdu pour autant, il reste dans la liste. */
  it("retire un numéro invalide de la file", () => {
    const file = fileDAppels(
      [ligne({ interestId: "ko", phoneInvalid: true }), ligne({ interestId: "ok" })],
      MAINTENANT,
    );
    expect(file.map((f) => f.interestId)).toEqual(["ok"]);
  });

  it("à rang égal, le plus ancien passe devant", () => {
    const file = fileDAppels(
      [
        ligne({ interestId: "recent", createdAt: "2026-10-12T09:00:00.000Z" }),
        ligne({ interestId: "ancien", createdAt: "2026-10-01T09:00:00.000Z" }),
      ],
      MAINTENANT,
    );
    expect(file.map((f) => f.interestId)).toEqual(["ancien", "recent"]);
  });
});

describe("avancer dans la file", () => {
  /**
   * Le vrai piège : le dossier qu'on vient d'enregistrer SORT de la file (il a
   * désormais un rappel futur). Si « suivant » recalculait la file, toutes les
   * positions glisseraient d'un cran et un dossier serait sauté sans que
   * personne ne le voie.
   */
  it("suit l'ordre figé au départ, même quand le dossier traité en sortirait", () => {
    const ordre = ["a", "b", "c"];
    expect(suivantDansLaFile(ordre, "a")).toBe("b");
    expect(suivantDansLaFile(ordre, "b")).toBe("c");
  });

  it("annonce la fin de session plutôt que de boucler", () => {
    expect(suivantDansLaFile(["a", "b"], "b")).toBeNull();
  });

  it("démarre au premier quand rien n'est encore ouvert", () => {
    expect(suivantDansLaFile(["a", "b"], null)).toBe("a");
  });

  it("donne la position pour savoir où l'on en est", () => {
    expect(positionDansLaFile(["a", "b", "c"], "b")).toEqual({ position: 2, total: 3 });
  });
});
