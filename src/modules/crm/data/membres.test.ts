import { describe, expect, it } from "vitest";

import { membresAffectables } from "./membres";
import type { MemberInfo } from "./noms";

function carte(entrees: Array<[string, Partial<MemberInfo>]>): Map<string, MemberInfo> {
  return new Map(
    entrees.map(([id, p]) => [
      id,
      { email: null, role: "commercial", displayName: null, status: "actif", ...p },
    ]),
  );
}

describe("les membres à qui on peut confier un dossier", () => {
  it("écarte un compte suspendu — on ne confie pas à qui ne peut pas se connecter", () => {
    const m = carte([
      ["u-antoine", { displayName: "Antoine" }],
      ["u-recette", { displayName: "RECETTE (temporaire)", status: "suspendu" }],
    ]);
    expect(membresAffectables(m).map((o) => o.name)).toEqual(["Antoine"]);
  });

  it("garde tous les membres actifs, quel que soit leur rôle", () => {
    const m = carte([
      ["u-jc", { displayName: "JC" }],
      ["u-agence", { displayName: "Agence", role: "administrateur" }],
      ["u-nicolas", { displayName: "Nicolas" }],
    ]);
    expect(membresAffectables(m).map((o) => o.name)).toEqual(["Agence", "JC", "Nicolas"]);
  });

  it("classe par ordre alphabétique français", () => {
    const m = carte([
      ["u-3", { displayName: "Étienne" }],
      ["u-1", { displayName: "Antoine" }],
      ["u-2", { displayName: "Zoé" }],
    ]);
    expect(membresAffectables(m).map((o) => o.name)).toEqual(["Antoine", "Étienne", "Zoé"]);
  });

  it("retombe sur l'e-mail quand aucun nom n'est saisi", () => {
    const m = carte([["u-x", { email: "casteljc69@gmail.com" }]]);
    expect(membresAffectables(m)[0]?.name).toBe("casteljc69");
  });

  it("rend une liste vide plutôt que de planter sur une carte vide", () => {
    expect(membresAffectables(new Map())).toEqual([]);
  });
});
