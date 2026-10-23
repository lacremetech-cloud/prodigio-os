import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { memberDisplayName } = await import("./queries");

const JC = "11111111-1111-1111-1111-111111111111";
const ANTOINE = "22222222-2222-2222-2222-222222222222";
const INCONNU = "33333333-3333-3333-3333-333333333333";

const membres = new Map([
  [JC, { email: "casteljc69@gmail.com", role: "commercial", displayName: "JC", status: "actif" }],
  [ANTOINE, { email: "adelombares@kprojects.fr", role: "commercial", displayName: null, status: "actif" }],
]);

describe("nom affichable d'un membre", () => {
  it("prefere le nom choisi par l'organisation", () => {
    expect(memberDisplayName(JC, membres)).toBe("JC");
  });

  it("retombe sur la partie locale de l'e-mail quand aucun nom n'est saisi", () => {
    expect(memberDisplayName(ANTOINE, membres)).toBe("adelombares");
  });

  it("ignore un nom qui ne contient que des espaces", () => {
    const m = new Map([[JC, { email: "casteljc69@gmail.com", role: "commercial", displayName: "   ", status: "actif" }]]);
    expect(memberDisplayName(JC, m)).toBe("casteljc69");
  });

  it("rend un identifiant court pour un membre inconnu, jamais une chaine vide", () => {
    expect(memberDisplayName(INCONNU, membres)).toBe("Membre 333333");
  });
});
