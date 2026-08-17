import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COMMUNICATION_EVENTS } from "./types";
import { EVENT_DEFINITIONS } from "./events";

/**
 * Garde-fou de **sécurité et de cohérence** sur la migration Communications.
 *
 * Ces tests relisent le SQL versionné — source de vérité — et refusent toute
 * régression : une table sans RLS, un accès `anon`, un helper interne devenu
 * exécutable, un `search_path` non figé, ou un événement documenté d'un côté
 * mais absent de l'autre.
 */

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");
const FILE = "20260818120000_communications_v1.sql";
const SQL = readFileSync(join(MIGRATIONS_DIR, FILE), "utf8");
const SQL_LOWER = SQL.toLowerCase();

/** Les six tables créées par la migration. */
const TABLES = [
  "communication_templates",
  "communication_messages",
  "communication_outbox",
  "communication_suppressions",
  "communication_automations",
  "communication_automation_runs",
] as const;

/** Fonctions destinées au CRM : exécutables par `authenticated`. */
const CRM_FUNCTIONS = [
  "crm_comm_eligibility",
  "crm_comm_upsert_template",
  "crm_comm_set_template_status",
  "crm_comm_add_suppression",
  "crm_comm_release_suppression",
  "crm_comm_upsert_automation",
  "crm_comm_set_automation_status",
  "crm_comm_claim_outbox",
  "crm_comm_prepare_message",
  "crm_comm_record_send",
  "crm_comm_reconcile_status",
  "crm_comm_cancel_message",
  "crm_comm_retry_message",
  "crm_comm_schedule_reminders",
] as const;

/** Helpers internes : jamais exécutables par `anon` ni `authenticated`. */
const INTERNAL_HELPERS = [
  "comm_operator_org",
  "comm_can_manage",
  "comm_google_covers_appointment",
  "comm_enqueue",
  "comm_tg_funnel_submission",
  "comm_tg_buyer_interest",
  "comm_tg_estimation_appointment",
] as const;

/**
 * Déplie les blocs `do $$ … format('revoke|grant …', fn) … $$` en instructions
 * explicites, afin que l'analyse voie les mêmes privilèges que PostgreSQL.
 */
function expandDoBlocks(sql: string): string {
  return sql.replace(/do \$\$[\s\S]*?\$\$;/gi, (block) => {
    const signatures = [...block.matchAll(/'(public\.[a-z0-9_]+\([^']*\))'/gi)].map((m) => m[1]!);
    if (signatures.length === 0) return "";
    const templates = [...block.matchAll(/format\(\s*'((?:revoke|grant)[^']*)'/gi)].map((m) => m[1]!);
    return templates
      .flatMap((tpl) => signatures.map((sig) => tpl.replace("%s", sig)))
      .join(";\n")
      .concat(";");
  });
}

/**
 * Retire les commentaires `--`. Indispensable : la migration est abondamment
 * commentée, et un commentaire contenant « grant » ou « anon » ne doit pas être
 * lu comme une instruction.
 */
function stripComments(sql: string): string {
  return sql
    .split("\n")
    .map((line) => {
      const i = line.indexOf("--");
      return i === -1 ? line : line.slice(0, i);
    })
    .join("\n");
}

const EXPANDED = expandDoBlocks(stripComments(SQL_LOWER));

/** Dernier privilège exprimé pour `fn` vis-à-vis de `role`. */
function lastPrivilege(fn: string, role: "anon" | "authenticated"): boolean {
  let granted = false;
  const needle = `public.${fn}(`;
  for (const raw of EXPANDED.split(";")) {
    const s = raw.replace(/\s+/g, " ");
    if (!s.includes(needle)) continue;
    if (!new RegExp(`\\b${role}\\b`).test(s)) continue;
    if (/\brevoke\b/.test(s)) granted = false;
    else if (/\bgrant\s+execute\b/.test(s)) granted = true;
  }
  return granted;
}

describe("migration Communications — présence et caractère additif", () => {
  it("est versionnée dans supabase/migrations", () => {
    expect(readdirSync(MIGRATIONS_DIR)).toContain(FILE);
  });

  it("ne supprime aucune table ni colonne existante", () => {
    for (const forbidden of ["drop table", "drop column", "truncate", "delete from public."]) {
      expect(SQL_LOWER.includes(forbidden), `interdit : « ${forbidden} »`).toBe(false);
    }
  });

  it("ne modifie aucune migration historique (aucun objet Mandats/Acquéreurs redéfini)", () => {
    // Les seules fonctions (re)définies commencent par `comm_` ou `crm_comm_`.
    const defined = [...SQL_LOWER.matchAll(/create or replace function public\.([a-z0-9_]+)/g)].map(
      (m) => m[1]!,
    );
    expect(defined.length).toBeGreaterThan(0);
    for (const fn of defined) {
      expect(
        fn.startsWith("comm_") || fn.startsWith("crm_comm_"),
        `${fn} n'appartient pas au module Communications`,
      ).toBe(true);
    }
  });

  it("ne touche aux politiques que des tables Communications", () => {
    const policed = [...SQL_LOWER.matchAll(/create policy [a-z0-9_]+ on public\.([a-z0-9_]+)/g)].map(
      (m) => m[1]!,
    );
    for (const table of policed) {
      expect(table.startsWith("communication_"), `politique posée sur ${table}`).toBe(true);
    }
  });

  it("n'étend `audit_events` que par AJOUT de valeurs", () => {
    // Les valeurs préexistantes doivent toutes être reconduites.
    for (const kept of ["acquereur_resultat", "mandat_signe", "bien_publie", "buyer_profile"]) {
      expect(SQL_LOWER.includes(`'${kept}'`), `valeur perdue : ${kept}`).toBe(true);
    }
  });
});

describe("migration Communications — sécurité des tables", () => {
  it("active la RLS sur chacune des six tables", () => {
    for (const table of TABLES) {
      expect(
        SQL_LOWER.includes(`alter table public.${table} enable row level security`),
        `${table} sans RLS`,
      ).toBe(true);
    }
  });

  it("n'accorde aucun droit de table à anon", () => {
    const grants = [...EXPANDED.matchAll(/grant [^;]*? on public\.communication[^;]*?;/g)].map(
      (m) => m[0],
    );
    for (const grant of grants) {
      expect(/\banon\b/.test(grant), `grant à anon : ${grant}`).toBe(false);
    }
  });

  it("révoque explicitement tout accès direct pour anon et public", () => {
    for (const table of TABLES) {
      expect(EXPANDED.includes(table)).toBe(true);
    }
    expect(/revoke all on public\.communication[\s\S]*?from anon, public/.test(EXPANDED)).toBe(true);
  });

  it("n'accorde d'écriture directe à personne : toute écriture passe par une fonction", () => {
    for (const verb of ["grant insert", "grant update", "grant delete", "grant all on public.communication"]) {
      expect(EXPANDED.includes(verb), `écriture directe accordée : ${verb}`).toBe(false);
    }
  });
});

describe("migration Communications — surface EXECUTE", () => {
  it("fige le `search_path` de chaque fonction", () => {
    const definitions = SQL_LOWER.split("create or replace function").slice(1);
    expect(definitions.length).toBeGreaterThanOrEqual(
      CRM_FUNCTIONS.length + INTERNAL_HELPERS.length,
    );
    for (const def of definitions) {
      const head = def.slice(0, 800);
      expect(/set search_path = /.test(head), `search_path non figé : ${head.slice(0, 60)}`).toBe(
        true,
      );
    }
  });

  it("n'expose AUCUNE fonction du module à anon", () => {
    for (const fn of [...CRM_FUNCTIONS, ...INTERNAL_HELPERS, "comm_message_access"]) {
      expect(lastPrivilege(fn, "anon"), `${fn} exposée à anon`).toBe(false);
    }
  });

  it("garde les helpers internes hors de portée de authenticated", () => {
    for (const fn of INTERNAL_HELPERS) {
      expect(
        lastPrivilege(fn, "authenticated"),
        `${fn} est un helper interne : pas d'EXECUTE pour authenticated`,
      ).toBe(false);
    }
  });

  it("révoque explicitement chaque helper interne pour authenticated", () => {
    // Supabase accorde EXECUTE par défaut : une révocation « public, anon » ne suffit pas.
    for (const fn of INTERNAL_HELPERS) {
      const revoked = EXPANDED.split(";").some((raw) => {
        const s = raw.replace(/\s+/g, " ");
        return s.includes(`revoke all on function public.${fn}(`) && /\bauthenticated\b/.test(s);
      });
      expect(revoked, `${fn} doit être explicitement révoquée pour authenticated`).toBe(true);
    }
  });

  it("conserve EXECUTE sur le helper appelé par les politiques RLS", () => {
    // Une politique est évaluée avec les privilèges du rôle appelant : lui
    // retirer EXECUTE casserait la lecture autorisée.
    expect(lastPrivilege("comm_message_access", "authenticated")).toBe(true);
  });

  it("laisse les actions CRM exécutables par authenticated", () => {
    for (const fn of CRM_FUNCTIONS) {
      expect(lastPrivilege(fn, "authenticated"), `${fn} doit rester utilisable`).toBe(true);
    }
  });
});

describe("migration Communications — garanties métier", () => {
  it("n'active AUCUN modèle : tous sont amorcés en brouillon", () => {
    // Le bloc d'amorçage insère explicitement le statut 'brouillon'.
    const seed = SQL_LOWER.slice(SQL_LOWER.indexOf("amorçage des modèles".toLowerCase()));
    expect(seed.includes("'brouillon'")).toBe(true);
    expect(/values[\s\S]*?'actif'/.test(seed), "un modèle serait amorcé actif").toBe(false);
  });

  it("impose une clé d'idempotence unique sur les messages et l'outbox", () => {
    expect(SQL_LOWER).toContain("communication_messages_idempotency_unique unique (idempotency_key)");
    expect(SQL_LOWER).toContain("communication_outbox_event_key_unique unique (event_key)");
  });

  it("réserve la file de façon atomique (aucun double traitement)", () => {
    expect(SQL_LOWER).toContain("for update skip locked");
  });

  it("borne les tentatives (aucune boucle infinie)", () => {
    expect(SQL_LOWER).toContain("attempt_count < max_attempts");
    expect(SQL_LOWER).toContain("max_attempts between 1 and 10");
  });

  it("exige un motif pour tout événement ignoré (aucune perte silencieuse)", () => {
    expect(SQL_LOWER).toContain("communication_outbox_skip_reason_required");
    expect(SQL_LOWER).toContain("communication_messages_blocked_consistency");
  });

  it("refuse le marketing tant que la base légale n'est pas tranchée", () => {
    expect(SQL_LOWER).toContain("legal_basis is distinct from 'a_valider_juridiquement'");
    expect(SQL_LOWER).toContain("base_legale_insuffisante");
  });

  it("consulte `privacy_records` sans jamais créer une seconde source de vérité", () => {
    expect(SQL_LOWER).toContain("from public.privacy_records");
    expect(SQL_LOWER).toContain("pr.do_not_contact");
    // Aucune colonne de préférence n'est dupliquée sur les nouvelles tables.
    expect(SQL_LOWER.includes("add column if not exists do_not_contact")).toBe(false);
  });

  it("évite le doublon Google en évaluant la donnée, jamais une hypothèse", () => {
    expect(SQL_LOWER).toContain("a.google_event_id is not null");
    expect(SQL_LOWER).toContain("a.owner_email is not null");
    expect(SQL_LOWER).toContain("google_couvre_l_envoi");
  });

  it("ne place aucune donnée personnelle dans les clés d'idempotence", () => {
    // Les clés sont construites à partir d'identifiants et d'horodatages.
    const keys = [...SQL_LOWER.matchAll(/'([a-z_]+):' \|\| ([a-z_.]+)::text/g)];
    expect(keys.length).toBeGreaterThan(0);
    for (const [, , source] of keys) {
      expect(/email|phone|nom|prenom/.test(source ?? ""), `source suspecte : ${source}`).toBe(false);
    }
  });
});

describe("catalogue d'événements — cohérence SQL ↔ TypeScript", () => {
  it("documente exactement les six événements couverts", () => {
    expect(EVENT_DEFINITIONS).toHaveLength(6);
    expect(EVENT_DEFINITIONS.map((d) => d.event).sort()).toEqual([...COMMUNICATION_EVENTS].sort());
  });

  it("déclare les mêmes événements que la contrainte SQL de l'outbox", () => {
    for (const event of COMMUNICATION_EVENTS) {
      expect(SQL_LOWER.includes(`'${event}'`), `${event} absent du SQL`).toBe(true);
    }
  });

  it("documente, pour chaque événement, destinataire, motif et cas de non-envoi", () => {
    for (const def of EVENT_DEFINITIONS) {
      expect(def.recipient.length, def.event).toBeGreaterThan(20);
      expect(def.rationale.length, def.event).toBeGreaterThan(20);
      expect(def.idempotency, def.event).toContain("event_key");
      expect(def.noMessageWhen.length, def.event).toBeGreaterThan(0);
    }
  });

  it("n'ouvre aucun événement marketing : la V1 est strictement transactionnelle", () => {
    for (const def of EVENT_DEFINITIONS) {
      expect(def.category, def.event).toBe("transactionnel");
    }
  });
});
