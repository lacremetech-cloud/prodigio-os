// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";

/**
 * LES GESTES DE L'ÉCRAN META, côté formulaire : ce qui part vers le serveur, et
 * ce qui ne part pas. Données fictives.
 */

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

type Charge = Record<string, unknown>;
const ajouter = vi.fn<(p: Charge) => Promise<{ ok: true }>>(async () => ({ ok: true }));
const retirer = vi.fn<(p: Charge) => Promise<{ ok: true }>>(async () => ({ ok: true }));
const lire = vi.fn<() => Promise<{ ok: true }>>(async () => ({ ok: true }));
vi.mock("@/modules/pilotage/meta/actions", () => ({
  ajouterRegleAction: (p: unknown) => ajouter(p as Charge),
  retirerRegleAction: (p: unknown) => retirer(p as Charge),
  lireMetaMaintenantAction: () => lire(),
}));

import { BoutonLireMaintenant, ExceptionCampagne, FormulaireRegle, RetirerRegle } from "./meta";

const VILLA = "6f1d2c3b-4a5e-4f60-8a9b-0c1d2e3f4a5b";
const PROGRAMME = "7a2b3c4d-5e6f-4a1b-9c2d-3e4f5a6b7c8d";
const BIENS = [
  { id: VILLA, nom: "Villa exemple" },
  { id: PROGRAMME, nom: "Programme exemple" },
];

afterEach(() => {
  cleanup();
  ajouter.mockClear();
  retirer.mockClear();
  lire.mockClear();
});

describe("ajouter une règle", () => {
  it("un jeton vers un groupe de deux biens", async () => {
    const v = render(<FormulaireRegle biens={BIENS} />);
    fireEvent.change(v.getByLabelText("Jeton"), { target: { value: "  exemple " } });
    fireEvent.click(v.getByLabelText("Villa exemple"));
    fireEvent.click(v.getByLabelText("Programme exemple"));
    fireEvent.click(v.getByRole("button", { name: "Enregistrer la règle" }));
    await waitFor(() => expect(ajouter).toHaveBeenCalledTimes(1));
    expect(ajouter.mock.calls[0]![0]).toEqual({
      typeRegle: "jeton",
      valeur: "exemple",
      cible: "biens",
      biens: [VILLA, PROGRAMME],
      note: null,
    });
  });

  it("sans bien choisi, rien ne part et l'écran le dit", () => {
    const v = render(<FormulaireRegle biens={BIENS} />);
    fireEvent.change(v.getByLabelText("Jeton"), { target: { value: "EXEMPLE" } });
    fireEvent.click(v.getByRole("button", { name: "Enregistrer la règle" }));
    expect(v.getByText("Choisissez au moins un bien.")).toBeTruthy();
    expect(ajouter).not.toHaveBeenCalled();
  });

  it("hors portefeuille : aucun bien n'est envoyé, même coché avant", async () => {
    const v = render(<FormulaireRegle biens={BIENS} />);
    fireEvent.change(v.getByLabelText("Règle"), { target: { value: "campagne" } });
    fireEvent.change(v.getByLabelText("Identifiant de campagne"), { target: { value: "120000000000000030" } });
    fireEvent.click(v.getByLabelText("Villa exemple"));
    fireEvent.click(v.getByLabelText("hors portefeuille (visible, hors indicateurs)"));
    fireEvent.change(v.getByLabelText("Note (facultatif)"), { target: { value: "Ancien bien (exemple)" } });
    fireEvent.click(v.getByRole("button", { name: "Enregistrer la règle" }));
    await waitFor(() => expect(ajouter).toHaveBeenCalledTimes(1));
    expect(ajouter.mock.calls[0]![0]).toEqual({
      typeRegle: "campagne",
      valeur: "120000000000000030",
      cible: "hors_portefeuille",
      biens: [],
      note: "Ancien bien (exemple)",
    });
  });

  it("les deux choix de cible forment un seul groupe au clavier, propre à chaque formulaire", () => {
    const v = render(
      <>
        <FormulaireRegle biens={BIENS} />
        <FormulaireRegle biens={BIENS} campagneId="120000000000000010" />
      </>,
    );
    const radios = v.getAllByRole("radio") as HTMLInputElement[];
    expect(radios).toHaveLength(4);
    expect(radios[0]!.name).toBeTruthy();
    expect(radios[0]!.name).toBe(radios[1]!.name);
    expect(radios[2]!.name).toBe(radios[3]!.name);
    expect(radios[0]!.name).not.toBe(radios[2]!.name);
  });
});

describe("exception pour une campagne", () => {
  it("s'ouvre à la demande, préremplie avec l'identifiant de la campagne", () => {
    const v = render(<ExceptionCampagne biens={BIENS} campagneId="120000000000000040" />);
    expect(v.queryByLabelText("Identifiant de campagne")).toBeNull();
    fireEvent.click(v.getByRole("button", { name: "Rattacher cette campagne…" }));
    expect((v.getByLabelText("Identifiant de campagne") as HTMLInputElement).value).toBe("120000000000000040");
    expect((v.getByLabelText("Règle") as HTMLSelectElement).value).toBe("campagne");
  });
});

describe("retirer une règle", () => {
  it("en deux temps, motif facultatif", async () => {
    const v = render(<RetirerRegle regleId="r1" libelle="Jeton EXEMPLE" />);
    fireEvent.click(v.getByRole("button", { name: "Retirer la règle Jeton EXEMPLE" }));
    expect(retirer).not.toHaveBeenCalled();
    fireEvent.click(v.getByRole("button", { name: "Confirmer le retrait" }));
    await waitFor(() => expect(retirer).toHaveBeenCalledWith({ regleId: "r1", motif: null }));
  });
});

describe("lire Meta maintenant", () => {
  it("lance une lecture, et rien quand le bouton est désactivé", async () => {
    const v = render(<BoutonLireMaintenant desactive={false} />);
    fireEvent.click(v.getByRole("button", { name: "Lire Meta maintenant" }));
    await waitFor(() => expect(lire).toHaveBeenCalledTimes(1));
    cleanup();
    const w = render(<BoutonLireMaintenant desactive />);
    expect((w.getByRole("button", { name: "Lire Meta maintenant" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
