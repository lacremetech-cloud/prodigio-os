import { describe, expect, it } from "vitest";
import { ANALYSE_ROUTE, PROPRIETAIRE_ROUTE } from "./routes";

describe("routes publiques", () => {
  it("le CTA conduit bien vers le parcours d'analyse (le quiz)", () => {
    expect(ANALYSE_ROUTE).toBe("/proprietaire/analyse");
  });

  it("la landing reste sur /proprietaire", () => {
    expect(PROPRIETAIRE_ROUTE).toBe("/proprietaire");
  });
});
