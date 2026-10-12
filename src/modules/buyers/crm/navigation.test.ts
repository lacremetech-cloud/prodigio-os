import { describe, expect, it } from "vitest";
import {
  dansLaSelection,
  ecrireNavigation,
  lireProjets,
  lireVue,
  teinteProjet,
} from "./navigation";

const PROJETS = [{ id: "verdun" }, { id: "jaures" }];

describe("lireVue", () => {
  it("accepte les vues connues et retombe sur la liste", () => {
    expect(lireVue("pipeline")).toBe("pipeline");
    expect(lireVue("liste")).toBe("liste");
    expect(lireVue("n_importe_quoi")).toBe("liste");
    expect(lireVue(undefined)).toBe("liste");
  });
});

describe("lireProjets", () => {
  it("lit une sélection multiple", () => {
    expect(lireProjets("verdun,jaures", PROJETS)).toEqual(["verdun", "jaures"]);
  });

  it("écarte un projet auquel on n’a pas accès", () => {
    // Un lien partagé ne doit ni vider la liste sans explication, ni révéler
    // l'existence d'un projet qu'on n'a pas le droit de voir.
    expect(lireProjets("verdun,secret", PROJETS)).toEqual(["verdun"]);
    expect(lireProjets("secret", PROJETS)).toEqual([]);
  });

  it("ne garde pas deux fois le même projet", () => {
    expect(lireProjets("verdun,verdun", PROJETS)).toEqual(["verdun"]);
  });

  it("tolère le vide et les espaces", () => {
    expect(lireProjets(undefined, PROJETS)).toEqual([]);
    expect(lireProjets(" verdun , ", PROJETS)).toEqual(["verdun"]);
  });
});

describe("ecrireNavigation", () => {
  it("n’écrit que ce qui s’écarte du défaut", () => {
    expect(ecrireNavigation({ projets: [], vue: "liste" })).toBe("");
    expect(ecrireNavigation({ projets: ["verdun"], vue: "liste" })).toBe("?projets=verdun");
    expect(ecrireNavigation({ projets: [], vue: "pipeline" })).toBe("?vue=pipeline");
  });

  it("conserve le signal actif en changeant de vue", () => {
    expect(
      ecrireNavigation({ projets: ["verdun"], vue: "pipeline", signal: "en_retard" }),
    ).toBe("?projets=verdun&vue=pipeline&signal=en_retard");
  });
});

describe("dansLaSelection", () => {
  it("laisse tout passer quand rien n’est sélectionné", () => {
    expect(dansLaSelection("verdun", [])).toBe(true);
    expect(dansLaSelection(null, [])).toBe(true);
  });

  it("filtre sur la sélection", () => {
    expect(dansLaSelection("verdun", ["verdun"])).toBe(true);
    expect(dansLaSelection("jaures", ["verdun"])).toBe(false);
  });

  it("écarte une ligne sans projet dès qu’un projet est choisi", () => {
    // Afficher un dossier sans projet sous l'onglet « Villa Verdun » ferait
    // mentir le compteur juste au-dessus.
    expect(dansLaSelection(null, ["verdun"])).toBe(false);
  });
});

describe("teinteProjet", () => {
  it("rend la même teinte pour le même projet", () => {
    expect(teinteProjet("verdun")).toBe(teinteProjet("verdun"));
  });

  it("reste dans la palette prévue", () => {
    for (const id of ["a", "verdun", "jaures", "deux-alpes", "x9"]) {
      expect([210, 160, 280, 30, 330, 100]).toContain(teinteProjet(id));
    }
  });
});
