import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  QUALIFICATION_FILTERS,
  demandeLesNonQualifies,
  lireQualificationFiltre,
  qualificationCorrespond,
} from "./qualification-filtre";
import { QUALIFICATIONS } from "./vocabulaire";
import type { BuyerInboxRow } from "./queries";

/** Une ligne minimale : seule la qualification compte ici. */
function ligne(qualification: string): BuyerInboxRow {
  return { qualification } as BuyerInboxRow;
}

describe("les options proposées", () => {
  it("couvrent TOUTES les qualifications existantes", () => {
    // Une fiche qu'aucune pastille ne peut atteindre est une fiche perdue.
    // C'est le défaut qu'on corrige ici, pas un détail de présentation : si
    // une cinquième qualification apparaît un jour et que cette rangée ne la
    // connaît pas, les dossiers qui la portent deviennent introuvables.
    const proposees = QUALIFICATION_FILTERS.flatMap((q) => q.valeurs ?? []);
    for (const q of QUALIFICATIONS) {
      expect(proposees, q.valeur).toContain(q.valeur);
    }
  });

  it("reprennent les libellés du vocabulaire, sans les recopier", () => {
    // La pastille ne peut pas annoncer autre chose que le badge de la carte.
    for (const q of QUALIFICATIONS) {
      const option = QUALIFICATION_FILTERS.find((o) => o.value === q.valeur);
      expect(option?.label, q.valeur).toBe(q.label);
    }
  });

  it("commencent par « toutes », qui ne filtre rien", () => {
    expect(QUALIFICATION_FILTERS[0]!.value).toBe("tous");
    expect(QUALIFICATION_FILTERS[0]!.valeurs).toBeNull();
  });
});

describe("lecture du paramètre d'URL", () => {
  it("accepte les valeurs connues", () => {
    expect(lireQualificationFiltre("a_qualifier")).toBe("a_qualifier");
    expect(lireQualificationFiltre("non_qualifie")).toBe("non_qualifie");
  });

  it("ne filtre rien sur une valeur inconnue plutôt que de vider l'écran", () => {
    for (const v of [undefined, "", "n'importe quoi", "gros_potentiel_2"]) {
      expect(lireQualificationFiltre(v), String(v)).toBe("tous");
    }
  });

  it("prend la première valeur quand le paramètre est répété", () => {
    expect(lireQualificationFiltre(["qualifie", "a_qualifier"])).toBe("qualifie");
  });
});

describe("le prédicat", () => {
  it("laisse tout passer sous « toutes »", () => {
    for (const q of QUALIFICATIONS) {
      expect(qualificationCorrespond(ligne(q.valeur), "tous"), q.valeur).toBe(true);
    }
  });

  it("ne retient que la qualification demandée", () => {
    expect(qualificationCorrespond(ligne("a_qualifier"), "a_qualifier")).toBe(true);
    expect(qualificationCorrespond(ligne("qualifie"), "a_qualifier")).toBe(false);
    expect(qualificationCorrespond(ligne("non_qualifie"), "non_qualifie")).toBe(true);
  });

  it("ne filtre rien si le filtre lui-même est inconnu", () => {
    // Défense en profondeur : mieux vaut tout montrer qu'un écran vide sans
    // explication.
    expect(qualificationCorrespond(ligne("qualifie"), "inexistant")).toBe(true);
  });
});

describe("le piège du pipeline", () => {
  /*
   * LE POINT QUI JUSTIFIE CE FICHIER.
   *
   * Le pipeline écarte les non qualifiés de toutes ses colonnes — c'est voulu :
   * un dossier écarté ne doit pas revenir tous les matins dans « à contacter ».
   * Mais la pastille « Non qualifié » annonce 9 ; si la sélection ne levait pas
   * cette exclusion, elle en ouvrirait 0.
   *
   * « Un filtre dont le nombre ne survit pas au clic est un filtre qui ment » —
   * c'est écrit dans la page pipeline, à propos d'un défaut déjà corrigé une
   * fois. Ce test empêche de le réintroduire.
   */

  it("demander « Non qualifié » lève l'exclusion, et rien d'autre ne la lève", () => {
    expect(demandeLesNonQualifies("non_qualifie")).toBe(true);
    for (const autre of ["tous", "a_qualifier", "qualifie", "gros_potentiel"]) {
      expect(demandeLesNonQualifies(autre), autre).toBe(false);
    }
  });

  it("les deux écrans appliquent la levée, pas un seul", () => {
    // La liste et le pipeline avaient déjà divergé en décidant chacun dans son
    // coin qui était « à contacter ». On vérifie que la page pipeline appelle
    // bien la levée dans ses prédicats, et non une règle réécrite sur place.
    const page = readFileSync("src/app/crm/acquereurs/pipeline/page.tsx", "utf8");
    expect(page).toContain("demandeLesNonQualifies(qualif)");
    // Les deux prédicats ET le compte des pastilles doivent la porter.
    expect(page.match(/demandeLesNonQualifies\(/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
  });
});

describe("les trois axes se croisent, ils ne se remplacent pas", () => {
  it("la barre de projets transporte le budget ET la qualification", () => {
    // Sans ça, cliquer « Villa Verdun » effaçait en silence le filtre qu'on
    // venait de poser. L'état vit dans l'adresse : un axe absent de l'adresse
    // est un axe perdu au premier clic.
    const barre = readFileSync("src/components/crm/buyers/barre-projets.tsx", "utf8");
    const liens = barre.match(/ecrireNavigation\(\{[\s\S]*?\}\)/g) ?? [];
    expect(liens.length).toBeGreaterThanOrEqual(3);
    for (const lien of liens) {
      expect(lien).toContain("budget");
      expect(lien).toContain("qualification");
    }
  });

  it("`ecrireNavigation` sait écrire la qualification, et l'omet quand elle ne filtre rien", () => {
    const nav = readFileSync("src/modules/buyers/crm/navigation.ts", "utf8");
    expect(nav).toContain('q.set("qualification", params.qualification)');
    expect(nav).toContain('params.qualification !== "tous"');
  });
});
