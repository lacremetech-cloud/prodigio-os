// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { ANALYSE_ROUTE } from "@/lib/routes";
import { Hero } from "./hero";
import { FinalCtaSection } from "./final-cta-section";
import { SelectivitySection } from "./selectivity-section";

vi.mock("next/image", () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  ),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

afterEach(() => cleanup());

function analyseLinks(container: HTMLElement) {
  return container.querySelectorAll(`a[href="${ANALYSE_ROUTE}"]`);
}

describe("CTAs de la landing → parcours d'analyse", () => {
  it("la hero conduit vers /proprietaire/analyse (nav + CTA principal)", () => {
    const { container } = render(<Hero />);
    // Navigation discrète + CTA principal sous la VSL.
    expect(analyseLinks(container).length).toBeGreaterThanOrEqual(2);
  });

  it("la section sélection conduit vers le parcours", () => {
    const { container } = render(<SelectivitySection />);
    expect(analyseLinks(container).length).toBeGreaterThanOrEqual(1);
  });

  it("le CTA final conduit vers le parcours", () => {
    const { container } = render(<FinalCtaSection />);
    expect(analyseLinks(container).length).toBeGreaterThanOrEqual(1);
  });
});
