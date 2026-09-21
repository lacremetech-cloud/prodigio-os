import { describe, expect, it } from "vitest";
import {
  resolveOrganization,
  slugifyOrganization,
  type OrganizationCandidate,
} from "./organization";

const JCA: OrganizationCandidate = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "JCA",
  slug: "jca",
  kind: "agence_partenaire",
};
const HERITAGE: OrganizationCandidate = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Héritage Patrimoine",
  slug: "heritage-patrimoine",
  kind: "agence_partenaire",
};

describe("slugifyOrganization", () => {
  it("produit un identifiant stable, sans accent ni caractère exotique", () => {
    expect(slugifyOrganization("JCA")).toBe("jca");
    expect(slugifyOrganization("Héritage Patrimoine")).toBe("heritage-patrimoine");
    expect(slugifyOrganization("  Agence   Côte & Mer  ")).toBe("agence-cote-mer");
  });

  it("renvoie une chaîne vide quand rien n'est exploitable", () => {
    expect(slugifyOrganization("   ")).toBe("");
    expect(slugifyOrganization("###")).toBe("");
  });
});

describe("resolveOrganization", () => {
  it("réutilise une organisation existante au lieu d'en créer un doublon", () => {
    const resolution = resolveOrganization("JCA", [JCA, HERITAGE]);
    expect(resolution.status).toBe("existante");
    if (resolution.status === "existante") {
      expect(resolution.organization.id).toBe(JCA.id);
    }
  });

  it("reconnaît une organisation par son identifiant même si la casse diffère", () => {
    const resolution = resolveOrganization("jca", [JCA]);
    expect(resolution.status).toBe("existante");
  });

  it("ignore les accents pour retrouver une organisation connue", () => {
    const resolution = resolveOrganization("heritage patrimoine", [HERITAGE]);
    expect(resolution.status).toBe("existante");
  });

  it("ne tranche pas entre deux homonymes", () => {
    const jumeau: OrganizationCandidate = { ...JCA, id: "33333333-3333-4333-8333-333333333333" };
    const resolution = resolveOrganization("JCA", [JCA, jumeau]);
    expect(resolution.status).toBe("ambigue");
    if (resolution.status === "ambigue") {
      expect(resolution.candidates).toHaveLength(2);
    }
  });

  it("propose un enregistrement quand l'organisation est inconnue — sans le faire", () => {
    const resolution = resolveOrganization("JCA", [HERITAGE]);
    expect(resolution.status).toBe("a_enregistrer");
    if (resolution.status === "a_enregistrer") {
      expect(resolution.slug).toBe("jca");
      expect(resolution.name).toBe("JCA");
    }
  });

  it("signale l'absence d'organisation : un bien partenaire ne peut pas exister sans elle", () => {
    expect(resolveOrganization(null, [JCA]).status).toBe("absente");
    expect(resolveOrganization("   ", [JCA]).status).toBe("absente");
  });
});
