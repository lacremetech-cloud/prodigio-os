// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { HeroVsl } from "./hero-vsl";
import { hero } from "./copy";

// next/image → simple <img> (évite le runtime Next dans jsdom).
vi.mock("next/image", () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  ),
}));

// next/dynamic → composant inerte : la fenêtre du film n'est pas testée ici.
vi.mock("next/dynamic", () => ({
  default: () => function Stub() {
    return <div data-testid="vsl-modal" />;
  },
}));

afterEach(() => cleanup());

describe("HeroVsl — affiche du film", () => {
  it("ne charge aucune iframe ni script YouTube sur le premier écran", () => {
    render(<HeroVsl />);
    // Le premier écran ne doit peser qu'une image : le lecteur n'arrive qu'au
    // clic. C'est la garantie de performance la plus importante de la page.
    expect(document.querySelector("iframe")).toBeNull();
    expect(document.querySelector('script[src*="youtube"]')).toBeNull();
  });

  it("rend toute la surface cliquable, et non un simple bouton de lecture", () => {
    const { container } = render(<HeroVsl />);
    const buttons = container.querySelectorAll("button");
    expect(buttons).toHaveLength(1);
    const surface = buttons[0]!;
    expect(surface.className).toContain("aspect-video");
    expect(surface.className).toContain("w-full");
    expect(surface.getAttribute("aria-label")).toMatch(/lire le film/i);
  });

  it("porte l'invitation et le repère de durée sur l'affiche", () => {
    render(<HeroVsl />);
    expect(screen.getByText(hero.vslInvite)).toBeTruthy();
    expect(screen.getByText(hero.vslDuration)).toBeTruthy();
  });

  it("n'ouvre la fenêtre du film qu'après un geste du visiteur", () => {
    const { container } = render(<HeroVsl />);
    expect(screen.queryByTestId("vsl-modal")).toBeNull();
    act(() => container.querySelector("button")!.click());
    expect(screen.getByTestId("vsl-modal")).toBeTruthy();
  });
});
