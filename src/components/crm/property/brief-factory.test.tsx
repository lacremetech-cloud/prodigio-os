// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { parseBrief } from "@/modules/properties/brief/parse";

/**
 * Parcours réel de la Fabrique « bien à partir d'un brief » : brief → analyse →
 * prévisualisation → confirmation. On vérifie surtout ce qui ne doit JAMAIS
 * arriver : une écriture au clic sur « Analyser », une création sans
 * organisation porteuse, ou une année de rénovation glissée dans l'année de
 * construction.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));

const analyzeBriefAction = vi.fn();
const createPropertyFromBriefAction = vi.fn();
vi.mock("@/modules/properties/brief/actions", () => ({
  analyzeBriefAction: (input: unknown) => analyzeBriefAction(input),
  createPropertyFromBriefAction: (input: unknown) => createPropertyFromBriefAction(input),
}));

const { BriefFactory } = await import("./brief-factory");

const JCA = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "JCA",
  slug: "jca",
  kind: "agence_partenaire",
};

const BRIEF = [
  "Nom : Villa Jean Jaurès",
  "Adresse : 20 avenue Jean Jaurès",
  "Ville : Cassis",
  "Code postal : 13260",
  "Surface : 160 m²",
  "Parcelle : 400 m2",
  "Prix : 1 490 000 €",
  "Organisation : JCA",
  "Année de rénovation : 2026",
  "Exposition cadastrale : lot 42 section AB",
].join("\n");

function analysisPayload() {
  const analysis = parseBrief(BRIEF);
  return {
    ok: true,
    data: {
      analysis,
      organization: { status: "existante" as const, organization: JCA },
      organizations: [JCA],
    },
  };
}

beforeEach(() => {
  analyzeBriefAction.mockReset();
  createPropertyFromBriefAction.mockReset();
  analyzeBriefAction.mockResolvedValue(analysisPayload());
});
afterEach(() => cleanup());

async function goToPreview(previewBlocked = false) {
  render(<BriefFactory canCreateOrganization previewBlocked={previewBlocked} />);
  fireEvent.change(screen.getByLabelText("Brief du bien"), { target: { value: BRIEF } });
  fireEvent.click(screen.getByRole("button", { name: /analyser le brief/i }));
  await waitFor(() => screen.getByRole("button", { name: /prévisualiser la fiche/i }));
  fireEvent.click(screen.getByRole("button", { name: /prévisualiser la fiche/i }));
  await waitFor(() => screen.getByRole("button", { name: "Créer le bien en brouillon" }));
}

describe("BriefFactory — étape 1, le brief", () => {
  it("n'analyse rien tant que le brief est vide", () => {
    render(<BriefFactory canCreateOrganization previewBlocked={false} />);
    const button = screen.getByRole("button", { name: /analyser le brief/i });
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(analyzeBriefAction).not.toHaveBeenCalled();
  });

  it("n'écrit rien à l'analyse : aucune création n'est déclenchée", async () => {
    render(<BriefFactory canCreateOrganization previewBlocked={false} />);
    fireEvent.change(screen.getByLabelText("Brief du bien"), { target: { value: BRIEF } });
    fireEvent.click(screen.getByRole("button", { name: /analyser le brief/i }));
    await waitFor(() => screen.getByRole("button", { name: /prévisualiser la fiche/i }));
    expect(createPropertyFromBriefAction).not.toHaveBeenCalled();
  });
});

describe("BriefFactory — étape 2, l'analyse", () => {
  it("restitue les passages non reconnus tels quels", async () => {
    render(<BriefFactory canCreateOrganization previewBlocked={false} />);
    fireEvent.change(screen.getByLabelText("Brief du bien"), { target: { value: BRIEF } });
    fireEvent.click(screen.getByRole("button", { name: /analyser le brief/i }));
    await waitFor(() => screen.getByText(/Exposition cadastrale : lot 42 section AB/));
    expect(screen.getByText(/Non reconnu \(1\)/)).toBeTruthy();
  });

  it("signale les champs indispensables manquants", async () => {
    analyzeBriefAction.mockResolvedValue({
      ok: true,
      data: {
        analysis: parseBrief("Ville : Cassis"),
        organization: { status: "absente" as const },
        organizations: [JCA],
      },
    });
    render(<BriefFactory canCreateOrganization previewBlocked={false} />);
    fireEvent.change(screen.getByLabelText("Brief du bien"), { target: { value: "Ville : Cassis" } });
    fireEvent.click(screen.getByRole("button", { name: /analyser le brief/i }));
    await waitFor(() => screen.getAllByText(/indispensable/));
    expect(screen.getAllByText(/indispensable/).length).toBeGreaterThan(0);
  });
});

describe("BriefFactory — étape 3, la prévisualisation", () => {
  it("pré-remplit la fiche avec les seules valeurs reconnues", async () => {
    await goToPreview();
    expect((screen.getByLabelText(/Nom du bien/) as HTMLInputElement).value).toBe(
      "Villa Jean Jaurès",
    );
    expect((screen.getByLabelText(/Ville/) as HTMLInputElement).value).toBe("Cassis");
    expect((screen.getByLabelText(/Surface habitable/) as HTMLInputElement).value).toBe("160");
    expect((screen.getByLabelText(/Terrain/) as HTMLInputElement).value).toBe("400");
  });

  it("laisse l'année de construction vide quand le brief ne parle que de rénovation", async () => {
    await goToPreview();
    expect((screen.getByLabelText(/Année de construction/) as HTMLInputElement).value).toBe("");
    expect(screen.getByText(/rénovation en 2026/)).toBeTruthy();
  });

  it("permet de revenir au brief sans rien écrire", async () => {
    await goToPreview();
    fireEvent.click(screen.getByRole("button", { name: /modifier le brief/i }));
    expect(screen.getByLabelText("Brief du bien")).toBeTruthy();
    expect(createPropertyFromBriefAction).not.toHaveBeenCalled();
  });

  it("interdit la création sans organisation porteuse", async () => {
    await goToPreview();
    fireEvent.change(screen.getByLabelText(/Organisation existante/), { target: { value: "" } });
    const submit = screen.getByRole("button", { name: "Créer le bien en brouillon" });
    expect(submit.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(/ne peut pas exister sans organisation porteuse/)).toBeTruthy();
  });

  it("cache l'enregistrement d'organisation à qui n'est pas administrateur", async () => {
    render(<BriefFactory canCreateOrganization={false} previewBlocked={false} />);
    fireEvent.change(screen.getByLabelText("Brief du bien"), { target: { value: BRIEF } });
    fireEvent.click(screen.getByRole("button", { name: /analyser le brief/i }));
    await waitFor(() => screen.getByRole("button", { name: /prévisualiser la fiche/i }));
    fireEvent.click(screen.getByRole("button", { name: /prévisualiser la fiche/i }));
    await waitFor(() => screen.getByRole("button", { name: "Créer le bien en brouillon" }));
    expect(screen.queryByLabelText(/enregistrer une nouvelle organisation/)).toBeNull();
  });
});

describe("BriefFactory — étape 4, la confirmation", () => {
  it("crée le bien en brouillon et propose d'ouvrir son cockpit", async () => {
    createPropertyFromBriefAction.mockResolvedValue({
      ok: true,
      data: {
        propertyId: "p-1",
        organizationId: JCA.id,
        alreadyExisted: false,
        organizationCreated: false,
      },
    });
    await goToPreview();
    fireEvent.click(screen.getByRole("button", { name: "Créer le bien en brouillon" }));
    await waitFor(() => screen.getByRole("link", { name: /ouvrir le cockpit/i }));
    const payload = createPropertyFromBriefAction.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.projectName).toBe("Villa Jean Jaurès");
    expect(payload.organizationId).toBe(JCA.id);
    expect(payload.yearBuilt).toBeNull();
    expect(screen.getByText(/créé en brouillon/i)).toBeTruthy();
  });

  it("dit clairement que rien n'a été dupliqué quand le bien existait déjà", async () => {
    createPropertyFromBriefAction.mockResolvedValue({
      ok: true,
      data: {
        propertyId: "p-1",
        organizationId: JCA.id,
        alreadyExisted: true,
        organizationCreated: false,
      },
    });
    await goToPreview();
    fireEvent.click(screen.getByRole("button", { name: "Créer le bien en brouillon" }));
    await waitFor(() => screen.getByText(/rien n’a été dupliqué/));
  });

  it("affiche l'échec sous le formulaire sans perdre la saisie", async () => {
    createPropertyFromBriefAction.mockResolvedValue({ ok: false, error: "Droits insuffisants." });
    await goToPreview();
    fireEvent.click(screen.getByRole("button", { name: "Créer le bien en brouillon" }));
    await waitFor(() => screen.getByRole("alert"));
    expect(screen.getByText("Droits insuffisants.")).toBeTruthy();
    expect((screen.getByLabelText(/Nom du bien/) as HTMLInputElement).value).toBe(
      "Villa Jean Jaurès",
    );
  });
});

describe("BriefFactory — prévisualisation Vercel", () => {
  it("annonce et bloque l'écriture réelle depuis une preview", async () => {
    await goToPreview(true);
    expect(screen.getByText(/Environnement de prévisualisation/)).toBeTruthy();
    const submit = screen.getByRole("button", { name: "Créer le bien en brouillon" });
    expect(submit.hasAttribute("disabled")).toBe(true);
  });

  it("dit le motif du refus À CÔTÉ du bouton, pas seulement en haut de page", async () => {
    await goToPreview(true);
    // Le bandeau est hors de vue une fois la fiche remplie : sans ce rappel, le
    // bouton est une impasse. On vérifie aussi qu'il dissipe le doute « il me
    // manque quelque chose ? ».
    // Deux `status` en preview : le bandeau en haut, le motif sous le bouton.
    const statuses = screen.getAllByRole("status");
    const reason = statuses[statuses.length - 1];
    expect(reason?.textContent).toMatch(/prévisualisation/i);
    expect(reason?.textContent).toMatch(/Rien ne manque à votre fiche/i);
  });
});

describe("BriefFactory — motif de blocage hors preview", () => {
  it("nomme l'organisation porteuse manquante", async () => {
    await goToPreview();
    fireEvent.change(screen.getByLabelText(/Organisation existante/), { target: { value: "" } });
    expect(screen.getByRole("status").textContent).toMatch(/organisation porteuse/i);
  });

  it("nomme le nom de bien manquant", async () => {
    await goToPreview();
    fireEvent.change(screen.getByLabelText(/Nom du bien/), { target: { value: "  " } });
    expect(screen.getByRole("status").textContent).toMatch(/nom du bien est obligatoire/i);
  });

  it("n'affiche aucun motif quand la fiche est prête", async () => {
    await goToPreview();
    expect(screen.queryByRole("status")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Créer le bien en brouillon" }).hasAttribute("disabled"),
    ).toBe(false);
  });
});
