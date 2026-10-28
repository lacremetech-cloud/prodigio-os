import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * UN FICHIER « use server » N'EXPORTE QUE DES FONCTIONS ASYNC.
 *
 * Cette règle n'est pas une convention de style : la transformation des actions
 * serveur réécrit la liste d'exports du module. Tout ce qui n'est pas une
 * fonction async y devient une référence à l'exécution — y compris un
 * `export type`, dont le symbole a pourtant été effacé par `import type`.
 * Le module lève alors `ReferenceError: X is not defined` À SON ÉVALUATION,
 * donc AVANT d'exécuter la moindre action : tout l'écran tombe, et le message
 * affiché à l'utilisateur est le repli générique, qui ne dit rien de la cause.
 *
 * C'est arrivé deux fois.
 *  - Octobre : `safeRedirect`, `messageUtilisateur` et `membresAffectables`
 *    ont dû être sortis dans leurs propres modules.
 *  - 7 octobre : `export type { PropertyPublicMediaRow }` a été ajouté à
 *    `buyers/public/actions.ts`. La panne est restée invisible trois semaines,
 *    parce que ce module ne s'évalue qu'au premier enregistrement depuis la
 *    fiche d'un bien. Elle a éclaté le 28 octobre, en créant Les Airelles.
 *
 * D'où ce test. Il coûte quelques millisecondes et rend la règle impossible
 * à enfreindre sans s'en apercevoir.
 */

const RACINE = join(process.cwd(), "src");

function fichiersTypeScript(dossier: string): string[] {
  const out: string[] = [];
  for (const entree of readdirSync(dossier)) {
    if (entree === "node_modules" || entree.startsWith(".")) continue;
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) {
      out.push(...fichiersTypeScript(chemin));
      continue;
    }
    if (/\.tsx?$/.test(entree) && !/\.test\.tsx?$/.test(entree)) out.push(chemin);
  }
  return out;
}

/** Les fichiers dont la première instruction est la directive. */
function fichiersUseServer(): string[] {
  return fichiersTypeScript(RACINE).filter((chemin) => {
    const tete = readFileSync(chemin, "utf8").trimStart().slice(0, 40);
    return /^["']use server["']/.test(tete);
  });
}

/**
 * Les exports de premier niveau, avec leur numéro de ligne. On ne regarde que
 * la colonne 0 : un `export` indenté est à l'intérieur d'autre chose, et la
 * transformation ne le touche pas.
 */
function exportsDePremierNiveau(source: string): { ligne: number; texte: string }[] {
  return source
    .split("\n")
    .map((texte, i) => ({ ligne: i + 1, texte }))
    .filter(({ texte }) => /^export\b/.test(texte));
}

/**
 * CE QUI CASSE, ET CE QUI NE CASSE PAS — la distinction est fine mais nette.
 *
 * Inoffensif : `export interface Foo {}` et `export type Foo = ...` déclarés
 * SUR PLACE. TypeScript les efface entièrement ; il ne reste aucun symbole à
 * exporter, donc rien à référencer. La preuve : `properties/brief/actions.ts`
 * en contient depuis des mois et la fabrique à biens fonctionne.
 *
 * Dangereux : le RÉ-EXPORT — `export { X }` ou `export type { X }`. Là, la
 * liste d'exports nomme un symbole LOCAL, que `import type` a effacé. La
 * transformation émet la référence, et le module meurt à l'évaluation.
 * Dangereux aussi : toute valeur exportée (`const`, `let`, `class`, `enum`,
 * fonction non async), que Next refuse de toute façon dans ce type de fichier.
 */
const RE_EXPORT = /^export\s+(type\s+)?\{/;
const DECLARATION_DE_TYPE = /^export\s+(interface|type)\s+\w/;
const FONCTION_ASYNC = /^export\s+(default\s+)?async\s+function\b/;

function estDangereux(texte: string): boolean {
  if (RE_EXPORT.test(texte)) return true;
  if (DECLARATION_DE_TYPE.test(texte)) return false;
  if (FONCTION_ASYNC.test(texte)) return false;
  return true;
}

describe("fichiers « use server »", () => {
  const fichiers = fichiersUseServer();

  it("sont bien détectés (sinon ce test ne garde rien)", () => {
    // Un test de garde qui ne regarde aucun fichier passerait toujours : on
    // vérifie donc d'abord qu'il a bien de quoi mordre.
    expect(fichiers.length).toBeGreaterThan(5);
  });

  it("ne ré-exportent jamais un symbole importé", () => {
    const fautes: string[] = [];

    for (const chemin of fichiers) {
      const source = readFileSync(chemin, "utf8");
      const relatif = chemin.slice(process.cwd().length + 1);
      for (const { ligne, texte } of exportsDePremierNiveau(source)) {
        if (!estDangereux(texte)) continue;
        fautes.push(`${relatif}:${ligne} → ${texte.trim()}`);
      }
    }

    // Le message porte la règle ET le remède : qui le lit sait quoi faire.
    expect(
      fautes,
      "Un fichier « use server » n'exporte que des fonctions async, ou des\n" +
        "types DÉCLARÉS SUR PLACE (ceux-là sont effacés sans laisser de trace).\n" +
        "Un ré-export (`export { X }`, `export type { X }`) ou une valeur y\n" +
        "devient une référence à l'exécution et casse TOUT l'écran dès\n" +
        "l'évaluation du module — avant la moindre action.\n" +
        "Remède : importez le symbole depuis sa source, sans passer par ici.\n\n" +
        "Exports fautifs :\n" +
        fautes.join("\n"),
    ).toEqual([]);
  });
});
