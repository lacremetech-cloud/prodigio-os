import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CONDITION_KEYS, DRAFT_AUTOMATION_STATUSES } from "./automation";

/**
 * Garde-fou sur la migration du **Studio Communications**.
 *
 * Elle doit rester strictement additive, ne toucher à rien d'autre que les
 * automatisations personnalisées, et rendre l'activation d'un workflow
 * personnalisé **impossible au niveau de la base** — pas seulement de l'écran.
 */

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");
const FILE = "20260819120000_communications_studio_v1.sql";
const SQL = readFileSync(join(MIGRATIONS_DIR, FILE), "utf8");
const SQL_LOWER = SQL.toLowerCase();

/** Migrations antérieures : leur contenu ne doit jamais être modifié. */
const HISTORICAL = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql") && f < FILE)
  .sort();

describe("migration du studio — portée", () => {
  it("est versionnée et postérieure à toutes les migrations existantes", () => {
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
    expect(files).toContain(FILE);
    expect(files.every((f) => f <= FILE)).toBe(true);
  });

  it("ne redéfinit AUCUN objet des domaines Mandats, Acquéreurs, Biens ou Agenda", () => {
    const forbidden = [
      "opportunities",
      "buyer_profiles",
      "properties",
      "estimation_appointments",
      "funnel_submissions",
      "mandates",
      "economic_rule",
    ];
    for (const table of forbidden) {
      expect(SQL_LOWER).not.toMatch(new RegExp(`(alter|drop)\\s+table[^;]*${table}`));
      expect(SQL_LOWER).not.toMatch(new RegExp(`create\\s+trigger[^;]*on\\s+public\\.${table}`));
    }
  });

  it("ne duplique aucune table existante : aucune table n'est créée", () => {
    expect(SQL_LOWER).not.toMatch(/create\s+table/);
    for (const table of [
      "contacts",
      "privacy_records",
      "communication_messages",
      "communication_outbox",
      "communication_templates",
      "communication_suppressions",
    ]) {
      expect(SQL_LOWER).not.toMatch(new RegExp(`create\\s+table[^;]*${table}`));
    }
  });

  it("ne supprime aucune table ni aucune colonne", () => {
    expect(SQL_LOWER).not.toMatch(/drop\s+table/);
    expect(SQL_LOWER).not.toMatch(/drop\s+column/);
  });

  it("ne crée aucun déclencheur, aucune tâche planifiée, aucun moteur d'exécution", () => {
    expect(SQL_LOWER).not.toMatch(/create\s+trigger/);
    expect(SQL_LOWER).not.toMatch(/cron\./);
    expect(SQL_LOWER).not.toMatch(/pg_cron/);
    expect(SQL_LOWER).not.toMatch(/pg_net/);
    expect(SQL_LOWER).not.toMatch(/http_post|net\.http/);
  });

  it("ne touche ni à la politique d'éligibilité, ni au traitement de la file", () => {
    for (const fn of [
      "crm_comm_eligibility",
      "crm_comm_prepare_message",
      "crm_comm_claim_outbox",
      "crm_comm_record_send",
      "crm_comm_reconcile_status",
      "crm_comm_upsert_template",
      "crm_comm_set_template_status",
      "crm_comm_add_suppression",
      "crm_comm_release_suppression",
      "crm_comm_schedule_reminders",
      "comm_enqueue",
    ]) {
      expect(SQL_LOWER).not.toMatch(new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${fn}\\b`));
    }
  });

  it("ne modifie aucune migration historique (elles ne mentionnent pas le studio)", () => {
    expect(HISTORICAL.length).toBeGreaterThan(0);
    for (const file of HISTORICAL) {
      const content = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      expect(content).not.toContain("pret_pour_revue");
      expect(content).not.toContain("comm_automation_conditions_valid");
      expect(content).not.toContain("template_version integer");
    }
  });

  it("ne modifie aucune politique RLS ni aucun droit de table", () => {
    expect(SQL_LOWER).not.toMatch(/create\s+policy/);
    expect(SQL_LOWER).not.toMatch(/drop\s+policy/);
    expect(SQL_LOWER).not.toMatch(/grant\s+(select|insert|update|delete|all)\s+on\s+(table\s+)?public\./);
  });
});

describe("migration du studio — activation impossible", () => {
  it("retire `actif` du domaine des statuts d'automatisation", () => {
    // On vise la clause `add constraint`, pas le `drop constraint if exists`.
    const added = SQL_LOWER.slice(
      SQL_LOWER.indexOf("add constraint communication_automations_status_check"),
    );
    const check = added.slice(added.indexOf("check ("), added.indexOf(";"));
    expect(check).toContain("'brouillon'");
    expect(check).toContain("'pret_pour_revue'");
    expect(check).toContain("'en_pause'");
    expect(check).toContain("'archive'");
    expect(check).not.toContain("'actif'");
  });

  it("reprend exactement les statuts déclarés côté TypeScript", () => {
    for (const status of DRAFT_AUTOMATION_STATUSES) {
      expect(SQL).toContain(`'${status}'`);
    }
  });

  it("refuse explicitement une demande d'activation, avec un code d'erreur de droits", () => {
    const fn = SQL.slice(SQL.indexOf("function public.crm_comm_set_automation_status"));
    expect(fn).toMatch(/if p_status = 'actif' then/);
    expect(fn).toMatch(/ne peut pas être activée/i);
    expect(fn).toMatch(/errcode = '42501'/);
  });

  it("force le statut `brouillon` à la création, sans laisser le choix à l'appelant", () => {
    const fn = SQL.slice(
      SQL.indexOf("function public.crm_comm_upsert_automation"),
      SQL.indexOf("function public.crm_comm_set_automation_status"),
    );
    expect(fn).toMatch(/'brouillon', v_uid, v_uid/);
    expect(fn).not.toMatch(/p_status/);
  });

  it("refuse d'appliquer la migration si une automatisation active existe", () => {
    expect(SQL_LOWER).toContain("where status = 'actif'");
    expect(SQL).toMatch(/migration refusée/i);
  });
});

describe("migration du studio — conditions déterministes", () => {
  it("valide les conditions contre un catalogue FERMÉ, identique au catalogue TypeScript", () => {
    const fn = SQL.slice(
      SQL.indexOf("function public.comm_automation_conditions_valid"),
      SQL.indexOf("comment on function public.comm_automation_conditions_valid"),
    );
    for (const key of CONDITION_KEYS) {
      expect(fn).toContain(`'${key}'`);
    }
    // Aucune autre clé n'est admise.
    const quoted = [...fn.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    for (const key of quoted) {
      expect([...CONDITION_KEYS, "object", "string", "boolean", "number"]).toContain(key);
    }
  });

  it("n'admet que des valeurs scalaires : aucun code, aucune structure", () => {
    const fn = SQL.slice(SQL.indexOf("function public.comm_automation_conditions_valid"));
    expect(fn).toMatch(/jsonb_typeof\(value\) not in \('string', 'boolean', 'number'\)/);
  });

  it("applique la validation par une CONTRAINTE, pas seulement dans une fonction", () => {
    expect(SQL_LOWER).toContain("communication_automations_conditions_declaratives");
    expect(SQL_LOWER).toContain("check (public.comm_automation_conditions_valid(conditions))");
  });
});

describe("migration du studio — surface d'exécution", () => {
  it("fige le `search_path` de chaque fonction", () => {
    const definitions = SQL_LOWER.split("create or replace function").slice(1);
    expect(definitions.length).toBeGreaterThan(0);
    for (const definition of definitions) {
      expect(definition.slice(0, 1200)).toContain("set search_path = public, pg_temp");
    }
  });

  it("n'expose aucune fonction à `anon` ni à `public`", () => {
    expect(SQL_LOWER).not.toMatch(/grant\s+execute[^;]*to\s+[^;]*anon/);
    expect(SQL_LOWER).not.toMatch(/grant\s+execute[^;]*to\s+[^;]*\bpublic\b/);
  });

  it("garde le validateur de conditions hors de portée de `authenticated`", () => {
    expect(SQL_LOWER).toContain(
      "revoke all on function public.comm_automation_conditions_valid(jsonb) from public, anon, authenticated",
    );
  });

  it("révoque puis ré-octroie explicitement les deux actions du studio", () => {
    expect(SQL_LOWER).toContain("revoke all on function %s from public, anon, authenticated");
    expect(SQL_LOWER).toContain("grant execute on function %s to authenticated");
    expect(SQL).toContain(
      "public.crm_comm_upsert_automation(text, text, text, text, text, integer, jsonb, jsonb, text, integer)",
    );
    expect(SQL).toContain("public.crm_comm_set_automation_status(uuid, text)");
  });

  it("réserve l'écriture aux rôles habilités, revérifiés en base", () => {
    const upsert = SQL.slice(
      SQL.indexOf("function public.crm_comm_upsert_automation"),
      SQL.indexOf("function public.crm_comm_set_automation_status"),
    );
    expect(upsert).toMatch(/if v_uid is null then raise exception 'authentification requise'/);
    expect(upsert).toMatch(/if not public\.comm_can_manage\(\) then/);
  });

  it("n'écrit dans l'audit que des identifiants et des clés techniques (aucune PII)", () => {
    const auditCalls = [...SQL.matchAll(/insert into public\.audit_events[\s\S]*?;/g)].map(
      (m) => m[0],
    );
    expect(auditCalls.length).toBeGreaterThan(0);
    for (const call of auditCalls) {
      for (const forbidden of ["email", "phone", "first_name", "last_name", "rendered_", "body"]) {
        expect(call.toLowerCase()).not.toContain(forbidden);
      }
    }
  });
});
