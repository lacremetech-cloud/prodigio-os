// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ACTION_FAILURE_MESSAGE } from "@/modules/crm/safe-action";
import type { PropertyRow } from "@/lib/supabase/types";

/**
 * Non-régression de l'incident du 25 août : une sauvegarde d'identité qui
 * échoue faisait remonter le rejet jusqu'à la frontière d'erreur. L'écran
 * entier était remplacé et **toute la saisie était perdue**.
 *
 * Ces tests exercent le VRAI formulaire de la Fabrique de biens.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));

const updatePropertyIdentityAction = vi.fn();
vi.mock("@/modules/properties/factory/actions", () => ({
  updatePropertyIdentityAction: (input: unknown) => updatePropertyIdentityAction(input),
  upsertPropertyPositioningAction: vi.fn(),
  validatePropertyPositioningAction: vi.fn(),
  setPropertyResponsibleAction: vi.fn(),
  transitionPropertyStatusAction: vi.fn(),
}));

import { IdentityForm } from "./cockpit";

const EMPTY_PROPERTY = {
  id: "c13477cb-d378-4ebb-a63c-1afd323e97ae",
  project_name: null,
  commercial_title: null,
  property_type: null,
  address_line: null,
  location_city: null,
  location_postal_code: null,
  location_country: null,
  surface_m2: null,
  land_m2: null,
  rooms: null,
  bedrooms: null,
  year_built: null,
  arch_style: null,
  description: null,
  history: null,
  signature_detail: null,
} as unknown as PropertyRow;

// `safeAction` consigne volontairement la cause en console : on la fait taire
// ici pour garder la sortie de test lisible, sans neutraliser le comportement.
vi.spyOn(console, "error").mockImplementation(() => {});

afterEach(() => {
  cleanup();
  updatePropertyIdentityAction.mockReset();
});

/** Remplit le formulaire comme l'utilisateur l'avait fait. */
function fillForm() {
  const set = (label: RegExp, value: string) => {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  };
  set(/Nom de projet/i, "VILLA");
  set(/Titre commercial/i, "VILLA SHABA");
  set(/Ville/i, "Montpellier");
  set(/Surface/i, "2222");
  set(/Terrain/i, "222222");
}

describe("formulaire d'identité — une panne ne détruit plus la saisie", () => {
  it("affiche un message lisible au lieu de laisser le rejet remonter", async () => {
    updatePropertyIdentityAction.mockRejectedValue(new Error("Boom côté serveur"));
    render(<IdentityForm property={EMPTY_PROPERTY} canEdit />);
    fillForm();

    // Le rendu ne doit PAS lever : sans le correctif, ce clic remontait à la
    // frontière d'erreur et remplaçait tout l'écran.
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer l’identité/i }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(ACTION_FAILURE_MESSAGE);
  });

  it("CONSERVE la saisie après l'échec — le cœur de l'incident", async () => {
    updatePropertyIdentityAction.mockRejectedValue(new Error("Boom côté serveur"));
    render(<IdentityForm property={EMPTY_PROPERTY} canEdit />);
    fillForm();

    fireEvent.click(screen.getByRole("button", { name: /Enregistrer l’identité/i }));
    await screen.findByRole("alert");

    expect((screen.getByLabelText(/Nom de projet/i) as HTMLInputElement).value).toBe("VILLA");
    expect((screen.getByLabelText(/Titre commercial/i) as HTMLInputElement).value).toBe("VILLA SHABA");
    expect((screen.getByLabelText(/Ville/i) as HTMLInputElement).value).toBe("Montpellier");
    expect((screen.getByLabelText(/Surface/i) as HTMLInputElement).value).toBe("2222");
    expect((screen.getByLabelText(/Terrain/i) as HTMLInputElement).value).toBe("222222");
  });

  it("reste utilisable : un second essai réussi est possible sans rien retaper", async () => {
    updatePropertyIdentityAction.mockRejectedValueOnce(new Error("Panne passagère"));
    render(<IdentityForm property={EMPTY_PROPERTY} canEdit />);
    fillForm();

    fireEvent.click(screen.getByRole("button", { name: /Enregistrer l’identité/i }));
    await screen.findByRole("alert");

    updatePropertyIdentityAction.mockResolvedValueOnce({ ok: true });
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer l’identité/i }));

    await waitFor(() => expect(screen.getByText("Enregistré")).toBeTruthy());
    // La deuxième tentative a bien renvoyé la saisie complète.
    const [, second] = updatePropertyIdentityAction.mock.calls;
    expect(second?.[0]).toMatchObject({
      projectName: "VILLA",
      commercialTitle: "VILLA SHABA",
      locationCity: "Montpellier",
      surfaceM2: 2222,
      landM2: 222222,
    });
  });

  it("continue d'afficher normalement un refus métier", async () => {
    updatePropertyIdentityAction.mockResolvedValue({
      ok: false,
      error: "Droits insuffisants sur ce bien.",
    });
    render(<IdentityForm property={EMPTY_PROPERTY} canEdit />);
    fillForm();

    fireEvent.click(screen.getByRole("button", { name: /Enregistrer l’identité/i }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Droits insuffisants sur ce bien.");
  });
});
