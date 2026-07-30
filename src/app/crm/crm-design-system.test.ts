import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Garde-fous du design system CRM (crm.css). Ces règles corrigent globalement les
 * problèmes de texte rogné : hauteurs par `min-height` (jamais fixes), `line-height`
 * maîtrisé, chevron de select centré, et utilitaires de troncature volontaire /
 * de passage à la ligne. Le test échoue si une régression réintroduit une hauteur
 * fixe fragile ou supprime les utilitaires.
 */
const css = readFileSync(
  fileURLToPath(new URL("./crm.css", import.meta.url)),
  "utf8",
);

function block(selector: string): string {
  // Extrait le corps de la première règle contenant `selector { ... }`.
  const idx = css.indexOf(selector);
  if (idx === -1) return "";
  const open = css.indexOf("{", idx);
  const close = css.indexOf("}", open);
  return css.slice(open + 1, close);
}

describe("design system CRM — robustesse au contenu", () => {
  it("les champs utilisent min-height (≈44px) et un line-height, jamais une hauteur fixe", () => {
    // Corps de la règle partagée `.crm-input, .crm-select, .crm-textarea { … }`.
    const base = block(".crm-input,");
    expect(base).toMatch(/min-height:\s*2\.75rem/);
    expect(base).toMatch(/line-height:\s*1\.4/);
    // Aucune hauteur fixe (`height: NNpx`) sur les champs.
    expect(base).not.toMatch(/[^-]height:\s*\d+px/);
    // Le textarea dispose d'un plancher dédié (multi-lignes).
    expect(css).toMatch(/\.crm-textarea\s*\{[^}]*min-height:\s*4\.75rem/);
  });

  it("le chevron du select est centré verticalement (indépendant de la hauteur)", () => {
    const sel = block(".crm-select {");
    expect(sel).toMatch(/background-position:[^;]*center/);
    expect(sel).toMatch(/padding-right:/);
  });

  it("les boutons utilisent min-height (extensible), jamais une hauteur fixe qui rogne le libellé", () => {
    const btn = block(".crm-btn {");
    expect(btn).toMatch(/min-height:/);
    expect(btn).toMatch(/line-height:/);
    expect(btn).not.toMatch(/[^-]height:\s*\d+px/);
    const sm = block(".crm-btn--sm {");
    expect(sm).toMatch(/min-height:/);
    expect(sm).not.toMatch(/[^-]height:\s*\d+px/);
  });

  it("les utilitaires de troncature volontaire et de passage à la ligne existent", () => {
    const wrap = block(".crm-wrap {");
    const ellipsis = block(".crm-ellipsis {");
    expect(wrap).toMatch(/overflow-wrap:\s*anywhere/);
    expect(wrap).toMatch(/min-width:\s*0/);
    expect(ellipsis).toMatch(/text-overflow:\s*ellipsis/);
    expect(ellipsis).toMatch(/min-width:\s*0/);
  });
});
