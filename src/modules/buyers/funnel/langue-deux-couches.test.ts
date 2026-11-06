import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { normaliserLangue } from "./langue";

/**
 * LA LANGUE EST LUE À DEUX ENDROITS. ILS DOIVENT LIRE PAREIL.
 *
 * Trouvé le 6 novembre en vérifiant le parcours anglais des Airelles :
 *
 *   TypeScript — `normaliserLangue()` tronque à deux lettres. « en-GB », « EN »
 *   et « en » donnent tous « en ». Son commentaire le promet explicitement.
 *
 *   SQL — `buyer_form_brochure()` comparait `lower(p_langue) = 'en'`, en exact.
 *   « en-GB » n'était donc pas de l'anglais pour elle : brochure française.
 *
 * Le défaut ne se voyait pas, et c'est ce qui le rendait dangereux :
 * l'application normalise avant d'appeler, donc la fonction ne recevait jamais
 * que « fr » ou « en ». Il attendait un appel direct, un second client, ou une
 * page transmettant `Accept-Language` tel quel — et il aurait échoué en
 * silence, un anglophone recevant la brochure française sans erreur nulle part.
 */

const CAS: { entree: string | null; anglais: boolean }[] = [
  { entree: "en", anglais: true },
  { entree: "EN", anglais: true },
  { entree: "en-GB", anglais: true },
  { entree: "en_US", anglais: true },
  { entree: "  en  ", anglais: true },
  { entree: "fr", anglais: false },
  { entree: "fr-CA", anglais: false },
  { entree: "zz", anglais: false },
  { entree: "", anglais: false },
  { entree: null, anglais: false },
];

describe("la couche TypeScript", () => {
  it("ramène toute variante d'anglais à « en », le reste au français", () => {
    for (const c of CAS) {
      expect(normaliserLangue(c.entree), String(c.entree)).toBe(c.anglais ? "en" : "fr");
    }
  });
});

describe("la couche SQL lit la langue de la même façon", () => {
  /** Dernière définition de la fonction, migrations lues dans l'ordre. */
  function definitionEffective(nom: string): string {
    const dossier = "supabase/migrations";
    let trouvee = "";
    for (const f of readdirSync(dossier).filter((x) => x.endsWith(".sql")).sort()) {
      const sql = readFileSync(join(dossier, f), "utf8");
      const entetes = [
        ...sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z0-9_]+)\s*\(/gi),
      ];
      for (let i = 0; i < entetes.length; i += 1) {
        if (entetes[i]![1] !== nom) continue;
        const fin = i + 1 < entetes.length ? entetes[i + 1]!.index! : sql.length;
        trouvee = sql.slice(entetes[i]!.index!, fin);
      }
    }
    return trouvee;
  }

  const fn = definitionEffective("buyer_form_brochure");

  it("tronque elle aussi à deux lettres", () => {
    expect(fn).not.toBe("");
    expect(fn).toMatch(/left\(\s*lower\(\s*btrim\(\s*coalesce\(p_langue/);
    expect(fn).toContain("), 2) = 'en'");
  });

  it("la comparaison exacte, qui écartait « en-GB », n'est plus là", () => {
    // `lower(p_langue) = 'en'` sans troncature : c'était le défaut.
    expect(fn).not.toMatch(/lower\(\s*coalesce\(p_langue[^)]*\)\s*\)\s*=\s*'en'/);
  });

  it("sans brochure anglaise renseignée, elle retombe sur la française", () => {
    // Un bien sans version anglaise ne doit pas renvoyer null : le visiteur
    // resterait sur le formulaire qu'il vient de remplir, sans rien comprendre.
    expect(fn).toContain("coalesce(nullif(btrim(c.buyer_form_brochure_url_en), ''),");
    expect(fn).toContain("c.buyer_form_brochure_url)");
  });
});
