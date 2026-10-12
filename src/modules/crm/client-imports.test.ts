import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Garde-fou STRUCTUREL : un composant serveur n'importe d'un module `"use
 * client"` que des COMPOSANTS, jamais une fonction utilitaire.
 *
 * Next refuse d'invoquer une fonction cliente depuis le serveur. L'erreur
 * n'apparaît ni au typage, ni au lint, ni au build : elle tombe à l'exécution,
 * et emporte la page entière. C'est ce qui est arrivé à la fiche acquéreur —
 * `numeroAppelable()`, pure, vivait dans un module client et la fiche, qui est
 * un composant serveur, l'appelait. La page était cassée pour tout le monde.
 *
 * Une fonction pure n'appartient à aucun des deux côtés : elle vit dans
 * `src/modules`, d'où les deux peuvent l'appeler.
 *
 * Heuristique assumée : un identifiant en PascalCase est un composant (il peut
 * être rendu), un identifiant en minuscule est une valeur (elle serait
 * appelée). Un faux positif se corrige en déplaçant la fonction, ce qui est de
 * toute façon la bonne réponse.
 */

const RACINE = process.cwd();
const APP = join(RACINE, "src", "app");

function fichiers(dir: string, ext: string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...fichiers(full, ext));
    else if (ext.some((e) => entry.endsWith(e))) out.push(full);
  }
  return out;
}

function source(file: string): string {
  return readFileSync(file, "utf8");
}

const estClient = (texte: string) => /^\s*["']use client["']/m.test(texte);

/** `import { a, B as C } from "@/x"` → chemin + noms importés. */
const IMPORT = /import\s+\{([^}]*)\}\s+from\s+["']([^"']+)["']/g;

function resoudre(spec: string): string | null {
  if (!spec.startsWith("@/")) return null;
  const base = resolve(RACINE, "src", spec.slice(2));
  for (const suffixe of [".tsx", ".ts", "/index.tsx", "/index.ts"]) {
    try {
      const candidat = base + suffixe;
      if (statSync(candidat).isFile()) return candidat;
    } catch {
      // chemin suivant
    }
  }
  return null;
}

describe("frontière client / serveur", () => {
  it("aucun composant serveur n'importe une fonction depuis un module « use client »", () => {
    const fautes: string[] = [];

    for (const fichier of fichiers(APP, [".tsx"])) {
      const texte = source(fichier);
      if (estClient(texte)) continue; // composant client : il a le droit.

      for (const m of texte.matchAll(IMPORT)) {
        const cible = resoudre(m[2] ?? "");
        if (!cible) continue;
        if (!estClient(source(cible))) continue;

        for (const brut of (m[1] ?? "").split(",")) {
          const nom = brut.split(" as ").pop()?.trim();
          if (!nom || nom.startsWith("type ")) continue;
          // PascalCase = composant, rendu et non appelé.
          if (/^[A-Z]/.test(nom)) continue;
          fautes.push(`${relative(RACINE, fichier)} importe « ${nom} » de ${m[2]}`);
        }
      }
    }

    expect(fautes).toEqual([]);
  });
});
