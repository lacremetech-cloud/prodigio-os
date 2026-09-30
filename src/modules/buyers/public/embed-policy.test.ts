import { describe, expect, it } from "vitest";
import {
  buildFrameAncestorsPolicy,
  buyerFormSlugFromPath,
  normalizeOrigin,
  sanitizeOrigins,
} from "./embed-policy";

describe("buyerFormSlugFromPath", () => {
  it("reconnaît la route du formulaire, avec ou sans barre finale", () => {
    expect(buyerFormSlugFromPath("/bien/villa-jean-jaures/interet")).toBe("villa-jean-jaures");
    expect(buyerFormSlugFromPath("/bien/villa-jean-jaures/interet/")).toBe("villa-jean-jaures");
  });

  it("ignore les autres routes", () => {
    for (const path of ["/bien/villa/x", "/crm/biens", "/", "/bien/villa", "/interet"]) {
      expect(buyerFormSlugFromPath(path)).toBeNull();
    }
  });
});

describe("normalizeOrigin", () => {
  it("accepte une origine http(s) et conserve le port", () => {
    expect(normalizeOrigin("https://villa-jeanjaures-cassis.vercel.app")).toBe(
      "https://villa-jeanjaures-cassis.vercel.app",
    );
    expect(normalizeOrigin("  https://exemple.test:8443  ")).toBe("https://exemple.test:8443");
  });

  it("écarte un chemin plutôt que de l'ignorer : cela autoriserait tout le domaine", () => {
    expect(normalizeOrigin("https://exemple.test/brochure")).toBeNull();
    expect(normalizeOrigin("https://exemple.test/?a=1")).toBeNull();
    expect(normalizeOrigin("https://exemple.test/#x")).toBeNull();
  });

  it("refuse les schémas dangereux ou inattendus", () => {
    for (const bad of [
      "javascript:alert(1)",
      "data:text/html,<b>",
      "file:///etc/passwd",
      "ftp://exemple.test",
    ]) {
      expect(normalizeOrigin(bad)).toBeNull();
    }
  });

  it("refuse les identifiants intégrés et les espaces", () => {
    expect(normalizeOrigin("https://user:pass@exemple.test")).toBeNull();
    expect(normalizeOrigin("https://exemple.test autre.test")).toBeNull();
  });

  it("refuse ce qui n'est pas une URL", () => {
    expect(normalizeOrigin("exemple.test")).toBeNull();
    expect(normalizeOrigin("")).toBeNull();
    expect(normalizeOrigin("   ")).toBeNull();
  });
});

describe("sanitizeOrigins", () => {
  it("dédoublonne et écarte l'invalide sans interrompre le reste", () => {
    expect(
      sanitizeOrigins([
        "https://a.test",
        "https://a.test/",
        "pas-une-url",
        "https://b.test",
        "javascript:alert(1)",
      ]),
    ).toEqual(["https://a.test", "https://b.test"]);
  });
});

describe("buildFrameAncestorsPolicy", () => {
  it("n'autorise QUE la page elle-même quand aucune origine n'est déclarée", () => {
    expect(buildFrameAncestorsPolicy([])).toBe("frame-ancestors 'self'");
  });

  it("ajoute les origines autorisées, sans jamais retirer 'self'", () => {
    expect(buildFrameAncestorsPolicy(["https://a.test", "https://b.test"])).toBe(
      "frame-ancestors 'self' https://a.test https://b.test",
    );
  });

  it("ne laisse pas passer une origine invalide dans l'en-tête", () => {
    expect(buildFrameAncestorsPolicy(["https://a.test", "javascript:alert(1)"])).toBe(
      "frame-ancestors 'self' https://a.test",
    );
  });

  it("n'autorise jamais tout le monde, même si on le lui demande", () => {
    const policy = buildFrameAncestorsPolicy(["*", "'none'", "https://ok.test"]);
    expect(policy).toBe("frame-ancestors 'self' https://ok.test");
    expect(policy).not.toContain("*");
  });
});
