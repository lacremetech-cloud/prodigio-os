// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { BeforeAfterSlider } from "./before-after-slider";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

afterEach(() => cleanup());

const before = { src: "/before.webp", width: 1600, height: 900, alt: "Annonce portail" };
const after = { src: "/after.webp", width: 1400, height: 764, alt: "Écrin Prodigio" };

describe("BeforeAfterSlider", () => {
  it("rend les deux visuels et un curseur accessible", () => {
    render(
      <BeforeAfterSlider
        before={before}
        after={after}
        beforeLabel="Annonce standard"
        afterLabel="Écrin Prodigio"
      />,
    );
    expect(screen.getByAltText("Annonce portail")).toBeTruthy();
    expect(screen.getByAltText("Écrin Prodigio")).toBeTruthy();
    // Les libellés des deux côtés.
    expect(screen.getByText("Annonce standard")).toBeTruthy();
    expect(screen.getAllByText("Écrin Prodigio").length).toBeGreaterThanOrEqual(1);
    // Contrôle réel = input range (role slider), pilotable au clavier.
    const slider = screen.getByRole("slider") as HTMLInputElement;
    expect(slider.type).toBe("range");
  });

  it("met à jour la position au déplacement du curseur", () => {
    render(
      <BeforeAfterSlider
        before={before}
        after={after}
        beforeLabel="Annonce standard"
        afterLabel="Écrin Prodigio"
      />,
    );
    const slider = screen.getByRole("slider") as HTMLInputElement;
    fireEvent.change(slider, { target: { value: "20" } });
    expect(Number(slider.value)).toBe(20);
  });
});
