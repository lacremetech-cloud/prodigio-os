import { describe, expect, it } from "vitest";
import { numeroAppelable } from "./telephone";

describe("numeroAppelable", () => {
  it("garde un numéro réel, sans les espaces", () => {
    expect(numeroAppelable("+33 6 12 34 56 78")).toBe("+33612345678");
  });

  it("refuse un numéro masqué : le bouton appellerait « ••• »", () => {
    expect(numeroAppelable("•••• masqué")).toBeNull();
  });

  it("refuse l'absence de numéro et les restes trop courts", () => {
    expect(numeroAppelable(null)).toBeNull();
    expect(numeroAppelable("")).toBeNull();
    expect(numeroAppelable("12 34")).toBeNull();
  });
});
