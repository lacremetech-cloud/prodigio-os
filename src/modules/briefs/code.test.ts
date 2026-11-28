import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  codeCorrespond,
  empreinteDuCode,
  jetonDeLecture,
  jetonValide,
  normaliserLaSaisie,
  tirerUnCode,
} from "./code";

/**
 * LA SERRURE D'UN BRIEF.
 *
 * Ce document porte le prix négociable, le nom du propriétaire, l'objection
 * d'entretien et les revenus locatifs. Il part à des gens extérieurs à la
 * maison. Le code est la seule chose entre ces informations et n'importe qui —
 * ces tests sont donc moins là pour le confort que pour la sûreté.
 */

describe("le code", () => {
  it("ouvre avec le bon, refuse avec un autre", () => {
    const empreinte = empreinteDuCode("ABCD1234WXYZ");
    expect(codeCorrespond("ABCD1234WXYZ", empreinte)).toBe(true);
    expect(codeCorrespond("ABCD1234WXYY", empreinte)).toBe(false);
    expect(codeCorrespond("", empreinte)).toBe(false);
  });

  it("ne garde aucune trace du code en clair", () => {
    /* Une empreinte qui contiendrait le code ne servirait à rien. On vérifie
       la propriété, pas l'implémentation. */
    const empreinte = empreinteDuCode("MOTDEPASSESECRET");
    expect(empreinte).not.toContain("MOTDEPASSESECRET");
    expect(empreinte.startsWith("scrypt$")).toBe(true);
  });

  it("résiste à une empreinte abîmée au lieu de s'ouvrir", () => {
    /* Le défaut classique : une empreinte vide ou tronquée que le code lit
       comme « rien à comparer, donc ça passe ». */
    for (const cassee of ["", "scrypt$", "scrypt$1$2$3$$", "n_importe_quoi", "$$$$$"]) {
      expect(codeCorrespond("ABCD1234WXYZ", cassee), cassee).toBe(false);
    }
  });

  it("pardonne la casse et les tirets, jamais le reste", () => {
    /* Un code se dicte au téléphone : « 3fjg b33y quwv » doit marcher. */
    expect(normaliserLaSaisie("3fjg-b33y-quwv")).toBe("3FJGB33YQUWV");
    expect(normaliserLaSaisie(" 3FJG B33Y QUWV ")).toBe("3FJGB33YQUWV");
    expect(normaliserLaSaisie("3FJG_B33Y.QUWV")).toBe("3FJGB33YQUWV");
  });

  it("tire des codes sans caractères ambigus", () => {
    /* Ni O ni 0, ni I ni 1 : « zéro ou O ? » est la première cause d'un code
       qui « ne marche pas ». Le L majuscule, lui, reste — c'est le l minuscule
       qui se confond avec 1, et l'alphabet est tout en capitales. */
    for (let i = 0; i < 40; i += 1) {
      const code = tirerUnCode();
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
      expect(code).not.toMatch(/[IO01]/);
    }
  });

  it("ne tire jamais deux fois le même", () => {
    const tires = new Set(Array.from({ length: 200 }, () => tirerUnCode()));
    expect(tires.size).toBe(200);
  });
});

describe("le jeton de lecture", () => {
  const empreinte = empreinteDuCode("ABCD1234WXYZ");

  it("reconnaît celui qu'il a émis", () => {
    expect(jetonValide("chalet-6511", empreinte, jetonDeLecture("chalet-6511", empreinte))).toBe(
      true,
    );
  });

  it("refuse l'absence de jeton, et un jeton inventé", () => {
    expect(jetonValide("chalet-6511", empreinte, undefined)).toBe(false);
    expect(jetonValide("chalet-6511", empreinte, "")).toBe(false);
    expect(jetonValide("chalet-6511", empreinte, "f".repeat(64))).toBe(false);
  });

  it("ne vaut QUE pour son brief", () => {
    /* Sans cela, le code du 6511 ouvrirait tous les biens de la grille. */
    const jeton = jetonDeLecture("chalet-6511", empreinte);
    expect(jetonValide("villa-verdun", empreinte, jeton)).toBe(false);
  });

  it("meurt quand le code change", () => {
    /* LA propriété qui donne son sens au changement de code. Sans elle, poser
       un nouveau code laisserait entrer tous ceux qui avaient saisi l'ancien,
       et on croirait avoir refermé la porte. */
    const jeton = jetonDeLecture("chalet-6511", empreinte);
    const nouvelle = empreinteDuCode("NOUVEAUCODE9");
    expect(jetonValide("chalet-6511", nouvelle, jeton)).toBe(false);
  });
});

describe("le registre", () => {
  const source = readFileSync(
    join(process.cwd(), "src", "modules", "briefs", "registre.ts"),
    "utf8",
  );

  it("ne porte que des empreintes, jamais un code", () => {
    /* Le dépôt est lu par tous ceux qui ont accès au code source, et il part
       sur GitHub. Un code en clair y serait un code publié. */
    const empreintes = source.match(/"scrypt\$[^"]+"/g) ?? [];
    expect(empreintes.length).toBeGreaterThan(0);
    expect(source).not.toMatch(/code\s*:\s*"[A-Z0-9-]{10,}"/);
  });

  it("chaque empreinte est au format attendu", () => {
    for (const brute of source.match(/scrypt\$[0-9a-f$]+/g) ?? []) {
      expect(brute.split("$")).toHaveLength(6);
    }
  });
});
