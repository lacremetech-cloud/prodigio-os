// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { StepShell } from "./step-shell";

// jsdom n'implémente pas scrollIntoView : on l'espionne pour vérifier que
// l'erreur est bien amenée à l'écran.
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderShell(overrides: Partial<Parameters<typeof StepShell>[0]> = {}) {
  return render(
    <StepShell
      question="À qui devons-nous adresser notre retour ?"
      onBack={() => {}}
      onNext={() => {}}
      canGoBack
      submitting={false}
      nextLabel="Adresser ma demande à Prodigio"
      submittingLabel="Transmission de votre demande…"
      {...overrides}
    >
      <input aria-label="champ" />
    </StepShell>,
  );
}

describe("StepShell — état d'envoi", () => {
  it("désactive le bouton et affiche le libellé d'envoi pendant la transmission", () => {
    renderShell({ submitting: true });
    const submit = screen.getByRole("button", {
      name: /transmission de votre demande/i,
    }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    // Le bouton retour est aussi neutralisé pendant l'envoi.
    const back = screen.getByRole("button", { name: /retour/i }) as HTMLButtonElement;
    expect(back.disabled).toBe(true);
  });

  it("réactive le bouton (libellé normal) hors envoi, même après une erreur", () => {
    renderShell({ submitting: false, errorMessage: "Une erreur est survenue." });
    const submit = screen.getByRole("button", {
      name: /adresser ma demande à prodigio/i,
    }) as HTMLButtonElement;
    expect(submit.disabled).toBe(false);
  });
});

describe("StepShell — affichage d'erreur", () => {
  it("n'affiche aucun encart d'erreur sans message", () => {
    renderShell({ errorMessage: null });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("affiche un encart d'erreur clair (role=alert) contenant le message", () => {
    const message = "Nous n'avons pas pu vérifier votre demande. Veuillez réessayer.";
    renderShell({ errorMessage: message });
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Envoi non abouti");
    expect(alert.textContent).toContain(message);
  });

  it("fait défiler l'erreur jusqu'à l'écran dès son apparition", () => {
    const spy = vi.spyOn(Element.prototype, "scrollIntoView");
    renderShell({ errorMessage: "Erreur à surfacer." });
    expect(spy).toHaveBeenCalled();
  });
});
