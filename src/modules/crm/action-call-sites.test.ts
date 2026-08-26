import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Garde-fou STRUCTUREL : tout appel d'action serveur depuis un composant CRM
 * doit passer par `safeAction`.
 *
 * Sans cette règle, un seul appel oublié suffit à refaire tomber l'écran entier
 * et à effacer la saisie de l'utilisateur — c'est l'incident du 25 août.
 */

const CRM_COMPONENTS = join(process.cwd(), "src", "components", "crm");

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...tsxFiles(full));
    else if (entry.endsWith(".tsx") && !entry.endsWith(".test.tsx")) out.push(full);
  }
  return out;
}

/** Code seul, commentaires retirés. */
function code(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const FILES = tsxFiles(CRM_COMPONENTS);

/** `await maChoseAction(...)` ou `await fn()` — hors `safeAction(...)`. */
const DIRECT_CALL = /await\s+(?!safeAction)([a-zA-Z_$][\w$]*)\s*\(/g;

/** Appels autorisés : ce ne sont pas des actions serveur. */
const ALLOWED = new Set([
  "Promise",
  "navigator",
  "fetch",
  "res",
  "import",
  "waitFor",
  "act",
]);

describe("appels d'actions serveur dans le CRM", () => {
  it("recense bien tous les composants CRM", () => {
    expect(FILES.length).toBeGreaterThan(20);
  });

  it("aucun appel d'action n'échappe à `safeAction`", () => {
    const offenders: string[] = [];

    for (const file of FILES) {
      const content = code(file);
      for (const match of content.matchAll(DIRECT_CALL)) {
        const name = match[1] ?? "";
        if (ALLOWED.has(name)) continue;
        // Un appel d'action se reconnaît à son suffixe, ou au rappel `fn()`
        // des aides locales `run(...)`.
        if (/Action$/.test(name) || name === "fn" || /^move[A-Z]/.test(name)) {
          offenders.push(`${file.replace(process.cwd() + "/", "")} → await ${name}(`);
        }
      }
    }

    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("chaque composant qui appelle une action importe bien `safeAction`", () => {
    for (const file of FILES) {
      const content = readFileSync(file, "utf8");
      if (!content.includes("safeAction(")) continue;
      expect(content, file).toMatch(
        /import \{ safeAction \} from "@\/modules\/crm\/safe-action";/,
      );
    }
  });
});
