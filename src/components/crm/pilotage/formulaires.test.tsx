// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import type { PilotageConditionsRow } from "@/lib/supabase/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

type Charge = Record<string, unknown>;
const conditions = vi.fn<(p: Charge) => Promise<{ ok: true }>>(async () => ({ ok: true }));
const cout = vi.fn<(p: Charge) => Promise<{ ok: true }>>(async () => ({ ok: true }));
vi.mock("@/modules/pilotage/actions", () => ({
  enregistrerConditionsAction: (p: unknown) => conditions(p as Charge),
  enregistrerLotAction: async () => ({ ok: true }),
  saisirCoutFixeAction: (p: unknown) => cout(p as Charge),
  annulerCoutFixeAction: async () => ({ ok: true }),
}));

import { FormulaireConditions } from "./formulaire-conditions";
import { FormulaireCoutFixe } from "./couts-fixes";

afterEach(() => {
  cleanup();
  conditions.mockClear();
  cout.mockClear();
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
