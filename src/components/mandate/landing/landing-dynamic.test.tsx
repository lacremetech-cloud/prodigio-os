// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CountUp, easeOutExpo } from "@/components/ui/count-up";
import { PreuveFlash } from "./preuve-flash";
import { CaseStudySection } from "./case-study-section";
import { ManifesteSection } from "./manifeste-section";
import { FaqSection } from "./faq-section";
import { caseStudy, faq, manifeste, preuveFlash } from "./copy";

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
  it("affiche la valeur finale (rendu SSR / sans JavaScript)", () => {
    render(<CountUp value={312} />);
    expect(screen.getByText("312")).toBeTruthy();
  });
});

describe("PreuveFlash", () => {
  it("pose les chiffres du cas réel juste après la hero", () => {
    render(<PreuveFlash />);
    for (const stat of preuveFlash.stats) {
      expect(screen.getByText(stat.label)).toBeTruthy();
    }
    expect(screen.getByText(preuveFlash.microcopy)).toBeTruthy();
  });
});

describe("CaseStudySection", () => {
  it("déroule l'entonnoir et conserve le disclaimer", () => {
    render(<CaseStudySection />);
    for (const stat of caseStudy.stats) {
      expect(screen.getByText(stat.label)).toBeTruthy();
    }
    expect(screen.getByText(caseStudy.climax.label)).toBeTruthy();
    // La preuve n'est jamais présentée comme une garantie.
    expect(screen.getByText(caseStudy.disclaimer)).toBeTruthy();
  });
});

describe("ManifesteSection", () => {
  it("énonce le positionnement « traditionnel + Système Prodigio »", () => {
    render(<ManifesteSection />);
    expect(screen.getByText(manifeste.expertise.label)).toBeTruthy();
    expect(screen.getByText(manifeste.systeme.label)).toBeTruthy();
    expect(screen.getByText(manifeste.resultat)).toBeTruthy();
  });
});

describe("FaqSection", () => {
  it("rend chaque question dans un repliable natif (utilisable sans JS)", () => {
    const { container } = render(<FaqSection />);
    expect(container.querySelectorAll("details").length).toBe(faq.items.length);
    for (const item of faq.items) {
      expect(screen.getByText(item.q)).toBeTruthy();
    }
  });
});

describe("Positionnement — interdits de ton", () => {
  it("ne caricature jamais les agences traditionnelles", () => {
    const { container } = render(
      <>
        <ManifesteSection />
        <FaqSection />
      </>,
    );
    const texte = container.textContent ?? "";
    for (const interdit of ["la même fiche", "annonce ordinaire", "partout ailleurs"]) {
      expect(texte.toLowerCase()).not.toContain(interdit);
    }
  });
});
