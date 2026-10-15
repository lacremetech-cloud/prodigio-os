import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * GARDE-FOU : UNE CONTRAINTE QUI BOUGE NE DOIT PLUS FAIRE PERDRE UN LEAD.
 *
 * Le 14 octobre au soir, les nouveaux acquéreurs ont cessé d'arriver pendant
 * vingt-deux heures — 65 dépôts rejetés. La migration qui a resserré la
 * contrainte de `buyer_profiles.pipeline_stage` sur les sept étapes actuelles
 * n'avait pas touché à la VALEUR PAR DÉFAUT de la colonne, restée « nouveau »,
 * que la nouvelle contrainte refuse. `buyer_attach_interest` créait le dossier
 * sans préciser l'étape : la contrainte rejetait la ligne, et toute la
 * transaction de dépôt était annulée — ni manifestation, ni contact, ni trace.
 *
 * Le défaut ne frappait que les contacts NOUVEAUX — un visiteur déjà connu
 * retrouvait son dossier sans insertion — ce qui l'a rendu invisible une
 * journée entière.
 *
 * Ces vérifications relisent les migrations versionnées, dans l'ordre. Elles
 * ne remplacent pas la base, mais elles refusent de laisser repartir la même
 * erreur, sur CETTE colonne comme sur n'importe quelle autre.
 */

const MIGRATIONS = join(process.cwd(), "supabase", "migrations");

function sqlDesMigrations(): string {
  return readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(join(MIGRATIONS, f), "utf8"))
    .join("\n");
}

/** Les commentaires SQL cachent des exemples : on ne lit que les instructions. */
function sansCommentaires(sql: string): string {
  return sql
    .split("\n")
    .map((l) => l.replace(/--.*$/, ""))
    .join("\n");
}

interface Colonne {
  table: string;
  colonne: string;
}

/** Le dernier `set default` posé sur chaque colonne, les migrations étant ordonnées. */
function derniersDefauts(sql: string): Map<string, string> {
  const out = new Map<string, string>();
  const motif =
    /alter\s+table\s+(?:public\.)?(\w+)\s+alter\s+column\s+(\w+)\s+set\s+default\s+'([a-z_]+)'/gi;
  for (const m of sql.matchAll(motif)) {
    out.set(`${(m[1] as string).toLowerCase()}.${(m[2] as string).toLowerCase()}`, m[3] as string);
  }
  /* Les colonnes nées avec leur défaut, dans un `create table`. */
  const creation = /create\s+table[^;]*?public\.(\w+)\s*\(([\s\S]*?)\n\)\s*;/gi;
  for (const t of sql.matchAll(creation)) {
    const table = (t[1] as string).toLowerCase();
    const corps = t[2] as string;
    const col = /(\w+)\s+text[^,\n]*?default\s+'([a-z_]+)'/gi;
    for (const c of corps.matchAll(col)) {
      const cle = `${table}.${(c[1] as string).toLowerCase()}`;
      if (!out.has(cle)) out.set(cle, c[2] as string);
    }
  }
  return out;
}

/**
 * La dernière contrainte énumérée posée sur chaque colonne.
 *
 * On ne découpe PAS le nom de la contrainte pour en déduire la table et la
 * colonne : `buyer_profiles_pipeline_stage_check` ne se sépare pas de façon
 * fiable, les deux parties contenant des tirets bas. On lit la table dans le
 * `alter table` et la colonne dans le `check` lui-même, où elles sont sans
 * ambiguïté.
 */
function dernieresValeursAdmises(sql: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const motif =
    /alter\s+table\s+(?:public\.)?(\w+)\s+add\s+constraint\s+\w+\s+check\s*\(\s*\(?\s*(\w+)\s+(?:in|=\s*any)\s*\(?\s*(?:array\s*\[)?([^)\]]*)/gi;
  for (const m of sql.matchAll(motif)) {
    const cle = `${(m[1] as string).toLowerCase()}.${(m[2] as string).toLowerCase()}`;
    const valeurs = [...(m[3] as string).matchAll(/'([a-z_]+)'/g)].map((v) => v[1] as string);
    if (valeurs.length > 0) out.set(cle, valeurs);
  }
  return out;
}

describe("valeurs par défaut et contraintes : elles doivent rester d'accord", () => {
  it("aucune colonne n'a une valeur par défaut que sa propre contrainte refuse", () => {
    const sql = sansCommentaires(sqlDesMigrations());
    const defauts = derniersDefauts(sql);
    const admises = dernieresValeursAdmises(sql);

    const fautes: string[] = [];
    for (const [cle, defaut] of defauts) {
      const liste = admises.get(cle);
      if (!liste) continue; // pas de contrainte énumérée : rien à comparer
      if (!liste.includes(defaut)) {
        fautes.push(
          `${cle} : défaut « ${defaut} », contrainte « ${liste.join(" | ")} ». ` +
            "Toute insertion qui ne précise pas cette colonne serait rejetée, " +
            "et avec elle la transaction entière.",
        );
      }
    }
    expect(fautes, fautes.join("\n")).toEqual([]);
  });

  /* Le cas précis qui a coûté la journée, verrouillé nommément : si la
     détection générique se faisait contourner par une écriture inhabituelle,
     celui-ci tiendrait quand même. */
  it("l'étape par défaut d'un dossier acquéreur reste une étape autorisée", () => {
    const sql = sansCommentaires(sqlDesMigrations());
    const defaut = derniersDefauts(sql).get("buyer_profiles.pipeline_stage");
    const admises = dernieresValeursAdmises(sql).get("buyer_profiles.pipeline_stage");
    expect(defaut, "aucun défaut trouvé pour buyer_profiles.pipeline_stage").toBeDefined();
    expect(admises, "aucune contrainte trouvée pour buyer_profiles.pipeline_stage").toBeDefined();
    expect(admises as string[]).toContain(defaut as string);
  });

  it("la création du dossier pose l'étape explicitement, sans compter sur le défaut", () => {
    const sql = sqlDesMigrations();
    const defs = [
      ...sql.matchAll(/create or replace function public\.buyer_attach_interest[\s\S]*?\n\$\$;/g),
    ];
    expect(defs.length, "fonction buyer_attach_interest introuvable").toBeGreaterThan(0);
    const derniere = (defs[defs.length - 1] as RegExpMatchArray)[0];
    const insertion = /insert into public\.buyer_profiles \(([\s\S]*?)\)\s*values/.exec(derniere);
    expect(insertion, "insertion dans buyer_profiles introuvable").not.toBeNull();
    const colonnes = ((insertion as RegExpExecArray)[1] as string).replace(/--[^\n]*/g, "");
    expect(
      colonnes,
      "l'étape doit être posée explicitement : une contrainte qui change ne doit " +
        "pas pouvoir annuler le dépôt d'un acquéreur",
    ).toMatch(/pipeline_stage/);
  });
});
