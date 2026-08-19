import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Étanchéité du studio, vérifiée sur le CODE SOURCE lui-même.
 *
 * Ces tests refusent qu'un futur changement rebranche discrètement un
 * fournisseur, exécute un brouillon, ou fasse partir une communication au simple
 * chargement d'une page.
 */

const ROOT = process.cwd();
const STUDIO_MODULES = join(ROOT, "src", "modules", "communications", "studio");
const STUDIO_COMPONENTS = join(ROOT, "src", "components", "crm", "communications", "studio");
const STUDIO_PAGES = join(ROOT, "src", "app", "crm", "communications");

function filesIn(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...filesIn(full));
    else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts") && !entry.endsWith(".test.tsx")) {
      out.push(full);
    }
  }
  return out;
}

function read(file: string): string {
  return readFileSync(file, "utf8");
}

/**
 * Code seul, commentaires retirés : ces tests portent sur ce que le code FAIT,
 * jamais sur ce que la prose explique (une explication peut légitimement citer
 * un terme que le code ne doit pas manipuler).
 */
function code(file: string): string {
  return read(file)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const MODULE_FILES = filesIn(STUDIO_MODULES);
const COMPONENT_FILES = filesIn(STUDIO_COMPONENTS);
const PAGE_FILES = filesIn(STUDIO_PAGES);
const ALL = [...MODULE_FILES, ...COMPONENT_FILES, ...PAGE_FILES];

describe("aucun appel fournisseur", () => {
  it("aucun fichier du studio ne cite un point d'entrée fournisseur", () => {
    for (const file of ALL) {
      const content = read(file).toLowerCase();
      expect(content, file).not.toContain("lumail.io");
      expect(content, file).not.toContain("api.twilio.com");
      expect(content, file).not.toContain("https://");
    }
  });

  it("aucun fichier du studio n'importe un adaptateur fournisseur ni le dispatcher", () => {
    for (const file of ALL) {
      const content = read(file);
      expect(content, file).not.toMatch(/from\s+["'].*providers\/(lumail|twilio)["']/);
      expect(content, file).not.toMatch(/from\s+["'].*\/dispatcher["']/);
      expect(content, file).not.toContain("dispatchPending");
      expect(content, file).not.toContain("createLumailProvider");
      expect(content, file).not.toContain("createTwilioProvider");
    }
  });

  it("aucun fichier du studio ne crée de destinataire chez un fournisseur", () => {
    for (const file of ALL) {
      expect(read(file).toLowerCase(), file).not.toContain("subscriber");
    }
  });

  it("les modules purs du studio n'appellent jamais le réseau", () => {
    for (const file of MODULE_FILES) {
      // `queries.ts` interroge la base via le client serveur, jamais le réseau
      // sortant : c'est le seul fichier autorisé à parler à Supabase.
      const content = read(file);
      expect(content, file).not.toMatch(/\bfetch\s*\(/);
      expect(content, file).not.toContain("XMLHttpRequest");
      if (!file.endsWith("queries.ts")) {
        expect(content, file).not.toContain("createSupabaseServerClient");
        expect(content, file).not.toMatch(/^import "server-only";/m);
      }
    }
  });
});

describe("aucune communication au chargement d'une page", () => {
  it("aucune page du studio ne traite la file ni ne planifie de rappels lors du rendu", () => {
    for (const file of PAGE_FILES) {
      const content = read(file);
      expect(content, file).not.toContain("processOutboxAction");
      expect(content, file).not.toContain("scheduleRemindersAction");
      expect(content, file).not.toContain("crm_comm_prepare_message");
      expect(content, file).not.toContain("crm_comm_record_send");
      expect(content, file).not.toContain("crm_comm_claim_outbox");
    }
  });

  it("les seules RPC atteintes au rendu sont des LECTURES", () => {
    const queries = read(join(STUDIO_MODULES, "queries.ts"));
    expect(queries).not.toMatch(/\.rpc\(/);
    // Uniquement des `select`, jamais d'écriture directe depuis l'application.
    expect(queries).not.toMatch(/\.(insert|update|upsert|delete)\(/);
  });

  it("le traitement de la file reste une action explicite de l'utilisateur", () => {
    const panels = read(
      join(ROOT, "src", "components", "crm", "communications", "panels.tsx"),
    );
    // Chaque APPEL au dispatcher est déclenché par un `onClick`, jamais au rendu.
    for (const call of ["processOutboxAction(", "scheduleRemindersAction("]) {
      const occurrences = [...panels.matchAll(new RegExp(call.replace("(", "\\("), "g"))];
      expect(occurrences.length, call).toBeGreaterThan(0);
      for (const occurrence of occurrences) {
        const index = occurrence.index ?? 0;
        expect(panels.slice(Math.max(0, index - 200), index), call).toContain("onClick");
      }
    }
  });
});

describe("aucune écriture directe depuis le navigateur", () => {
  it("aucun composant client n'écrit dans une table", () => {
    for (const file of COMPONENT_FILES) {
      const content = read(file);
      expect(content, file).not.toContain("createSupabaseBrowserClient");
      expect(content, file).not.toMatch(/\.from\(["'][a-z_]+["']\)/);
      expect(content, file).not.toMatch(/\.(insert|update|upsert|delete)\(/);
    }
  });

  it("toute écriture passe par une action serveur validée", () => {
    const editors = COMPONENT_FILES.filter((f) => /template-studio|automation-studio|suppressions-view/.test(f));
    expect(editors.length).toBe(3);
    for (const file of editors) {
      expect(read(file), file).toMatch(/from "@\/modules\/communications\/actions"/);
    }
  });
});

describe("aucune activation d'automatisation personnalisée", () => {
  it("aucun écran ne propose d'activer un workflow personnalisé", () => {
    for (const file of [...COMPONENT_FILES, ...PAGE_FILES]) {
      const content = read(file);
      expect(content, file).not.toMatch(/status:\s*["']actif["']\s*\}\s*\)/);
      expect(content, file).not.toMatch(/setAutomationStatusAction\(\{[^}]*["']actif["']/);
    }
  });

  it("l'écran des automatisations n'offre que les statuts de brouillon", () => {
    const content = read(join(STUDIO_COMPONENTS, "automation-studio.tsx"));
    expect(content).toContain("DRAFT_AUTOMATION_STATUSES");
    expect(content).toMatch(/jamais « actif »/);
  });
});

describe("aucune donnée personnelle exposée", () => {
  it("le simulateur ne reçoit jamais de contact réel", () => {
    const page = read(join(STUDIO_PAGES, "simulateur", "page.tsx"));
    expect(page).not.toContain("contacts");
    expect(page).not.toContain("privacy_records");
    expect(page).not.toContain("communication_messages");
    const component = read(join(STUDIO_COMPONENTS, "workflow-simulator.tsx"));
    expect(component).toContain("SYNTHETIC_RECIPIENTS");
  });

  it("l'écran des oppositions n'affiche aucune coordonnée", () => {
    const content = read(join(STUDIO_COMPONENTS, "suppressions-view.tsx"));
    expect(content).not.toMatch(/\bemail\b\s*[:.]/);
    expect(content).not.toMatch(/\bphone\b/);
  });

  it("aucun payload brut, jeton ni webhook n'est rendu", () => {
    for (const file of [...COMPONENT_FILES, ...PAGE_FILES]) {
      const content = code(file).toLowerCase();
      for (const forbidden of ["webhook", "bearer", "payload", "rendered_body", "provider_message_id"]) {
        expect(content, file).not.toContain(forbidden);
      }
    }
  });

  it("aucune VALEUR de secret n'atteint le navigateur : seule la présence est transmise", () => {
    for (const file of PAGE_FILES) {
      const content = read(file);
      // Les variables sensibles ne peuvent apparaître qu'enveloppées dans un
      // `Boolean(...)` : un booléen de présence, jamais la valeur elle-même.
      for (const match of content.matchAll(/env\.([A-Z_]+)/g)) {
        const index = match.index ?? 0;
        expect(content.slice(Math.max(0, index - 10), index), `${file} · ${match[1]}`).toContain(
          "Boolean(",
        );
      }
    }
  });

  it("aucune journalisation console dans le studio", () => {
    for (const file of ALL) {
      expect(read(file), file).not.toMatch(/console\.(log|info|warn|error|debug)/);
    }
  });
});

describe("sémantique de livraison", () => {
  it("« en file chez le fournisseur » n'est jamais présenté comme envoyé ou livré", () => {
    const content = read(join(STUDIO_COMPONENTS, "overview-stats.tsx"));
    const tile = content.slice(content.indexOf('key: "file"'), content.indexOf('key: "livres"'));
    expect(tile).toMatch(/Ni « envoyé », ni « livré »/);
  });

  it("une livraison n'est comptée qu'avec une preuve fournisseur", () => {
    const queries = read(join(STUDIO_MODULES, "queries.ts"));
    expect(queries).toContain('.eq("status", "livre")');
    expect(queries).toContain('.not("provider_status", "is", null)');
  });

  it("l'historique d'un dossier n'affiche une livraison qu'avec sa preuve", () => {
    const content = read(
      join(ROOT, "src", "components", "crm", "communications", "entity-communications.tsx"),
    );
    expect(content).toMatch(/message\.delivered_at && message\.provider_status/);
    expect(content).toContain("non établie");
  });
});

describe("permissions par rôle", () => {
  it("chaque écran de configuration re-vérifie le rôle, indépendamment de la navigation", () => {
    for (const section of ["modeles", "automatisations", "simulateur"]) {
      const content = read(join(STUDIO_PAGES, section, "page.tsx"));
      expect(content, section).toContain("requireCrmSession");
      expect(content, section).toMatch(
        /hasAnyRole\(session\.roles, \["administrateur", "manager"\]\)/,
      );
      expect(content, section).toContain('redirect("/crm/communications")');
    }
  });

  it("la levée d'opposition est réservée à l'administrateur", () => {
    const content = read(join(STUDIO_PAGES, "oppositions", "page.tsx"));
    expect(content).toMatch(/hasAnyRole\(session\.roles, \["administrateur"\]\)/);
  });

  it("l'enveloppe du studio n'affiche pas les onglets de configuration aux autres rôles", () => {
    const content = read(join(STUDIO_PAGES, "layout.tsx"));
    expect(content).toMatch(/hasAnyRole\(session\.roles, \["administrateur", "manager"\]\)/);
    expect(content).toContain("canConfigure");
  });

  it("aucune page du studio n'est accessible sans session CRM", () => {
    // `loading.tsx` n'affiche qu'un squelette sans donnée : il n'a rien à garder.
    const guarded = PAGE_FILES.filter((f) => /(page|layout)\.tsx$/.test(f));
    expect(guarded.length).toBe(6);
    for (const file of guarded) {
      expect(read(file), file).toContain("requireCrmSession");
    }
  });
});
