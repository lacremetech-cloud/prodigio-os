// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BUDGET_QUESTION } from "@/modules/buyers/funnel/universal";

/**
 * Parcours réel du formulaire universel. Ce qui est vérifié ici tient en une
 * phrase : deux écrans, quatre champs, aucune case bloquante, et la brochure
 * remise à l'arrivée — y compris à qui refuse le marketing.
 */

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

const submit = vi.fn();
vi.mock("@/modules/buyers/funnel/universal-submit", () => ({
  submitUniversalInterestAction: (input: unknown) => submit(input),
}));
vi.mock("@/components/mandate/attribution-capture", () => ({ AttributionCapture: () => null }));

const { UniversalBuyerForm } = await import("./universal-form");

beforeEach(() => {
  submit.mockReset();
  submit.mockResolvedValue({ ok: true, brochureUrl: "https://exemple.test/brochure.pdf" });
});
afterEach(() => cleanup());

function renderForm(props: Partial<Parameters<typeof UniversalBuyerForm>[0]> = {}) {
  return render(
    <UniversalBuyerForm
      slug="villa-jean-jaures"
      propertyName={null}
      brochureAvailable
      {...props}
    />,
  );
}

async function fillAndSubmit(marketing = false) {
  fireEvent.click(screen.getByLabelText("Oui, entre 1 et 2 millions d’euros".replace("’", "'")));
  fireEvent.click(screen.getByRole("button", { name: /continuer/i }));
  await waitFor(() => screen.getByLabelText("Prénom"));
  fireEvent.change(screen.getByLabelText("Prénom"), { target: { value: "Camille" } });
  fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "Durand" } });
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "c@example.test" } });
  fireEvent.change(screen.getByLabelText("Téléphone"), { target: { value: "0612345678" } });
  if (marketing) fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: /recevoir la brochure/i }));
}

describe("écran 1", () => {
  it("pose la question exacte, avec le « si oui »", () => {
    renderForm();
    expect(screen.getByText(BUDGET_QUESTION)).toBeTruthy();
    expect(BUDGET_QUESTION).toBe("Avez-vous un projet ? Si oui, quel est votre budget ?");
  });

  it("propose les cinq réponses, et seulement elles", () => {
    renderForm();
    expect(screen.getAllByRole("radio")).toHaveLength(5);
    expect(screen.getByLabelText("Non, je n'ai pas de projet")).toBeTruthy();
    expect(screen.getByLabelText("Plus de 3 millions d'euros")).toBeTruthy();
  });

  it("ne pose AUCUNE autre question de qualification", () => {
    renderForm();
    const texte = document.body.textContent ?? "";
    for (const absent of ["horizon", "financement", "résidence", "nature du projet", "visite"]) {
      expect(texte.toLowerCase()).not.toContain(absent);
    }
  });

  it("n'avance pas sans réponse", () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: /continuer/i }));
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByLabelText("Prénom")).toBeNull();
  });
});

describe("écran 2", () => {
  it("n'affiche que les quatre champs obligatoires", async () => {
    renderForm();
    fireEvent.click(screen.getByLabelText("Non, je n'ai pas de projet"));
    fireEvent.click(screen.getByRole("button", { name: /continuer/i }));
    await waitFor(() => screen.getByLabelText("Prénom"));
    for (const champ of ["Prénom", "Nom", "E-mail", "Téléphone"]) {
      expect(screen.getByLabelText(champ)).toBeTruthy();
    }
    // Une seule case, et elle est facultative.
    const cases = screen.getAllByRole("checkbox");
    expect(cases).toHaveLength(1);
    expect((cases[0] as HTMLInputElement).checked).toBe(false);
  });

  it("affiche l'information sur l'usage des données", async () => {
    renderForm();
    fireEvent.click(screen.getByLabelText("Non, je n'ai pas de projet"));
    fireEvent.click(screen.getByRole("button", { name: /continuer/i }));
    await waitFor(() => screen.getByLabelText("Prénom"));
    expect(screen.getByText(/conservées par Prodigio/i)).toBeTruthy();
    expect(screen.getByText(/ne sont pas cédées à des tiers/i)).toBeTruthy();
  });

  it("permet de revenir à l'écran 1", async () => {
    renderForm();
    fireEvent.click(screen.getByLabelText("Non, je n'ai pas de projet"));
    fireEvent.click(screen.getByRole("button", { name: /continuer/i }));
    await waitFor(() => screen.getByLabelText("Prénom"));
    fireEvent.click(screen.getByRole("button", { name: /retour/i }));
    expect(screen.getByText(BUDGET_QUESTION)).toBeTruthy();
  });
});

describe("envoi", () => {
  it("transmet la réponse exacte et aboutit SANS accord marketing", async () => {
    renderForm();
    await fillAndSubmit(false);
    await waitFor(() => expect(submit).toHaveBeenCalled());
    const payload = submit.mock.calls[0]?.[0] as { answers: Record<string, unknown> };
    expect(payload.answers.budgetChoice).toBe("1m_2m");
    expect(payload.answers.marketingOptIn).toBe(false);
    await waitFor(() => screen.getByRole("link", { name: /accéder à la brochure/i }));
  });

  it("consigne l'accord marketing quand il est donné", async () => {
    renderForm();
    await fillAndSubmit(true);
    await waitFor(() => expect(submit).toHaveBeenCalled());
    const payload = submit.mock.calls[0]?.[0] as { answers: Record<string, unknown> };
    expect(payload.answers.marketingOptIn).toBe(true);
  });

  it("donne accès à la brochure immédiatement après validation", async () => {
    renderForm();
    await fillAndSubmit();
    const lien = await screen.findByRole("link", { name: /accéder à la brochure/i });
    expect(lien.getAttribute("href")).toBe("https://exemple.test/brochure.pdf");
    expect(lien.getAttribute("rel")).toContain("noopener");
  });

  it("ne révèle pas le nom du bien quand la vitrine n'est pas publiée", async () => {
    renderForm({ propertyName: null });
    await fillAndSubmit();
    await screen.findByRole("link", { name: /accéder à la brochure/i });
    expect(document.body.textContent).not.toContain("Villa");
  });

  it("n'envoie rien tant que les quatre champs ne sont pas remplis", async () => {
    renderForm();
    fireEvent.click(screen.getByLabelText("Non, je n'ai pas de projet"));
    fireEvent.click(screen.getByRole("button", { name: /continuer/i }));
    await waitFor(() => screen.getByLabelText("Prénom"));
    fireEvent.click(screen.getByRole("button", { name: /recevoir la brochure/i }));
    await waitFor(() => screen.getAllByRole("alert"));
    expect(submit).not.toHaveBeenCalled();
  });

  it("affiche l'échec sans perdre la saisie", async () => {
    submit.mockResolvedValue({ ok: false, reason: "error", message: "Réessayez." });
    renderForm();
    await fillAndSubmit();
    await waitFor(() => screen.getByText("Réessayez."));
    expect((screen.getByLabelText("Prénom") as HTMLInputElement).value).toBe("Camille");
  });
});
