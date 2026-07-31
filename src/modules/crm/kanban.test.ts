import { describe, expect, it } from "vitest";
import { evaluateMove, isProtectedTarget, PROTECTED_TARGET_STAGES } from "./kanban";

describe("evaluateMove — règles de progression du Kanban", () => {
  it("autorise un déplacement de progression commerciale ordinaire", () => {
    const r = evaluateMove("nouveau", "prise_de_contact_en_cours");
    expect(r.allowed).toBe(true);
    expect(r.requiresAction).toBeUndefined();
  });

  it("autorise le retour en arrière dans les stades ordinaires", () => {
    expect(evaluateMove("qualification_en_cours", "contact_etabli").allowed).toBe(true);
  });

  it("traite un dépôt dans la même colonne comme un no-op", () => {
    const r = evaluateMove("nouveau", "nouveau");
    expect(r.allowed).toBe(false);
    expect(r.noop).toBe(true);
  });

  it("REFUSE le passage direct en « proposition_de_mandat » (action mandat requise)", () => {
    const r = evaluateMove("qualification_en_cours", "proposition_de_mandat");
    expect(r.allowed).toBe(false);
    expect(r.requiresAction).toBe("mandat");
    expect(r.reason).toBeTruthy();
  });

  it("REFUSE le passage direct en « mandat_signe » (jamais forcer signé)", () => {
    const r = evaluateMove("estimation_etude_dossier", "mandat_signe");
    expect(r.allowed).toBe(false);
    expect(r.requiresAction).toBe("mandat");
  });

  it("REFUSE le passage direct en « perdu » (résultat commercial avec motif requis)", () => {
    const r = evaluateMove("rendez_vous_planifie", "perdu");
    expect(r.allowed).toBe(false);
    expect(r.requiresAction).toBe("resultat");
  });

  it("refuse une colonne inconnue", () => {
    expect(evaluateMove("nouveau", "colonne_bidon").allowed).toBe(false);
  });
});

describe("isProtectedTarget", () => {
  it("identifie les colonnes protégées", () => {
    expect(isProtectedTarget("proposition_de_mandat")).toBe(true);
    expect(isProtectedTarget("mandat_signe")).toBe(true);
    expect(isProtectedTarget("perdu")).toBe(true);
    expect(isProtectedTarget("nouveau")).toBe(false);
    expect(isProtectedTarget("rendez_vous_planifie")).toBe(false);
  });

  it("les cibles protégées couvrent bien mandat + résultat", () => {
    expect(PROTECTED_TARGET_STAGES.mandat_signe).toBe("mandat");
    expect(PROTECTED_TARGET_STAGES.perdu).toBe("resultat");
  });
});
