// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CountUp, easeOutExpo } from "@/components/ui/count-up";
import { ProofStripSection } from "./proof-strip-section";
import { AudienceSection } from "./audience-section";
import { ComparaisonSection } from "./comparaison-section";
import { audience, comparaison, proofStrip } from "./copy";

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

describe("AudienceSection", () => {
  it("pose l'angle mort avant la mesure de l'audience", () => {
    const { container } = render(<AudienceSection />);
    const texte = container.textContent ?? "";
    expect(screen.getByText(audience.emphasis)).toBeTruthy();
    expect(texte).toContain(audience.punch);
    // Le constat vise la commercialisation passive, jamais la profession.
    expect(texte).not.toMatch(/dépassé|obsolèt|ne font rien|ne fonctionne plus/i);
  });

  it("ne publie jamais de statistique sans mention de source", () => {
    const { container } = render(<AudienceSection />);
    expect(container.textContent ?? "").toContain(audience.sourceNote);
  });
});

describe("ComparaisonSection", () => {
  it("reste additive : la commercialisation traditionnelle n'est jamais dénigrée", () => {
    const { container } = render(<ComparaisonSection />);
    const texte = container.textContent ?? "";
    expect(texte).toContain(comparaison.punchLine1);
    expect(texte).toContain(comparaison.punchLine2);
    // Aucune formule accusatrice envers la profession.
    expect(texte).not.toMatch(/dépassé|obsolèt|ne font rien|ne fonctionne plus/i);
  });
});
