// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import type { PilotageConditionsRow } from "@/lib/supabase/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

type Charge = Record<string, unknown>;
const conditions = vi.fn<(p: Charge) => Promise<{ ok: true }>>(async () => ({ ok: true }));
const cout = vi.fn<(p: Charge) => Promise<{ ok: true }>>(async () => ({ ok: true }));
const budget = vi.fn<(p: Charge) => Promise<{ ok: true }>>(async () => ({ ok: true }));
vi.mock("@/modules/pilotage/actions", () => ({
  enregistrerConditionsAction: (p: unknown) => conditions(p as Charge),
  enregistrerLotAction: async () => ({ ok: true }),
  saisirCoutFixeAction: (p: unknown) => cout(p as Charge),
  annulerCoutFixeAction: async () => ({ ok: true }),
  enregistrerBudgetAction: (p: unknown) => budget(p as Charge),
}));

import { FormulaireConditions } from "./formulaire-conditions";
import { FormulaireCoutFixe } from "./couts-fixes";
import { FormulaireBudget } from "./formulaire-budget";

afterEach(() => {
  cleanup();
  conditions.mockClear();
  cout.mockClear();
  budget.mockClear();
});

const BIEN = "6f1d2c3b-4a5e-4f60-8a9b-0c1d2e3f4a5b";

const enVigueur: PilotageConditionsRow = {
  id: "c1",
  property_id: BIEN,
  date_effet: "2026-11-01",
  vente_par_lots: false,
  nature_prix: "fai",
  prix_affiche_cents: 145_000_000,
  taux_commission_pct: 3.75,
  base_honoraires: "TTC",
  part_prodigio_pct: 70,
  taux_tva_pct: 20,
  statut_commercial: "a_vendre",
  prix_vente_final_cents: null,
  vendu_le: null,
  motif: "Saisie initiale",
  saisi_le: "2026-11-01T09:00:00Z",
  saisi_par: "admin",
};

describe("le formulaire des conditions", () => {
  it("une première saisie ne présente aucune valeur économique comme acquise", () => {
    const { getByLabelText } = render(
      <FormulaireConditions propertyId={BIEN} jour="2026-11-12" initiale={null} sousMandat={false} />,
    );
    expect((getByLabelText("Prix affiché (€)") as HTMLInputElement).value).toBe("");
    expect((getByLabelText("Taux de commission (%)") as HTMLInputElement).value).toBe("");
    expect((getByLabelText("Part de Prodigio (%)") as HTMLInputElement).value).toBe("");
    expect((getByLabelText("TVA sur les honoraires (%)") as HTMLInputElement).value).toBe("");
    // La base des honoraires n'est pas présumée : il faut la choisir.
    expect((getByLabelText("Base des honoraires") as HTMLSelectElement).value).toBe("");
    expect((getByLabelText("Date d’effet") as HTMLInputElement).value).toBe("2026-11-12");
  });

  it("refuse d'envoyer sans base ni motif, et dit quoi corriger", async () => {
    const { getByRole, findByRole } = render(
      <FormulaireConditions propertyId={BIEN} jour="2026-11-12" initiale={null} sousMandat={false} />,
    );
    fireEvent.click(getByRole("button", { name: "Enregistrer les conditions" }));
    expect((await findByRole("alert")).textContent).toMatch(/base des honoraires.*motif/);
    expect(conditions).not.toHaveBeenCalled();
  });

  it("une nouvelle version part de celle en vigueur, et envoie des centimes et des pourcentages", async () => {
    const { getByLabelText, getByRole } = render(
      <FormulaireConditions propertyId={BIEN} jour="2026-11-12" initiale={enVigueur} sousMandat={false} />,
    );
    expect((getByLabelText("Taux de commission (%)") as HTMLInputElement).value).toBe("3,75");
    fireEvent.change(getByLabelText("Prix affiché (€)"), { target: { value: "1 350 000" } });
    fireEvent.change(getByLabelText("Motif"), { target: { value: "Baisse de prix" } });
    fireEvent.click(getByRole("button", { name: "Enregistrer cette nouvelle version" }));
    await waitFor(() => expect(conditions).toHaveBeenCalledTimes(1));
    expect(conditions.mock.calls[0]![0]).toEqual({
      propertyId: BIEN,
      dateEffet: "2026-11-12",
      venteParLots: false,
      naturePrix: "fai",
      prixAfficheCentimes: 135_000_000,
      tauxCommissionPct: 3.75,
      baseHonoraires: "TTC",
      partProdigioPct: 70,
      tauxTvaPct: 20,
      statutCommercial: "a_vendre",
      prixVenteFinalCentimes: null,
      venduLe: null,
      motif: "Baisse de prix",
    });
  });

  it("par lots : le prix et le statut disparaissent du bien, et ne sont pas envoyés", async () => {
    const { getByLabelText, getByRole, queryByLabelText } = render(
      <FormulaireConditions propertyId={BIEN} jour="2026-11-12" initiale={enVigueur} sousMandat={false} />,
    );
    fireEvent.click(getByLabelText("par lots (programme)"));
    expect(queryByLabelText("Prix affiché (€)")).toBeNull();
    expect(queryByLabelText("Statut commercial")).toBeNull();
    fireEvent.change(getByLabelText("Motif"), { target: { value: "Programme" } });
    fireEvent.click(getByRole("button", { name: "Enregistrer cette nouvelle version" }));
    await waitFor(() => expect(conditions).toHaveBeenCalledTimes(1));
    expect(conditions.mock.calls[0]![0]).toMatchObject({
      venteParLots: true,
      prixAfficheCentimes: null,
      statutCommercial: null,
    });
  });

  it("le prix de vente final n'apparaît que pour un bien vendu", () => {
    const { getByLabelText, queryByLabelText } = render(
      <FormulaireConditions propertyId={BIEN} jour="2026-11-12" initiale={enVigueur} sousMandat={false} />,
    );
    expect(queryByLabelText("Prix de vente final (€)")).toBeNull();
    fireEvent.change(getByLabelText("Statut commercial"), { target: { value: "vendu" } });
    expect(queryByLabelText("Prix de vente final (€)")).not.toBeNull();
  });

  it("sous mandat, une part vide renvoie à la photographie du mandat", () => {
    const { getByText } = render(
      <FormulaireConditions propertyId={BIEN} jour="2026-11-12" initiale={null} sousMandat />,
    );
    expect(getByText(/photographie économique du mandat/)).toBeTruthy();
  });
});

describe("le formulaire des coûts fixes", () => {
  it("envoie un montant HT en centimes, avec une clé de saisie", async () => {
    const { getByLabelText, getByRole } = render(<FormulaireCoutFixe propertyId={BIEN} />);
    fireEvent.change(getByLabelText("Type"), { target: { value: "photos" } });
    fireEvent.change(getByLabelText("Montant HT (€)"), { target: { value: "800" } });
    fireEvent.click(getByRole("button", { name: "Enregistrer le coût" }));
    await waitFor(() => expect(cout).toHaveBeenCalledTimes(1));
    const envoi = cout.mock.calls[0]![0];
    expect(envoi).toMatchObject({ propertyId: BIEN, typeCout: "photos", montantHtCentimes: 80_000, note: null });
    expect(String(envoi.cleSaisie)).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("deux envois successifs portent deux clés différentes", async () => {
    const { getByLabelText, getByRole } = render(<FormulaireCoutFixe propertyId={BIEN} />);
    for (const montant of ["800", "900"]) {
      fireEvent.change(getByLabelText("Type"), { target: { value: "montage" } });
      fireEvent.change(getByLabelText("Montant HT (€)"), { target: { value: montant } });
      fireEvent.click(getByRole("button", { name: "Enregistrer le coût" }));
      await waitFor(() => expect(cout).toHaveBeenCalledTimes(montant === "800" ? 1 : 2));
    }
    expect(cout.mock.calls[0]![0].cleSaisie).not.toBe(cout.mock.calls[1]![0].cleSaisie);
  });

  it("sans type ni montant : rien ne part, et l'écran le dit", async () => {
    const { getByRole, findByRole } = render(<FormulaireCoutFixe propertyId={BIEN} />);
    fireEvent.click(getByRole("button", { name: "Enregistrer le coût" }));
    expect((await findByRole("alert")).textContent).toMatch(/type.*montant/);
    expect(cout).not.toHaveBeenCalled();
  });
});

describe("le formulaire du budget", () => {
  const M = 100_000_000;
  const coche = (getByLabelText: (t: string) => HTMLElement, libelle: string) =>
    (getByLabelText(libelle) as HTMLInputElement).checked;

  it("sans réglage ni prix : les tranches d'aujourd'hui, et la cible reste à choisir", () => {
    const { getByLabelText } = render(<FormulaireBudget propertyId={BIEN} jour="2026-11-28" initiale={null} proposition={null} />);
    expect(coche(getByLabelText, "Oui, entre 500 000 € et 1 million d'euros")).toBe(true);
    expect(coche(getByLabelText, "Plus de 1 million d'euros")).toBe(true);
    expect(coche(getByLabelText, "Plus de 3 millions d'euros")).toBe(false);
    expect((getByLabelText(/Cible/) as HTMLSelectElement).value).toBe("");
  });

  it("part de la proposition d'après le prix, et n'envoie rien sans motif", async () => {
    const { getByLabelText, getByRole, findByRole } = render(
      <FormulaireBudget
        propertyId={BIEN}
        jour="2026-11-28"
        initiale={null}
        proposition={{ tranches: ["1m_2m", "2m_3m", "plus_3m"], cibleMinCentimes: 3 * M, prixCentimes: 4 * M, depuis: "prix_affiche" }}
      />,
    );
    expect(coche(getByLabelText, "Oui, entre 1 et 2 millions d'euros")).toBe(true);
    expect(coche(getByLabelText, "Plus de 1 million d'euros")).toBe(false);
    expect((getByLabelText(/Cible/) as HTMLSelectElement).value).toBe(String(3 * M));
    fireEvent.click(getByRole("button", { name: /enregistrer le budget/i }));
    expect((await findByRole("alert")).textContent).toMatch(/motif/i);
    expect(budget).not.toHaveBeenCalled();
  });

  it("dit tout de suite qu'une liste a un trou, et refuse de l'envoyer", async () => {
    const { getByLabelText, getByRole, getByText } = render(
      <FormulaireBudget propertyId={BIEN} jour="2026-11-28" initiale={{ tranches: ["500k_1m", "1m_2m", "2m_3m", "plus_3m"], cibleMinCentimes: M }} proposition={null} />,
    );
    fireEvent.click(getByLabelText("Oui, entre 1 et 2 millions d'euros"));
    expect(getByText(/Les tranches doivent se suivre/)).toBeTruthy();
    fireEvent.change(getByLabelText("Motif"), { target: { value: "Essai" } });
    fireEvent.click(getByRole("button", { name: /nouvelle version/i }));
    expect(budget).not.toHaveBeenCalled();
  });

  it("une cible qui n'est plus le bas d'une tranche proposée tombe, et se rechoisit", () => {
    const { getByLabelText } = render(
      <FormulaireBudget propertyId={BIEN} jour="2026-11-28" initiale={{ tranches: ["500k_1m", "plus_1m"], cibleMinCentimes: M }} proposition={null} />,
    );
    fireEvent.click(getByLabelText("Plus de 1 million d'euros"));
    expect((getByLabelText(/Cible/) as HTMLSelectElement).value).toBe("");
  });

  it("envoie les tranches dans l'ordre de l'échelle, la cible et le motif", async () => {
    const { getByLabelText, getByRole, findByText } = render(
      <FormulaireBudget propertyId={BIEN} jour="2026-11-28" initiale={{ tranches: ["500k_1m", "plus_1m"], cibleMinCentimes: M }} proposition={null} />,
    );
    // Passer à l'échelle haute : retirer « plus d'1 M€ », ajouter 1–2, 2–3 et plus de 3 M€ (dans le désordre).
    fireEvent.click(getByLabelText("Plus de 1 million d'euros"));
    fireEvent.click(getByLabelText("Plus de 3 millions d'euros"));
    fireEvent.click(getByLabelText("Oui, entre 1 et 2 millions d'euros"));
    fireEvent.click(getByLabelText("Oui, entre 2 et 3 millions d'euros"));
    fireEvent.change(getByLabelText(/Cible/), { target: { value: String(2 * M) } });
    fireEvent.change(getByLabelText("Motif"), { target: { value: "Seuil validé" } });
    fireEvent.click(getByRole("button", { name: /nouvelle version/i }));
    await waitFor(() => expect(budget).toHaveBeenCalledTimes(1));
    expect(budget.mock.calls[0]![0]).toEqual({
      propertyId: BIEN,
      dateEffet: "2026-11-28",
      tranches: ["500k_1m", "1m_2m", "2m_3m", "plus_3m"],
      cibleMinCentimes: 2 * M,
      motif: "Seuil validé",
    });
    // « Enregistré » dès que la base a confirmé (docs/05, n° 49).
    expect(await findByText("Enregistré")).toBeTruthy();
  });
});
