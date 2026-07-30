// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";

// Espionne l'action serveur SANS l'exécuter (module « use server »).
const { submitSpy } = vi.hoisted(() => ({ submitSpy: vi.fn() }));
vi.mock("@/modules/mandates/funnel/submit", () => ({
  submitMandateFunnelAction: submitSpy,
}));

import { useAnalyseMachine } from "./use-analyse-machine";

const STORAGE_KEY = "prodigio.analyse.v1";

const validDraft = {
  propertyType: "appartement_exception",
  location: { city: "Paris", postalCode: "75008", country: "France" },
  valueBand: "plus_2m",
  saleHorizon: "des_que_possible",
  mandateSituation: "aucun_mandat",
  contact: {
    firstName: "Rayyân",
    lastName: "Djeridi",
    phoneRaw: "06 25 77 35 92",
    phoneCountry: "FR",
    emailRaw: "rayyan@indescale.com",
    preference: "telephone",
    recallPreference: "des_que_possible",
    consent: true,
  },
  company: "",
};

beforeEach(() => {
  submitSpy.mockReset();
  submitSpy.mockResolvedValue({ ok: true, appreciation: "eligible_premium" });
  window.sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ step: 6, draft: validDraft, idempotencyKey: "test-idem-key-000001" }),
  );
});

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

describe("useAnalyseMachine — exactement un envoi", () => {
  it("un double appel goNext à la dernière étape n'exécute l'action qu'UNE fois", async () => {
    const { result } = renderHook(() => useAnalyseMachine());
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.step).toBe(6);

    // Double-clic : deux appels quasi simultanés (statut `status` pas encore
    // rafraîchi au second) — le verrou synchrone doit bloquer le second.
    await act(async () => {
      result.current.goNext();
      result.current.goNext();
    });

    await waitFor(() => expect(submitSpy).toHaveBeenCalled());
    expect(submitSpy).toHaveBeenCalledTimes(1);
  });

  it("après une soumission réussie, passe à l'écran de pré-analyse", async () => {
    const { result } = renderHook(() => useAnalyseMachine());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    await act(async () => {
      result.current.goNext();
    });

    await waitFor(() => expect(result.current.step).toBe(7)); // CONFIRMATION_STEP
    expect(result.current.status).toBe("done");
    expect(submitSpy).toHaveBeenCalledTimes(1);
  });
});
