import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BUYER_EXECUTE_SURFACE,
  INTERNAL_HELPERS,
  PUBLIC_ENTRY_POINTS,
  functionName,
} from "./execute-surface";

/**
 * Garde-fou de **sécurité** sur la surface EXECUTE du CRM Acquéreurs.
 *
 * Ces tests relisent les migrations SQL versionnées et refusent toute
 * régression : un helper interne ne doit jamais acquérir silencieusement
 * `EXECUTE` pour `authenticated`, et les points d'entrée publics ne doivent pas
 * perdre le leur.
 *
 * Ils vérifient l'**intention exprimée dans les migrations** (source de vérité
 * versionnée). La conformité de la base elle-même est vérifiée séparément lors
 * de l'application (voir docs/20 § surface EXECUTE).
 */

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

function readMigrations(): { name: string; sql: string }[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((name) => ({ name, sql: readFileSync(join(MIGRATIONS_DIR, name), "utf8") }));
}

/**
 * Les migrations accordent parfois les privilèges depuis un bloc
 * `do $$ … execute format('grant execute on function %s to authenticated', fn) … $$`
 * parcourant une liste de signatures. On **déplie** ces blocs en instructions
 * explicites afin que l'analyse ci-dessous voie les mêmes privilèges que
 * PostgreSQL.
 */
function expandDoBlocks(sql: string): string {
  return sql.replace(/do \$\$[\s\S]*?\$\$;/gi, (block) => {
    const signatures = [...block.matchAll(/'(public\.[a-z0-9_]+\([^']*\))'/gi)].map((m) => m[1]!);
    if (signatures.length === 0) return "";
    const templates = [...block.matchAll(/format\(\s*'((?:revoke|grant)[^']*)'/gi)].map(
      (m) => m[1]!,
    );
    return templates
      .flatMap((tpl) => signatures.map((sig) => tpl.replace("%s", sig)))
      .join(";\n")
      .concat(";");
  });
}

/** Concaténation de toutes les migrations, dans l'ordre d'application. */
const ALL_SQL = expandDoBlocks(
  readMigrations()
    .map((m) => m.sql)
    .join("\n"),
);

/**
 * Dernier privilège exprimé pour `fn` vis-à-vis de `role`, en parcourant les
 * migrations dans l'ordre : `true` si un GRANT est postérieur au dernier
 * REVOKE, `false` sinon.
 */
function lastPrivilege(fn: string, role: "anon" | "authenticated"): boolean {
  let granted = false;
  const needle = `public.${fn.toLowerCase()}(`;
  for (const raw of ALL_SQL.split(";")) {
    const s = raw.replace(/\s+/g, " ").toLowerCase();
    if (!s.includes(needle)) continue;
    if (!new RegExp(`\\b${role}\\b`).test(s)) continue;
    if (/\brevoke\b/.test(s)) granted = false;
    else if (/\bgrant\s+execute\b/.test(s)) granted = true;
  }
  return granted;
}

describe("surface EXECUTE — classification", () => {
  it("couvre toute la surface du module, chaque fonction dans une catégorie unique", () => {
    // 18 = les 17 fonctions créées par `buyers_crm_v1`
    //    + `crm_buyer_interest_set_status`, héritée de
    //      `20260802120000_public_property_experience_v1` (réception des
    //      intérêts depuis la Fabrique de biens).
    expect(BUYER_EXECUTE_SURFACE).toHaveLength(18);
    const names = BUYER_EXECUTE_SURFACE.map((e) => functionName(e.signature));
    expect(new Set(names).size).toBe(18);
  });

  it("ne déclare aucun helper interne avec un droit anon ou authenticated", () => {
    for (const entry of BUYER_EXECUTE_SURFACE) {
      if (entry.category === "helper_interne") {
        expect(entry.grants, `${entry.signature} doit rester sans droit`).toEqual([]);
      }
    }
  });

  it("n'expose à anon que les points d'entrée publics déclarés", () => {
    expect(PUBLIC_ENTRY_POINTS).toEqual(["submit_buyer_interest"]);
  });
});

describe("surface EXECUTE — cohérence avec les migrations SQL", () => {
  it("aucun helper interne n'est exécutable par authenticated", () => {
    for (const fn of INTERNAL_HELPERS) {
      expect(
        lastPrivilege(fn, "authenticated"),
        `${fn} est un helper interne : il ne doit pas avoir EXECUTE pour authenticated`,
      ).toBe(false);
    }
  });

  it("aucun helper interne n'est exécutable par anon", () => {
    for (const fn of INTERNAL_HELPERS) {
      expect(lastPrivilege(fn, "anon"), `${fn} ne doit pas avoir EXECUTE pour anon`).toBe(false);
    }
  });

  it("chaque helper interne est explicitement révoqué pour authenticated", () => {
    // Défense en profondeur : Supabase accorde EXECUTE par défaut aux rôles du
    // schéma public. Une révocation limitée à « public, anon » ne suffit donc pas.
    for (const fn of INTERNAL_HELPERS) {
      const revoked = ALL_SQL.split(";").some((raw) => {
        const s = raw.replace(/\s+/g, " ").toLowerCase();
        return (
          s.includes(`revoke all on function public.${fn}(`) && /\bauthenticated\b/.test(s)
        );
      });
      expect(revoked, `${fn} doit être explicitement révoquée pour authenticated`).toBe(true);
    }
  });

  it("submit_buyer_interest conserve son parcours public", () => {
    expect(lastPrivilege("submit_buyer_interest", "anon")).toBe(true);
    expect(lastPrivilege("submit_buyer_interest", "authenticated")).toBe(true);
  });

  it("crm_buyer_profile_access conserve EXECUTE (helper requis par les politiques RLS)", () => {
    // Les politiques RLS sont évaluées avec les privilèges du rôle appelant :
    // révoquer ce droit casserait la lecture autorisée.
    expect(lastPrivilege("crm_buyer_profile_access", "authenticated")).toBe(true);
  });

  it("les actions CRM restent exécutables par authenticated", () => {
    const actions = BUYER_EXECUTE_SURFACE.filter(
      (e) => e.category === "action_crm_authentifiee",
    ).map((e) => functionName(e.signature));
    expect(actions.length).toBeGreaterThan(0);
    for (const fn of actions) {
      expect(lastPrivilege(fn, "authenticated"), `${fn} doit rester utilisable par le CRM`).toBe(
        true,
      );
    }
  });

  it("aucune action CRM n'est exposée à anon", () => {
    const actions = BUYER_EXECUTE_SURFACE.filter(
      (e) => e.category === "action_crm_authentifiee",
    ).map((e) => functionName(e.signature));
    for (const fn of actions) {
      expect(lastPrivilege(fn, "anon"), `${fn} ne doit jamais être exposée à anon`).toBe(false);
    }
  });
});

describe("migration de durcissement", () => {
  const hardening = readMigrations().find((m) =>
    m.name.includes("buyers_crm_restrict_internal_execute"),
  );

  it("est présente et versionnée", () => {
    expect(hardening).toBeDefined();
  });

  it("ne touche qu'aux privilèges (aucun DDL de table, politique ou fonction)", () => {
    const sql = (hardening?.sql ?? "").toLowerCase();
    for (const forbidden of [
      "create table",
      "alter table",
      "drop table",
      "create policy",
      "drop policy",
      "create or replace function",
      "drop function",
      "delete from",
      "update public.",
      "insert into",
    ]) {
      expect(sql.includes(forbidden), `la migration ne doit pas contenir « ${forbidden} »`).toBe(
        false,
      );
    }
  });

  it("révoque les trois helpers internes, et pas crm_buyer_profile_access", () => {
    const sql = (hardening?.sql ?? "").toLowerCase();
    for (const fn of INTERNAL_HELPERS) {
      expect(sql.includes(`revoke all on function public.${fn}(`)).toBe(true);
    }
    expect(sql.includes("revoke all on function public.crm_buyer_profile_access(")).toBe(false);
  });
});
