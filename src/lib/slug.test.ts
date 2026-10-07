import { describe, expect, it } from "vitest";
import { foldText, slugify } from "./slug";

describe("slugify", () => {
  it("propose l'identifiant attendu pour un nom de bien accentué", () => {
    expect(slugify("Villa Jean Jaurès")).toBe("villa-jean-jaures");
    expect(slugify("Villa Belvédère")).toBe("villa-belvedere");
  });

  it("absorbe la ponctuation, les séparateurs et les espaces insécables", () => {
    expect(slugify("Maison · Cassis")).toBe("maison-cassis");
    expect(slugify("20, avenue Jean Jaurès")).toBe("20-avenue-jean-jaures");
  });

  it("ne laisse jamais de tiret en tête ni en queue, même après troncature", () => {
    expect(slugify("—  Villa  —")).toBe("villa");
    expect(slugify(`${"a".repeat(119)} suite`)).toBe("a".repeat(119));
  });

  it("renvoie une chaîne vide plutôt que d'inventer un identifiant", () => {
    expect(slugify("")).toBe("");
    expect(slugify("—— ··· ——")).toBe("");
  });

  it("foldText sert aux comparaisons de libellés, pas aux identifiants", () => {
    expect(foldText("  Héritage   Patrimoine ")).toBe("heritage patrimoine");
  });
});
