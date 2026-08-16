import { describe, expect, it } from "vitest";
import {
  CLOSED_BUYER_STAGES,
  evaluateBuyerMove,
  isProtectedBuyerStage,
  movableBuyerStages,
  buyerUrgencyWeight,
  type BuyerKanbanCard,
} from "./pipeline";
import { BUYER_KANBAN_COLUMNS, buyerStageLabels } from "./labels";

const card = (over: Partial<BuyerKanbanCard> = {}): BuyerKanbanCard => ({
  buyerProfileId: "bp-1",
  stage: "nouveau",
  name: "Léa Bernard",
  propertyLabel: "Villa Belvédère",
  city: "Megève",
  bestScore: 70,
  recommendedPriority: "a_qualifier",
  qualificationLabel: "Non qualifié",
  interestCount: 1,
  unassigned: false,
  overdue: false,
  noNextAction: false,
  newInterest: false,
  phoneMasked: null,
  ...over,
});

describe("pipeline acquéreurs — colonnes", () => {
  it("chaque colonne porte un libellé français", () => {
    for (const stage of BUYER_KANBAN_COLUMNS) {
      expect(buyerStageLabels[stage]).toBeTruthy();
    }
  });

  it("le cycle commence par « nouveau » et se termine par « perdu »", () => {
    expect(BUYER_KANBAN_COLUMNS[0]).toBe("nouveau");
    expect(BUYER_KANBAN_COLUMNS.at(-1)).toBe("perdu");
  });
});

describe("evaluateBuyerMove — étapes protégées", () => {
  it("refuse le déplacement vers « offre en cours » et renvoie vers l'action dédiée", () => {
    const res = evaluateBuyerMove("qualifie", "offre_en_cours");
    expect(res.allowed).toBe(false);
    expect(res.requiresAction).toBe("offre");
    expect(res.reason).toBeTruthy();
  });

  it("refuse le déplacement vers « acquéreur gagné »", () => {
    const res = evaluateBuyerMove("suivi_apres_visite", "acquereur_gagne");
    expect(res.allowed).toBe(false);
    expect(res.requiresAction).toBe("resultat");
  });

  it("refuse le déplacement vers « perdu »", () => {
    const res = evaluateBuyerMove("contact_en_cours", "perdu");
    expect(res.allowed).toBe(false);
    expect(res.requiresAction).toBe("resultat");
  });

  it("marque bien les trois étapes comme protégées, et elles seules", () => {
    const protectedOnes = BUYER_KANBAN_COLUMNS.filter(isProtectedBuyerStage);
    expect(protectedOnes).toEqual(["offre_en_cours", "acquereur_gagne", "perdu"]);
  });
});

describe("evaluateBuyerMove — dossiers clos et cas neutres", () => {
  it("refuse de rouvrir un dossier clos par simple déplacement", () => {
    for (const closed of CLOSED_BUYER_STAGES) {
      const res = evaluateBuyerMove(closed, "qualifie");
      expect(res.allowed).toBe(false);
      expect(res.requiresAction).toBe("reouverture");
    }
  });

  it("traite un déplacement sur place comme sans effet (aucun appel serveur)", () => {
    const res = evaluateBuyerMove("qualifie", "qualifie");
    expect(res.allowed).toBe(false);
    expect(res.noop).toBe(true);
  });

  it("refuse une colonne inconnue", () => {
    expect(evaluateBuyerMove("nouveau", "colonne_inventee").allowed).toBe(false);
  });

  it("autorise une progression ordinaire", () => {
    expect(evaluateBuyerMove("nouveau", "a_contacter").allowed).toBe(true);
    expect(evaluateBuyerMove("visite_planifiee", "suivi_apres_visite").allowed).toBe(true);
  });

  it("autorise aussi un retour en arrière (le pipeline n'est pas à sens unique)", () => {
    expect(evaluateBuyerMove("qualifie", "a_contacter").allowed).toBe(true);
  });
});

describe("movableBuyerStages", () => {
  it("n'expose jamais une étape protégée comme cible", () => {
    const targets = movableBuyerStages("qualifie");
    expect(targets).not.toContain("offre_en_cours");
    expect(targets).not.toContain("acquereur_gagne");
    expect(targets).not.toContain("perdu");
  });

  it("n'expose pas l'étape courante", () => {
    expect(movableBuyerStages("qualifie")).not.toContain("qualifie");
  });

  it("n'offre aucune cible depuis un dossier clos", () => {
    expect(movableBuyerStages("perdu")).toEqual([]);
    expect(movableBuyerStages("acquereur_gagne")).toEqual([]);
  });
});

describe("buyerUrgencyWeight", () => {
  it("place un rappel en retard au-dessus d'un simple fort potentiel", () => {
    const late = buyerUrgencyWeight(card({ overdue: true }));
    const potential = buyerUrgencyWeight(card({ recommendedPriority: "prioritaire" }));
    expect(late).toBeGreaterThan(potential);
  });

  it("cumule les signaux opérationnels", () => {
    const one = buyerUrgencyWeight(card({ unassigned: true }));
    const many = buyerUrgencyWeight(
      card({ unassigned: true, overdue: true, noNextAction: true, newInterest: true }),
    );
    expect(many).toBeGreaterThan(one);
  });

  it("un dossier sans aucun signal n'est pas urgent", () => {
    expect(buyerUrgencyWeight(card({ recommendedPriority: null }))).toBe(0);
  });
});
