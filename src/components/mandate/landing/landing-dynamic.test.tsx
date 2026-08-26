// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CountUp, easeOutExpo } from "@/components/ui/count-up";
import { ProofStripSection } from "./proof-strip-section";
import { MarcheInvisibleSection } from "./marche-invisible-section";
import { AcquisitionSection } from "./acquisition-section";
import { MarchesSection } from "./marches-section";
import { acquisition, marcheInvisible, marches, proofStrip } from "./copy";

afterEach(() => cleanup());

describe("easeOutExpo", () => {
  it("borne les extrémités à 0 et 1", () => {
    expect(easeOutExpo(0)).toBe(0);
    expect(easeOutExpo(1)).toBe(1);
    expect(easeOutExpo(-1)).toBe(0);
    expect(easeOutExpo(2)).toBe(1);
  });

  it("est croissante entre 0 et 1", () => {
    expect(easeOutExpo(0.25)).toBeLessThan(easeOutExpo(0.75));
    expect(easeOutExpo(0.5)).toBeGreaterThan(0);
    expect(easeOutExpo(0.5)).toBeLessThan(1);
  });
});

describe("CountUp", () => {
  it("affiche la valeur finale (rendu SSR / no-JS friendly)", () => {
    render(<CountUp value={312} />);
    expect(screen.getByText("312")).toBeTruthy();
  });
});

describe("ProofStripSection", () => {
  it("affiche la preuve chiffrée immédiatement lisible", () => {
    render(<ProofStripSection />);
    for (const stat of proofStrip.stats) {
      expect(screen.getByText(stat.label)).toBeTruthy();
    }
    expect(screen.getByText("312")).toBeTruthy();
  });
});

describe("MarcheInvisibleSection", () => {
  it("pose la question du marché latent, sans rien démontrer", () => {
    const { container } = render(<MarcheInvisibleSection />);
    const texte = container.textContent ?? "";
    expect(screen.getByText(marcheInvisible.statement)).toBeTruthy();
    expect(texte).toContain(marcheInvisible.body);
    for (const trait of marcheInvisible.traits) {
      expect(screen.getByText(trait)).toBeTruthy();
    }
  });
});

describe("MarchesSection", () => {
  it("donne raison au marché actif avant d'ajouter le marché latent", () => {
    const { container } = render(<MarchesSection />);
    const texte = container.textContent ?? "";
    expect(texte).toContain(marches.aside);
    expect(texte).toContain(marches.punchLine1);
    expect(texte).toContain(marches.punchLine2);
    // Aucune formule accusatrice envers la profession.
    expect(texte).not.toMatch(/dépassé|obsolèt|ne font rien|ne fonctionne plus/i);
  });

  it("présente les deux marchés côte à côte, aucun n'étant escamoté", () => {
    render(<MarchesSection />);
    expect(screen.getByText(marches.actif.label)).toBeTruthy();
    expect(screen.getByText(marches.latent.label)).toBeTruthy();
    for (const item of marches.actif.items) {
      expect(screen.getByText(item)).toBeTruthy();
    }
  });
});

describe("AcquisitionSection", () => {
  it("oppose la nature des objets, jamais leur valeur", () => {
    const { container } = render(<AcquisitionSection />);
    const texte = container.textContent ?? "";
    expect(texte).toContain(acquisition.punchLine1);
    expect(texte).toContain(acquisition.punchLine2);
    // On ne dit jamais que l'organique ou les réseaux sociaux ne marchent pas.
    expect(texte).not.toMatch(/ne (fonctionne|marche)nt? (pas|plus)|inefficace/i);
    // La maquette publicitaire reste annoncée comme une illustration.
    expect(texte).toContain(acquisition.adMock.note);
  });
});
