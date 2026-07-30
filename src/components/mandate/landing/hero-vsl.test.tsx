// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import {
  HeroVsl,
  shouldShowPlayFallback,
  shouldShowSoundButton,
} from "./hero-vsl";

// next/image → simple <img> (évite le runtime Next dans jsdom).
vi.mock("next/image", () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  ),
}));

afterEach(() => cleanup());

describe("HeroVsl — logique d'affichage", () => {
  it("propose le son uniquement pendant la lecture muette", () => {
    expect(shouldShowSoundButton("playing")).toBe(true);
    expect(shouldShowSoundButton("idle")).toBe(false);
    expect(shouldShowSoundButton("sound")).toBe(false);
    expect(shouldShowSoundButton("blocked")).toBe(false);
  });

  it("propose la lecture de secours uniquement si l'autoplay est bloqué", () => {
    expect(shouldShowPlayFallback("blocked")).toBe(true);
    expect(shouldShowPlayFallback("idle")).toBe(false);
    expect(shouldShowPlayFallback("playing")).toBe(false);
  });
});

describe("HeroVsl — rendu", () => {
  it("intègre la VSL (iframe nocookie, autoplay muet, playsinline, sans habillage)", () => {
    render(<HeroVsl />);
    const iframe = document.querySelector("iframe");
    expect(iframe).not.toBeNull();
    const src = iframe!.getAttribute("src") ?? "";
    expect(src).toContain("youtube-nocookie.com/embed/rgH1uqNdvHs");
    expect(src).toContain("autoplay=1");
    expect(src).toContain("mute=1");
    expect(src).toContain("playsinline=1");
    expect(src).toContain("controls=0");
    expect(src).toContain("enablejsapi=1");
    // Attribut autorisant l'autoplay.
    expect(iframe!.getAttribute("allow") ?? "").toContain("autoplay");
  });

  it("affiche des repères cinématographiques discrets", () => {
    render(<HeroVsl />);
    expect(screen.getByText(/Scene 01/i)).toBeTruthy();
  });

  it("affiche un bouton de lecture de secours si l'autoplay ne démarre pas", () => {
    vi.useFakeTimers();
    try {
      render(<HeroVsl />);
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(
        screen.getByRole("button", { name: /Lancer le film de présentation/i }),
      ).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});
