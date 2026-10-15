import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * GARDE-FOU : UNE CONTRAINTE QUI BOUGE NE DOIT PLUS FAIRE PERDRE UN LEAD.
 *
 * Le 15 octobre, les nouveaux acquéreurs ont cessé d'arriver pendant neuf
 * heures. La migration qui a resserré la contrainte de
 * `buyer_profiles.pipeline_stage` sur les sept étapes actuelles n'avait pas
 * touché à la VALEUR PAR DÉFAUT de la colonne, restée « nouveau » — une valeur
 * que la nouvelle contrainte refuse. `buyer_attach_interest` créait le dossier
 * sans préciser l'étape, la contrainte rejetait la ligne, et toute la
 * transaction de dépôt était annulée : ni manifestation, ni contact, ni trace.
 *
 * Le défaut ne frappait que les contacts NOUVEAUX — un visiteur déjà connu
 * retrouvait son dossier sans insertion — ce qui l'a rendu invisible plusieurs
 * heures.
 *
 * Ces deux vérifications relisent les migrations versionnées. Elles ne
 * remplacent pas la base, mais elles refusent de laisser repartir la même
 * erreur.
 */

const MIGRATIONS = join(process.cwd(), "supabase", "migrations");

function sqlDesMigrations(): string {
  return readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(join(MIGRATIONS, f), "utf8"))
    .join("\n");
}

/** Le dernier `set default` posé sur une colonne, les migrations étant jouées dans l'ordre. */
function dernierDefaut(sql: string, table: string, colonne: string): string | null {
  const motif = new RegExp(
    `alter\\s+table\\s+(?:public\\.)?${table}\\s+alter\\s+column\\s+${colonne}\\s+set\\s+default\\s+'([a-z_]+)'`,
    "gi",
  );
  let dernier: string | null = null;
  for (const m of sql.matchAll(motif)) dernier = m[1] ?? null;
  return dernier;
}

/** La dernière contrainte CHECK posée sur une colonne, et les valeurs qu'elle admet. */
function dernieresValeursAdmises(sql: string, table: string, colonne: string): string[] | null {
  const motif = new RegExp(
    `add\\s+constraint\\s+${table}_${colonne}_check[\\s\\S]{0,80}?check\\s*\\(([\\s\\S]{0,600}?)\\)\\s*;`,
    "gi",
  );
  let dernier: string | null = null;
  for (const m of sql.matchAll(motif)) dernier = m[1] ?? null;
  if (!dernier) return null;
  return [...dernier.matchAll(/'([a-z_]+)'/g)].map((m) => m[1] as string);
}

describe("valeurs par défaut et contraintes : elles doivent rester d'accord", () => {
  it("l'étape par défaut d'un dossier acquéreur est une étape autorisée", () => {
    const sql = sqlDesMigrations();
    const defaut = dernierDefaut(sql, "buyer_profiles", "pipeline_stage");
    const admises = dernieresValeursAdmises(sql, "buyer_profiles", "pipeline_stage");

    expect(defaut, "aucun `set default` trouvé pour buyer_profiles.pipeline_stage").not.toBeNull();
    expect(admises, "aucune contrainte trouvée pour buyer_profiles.pipeline_stage").not.toBeNull();
    expect(
      admises,
      `la valeur par défaut « ${defaut} » n'est pas admise par la contrainte : ` +
        "tout nouveau dossier serait rejeté, et avec lui le dépôt entier",
    ).toContain(defaut as string);
  });

  it("la création du dossier pose l'étape explicitement, sans compter sur le défaut", () => {
    const sql = sqlDesMigrations();
    /* La dernière définition de la fonction, les migrations étant ordonnées. */
    const defs = [...sql.matchAll(/create or replace function public\.buyer_attach_interest[\s\S]*?\n\$\$;/g)];
    expect(defs.length, "fonction buyer_attach_interest introuvable").toBeGreaterThan(0);
    const derniere = defs[defs.length - 1]![0];

    const insertion = /insert into public\.buyer_profiles \(([\s\S]*?)\)\s*values/.exec(derniere);
    expect(insertion, "insertion dans buyer_profiles introuvable").not.toBeNull();
    const colonnes = (insertion as RegExpExecArray)[1] as string;
    expect(
      colonnes.replace(/--[^\n]*/g, ""),
      "l'étape doit être posée explicitement : une contrainte qui change ne doit pas " +
        "pouvoir annuler le dépôt d'un acquéreur",
    ).toMatch(/pipeline_stage/);
  });
});
