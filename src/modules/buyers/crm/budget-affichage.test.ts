import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { budgetARepeter } from "./budget-affichage";

/**
 * Le budget n'est plus répété sous chaque projet — sauf quand il diffère.
 *
 * Le garde-fou de CÂBLAGE n'est pas décoratif : plus tôt dans la journée,
 * j'ai corrigé une fonction que personne n'appelait, et le test est passé
 * quand même. Vérifier la règle ne prouve pas qu'elle s'applique.
 */
describe("budgetARepeter", () => {
  it("ne répète pas ce que l'en-tête dit déjà", () => {
    expect(budgetARepeter("plus_1m", "plus_1m")).toBe(false);
    expect(budgetARepeter("aucun_projet", "aucun_projet")).toBe(false);
    // Le cas de la capture : deux projets, la même réponse, zéro bloc affiché.
    expect(budgetARepeter("aucun_projet", "aucun_projet")).toBe(false);
  });

  it("montre la réponse qui DIFFÈRE — le cas Christiane DORAT", () => {
    // En-tête : « Plus d'1 M€ » (sa réponse la plus récente).
    // Ce projet-là portait « 500 000 € – 1 M€ » : elle a revu à la hausse.
    expect(budgetARepeter("500k_1m", "plus_1m")).toBe(true);
    expect(budgetARepeter("plus_1m", "500k_1m")).toBe(true);
    expect(budgetARepeter("aucun_projet", "plus_1m")).toBe(true);
  });

  it("une absence de réponse n'est pas une divergence à signaler", () => {
    expect(budgetARepeter(null, "plus_1m")).toBe(false);
    expect(budgetARepeter(null, null)).toBe(false);
  });

  it("un en-tête vide ne fait pas disparaître la seule réponse connue", () => {
    expect(budgetARepeter("plus_1m", null)).toBe(true);
  });

  it("la fiche l'APPELLE vraiment — une règle non câblée ne règle rien", () => {
    const page = readFileSync("src/app/crm/acquereurs/[id]/page.tsx", "utf8");
    expect(page).toContain('from "@/modules/buyers/crm/budget-affichage"');
    expect(page).toMatch(/budgetARepeter\(i\.budget_choice, choixBudget\)/);
    // Et plus aucun ReponseBudget inconditionnel sous les projets.
    expect(page).not.toMatch(/<ReponseBudget choix=\{i\.budget_choice\} \/>/);
  });
});
