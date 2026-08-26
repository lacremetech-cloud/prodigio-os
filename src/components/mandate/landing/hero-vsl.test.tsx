// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { HeroVsl } from "./hero-vsl";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

afterEach(() => cleanup());

describe("HeroVsl — un seul geste", () => {
  it("expose l'écrin comme un unique bouton : toute la zone est cliquable", () => {
    render(<HeroVsl />);
    const triggers = screen.getAllByRole("button");
    expect(triggers.length).toBe(1);
  });

  it("n'ouvre aucun lecteur tant que rien n'est cliqué (aucune lecture auto)", () => {
    const { container } = render(<HeroVsl />);
    expect(container.querySelector("iframe")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("ouvre l'expérience agrandie dès le premier clic, avec le son", () => {
    const { container } = render(<HeroVsl />);
    fireEvent.click(screen.getByRole("button"));

    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");

    const iframe = container.querySelector("iframe");
    expect(iframe).not.toBeNull();
    // Le film démarre seul et audible : pas de « lire puis chercher le son ».
    expect(iframe?.getAttribute("src")).toContain("autoplay=1");
    expect(iframe?.getAttribute("src")).toContain("mute=0");
  });

  it("se ferme avec la touche Échap", () => {
    render(<HeroVsl />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("restaure la position de défilement à la fermeture (aucun saut)", () => {
    const scrollTo = vi.fn();
    Object.defineProperty(window, "scrollY", { value: 1240, writable: true });
    Object.defineProperty(window, "scrollTo", { value: scrollTo, writable: true });

    render(<HeroVsl />);
    fireEvent.click(screen.getByRole("button"));
    // Le corps est figé à l'offset courant pendant la lecture.
    expect(document.body.style.top).toBe("-1240px");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(scrollTo).toHaveBeenCalledWith(0, 1240);
    expect(document.body.style.position).toBe("");
  });
});
