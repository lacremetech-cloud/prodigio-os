import { describe, expect, it } from "vitest";
import { compareTemplates, diffLines, type ComparableTemplate } from "./diff";

const V1: ComparableTemplate = {
  version: 1,
  name: "Accusé de réception",
  subject: "Votre demande a bien été reçue",
  body: "Bonjour {{prenom}},\n\nNous avons bien reçu votre demande.\n\nL'équipe",
  allowedVariables: ["prenom", "nom"],
};

const V2: ComparableTemplate = {
  version: 2,
  name: "Accusé de réception",
  subject: "Bien reçu !",
  body: "Bonjour {{prenom}},\n\nNous avons bien reçu votre demande à {{ville}}.\n\nL'équipe",
  allowedVariables: ["prenom", "nom", "ville"],
};

describe("comparaison ligne à ligne", () => {
  it("marque comme identiques deux textes égaux", () => {
    const lines = diffLines("a\nb", "a\nb");
    expect(lines.every((l) => l.kind === "identique")).toBe(true);
    expect(lines).toHaveLength(2);
  });

  it("distingue ajouts et suppressions, avec les numéros de ligne", () => {
    const lines = diffLines("a\nb\nc", "a\nc");
    expect(lines.filter((l) => l.kind === "suppression").map((l) => l.text)).toEqual(["b"]);
    expect(lines.filter((l) => l.kind === "ajout")).toHaveLength(0);
    expect(lines.find((l) => l.text === "b")?.left).toBe(2);
    expect(lines.find((l) => l.text === "b")?.right).toBeNull();
  });

  it("traite le passage de vide à non vide comme un ajout complet", () => {
    const lines = diffLines("", "x");
    expect(lines.some((l) => l.kind === "ajout" && l.text === "x")).toBe(true);
  });

  it("est déterministe", () => {
    expect(diffLines(V1.body, V2.body)).toEqual(diffLines(V1.body, V2.body));
  });
});

describe("comparaison de deux versions de modèle", () => {
  it("compare les quatre champs attendus", () => {
    expect(compareTemplates(V1, V2).map((f) => f.field)).toEqual([
      "name",
      "subject",
      "body",
      "allowedVariables",
    ]);
  });

  it("signale précisément ce qui a changé, et ce qui n'a pas changé", () => {
    const diffs = compareTemplates(V1, V2);
    const byField = new Map(diffs.map((d) => [d.field, d]));
    expect(byField.get("name")?.changed).toBe(false);
    expect(byField.get("subject")?.changed).toBe(true);
    expect(byField.get("body")?.changed).toBe(true);
    expect(byField.get("allowedVariables")?.changed).toBe(true);
  });

  it("comparer est une LECTURE : aucune des deux versions n'est modifiée", () => {
    const left = structuredClone(V1);
    const right = structuredClone(V2);
    compareTemplates(left, right);
    expect(left).toEqual(V1);
    expect(right).toEqual(V2);
  });

  it("ne signale aucun changement entre une version et elle-même", () => {
    expect(compareTemplates(V1, V1).every((f) => !f.changed)).toBe(true);
  });
});
