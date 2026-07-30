// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CountUp, easeOutExpo } from "@/components/ui/count-up";
import { StatementSection } from "./statement-section";
import { ProofSection } from "./proof-section";
import { preuve, statement } from "./copy";

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

describe("StatementSection", () => {
  it("porte la phrase signature « Prodigio le vend »", () => {
    render(<StatementSection />);
    expect(screen.getByText(statement.line1)).toBeTruthy();
    expect(screen.getByText(/le vend\./i)).toBeTruthy();
  });
});

describe("ProofSection", () => {
  it("affiche tous les paliers de l'entonnoir", () => {
    render(<ProofSection />);
    for (const stat of preuve.stats) {
      expect(screen.getByText(stat.label)).toBeTruthy();
    }
    // Valeurs animées : rendu initial = valeur finale.
    expect(screen.getByText("312")).toBeTruthy();
  });
});
