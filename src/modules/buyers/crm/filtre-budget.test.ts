import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { BUDGET_FILTERS, budgetCorrespond } from "./budget";
import { FILTRES_RAPIDES } from "./signaux";
import { ecrireNavigation } from "./navigation";
import type { BuyerInboxRow } from "./queries";

/**
 * UN FILTRE DOIT SÉPARER QUELQUE CHOSE.
 *
 * « Non affectés » renvoyait 67 dossiers sur 75 — 89 %. Un filtre qui garde
 * neuf lignes sur dix ne trie rien : il occupe une pastille et donne
 * l'illusion d'un tri. Même maladie que « Nouvel intérêt », allumé sur les 82
 * manifestations.
 *
 * Le budget, lui, sépare vraiment : 37 entre 500 k et 1 M€, 27 au-dessus
 * d'1 M€, 10 sans projet. C'est la question que les commerciaux se posent
 * d'abord, et elle était enterrée dans un menu replié — rien du tout côté
 * pipeline.
 */

const ligne = (budgetChoice: string | null): BuyerInboxRow =>
  ({ budgetChoice }) as unknown as BuyerInboxRow;

describe("le budget sépare, et sur les trois réponses réellement posées", () => {
  it("« Plus d'1 M€ » ramasse aussi les anciennes tranches hautes", () => {
    for (const ancien of ["plus_1m", "1m_2m", "2m_3m", "plus_3m"]) {
      expect(budgetCorrespond(ligne(ancien), "plus_1m"), ancien).toBe(true);
    }
    expect(budgetCorrespond(ligne("500k_1m"), "plus_1m")).toBe(false);
  });

  it("les deux tranches que le commercial trie en premier sont disjointes", () => {
    expect(budgetCorrespond(ligne("500k_1m"), "500k_1m")).toBe(true);
    expect(budgetCorrespond(ligne("500k_1m"), "plus_1m")).toBe(false);
    expect(budgetCorrespond(ligne("plus_1m"), "500k_1m")).toBe(false);
  });

  it("« Tous budgets » ne filtre rien", () => {
    for (const c of ["500k_1m", "plus_1m", "aucun_projet", null]) {
      expect(budgetCorrespond(ligne(c), "tous"), String(c)).toBe(true);
    }
  });
});

describe("les deux axes se croisent, au lieu de s'exclure", () => {
  it("l'adresse porte le signal ET la tranche", () => {
    const url = ecrireNavigation({
      projets: [],
      vue: "pipeline",
      signal: "en_retard",
      budget: "plus_1m",
    });
    expect(url).toContain("signal=en_retard");
    expect(url).toContain("budget=plus_1m");
  });

  it("« tous » ne salit pas l'adresse", () => {
    expect(ecrireNavigation({ projets: [], vue: "liste", signal: "tous", budget: "tous" })).toBe("");
  });
});

describe("« Non affectés » a quitté les pastilles", () => {
  it("il n'est plus proposé — il gardait 89 % des dossiers", () => {
    expect(FILTRES_RAPIDES.map((f) => f.signal)).not.toContain("non_affectes");
  });

  it("la tuile de la liste est partie avec lui", () => {
    const liste = readFileSync("src/components/crm/buyers/buyer-inbox.tsx", "utf8");
    expect(liste).not.toContain('label="Non affectés"');
  });

  it("le signal reste joignable par l'URL, pour le jour où ça servira", () => {
    // Retirer une pastille n'est pas supprimer une capacité.
    const signaux = readFileSync("src/modules/buyers/crm/signaux.ts", "utf8");
    expect(signaux).toContain('"non_affectes"');
  });
});

describe("les deux vues proposent les mêmes tranches", () => {
  it("une seule définition, dans un module que le serveur peut lire", () => {
    const liste = readFileSync("src/components/crm/buyers/buyer-inbox.tsx", "utf8");
    const page = readFileSync("src/app/crm/acquereurs/pipeline/page.tsx", "utf8");
    for (const [nom, source] of [["liste", liste], ["pipeline", page]] as const) {
      expect(source, nom).toContain("BUDGET_FILTERS.map");
      expect(source, nom).toContain("budgetCorrespond");
    }
  });

  it("le menu déroulant replié de la liste a disparu", () => {
    const liste = readFileSync("src/components/crm/buyers/buyer-inbox.tsx", "utf8");
    expect(liste).not.toContain('<Select label="Budget"');
  });

  it("chaque tranche annonce son nombre", () => {
    const page = readFileSync("src/app/crm/acquereurs/pipeline/page.tsx", "utf8");
    // Croisé avec le signal courant, mais PAS avec la tranche courante —
    // sinon toutes les autres afficheraient zéro.
    expect(page).toContain("dansLeSignal(i) && budgetCorrespond(toInboxRow(i), b.value)");
    expect(BUDGET_FILTERS.length).toBeGreaterThanOrEqual(4);
  });
});
