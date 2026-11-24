// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { GraphiqueParJour, type PointGraphique, type SerieGraphique } from "./graphique";

/** Le graphique de la page Pilotage, sur des chiffres fictifs. */

afterEach(() => cleanup());

const SERIES: SerieGraphique[] = [
  { cle: "a", nom: "Villa test A", couleur: "var(--crm-serie-1)" },
  { cle: "b", nom: "Programme test B", couleur: "var(--crm-serie-2)" },
];

const POINTS: PointGraphique[] = [
  { debut: "2026-11-20", fin: "2026-11-20", valeurs: { a: 10_000 } },
  { debut: "2026-11-21", fin: "2026-11-21", valeurs: { a: 4_000, b: 6_000 } },
  { debut: "2026-11-22", fin: "2026-11-22", valeurs: {} },
];

describe("le graphique par jour", () => {
  it("plusieurs biens : une légende, et le tableau des chiffres porte chaque valeur", () => {
    const v = render(<GraphiqueParJour titre="Dépense" unite="euros" pas="jour" points={POINTS} series={SERIES} vide="Rien." />);
    const legende = v.getByRole("list", { name: "Légende" });
    expect(within(legende).getByText("Villa test A")).toBeTruthy();
    const tableau = v.getByRole("table");
    const ligne = within(tableau).getByRole("row", { name: /21 nov\./ });
    expect(ligne.textContent?.replace(/\s/g, " ")).toMatch(/40 €.*60 €.*100 €/);
  });

  it("un seul bien : pas de légende — le titre dit ce qui est tracé", () => {
    const v = render(<GraphiqueParJour titre="Leads" unite="leads" pas="jour" points={POINTS} series={[SERIES[0]!]} vide="Rien." />);
    expect(v.queryByRole("list", { name: "Légende" })).toBeNull();
  });

  it("au clavier comme à la souris, une colonne montre son détail", () => {
    const v = render(<GraphiqueParJour titre="Dépense" unite="euros" pas="jour" points={POINTS} series={SERIES} vide="Rien." />);
    fireEvent.focus(v.getByLabelText(/^21 nov\. : 100 €$/));
    const detail = v.getByRole("status");
    expect(detail.textContent).toContain("Programme test B");
    expect(detail.textContent?.replace(/\s/g, " ")).toContain("Total 100 €");
  });

  it("rien sur la période : un message, pas un graphique vide", () => {
    const v = render(
      <GraphiqueParJour titre="Dépense" unite="euros" pas="jour" points={[POINTS[2]!]} series={SERIES} vide="Aucune dépense sur la période." />,
    );
    expect(v.getByText("Aucune dépense sur la période.")).toBeTruthy();
    expect(v.queryByRole("img")).toBeNull();
  });
});
