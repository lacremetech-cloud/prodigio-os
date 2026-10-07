// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { FaqSection } from "./faq-section";
import { faq } from "./copy";

afterEach(() => cleanup());

describe("FaqSection", () => {
  it("expose chaque question dans un <details> natif (clavier, sans JS)", () => {
    const { container } = render(<FaqSection />);
    const details = container.querySelectorAll("details");
    expect(details.length).toBe(faq.items.length);
    for (const item of faq.items) {
      expect(screen.getByText(item.q)).toBeTruthy();
      expect(screen.getByText(item.a)).toBeTruthy();
    }
  });

  it("ne publie ni délai promis ni condition économique chiffrée", () => {
    const { container } = render(<FaqSection />);
    const texte = container.textContent ?? "";
    // Pas de seuil, de partage ni de pourcentage : ce sont des paramètres
    // contractuels versionnés, pas du contenu public.
    expect(texte).not.toMatch(/\d+\s*%/);
    expect(texte).not.toMatch(/\b\d[\d\s]*(€|euros)/i);
    expect(texte).not.toMatch(/garanti/i);
  });
});
