import { describe, expect, it } from "vitest";
import {
  compterDossiers,
  domaineLisible,
  lienDuTunnel,
  type DossierPourCompte,
} from "./raccourcis";

const dossier = (over: Partial<DossierPourCompte> = {}): DossierPourCompte => ({
  pipelineStage: "en_discussion",
  derniereDemande: "2026-10-01T10:00:00.000Z",
  assigneCount: 1,
  ...over,
});

describe("lienDuTunnel", () => {
  it("retient la première origine https", () => {
    expect(lienDuTunnel(["https://villa-verdun-cassis.vercel.app"])).toBe(
      "https://villa-verdun-cassis.vercel.app",
    );
  });

  it("ignore une origine en clair, qui ne serait pas un tunnel de production", () => {
    expect(lienDuTunnel(["http://localhost:3000", "https://villa.test"])).toBe("https://villa.test");
  });

  it("retire la barre oblique finale, pour que le lien se colle tel quel", () => {
    expect(lienDuTunnel(["https://villa.test/"])).toBe("https://villa.test");
  });

  it("sans origine autorisée, il n'y a pas de tunnel à montrer", () => {
    expect(lienDuTunnel([])).toBeNull();
    expect(lienDuTunnel(null)).toBeNull();
  });
});

describe("domaineLisible", () => {
  it("ne garde que le domaine", () => {
    expect(domaineLisible("https://villa-verdun-cassis.vercel.app/dossier/")).toBe(
      "villa-verdun-cassis.vercel.app",
    );
  });

  it("rend null plutôt que d'afficher une adresse invalide", () => {
    expect(domaineLisible("pas une adresse")).toBeNull();
    expect(domaineLisible(null)).toBeNull();
  });
});

describe("compterDossiers", () => {
  const maintenant = new Date("2026-10-12T09:00:00.000Z");

  it("compte les demandes du jour dans le fuseau de celui qui regarde", () => {
    const c = compterDossiers(
      [
        dossier({ derniereDemande: "2026-10-12T07:30:00.000Z" }),
        dossier({ derniereDemande: "2026-10-11T22:00:00.000Z" }),
      ],
      maintenant,
    );
    expect(c.total).toBe(2);
    expect(c.aujourdhui).toBe(1);
  });

  it("« à traiter » couvre le nouveau et le rappel, pas la discussion en cours", () => {
    const c = compterDossiers(
      [
        dossier({ pipelineStage: "nouveau" }),
        dossier({ pipelineStage: "a_rappeler" }),
        dossier({ pipelineStage: "en_discussion" }),
        dossier({ pipelineStage: "gagne" }),
      ],
      maintenant,
    );
    expect(c.aTraiter).toBe(2);
  });

  it("signale les dossiers que personne ne suit", () => {
    const c = compterDossiers(
      [dossier({ assigneCount: 0 }), dossier({ assigneCount: 2 })],
      maintenant,
    );
    expect(c.sansResponsable).toBe(1);
  });

  it("une date illisible ne compte pas pour aujourd'hui et ne fait rien planter", () => {
    const c = compterDossiers([dossier({ derniereDemande: "jamais" })], maintenant);
    expect(c.aujourdhui).toBe(0);
    expect(c.total).toBe(1);
  });

  it("sans dossier, tout est à zéro", () => {
    expect(compterDossiers([], maintenant)).toEqual({
      total: 0,
      aujourdhui: 0,
      aTraiter: 0,
      sansResponsable: 0,
    });
  });
});
