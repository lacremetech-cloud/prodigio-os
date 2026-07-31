// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { Timeline } from "./timeline";
import type { TimelineEntry } from "@/modules/crm/timeline";

function entry(over: Partial<TimelineEntry>): TimelineEntry {
  return {
    key: over.key ?? "k1",
    at: over.at ?? "2026-07-30T10:00:00.000Z",
    source: over.source ?? "audit",
    kind: over.kind ?? "stade",
    title: over.title ?? "Changement de stade",
    body: over.body ?? "Nouveau → Contacté",
    author: over.author ?? "Membre",
    tone: over.tone ?? "neutral",
  };
}

afterEach(() => cleanup());

describe("Timeline — structure robuste (aucun chevauchement)", () => {
  it("rend chaque entrée en grille : marqueur et contenu dans des cellules distinctes", () => {
    const { container } = render(<Timeline entries={[entry({})]} />);
    const item = container.querySelector(".crm-tl-item");
    expect(item).toBeTruthy();
    // Le marqueur (rail/dot) et le contenu (body) sont deux enfants séparés.
    const rail = item!.querySelector(".crm-tl-rail");
    const body = item!.querySelector(".crm-tl-body");
    expect(rail).toBeTruthy();
    expect(body).toBeTruthy();
    // Le point n'est PAS dans le conteneur de contenu (pas de superposition).
    expect(body!.querySelector(".crm-tl-dot")).toBeNull();
    expect(rail!.querySelector(".crm-tl-dot")).toBeTruthy();
  });

  it("le titre complet est présent (aucune première lettre consommée)", () => {
    const { container } = render(
      <Timeline entries={[entry({ title: "Changement de stade" }), entry({ key: "k2", kind: "rendez_vous", title: "Rendez-vous" }), entry({ key: "k3", kind: "appel", title: "Appel" })]} />,
    );
    const titles = Array.from(container.querySelectorAll(".crm-tl-title")).map((n) => n.textContent);
    expect(titles).toContain("Changement de stade");
    expect(titles).toContain("Rendez-vous");
    expect(titles).toContain("Appel");
  });

  it("affiche une icône par type d'événement (couleur jamais seule)", () => {
    const { container } = render(<Timeline entries={[entry({ kind: "mandat", title: "Mandat signé" })]} />);
    const dot = container.querySelector(".crm-tl-dot");
    expect(dot?.textContent?.length).toBeGreaterThan(0);
  });

  it("le body long reste dans le flux (classe de retour à la ligne)", () => {
    const { container } = render(<Timeline entries={[entry({ body: "x".repeat(200) })]} />);
    expect(container.querySelector(".crm-tl-text")).toBeTruthy();
  });
});
