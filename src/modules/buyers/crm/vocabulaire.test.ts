import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  ETAPES,
  ETAPES_ACTIVES,
  ETAPES_HORS_FILE,
  QUALIFICATIONS,
  estAppelable,
  estEtapeConnue,
  estQualificationConnue,
  etape,
  qualification,
  sortDeLaFileActive,
} from "./vocabulaire";

describe("les huit étapes", () => {
  it("sont exactement celles arrêtées avec l'agence, dans l'ordre", () => {
    expect(ETAPES.map((e) => e.label)).toEqual([
      "À contacter",
      "À rappeler",
      "En discussion",
      "Visite planifiée",
      "Vivier",
      "Pas intéressé",
      "Mauvais numéro",
    ]);
  });

  it("ne contient pas « écarté » : une case grise de trop", () => {
    /* « Écarté » et « Pas intéressé » étaient deux cases grises voisines qui
       disaient presque la même chose. Un pipeline qui finit sur trois colonnes
       négatives décourage celui qui le regarde toute la journée. */
    expect(ETAPES.map((e) => e.valeur) as string[]).not.toContain("ecarte");
    expect(ETAPES).toHaveLength(7);
  });

  it("ne contient ni « nouveau », ni « perdu », ni « gagné », ni « offre »", () => {
    /* Ces quatre appartenaient à l'ancien vocabulaire. « Perdu » s'est scindé
       en deux — « pas intéressé » (la personne refuse) et « écarté » (son
       profil ne convient pas) — et les confondre faisait perdre l'information
       la plus utile des deux. */
    const valeurs = ETAPES.map((e) => e.valeur) as string[];
    for (const ancienne of ["nouveau", "perdu", "gagne", "offre", "visite"]) {
      expect(valeurs).not.toContain(ancienne);
    }
  });

  it("« non qualifié » n'est pas une étape : c'est une qualification", () => {
    expect(ETAPES.map((e) => e.valeur) as string[]).not.toContain("non_qualifie");
  });

  it("« vivier » n'est pas une qualification : c'est une étape", () => {
    expect(QUALIFICATIONS.map((q) => q.valeur) as string[]).not.toContain("vivier");
    expect(ETAPES.map((e) => e.valeur)).toContain("vivier");
  });

  it("quatre étapes sortent la personne de la file active", () => {
    expect(ETAPES_ACTIVES).toEqual([
      "a_contacter",
      "a_rappeler",
      "en_discussion",
      "visite_planifiee",
    ]);
  });

  it("deux étapes sortent la personne de la file d'appels, le vivier non", () => {
    /* On rappelle quelqu'un du vivier : il est en attente, pas écarté. */
    expect(ETAPES_HORS_FILE).toEqual(["pas_interesse", "mauvais_numero"]);
    expect(etape("vivier").appelable).toBe(true);
  });

  it("une valeur inconnue ne casse rien et retombe sur « À contacter »", () => {
    expect(estEtapeConnue("a_rappeler")).toBe(true);
    expect(estEtapeConnue("nouveau")).toBe(false);
    expect(etape("nimporte_quoi").label).toBe("À contacter");
  });
});

describe("les quatre qualifications", () => {
  it("sont exactement celles arrêtées avec l'agence", () => {
    expect(QUALIFICATIONS.map((q) => q.label)).toEqual([
      "À qualifier",
      "Qualifié",
      "Gros potentiel",
      "Non qualifié",
    ]);
  });

  it("n'exigent un motif que pour écarter quelqu'un", () => {
    expect(qualification("non_qualifie").motifRequis).toBe(true);
    expect(qualification("gros_potentiel").motifRequis).toBe(false);
  });

  it("ne connaissent plus « en réflexion »", () => {
    expect(estQualificationConnue("en_reflexion")).toBe(false);
  });
});

describe("ce qu'une qualification entraîne", () => {
  it("« non qualifié » sort la personne de la file active à lui seul", () => {
    /* C'est la plainte d'origine : « quand un lead passe en non qualifié, il
       reste dans à contacter ». Plus besoin d'une colonne pour ça. */
    expect(sortDeLaFileActive("non_qualifie", "a_contacter")).toBe(true);
    expect(sortDeLaFileActive("non_qualifie", "en_discussion")).toBe(true);
    expect(estAppelable("non_qualifie", "a_contacter")).toBe(false);
  });

  it("laisse la personne à l'étape où elle en était", () => {
    /* Où en était la conversation reste vrai. Le jour où elle est
       requalifiée, on la retrouve au bon endroit, pas au début. */
    expect(etape("en_discussion").label).toBe("En discussion");
    expect(sortDeLaFileActive("qualifie", "en_discussion")).toBe(false);
  });

  it("les autres qualifications ne déplacent ni n'excluent personne", () => {
    /* Les deux axes restent indépendants : qualifier quelqu'un de gros
       potentiel ne dit RIEN de l'endroit où en est la conversation. */
    for (const q of ["a_qualifier", "qualifie", "gros_potentiel"] as const) {
      expect(sortDeLaFileActive(q, "a_contacter")).toBe(false);
      expect(estAppelable(q, "a_rappeler")).toBe(true);
    }
  });

  it("le vivier reste appelable, un mauvais numéro non", () => {
    expect(estAppelable("gros_potentiel", "vivier")).toBe(true);
    expect(sortDeLaFileActive("gros_potentiel", "vivier")).toBe(true);
    expect(estAppelable("qualifie", "mauvais_numero")).toBe(false);
  });
});

// --- Les couleurs existent vraiment, et se lisent ----------------------------

const CSS = readFileSync("src/app/crm/crm.css", "utf8");

function variables(theme: "dark" | "light"): Map<string, string> {
  const debut = CSS.indexOf(`.crm-root[data-crm-theme="${theme}"] {`);
  const fin = CSS.indexOf("\n}", debut);
  const bloc = CSS.slice(debut, fin);
  const m = new Map<string, string>();
  for (const ligne of bloc.matchAll(/(--[a-z0-9-_]+):\s*(#[0-9a-fA-F]{6})/g)) {
    m.set(ligne[1]!, ligne[2]!);
  }
  return m;
}

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const l = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * l[0]! + 0.7152 * l[1]! + 0.0722 * l[2]!;
}

function contraste(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}

describe("les couleurs de la légende", () => {
  for (const theme of ["dark", "light"] as const) {
    it(`sont toutes définies en thème ${theme}`, () => {
      const v = variables(theme);
      for (const e of ETAPES) expect(v.has(e.couleur), `${e.label} → ${e.couleur}`).toBe(true);
      for (const q of QUALIFICATIONS) expect(v.has(q.couleur), q.label).toBe(true);
    });

    it(`portent un libellé lisible en thème ${theme}`, () => {
      /* Le libellé d'une pastille est en 14 px gras, soit du « grand texte »
         au sens WCAG : le seuil est 3:1. On le vérifie plutôt que de le
         supposer — une pastille illisible ne sert à rien. */
      const v = variables(theme);
      for (const e of ETAPES) {
        const fond = v.get(e.couleur)!;
        /* On lit l'encre DÉCLARÉE PAR L'ÉTAPE, et non plus une exception
           écrite dans le test. C'est ce qui manquait : le test validait le
           bon contraste pendant que les composants posaient tous la même
           encre — noire sur noir en thème clair pour « Mauvais numéro ». */
        const sur = v.get(e.encre)!;
        expect(contraste(fond, sur), `${e.label} (${fond} / ${sur})`).toBeGreaterThanOrEqual(3);
      }
    });
  }
});

describe("encre des étapes", () => {
  it("chaque étape déclare l'encre posée sur sa couleur", () => {
    for (const e of ETAPES) expect(e.encre, e.label).toMatch(/^--crm-acq-sur-/);
  });

  it("« Mauvais numéro » est le SEUL repère à encre dédiée", () => {
    /* Il doit rester noir à texte blanc, distinct du rouge des refus : le
       noir ne porte que du blanc, et l'encre commune est sombre en thème
       clair. */
    const dedie = ETAPES.filter((e) => e.encre === "--crm-acq-sur-mauvais_numero");
    expect(dedie.map((e) => e.valeur)).toEqual(["mauvais_numero"]);
  });
});
