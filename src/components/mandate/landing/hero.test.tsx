// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { EXPERIENCE_LABEL, SYSTEM_NAME } from "@/config/credentials";
import { Hero } from "./hero";
import { CTA_PRIMARY, CTA_SUB, hero } from "./copy";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

afterEach(() => cleanup());

function heroText(container: HTMLElement) {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

describe("Hero", () => {
  it("pose la question d'ouverture comme unique titre de niveau 1", () => {
    const { container } = render(<Hero />);
    const titles = container.querySelectorAll("h1");
    expect(titles).toHaveLength(1);
    expect(titles[0]?.textContent).toBe(hero.title);
  });

  it("nomme la méthode dans le sous-titre et la met en valeur", () => {
    const { container } = render(<Hero />);
    expect(heroText(container)).toContain(
      `${hero.subtitleBefore}${SYSTEM_NAME}${hero.subtitleAfter}`.replace(/\s+/g, " "),
    );
    // Le nom de la méthode est distingué typographiquement, pas noyé.
    const accent = container.querySelector("strong");
    expect(accent?.textContent).toBe(SYSTEM_NAME);
  });

  it("garde l'ancienneté comme paramètre, jamais comme constante d'un composant", () => {
    expect(hero.subtitleBefore).toContain(EXPERIENCE_LABEL);
  });

  it("conserve l'annotation manuscrite qui désigne le film", () => {
    // Formulation validée par le propriétaire : elle ne doit pas disparaître.
    const { container } = render(<Hero />);
    expect(heroText(container)).toContain(hero.vslNote);
    expect(container.querySelector("svg[viewBox='0 0 48 44']")).toBeTruthy();
  });

  it("garde le film au-dessus du bouton, et le bouton au-dessus de sa réassurance", () => {
    const { container } = render(<Hero />);
    // Position de chaque repère dans l'ordre du document.
    const noeuds = [...container.querySelectorAll("*")];
    const rang = (selecteur: string) =>
      noeuds.findIndex((n) => n.matches(selecteur) && !n.closest("header"));

    const titre = rang("h1");
    const film = rang(".hero-media");
    const bouton = rang("a[href='/proprietaire/analyse']");
    expect(titre).toBeGreaterThanOrEqual(0);
    expect(film).toBeGreaterThan(titre);
    expect(bouton).toBeGreaterThan(film);

    expect(heroText(container)).toContain(CTA_PRIMARY);
    expect(heroText(container)).toContain(CTA_SUB);
  });
});
