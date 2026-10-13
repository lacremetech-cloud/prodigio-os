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

async function fillAndSubmit() {
  fireEvent.click(screen.getByLabelText("Oui, entre 1 et 2 millions d’euros".replace("’", "'")));
  fireEvent.click(screen.getByRole("button", { name: /continuer/i }));
  await waitFor(() => screen.getByLabelText("Prénom"));
  fireEvent.change(screen.getByLabelText("Prénom"), { target: { value: "Camille" } });
  fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "Durand" } });
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "c@example.test" } });
  fireEvent.change(screen.getByLabelText("Téléphone"), { target: { value: "0612345678" } });
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
  it("n'affiche que les quatre champs, et AUCUNE case", async () => {
    renderForm();
    fireEvent.click(screen.getByLabelText("Non, je n'ai pas de projet"));
    fireEvent.click(screen.getByRole("button", { name: /continuer/i }));
    await waitFor(() => screen.getByLabelText("Prénom"));
    for (const champ of ["Prénom", "Nom", "E-mail", "Téléphone"]) {
      expect(screen.getByLabelText(champ)).toBeTruthy();
    }
    // Ni obligatoire, ni précochée, ni facultative : il n'y en a pas.
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("affiche une information de confidentialité courte, sans case à cocher", async () => {
    renderForm();
    fireEvent.click(screen.getByLabelText("Non, je n'ai pas de projet"));
    fireEvent.click(screen.getByRole("button", { name: /continuer/i }));
    await waitFor(() => screen.getByLabelText("Prénom"));
    const notice = screen.getByText(/ne sont pas cédées à des tiers/i);
    expect(notice).toBeTruthy();
    expect(notice.querySelector("input")).toBeNull();
    expect((notice.textContent ?? "").length).toBeLessThan(220);
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
  it("transmet la réponse exacte, sans aucun champ de consentement", async () => {
    renderForm();
    await fillAndSubmit();
    await waitFor(() => expect(submit).toHaveBeenCalled());
    const payload = submit.mock.calls[0]?.[0] as { answers: Record<string, unknown> };
    expect(payload.answers.budgetChoice).toBe("1m_2m");
    expect("marketingOptIn" in payload.answers).toBe(false);
    expect(JSON.stringify(payload)).not.toMatch(/marketing/i);
    await waitFor(() => screen.getByRole("link", { name: /accéder à la brochure/i }));
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

/**
 * La remise du dossier ne doit plus coûter un clic : la page d'arrivée porte
 * déjà « Votre demande est enregistrée », l'écran intermédiaire ne disait rien
 * de plus. Ce qui est vérifié ici, c'est qu'on y conduit vraiment — et que le
 * bouton reste en place pour qui ne peut pas être conduit.
 */
describe("remise du dossier", () => {
  const vraiParent = window.parent;
  const vraiTop = window.top;

  /* « Dans un cadre » se mesure a `window.self !== window.top` : remplacer le
     seul `parent` ne suffit pas, le formulaire se croirait encore autonome. */
  function simulerCadre(postMessage: ReturnType<typeof vi.fn>) {
    Object.defineProperty(window, "parent", { value: { postMessage }, configurable: true });
    Object.defineProperty(window, "top", { value: { nom: "hote" }, configurable: true });
  }

  afterEach(() => {
    Object.defineProperty(window, "parent", { value: vraiParent, configurable: true });
    Object.defineProperty(window, "top", { value: vraiTop, configurable: true });
  });

  it("hors cadre, conduit directement au dossier", async () => {
    const replace = vi.fn();
    Object.defineProperty(window, "location", {
      value: { ...window.location, replace, href: "https://go.test/bien/x/interet" },
      configurable: true,
    });
    renderForm();
    await fillAndSubmit();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("https://exemple.test/brochure.pdf"));
  });

  it("dans un cadre, demande au parent de s'y rendre — et ne se déplace pas lui-même", async () => {
    const postMessage = vi.fn();
    simulerCadre(postMessage);
    renderForm();
    await fillAndSubmit();
    await waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith(
        { type: "prodigio:buyer-form:brochure", url: "https://exemple.test/brochure.pdf" },
        "*",
      ),
    );
  });

  it("garde le bouton en repli, pour une page hôte qui n'écoute pas", async () => {
    simulerCadre(vi.fn());
    renderForm();
    await fillAndSubmit();
    const lien = await screen.findByRole("link", { name: /accéder à la brochure/i });
    expect(lien.getAttribute("href")).toBe("https://exemple.test/brochure.pdf");
  });

  it("sans dossier disponible, ne déplace personne", async () => {
    submit.mockResolvedValue({ ok: true, brochureUrl: null });
    const postMessage = vi.fn();
    simulerCadre(postMessage);
    renderForm();
    await fillAndSubmit();
    await screen.findByText("Votre demande est enregistrée.");
    expect(postMessage).not.toHaveBeenCalled();
  });
});
