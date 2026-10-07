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

describe("useAnalyseMachine — contrat de données du CRM", () => {
  /**
   * Verrou de non-régression. Les réponses transmises au CRM sont un CONTRAT :
   * clés, valeurs et types ne doivent pas bouger au gré des retouches d'UI. Ce
   * test échoue si une amélioration visuelle déforme la charge utile.
   */
  it("transmet exactement les mêmes clés, valeurs et types qu'avant", async () => {
    const { result } = renderHook(() => useAnalyseMachine());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    await act(async () => {
      result.current.goNext();
    });
    await waitFor(() => expect(submitSpy).toHaveBeenCalledTimes(1));

    const sent = submitSpy.mock.calls[0]![0] as {
      answers: Record<string, unknown>;
      context: Record<string, unknown>;
      turnstileToken: string | null;
    };

    expect(Object.keys(sent).sort()).toEqual(["answers", "context", "turnstileToken"]);
    expect(Object.keys(sent.answers).sort()).toEqual([
      "company",
      "contact",
      "location",
      "mandateSituation",
      "propertyType",
      "saleHorizon",
      "valueBand",
    ]);
    expect(sent.answers.propertyType).toBe("appartement_exception");
    expect(sent.answers.valueBand).toBe("plus_2m");
    expect(sent.answers.saleHorizon).toBe("des_que_possible");
    expect(sent.answers.mandateSituation).toBe("aucun_mandat");
    expect(sent.answers.location).toMatchObject({
      city: "Paris",
      postalCode: "75008",
      country: "France",
    });
    expect(sent.answers.contact).toMatchObject({
      firstName: "Rayyân",
      lastName: "Djeridi",
      preference: "telephone",
      recallPreference: "des_que_possible",
      consent: true,
    });
    // La clé d'idempotence reste celle reprise du brouillon : rouvrir la page
    // ne doit pas créer un second dossier.
    expect(sent.context.idempotencyKey).toBe("test-idem-key-000001");
  });

  it("ne fait transiter aucune réponse ni donnée personnelle dans la mesure", async () => {
    window.dataLayer = [];
    const { result } = renderHook(() => useAnalyseMachine());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    await act(async () => {
      result.current.goNext();
    });
    await waitFor(() => expect(submitSpy).toHaveBeenCalledTimes(1));

    const mesure = JSON.stringify(window.dataLayer ?? []);
    expect(mesure).toContain("eligibility_step_completed");
    expect(mesure).toContain("eligibility_submitted");
    for (const secret of [
      "Rayyân",
      "Djeridi",
      "rayyan@indescale.com",
      "06 25 77 35 92",
      "75008",
      "appartement_exception",
      "plus_2m",
    ]) {
      expect(mesure, `donnée transmise à la mesure : ${secret}`).not.toContain(secret);
    }
  });
});
