// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { KanbanBoard } from "./kanban-board";
import type { KanbanLead } from "@/modules/crm/kanban";

// --- Mocks -------------------------------------------------------------------
const moveLeadStage = vi.fn(async () => ({ ok: true }) as { ok: boolean; error?: string; requiresAction?: "mandat" | "resultat" });

vi.mock("@/modules/crm/data/mutations", () => ({
  moveLeadStage: (...args: unknown[]) => moveLeadStage(...(args as [])),
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

function lead(over: Partial<KanbanLead> = {}): KanbanLead {
  return {
    opportunityId: over.opportunityId ?? "opp-1",
    stage: over.stage ?? "qualification_en_cours",
    name: over.name ?? "Marie Dupont",
    propertyLabel: over.propertyLabel ?? "Villa",
    city: over.city ?? "Annecy",
    valueLabel: over.valueLabel ?? "Plus de 2 M€",
    compatibilityScore: over.compatibilityScore ?? 60,
    maturityScore: over.maturityScore ?? 50,
    highPotential: over.highPotential ?? false,
    overdue: over.overdue ?? false,
    unassigned: over.unassigned ?? false,
    phoneMasked: over.phoneMasked ?? null,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("KanbanBoard", () => {
  it("rend les colonnes du pipeline et place la carte dans son stade", () => {
    render(<KanbanBoard leads={[lead()]} canMove canView={false} />);
    expect(screen.getByText("Marie Dupont")).toBeTruthy();
    expect(screen.getAllByText("Qualifié").length).toBeGreaterThan(0);
  });

  it("REFUSE via le menu un déplacement vers une colonne protégée (aucune mutation serveur)", async () => {
    render(<KanbanBoard leads={[lead()]} canMove canView={false} />);
    const select = screen.getByLabelText("Déplacer Marie Dupont vers un stade") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "mandat_signe" } });
    // Message d'orientation vers l'action métier affiché, action serveur NON appelée.
    expect(await screen.findByText("Ouvrir le dossier (mandat)")).toBeTruthy();
    expect(moveLeadStage).not.toHaveBeenCalled();
  });

  it("APPELLE la mutation une seule fois pour un déplacement autorisé", async () => {
    render(<KanbanBoard leads={[lead()]} canMove canView={false} />);
    const select = screen.getByLabelText("Déplacer Marie Dupont vers un stade") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "rendez_vous_planifie" } });
    expect(moveLeadStage).toHaveBeenCalledTimes(1);
    expect(moveLeadStage).toHaveBeenCalledWith({
      opportunityId: "opp-1",
      fromStage: "qualification_en_cours",
      toStage: "rendez_vous_planifie",
    });
  });

  it("n'affiche aucune poignée ni menu de déplacement en lecture seule", () => {
    render(<KanbanBoard leads={[lead()]} canMove={false} canView={false} />);
    expect(screen.queryByLabelText("Déplacer Marie Dupont vers un stade")).toBeNull();
    expect(screen.queryByLabelText("Déplacer Marie Dupont")).toBeNull();
  });

  it("filtre les cartes sans perdre la structure des colonnes (filtre stable)", () => {
    render(
      <KanbanBoard
        leads={[lead({ opportunityId: "a", name: "Marie" }), lead({ opportunityId: "b", name: "Paul", city: "Chamonix" })]}
        canMove
        canView={false}
      />,
    );
    const search = screen.getByLabelText("Rechercher un dossier");
    fireEvent.change(search, { target: { value: "chamonix" } });
    expect(screen.queryByText("Marie")).toBeNull();
    expect(screen.getByText("Paul")).toBeTruthy();
  });
});
