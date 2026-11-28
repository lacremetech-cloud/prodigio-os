import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ETAPES_ACQUEREUR } from "./vocabulaire";

/**
 * AUCUNE FONCTION ACQUÉREUR N'ÉCRIT UNE ÉTAPE HORS DES NEUF DU PIPELINE.
 *
 * Le 12/10/2026, trois fonctions (offre, résultat, réouverture) ont été
 * réécrites vers les clés du pipeline à huit colonnes ; le pipeline est passé
 * à neuf étapes le 10/11/2026 sans elles, et la base a refusé chaque appel
 * jusqu'au 23/11/2026 (`20261123200000_formulaires_acquereur_neuf_etapes`).
 *
 * Ce test relit la DERNIÈRE définition de chaque fonction `crm_buyer_*` des
 * migrations et refuse toute étape littérale (`pipeline_stage = '…'`) qui
 * n'est pas l'une des neuf. Limite : le SQL dynamique (une réécriture par
 * `replace()` dans un bloc `do`) n'est pas relu ; la recette
 * `scripts/formulaires-acquereur.sql` vérifie l'état réel de la base.
 */

const DOSSIER = join(process.cwd(), "supabase", "migrations");

/** Les corps des fonctions `crm_buyer_*`, la dernière définition l'emportant. */
function dernieresDefinitions(): Map<string, { fichier: string; corps: string }> {
  const out = new Map<string, { fichier: string; corps: string }>();
  for (const fichier of readdirSync(DOSSIER).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = readFileSync(join(DOSSIER, fichier), "utf8");
    const debut = /create\s+or\s+replace\s+function\s+(?:public\.)?(crm_buyer_\w+)\s*\(/gi;
    for (let m = debut.exec(sql); m; m = debut.exec(sql)) {
      const nom = m[1]!.toLowerCase();
      const as = /\bas\s+(\$\w*\$)/i.exec(sql.slice(m.index));
      if (!as) continue;
      const balise = as[1]!;
      const ouverture = m.index + as.index + as[0].length;
      const fermeture = sql.indexOf(balise, ouverture);
      if (fermeture < 0) continue;
      out.set(nom, { fichier, corps: sql.slice(ouverture, fermeture) });
    }
  }
  return out;
}

describe("les fonctions acquéreur n'écrivent que les neuf étapes du pipeline", () => {
  const definitions = dernieresDefinitions();

  it("on relit bien les fonctions acquéreur des migrations", () => {
    expect(definitions.size).toBeGreaterThan(10);
    for (const f of ["crm_buyer_record_offer", "crm_buyer_record_outcome", "crm_buyer_reopen"]) {
      expect(definitions.get(f)?.fichier, f).toBe("20261123200000_formulaires_acquereur_neuf_etapes.sql");
    }
  });

  it("chaque étape écrite en toutes lettres est l'une des neuf", () => {
    const permises = new Set<string>(ETAPES_ACQUEREUR);
    const fautes: string[] = [];
    for (const [nom, { fichier, corps }] of definitions) {
      const sansCommentaires = corps.replace(/--.*$/gm, "");
      for (const m of sansCommentaires.matchAll(/pipeline_stage\s*=\s*'([a-z_]+)'/g)) {
        if (!permises.has(m[1]!)) fautes.push(`${nom} (${fichier}) : ${m[1]}`);
      }
    }
    expect(fautes).toEqual([]);
  });

  it("offre → offre en cours ; perdu → pas intéressé ; gagné garde l'étape ; rouvrir → à rappeler", () => {
    const corps = (nom: string) => definitions.get(nom)!.corps.replace(/--.*$/gm, "");
    expect(corps("crm_buyer_record_offer")).toMatch(/pipeline_stage\s*=\s*'offre_en_cours'/);
    expect(corps("crm_buyer_record_outcome")).toMatch(
      /v_stage\s*:=\s*case\s+when\s+p_outcome\s*=\s*'gagne'\s+then\s+v_old\s+else\s+'pas_interesse'\s+end/,
    );
    expect(corps("crm_buyer_reopen")).toMatch(/pipeline_stage\s*=\s*'a_rappeler'/);
  });
});
