import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * LES DEUX LISTES FERMÉES DU JOURNAL D'AUDIT, TENUES PAR UN TEST.
 *
 * `audit_events_event_type_check` et `audit_events_entity_type_check` sont
 * réécrites EN ENTIER à chaque migration qui ajoute un type : une contrainte
 * ne s'étend pas, elle se remplace. Deux fautes sont possibles, et toutes deux
 * sont muettes jusqu'au clic :
 *
 *  1. OUBLIER une valeur en recopiant la liste. Toute fonction qui l'écrit
 *     échoue alors, et avec elle la transaction qui la porte — l'étape, la
 *     qualification, le mandat, tout est annulé.
 *  2. ÉCRIRE un type qu'aucune liste ne déclare. C'est l'incident du
 *     28 octobre : une RPC journalisait un type absent de la contrainte ;
 *     l'écran ne savait pas dire pourquoi rien ne s'enregistrait.
 *
 * Le test acquéreur (`buyers/crm/evenements-audit.test.ts`) couvre le second
 * cas pour les seuls événements `acquereur_*`. Celui-ci couvre TOUTES les
 * fonctions, et le premier cas en plus : chaque réécriture doit être un
 * sur-ensemble de la précédente. Il relit les migrations versionnées, dans
 * l'ordre ; la base elle-même se vérifie à l'application.
 */

const DOSSIER = join(process.cwd(), "supabase", "migrations");

function migrations(): { nom: string; sql: string }[] {
  return readdirSync(DOSSIER)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((nom) => ({ nom, sql: readFileSync(join(DOSSIER, nom), "utf8") }));
}

/** Les commentaires `--` portent des exemples : on ne lit que les instructions. */
function sansCommentaires(sql: string): string {
  return sql
    .split("\n")
    .map((l) => l.replace(/--.*$/, ""))
    .join("\n");
}

const CONTRAINTES = ["audit_events_event_type_check", "audit_events_entity_type_check"] as const;

/** Chaque définition d'une contrainte, dans l'ordre des migrations. */
function definitions(contrainte: string): { nom: string; valeurs: Set<string> }[] {
  const out: { nom: string; valeurs: Set<string> }[] = [];
  const motif = new RegExp(
    `add\\s+constraint\\s+${contrainte}\\s+check\\s*\\(([\\s\\S]*?)\\)\\s*\\)?\\s*;`,
    "gi",
  );
  for (const m of migrations()) {
    for (const d of sansCommentaires(m.sql).matchAll(motif)) {
      out.push({ nom: m.nom, valeurs: new Set([...d[1]!.matchAll(/'([a-z_]+)'/g)].map((v) => v[1]!)) });
    }
  }
  return out;
}

/** Dernière définition de chaque fonction : une migration plus récente remplace. */
function fonctionsEffectives(): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of migrations()) {
    const sql = sansCommentaires(m.sql);
    const entetes = [...sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z0-9_]+)\s*\(/gi)];
    for (let i = 0; i < entetes.length; i += 1) {
      const debut = entetes[i]!.index!;
      const fin = i + 1 < entetes.length ? entetes[i + 1]!.index! : sql.length;
      out.set(entetes[i]![1]!, sql.slice(debut, fin));
    }
  }
  return out;
}

/** Découpe une liste de valeurs SQL aux virgules de premier niveau. */
function decouper(valeurs: string): string[] {
  const parts: string[] = [];
  let profondeur = 0;
  let dansChaine = false;
  let courant = "";
  for (const c of valeurs) {
    if (c === "'") dansChaine = !dansChaine;
    if (!dansChaine && c === "(") profondeur += 1;
    if (!dansChaine && c === ")") profondeur -= 1;
    if (!dansChaine && c === "," && profondeur === 0) {
      parts.push(courant.trim());
      courant = "";
    } else courant += c;
  }
  parts.push(courant.trim());
  return parts;
}

/**
 * Les types littéraux qu'une expression peut produire : `'x'`, ou les branches
 * `then 'x'` / `else 'x'` d'un `case`. Une variable (`v_evt`) n'est pas lisible
 * ici : elle est ignorée, et ce n'est pas ce test qui la garde.
 */
function litteraux(expression: string): string[] {
  const seul = /^'([a-z_]+)'$/.exec(expression);
  if (seul) return [seul[1]!];
  return [...expression.matchAll(/\b(?:then|else)\s+'([a-z_]+)'/gi)].map((m) => m[1]!);
}

interface Ecriture {
  fonction: string;
  colonne: "event_type" | "entity_type";
  valeur: string;
}

/** Chaque `insert into public.audit_events (...) values (...)` des fonctions. */
function ecrituresDAudit(): Ecriture[] {
  const out: Ecriture[] = [];
  for (const [fonction, corps] of fonctionsEffectives()) {
    for (const m of corps.matchAll(/insert\s+into\s+public\.audit_events\s*\(([^)]*)\)\s*values\s*\(([\s\S]*?)\)\s*;/gi)) {
      const colonnes = m[1]!.split(",").map((c) => c.trim().toLowerCase());
      const valeurs = decouper(m[2]!);
      for (const colonne of ["event_type", "entity_type"] as const) {
        const i = colonnes.indexOf(colonne);
        if (i < 0 || !valeurs[i]) continue;
        for (const valeur of litteraux(valeurs[i]!)) out.push({ fonction, colonne, valeur });
      }
    }
  }
  return out;
}

describe("les listes fermées du journal d'audit", () => {
  it("on lit bien les migrations — sinon le test passerait en ne regardant rien", () => {
    expect(definitions("audit_events_event_type_check").length).toBeGreaterThan(5);
    expect(definitions("audit_events_entity_type_check").length).toBeGreaterThan(3);
    expect(ecrituresDAudit().length).toBeGreaterThan(50);
  });

  for (const contrainte of CONTRAINTES) {
    it(`${contrainte} : chaque réécriture garde TOUTES les valeurs de la précédente`, () => {
      const defs = definitions(contrainte);
      const pertes: string[] = [];
      for (let i = 1; i < defs.length; i += 1) {
        const avant = defs[i - 1]!;
        const apres = defs[i]!;
        const perdues = [...avant.valeurs].filter((v) => !apres.valeurs.has(v));
        if (perdues.length > 0) pertes.push(`${apres.nom} a perdu : ${perdues.join(", ")}`);
      }
      expect(pertes, pertes.join("\n")).toEqual([]);
    });
  }

  it("chaque type écrit par une fonction figure dans la dernière liste", () => {
    const derniere = {
      event_type: definitions("audit_events_event_type_check").at(-1)!.valeurs,
      entity_type: definitions("audit_events_entity_type_check").at(-1)!.valeurs,
    };
    const orphelins = ecrituresDAudit()
      .filter((e) => !derniere[e.colonne].has(e.valeur))
      .map((e) => `${e.fonction} écrit ${e.colonne} = « ${e.valeur} »`);
    expect(orphelins, orphelins.join("\n")).toEqual([]);
  });

  it("l'extracteur attrape vraiment une faute — et lit les branches d'un case", () => {
    expect(litteraux("'acquereur_etape'")).toEqual(["acquereur_etape"]);
    expect(
      litteraux("case when v_nouveau then 'pilotage_lot_cree' else 'pilotage_lot_modifie' end"),
    ).toEqual(["pilotage_lot_cree", "pilotage_lot_modifie"]);
    // La valeur comparée (`when p_status = 'actif'`) n'est pas un type écrit.
    expect(litteraux("case when p_status = 'actif' then 'activation_membre' else 'desactivation_membre' end"))
      .toEqual(["activation_membre", "desactivation_membre"]);
    expect(decouper("v_uid, 'property', coalesce(a, b), 'bien_cree'")).toEqual([
      "v_uid",
      "'property'",
      "coalesce(a, b)",
      "'bien_cree'",
    ]);
  });
});
