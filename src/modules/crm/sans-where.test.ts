import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * AUCUNE FONCTION SQL DU DÉPÔT NE FAIT UN DELETE OU UN UPDATE SANS WHERE.
 *
 * En production, Supabase charge l'extension `safeupdate` pour toute requête
 * passée par l'API (rôle `authenticator`) : un DELETE ou un UPDATE sans WHERE y
 * est refusé — y compris À L'INTÉRIEUR d'une fonction SECURITY DEFINER, ou d'un
 * déclencheur réveillé par une écriture de l'API. Une base PostgreSQL locale ne
 * charge pas cette extension : la recette passait, la production échouait (la
 * lecture Meta du 22/11/2026, arrêtée à l'écriture de la couverture).
 *
 * Ce test relit la DERNIÈRE définition de chaque fonction des migrations (une
 * fonction remplacée ou supprimée plus tard ne compte plus) et refuse tout
 * DELETE ou UPDATE sans WHERE à son propre niveau — un WHERE dans une
 * sous-requête ne compte pas. Pour tout effacer exprès : `where true`, qui dit
 * l'intention et que safeupdate accepte.
 *
 * Limite connue : le SQL dynamique (`execute '…'`) n'est pas relu.
 */

const DOSSIER = join(process.cwd(), "supabase", "migrations");

/**
 * En UNE passe, commentaires effacés et chaînes vidées (même longueur) : un
 * `--` dans une chaîne n'ouvre pas un commentaire, une apostrophe dans un
 * commentaire n'ouvre pas une chaîne. Les corps `$…$` restent lisibles — c'est
 * eux qu'on relit. Une instruction écrite dans un message n'en est pas une.
 */
export function nettoyer(sql: string): string {
  let out = "";
  let i = 0;
  while (i < sql.length) {
    const c = sql[i]!;
    if (c === "-" && sql[i + 1] === "-") {
      while (i < sql.length && sql[i] !== "\n") {
        out += " ";
        i += 1;
      }
    } else if (c === "/" && sql[i + 1] === "*") {
      const fin = sql.indexOf("*/", i + 2);
      const bout = fin < 0 ? sql.length : fin + 2;
      out += sql.slice(i, bout).replace(/[^\n]/g, " ");
      i = bout;
    } else if (c === "'") {
      out += "'";
      i += 1;
      while (i < sql.length) {
        if (sql[i] === "'" && sql[i + 1] === "'") {
          out += "xx";
          i += 2;
        } else if (sql[i] === "'") {
          out += "'";
          i += 1;
          break;
        } else {
          out += sql[i] === "\n" ? "\n" : "x";
          i += 1;
        }
      }
    } else {
      out += c;
      i += 1;
    }
  }
  return out;
}

/** L'indice de la parenthèse fermante qui répond à celle de `ouvrante`. */
function fermante(texte: string, ouvrante: number): number {
  let profondeur = 0;
  for (let i = ouvrante; i < texte.length; i += 1) {
    if (texte[i] === "(") profondeur += 1;
    else if (texte[i] === ")") {
      profondeur -= 1;
      if (profondeur === 0) return i;
    }
  }
  return -1;
}

/** Les types des arguments, sans leurs noms ni leurs valeurs par défaut : la vraie identité d'une fonction. */
function typesDesArguments(args: string): string {
  const morceaux: string[] = [];
  let profondeur = 0;
  let courant = "";
  for (const c of args) {
    if (c === "(") profondeur += 1;
    if (c === ")") profondeur -= 1;
    if (c === "," && profondeur === 0) {
      morceaux.push(courant);
      courant = "";
    } else courant += c;
  }
  if (courant.trim()) morceaux.push(courant);
  return morceaux
    .map((m) => {
      const sansDefaut = m.split(/\s+default\s+|\s*=\s*/i)[0]!.trim().toLowerCase();
      const mots = sansDefaut.split(/\s+/).filter((x) => !["in", "out", "inout", "variadic"].includes(x));
      return (mots.length > 1 ? mots.slice(1) : mots).join(" ");
    })
    .join(",");
}

function cle(nom: string, args: string | null): string {
  return `${nom.toLowerCase().replace(/^public\./, "").replace(/"/g, "")}(${args === null ? "*" : typesDesArguments(args)})`;
}

interface Definition {
  cle: string;
  fichier: string;
  corps: string;
}

/** La dernière définition de chaque fonction, migration après migration. */
export function dernieresDefinitions(fichiers: { nom: string; sql: string }[]): Map<string, Definition> {
  const fonctions = new Map<string, Definition>();
  for (const { nom: fichier, sql } of fichiers) {
    const code = nettoyer(sql);
    const evenements: { position: number; agir: () => void }[] = [];

    for (const m of code.matchAll(/create\s+(?:or\s+replace\s+)?function\s+((?:"?[a-z_]\w*"?\.)?"?[a-z_]\w*"?)\s*\(/gi)) {
      const ouvrante = m.index! + m[0].length - 1;
      const fin = fermante(code, ouvrante);
      if (fin < 0) continue;
      const suite = code.slice(fin);
      const debutCorps = /\bas\s+(\$[a-z_]*\$)/i.exec(suite);
      if (!debutCorps) continue;
      const balise = debutCorps[1]!;
      const ouverture = fin + debutCorps.index + debutCorps[0].length;
      const fermeture = code.indexOf(balise, ouverture);
      if (fermeture < 0) continue;
      const k = cle(m[1]!, code.slice(ouvrante + 1, fin));
      const corps = code.slice(ouverture, fermeture);
      evenements.push({ position: m.index!, agir: () => fonctions.set(k, { cle: k, fichier, corps }) });
    }

    for (const m of code.matchAll(/drop\s+function\s+(?:if\s+exists\s+)?((?:"?[a-z_]\w*"?\.)?"?[a-z_]\w*"?)\s*(\()?/gi)) {
      const nom = m[1]!;
      let args: string | null = null;
      if (m[2]) {
        const ouvrante = m.index! + m[0].length - 1;
        const fin = fermante(code, ouvrante);
        if (fin > 0) args = code.slice(ouvrante + 1, fin);
      }
      evenements.push({
        position: m.index!,
        agir: () => {
          if (args !== null) fonctions.delete(cle(nom, args));
          else {
            const prefixe = cle(nom, null).replace("(*)", "(");
            for (const k of [...fonctions.keys()]) if (k.startsWith(prefixe)) fonctions.delete(k);
          }
        },
      });
    }

    for (const e of evenements.sort((a, b) => a.position - b.position)) e.agir();
  }
  return fonctions;
}

const RE_ECRITURE =
  /\b(delete\s+from|update\s+(?:only\s+)?(?!set\b)"?[a-z_][\w."]*(?:\s+(?:as\s+)?(?!set\b|where\b|from\b)[a-z_]\w*)?\s+set)\b/gi;

/** Chaque DELETE ou UPDATE du corps qui n'a pas de WHERE à son propre niveau. */
export function ecrituresSansWhere(corpsBrut: string): string[] {
  const corps = nettoyer(corpsBrut);
  const trouvees: string[] = [];
  for (const m of corps.matchAll(RE_ECRITURE)) {
    let profondeur = 0;
    let aUnWhere = false;
    let j = m.index!;
    for (; j < corps.length; j += 1) {
      const c = corps[j]!;
      if (c === "(") profondeur += 1;
      else if (c === ")") {
        if (profondeur === 0) break;
        profondeur -= 1;
      } else if (c === ";" && profondeur === 0) break;
      else if (
        profondeur === 0 &&
        /w/i.test(c) &&
        /^where\b/i.test(corps.slice(j, j + 6)) &&
        !/\w/.test(corps[j - 1] ?? " ")
      ) {
        aUnWhere = true;
      }
    }
    if (!aUnWhere) trouvees.push(corps.slice(m.index!, Math.min(j, m.index! + 90)).replace(/\s+/g, " ").trim());
  }
  return trouvees;
}

function migrations(): { nom: string; sql: string }[] {
  return readdirSync(DOSSIER)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((nom) => ({ nom, sql: readFileSync(join(DOSSIER, nom), "utf8") }));
}

describe("le lecteur de fonctions lui-même", () => {
  it("repère un DELETE ou un UPDATE sans WHERE à son niveau, et seulement eux", () => {
    expect(ecrituresSansWhere("begin delete from public.t; end;")).toHaveLength(1);
    expect(ecrituresSansWhere("begin delete from public.t where true; end;")).toEqual([]);
    expect(ecrituresSansWhere("update public.t set a = (select b from c where d = 1);")).toHaveLength(1);
    expect(ecrituresSansWhere("update public.t as x set a = 1 from u where u.id = x.id;")).toEqual([]);
    expect(ecrituresSansWhere("update only public.t set a = 1 where id = p_id;")).toEqual([]);
    expect(ecrituresSansWhere("with d as (delete from public.t returning *) select count(*) from d;")).toHaveLength(1);
    expect(ecrituresSansWhere("with d as (delete from public.t where x returning *) select count(*) from d;")).toEqual([]);
    // Ce qui n'est pas un UPDATE ni un DELETE.
    expect(ecrituresSansWhere("insert into t (k) values (1) on conflict (k) do update set a = excluded.a;")).toEqual([]);
    expect(ecrituresSansWhere("select * from t for update; select * from u for update skip locked;")).toEqual([]);
    expect(ecrituresSansWhere("update_at := now(); raise exception 'delete from t';")).toEqual([]);
    expect(ecrituresSansWhere("-- delete from t;\n/* update t set a = 1; */ select 1;")).toEqual([]);
    // Un `--` dans une chaîne n'est pas un commentaire : il ne cache pas la suite.
    expect(ecrituresSansWhere("raise notice '--- 7. l''essai'; delete from t;")).toHaveLength(1);
    // Une apostrophe dans un commentaire n'ouvre pas une chaîne.
    expect(ecrituresSansWhere("-- l'identifiant\ndelete from t;")).toHaveLength(1);
  });

  it("ne garde que la dernière définition d'une fonction, et oublie une fonction supprimée", () => {
    const defs = dernieresDefinitions([
      { nom: "1.sql", sql: "create function public.f(p_a uuid) returns void language sql as $$ delete from t; $$;" },
      { nom: "2.sql", sql: "create or replace function public.f(p_a uuid default null) returns void language sql as $fn$ delete from t where true; $fn$;" },
      { nom: "3.sql", sql: "create function public.g() returns void language sql as $$ delete from t; $$; drop function if exists public.g();" },
    ]);
    expect([...defs.keys()]).toEqual(["f(uuid)"]);
    expect(ecrituresSansWhere(defs.get("f(uuid)")!.corps)).toEqual([]);
  });
});

describe("aucune fonction du dépôt n'écrit sans WHERE (safeupdate, production)", () => {
  it("on lit bien les migrations (sinon le test ne garderait rien)", () => {
    expect(dernieresDefinitions(migrations()).size).toBeGreaterThan(100);
  });

  it("chaque DELETE et chaque UPDATE a son WHERE", () => {
    const fautes: string[] = [];
    for (const d of dernieresDefinitions(migrations()).values()) {
      for (const e of ecrituresSansWhere(d.corps)) fautes.push(`${d.fichier} — ${d.cle} : ${e}`);
    }
    expect(fautes, "En production, safeupdate refuse ces écritures. Ajouter un WHERE (ou `where true` pour tout viser exprès).").toEqual([]);
  });
});
