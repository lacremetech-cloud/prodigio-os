import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  ETAPES,
  ETAPES_ACTIVES,
  ETAPES_HORS_FILE,
  QUALIFICATIONS,
  estEtapeConnue,
  estQualificationConnue,
  etape,
  etapeProposeeParQualification,
  qualification,
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
      "Écarté",
      "Mauvais numéro",
    ]);
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

  it("trois étapes sortent la personne de la file d'appels, le vivier non", () => {
    /* On rappelle quelqu'un du vivier : il est en attente, pas écarté. */
    expect(ETAPES_HORS_FILE).toEqual(["pas_interesse", "ecarte", "mauvais_numero"]);
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
  it("« non qualifié » propose de sortir la personne de la file", () => {
    /* Dans le MÊME enregistrement : lui demander ensuite de déplacer la carte
       à la main était le « je l'ai déjà fait » dont Antoine se plaignait. */
    expect(etapeProposeeParQualification("non_qualifie", "a_contacter")).toBe("ecarte");
    expect(etapeProposeeParQualification("non_qualifie", "en_discussion")).toBe("ecarte");
  });

  it("ne rétrograde pas une personne déjà sortie de la file", () => {
    /* « Pas intéressé » dit qu'elle a refusé ; « écarté » le perdrait. */
    expect(etapeProposeeParQualification("non_qualifie", "pas_interesse")).toBeNull();
    expect(etapeProposeeParQualification("non_qualifie", "mauvais_numero")).toBeNull();
  });

  it("ne propose rien pour les autres qualifications", () => {
    /* Qualifier quelqu'un de gros potentiel ne dit RIEN de l'endroit où en est
       la conversation. Les deux axes sont indépendants. */
    for (const q of ["a_qualifier", "qualifie", "gros_potentiel"] as const) {
      expect(etapeProposeeParQualification(q, "a_contacter")).toBeNull();
    }
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
      const encre = v.get("--crm-acq-sur-etape")!;
      for (const e of ETAPES) {
        const fond = v.get(e.couleur)!;
        const sur = e.valeur === "mauvais_numero" ? v.get("--crm-acq-sur-mauvais_numero")! : encre;
        expect(contraste(fond, sur), `${e.label} (${fond} / ${sur})`).toBeGreaterThanOrEqual(3);
      }
    });
  }
});
