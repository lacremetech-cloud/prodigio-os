import { describe, expect, it } from "vitest";
import {
  CLOSED_BUYER_STAGES,
  PROTECTED_BUYER_STAGES,
  evaluateBuyerMove,
  isProtectedBuyerStage,
  movableBuyerStages,
  buyerUrgencyWeight,
  type BuyerKanbanCard,
} from "./pipeline";
import { BUYER_KANBAN_COLUMNS, buyerStageLabels } from "./labels";

const card = (over: Partial<BuyerKanbanCard> = {}): BuyerKanbanCard => ({
  interestId: "int-1",
  propertyId: "prop-1",
  buyerProfileId: "bp-1",
  stage: "nouveau",
  name: "Léa Bernard",
  propertyLabel: "Villa Belvédère",
  properties: [{ id: "prop-1", label: "Villa Verdun" }],
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

  it("le cycle va de « à contacter » à « mauvais numéro », sept colonnes", () => {
    /* Sept, et non huit : « Écarté » a été retiré — il faisait doublon avec
       « Pas intéressé », et un pipeline qui finit sur trois colonnes négatives
       décourage celui qui le regarde toute la journée. */
    expect(BUYER_KANBAN_COLUMNS).toHaveLength(7);
    expect(BUYER_KANBAN_COLUMNS[0]).toBe("a_contacter");
    expect(BUYER_KANBAN_COLUMNS).toContain("vivier");
    expect(BUYER_KANBAN_COLUMNS).not.toContain("offre");
    expect(BUYER_KANBAN_COLUMNS).not.toContain("gagne");
    expect(BUYER_KANBAN_COLUMNS).not.toContain("perdu");
  });
});

describe("evaluateBuyerMove — plus aucune étape protégée", () => {
  it("laisse déplacer vers n'importe quelle colonne du pipeline", () => {
    /* Les trois étapes qui exigeaient une action dédiée — offre, gagné, perdu
       — ont quitté le pipeline : une offre et une issue commerciale
       appartiennent à l'AFFAIRE, donc au bien. Les sept restantes décrivent
       toutes où en est la CONVERSATION, et une conversation se déplace
       librement. */
    for (const colonne of BUYER_KANBAN_COLUMNS) {
      if (colonne === "a_contacter") continue;
      const r = evaluateBuyerMove("a_contacter", colonne);
      expect(r.allowed, colonne).toBe(true);
      expect(r.requiresAction, colonne).toBeUndefined();
    }
  });

  it("refuse toujours une colonne inconnue", () => {
    expect(evaluateBuyerMove("a_contacter", "ecarte").allowed).toBe(false);
    expect(evaluateBuyerMove("a_contacter", "nimporte_quoi").allowed).toBe(false);
  });

  it("aucune étape n'est protégée, et aucune n'est terminale", () => {
    /* « Pas intéressé » et « mauvais numéro » n'enferment personne : un numéro
       se corrige, et quelqu'un qui a dit non à une villa dira peut-être oui à
       la suivante. */
    expect(Object.keys(PROTECTED_BUYER_STAGES)).toEqual([]);
    expect(CLOSED_BUYER_STAGES).toEqual([]);
  });
});

describe("evaluateBuyerMove — dossiers clos et cas neutres", () => {
  it("refuse de rouvrir un dossier clos par simple déplacement", () => {
    for (const closed of CLOSED_BUYER_STAGES) {
      const res = evaluateBuyerMove(closed, "en_discussion");
      expect(res.allowed).toBe(false);
      expect(res.requiresAction).toBe("reouverture");
    }
  });

  it("traite un déplacement sur place comme sans effet (aucun appel serveur)", () => {
    const res = evaluateBuyerMove("en_discussion", "en_discussion");
    expect(res.allowed).toBe(false);
    expect(res.noop).toBe(true);
  });

  it("refuse une colonne inconnue", () => {
    expect(evaluateBuyerMove("a_contacter", "colonne_inventee").allowed).toBe(false);
  });

  it("autorise une progression ordinaire", () => {
    expect(evaluateBuyerMove("a_contacter", "a_rappeler").allowed).toBe(true);
    expect(evaluateBuyerMove("en_discussion", "visite_planifiee").allowed).toBe(true);
  });

  it("autorise aussi un retour en arrière (le pipeline n'est pas à sens unique)", () => {
    expect(evaluateBuyerMove("visite_planifiee", "a_rappeler").allowed).toBe(true);
  });
});

describe("movableBuyerStages", () => {
  it("n'expose plus les étapes qui ont quitté le pipeline", () => {
    const targets = movableBuyerStages("en_discussion");
    expect(targets).not.toContain("offre");
    expect(targets).not.toContain("gagne");
    expect(targets).not.toContain("perdu");
    expect(targets).not.toContain("ecarte");
  });

  it("n'expose pas l'étape courante", () => {
    expect(movableBuyerStages("en_discussion")).not.toContain("en_discussion");
  });

  it("offre des cibles même depuis « pas intéressé » : rien n'enferme", () => {
    /* Un refus n'est pas définitif. Quelqu'un qui a dit non à une villa dira
       peut-être oui à la suivante — c'est à cela que sert le vivier. */
    const depuisRefus = movableBuyerStages("pas_interesse");
    expect(depuisRefus).toContain("vivier");
    expect(depuisRefus).toContain("a_rappeler");
    /* Et un mauvais numéro se corrige : la personne revient dans la file. */
    expect(movableBuyerStages("mauvais_numero")).toContain("a_contacter");
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
