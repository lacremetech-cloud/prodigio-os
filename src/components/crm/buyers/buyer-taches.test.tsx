// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { TaskRow } from "@/lib/supabase/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

type Charge = Record<string, unknown>;
const modifie = vi.fn(async (_p: Charge) => ({ ok: true as const }));
const statut = vi.fn(async (_p: Charge) => ({ ok: true as const }));
const creer = vi.fn(async (_p: Charge) => ({ ok: true as const }));
vi.mock("@/modules/buyers/crm/actions", () => ({
  updateBuyerTaskAction: (p: unknown) => modifie(p as Charge),
  setBuyerTaskStatusAction: (p: unknown) => statut(p as Charge),
  createBuyerTaskAction: (p: unknown) => creer(p as Charge),
  logBuyerActivityAction: async () => ({ ok: true }),
  qualifyBuyerAction: async () => ({ ok: true }),
  setBuyerStageAction: async () => ({ ok: true }),
  recordBuyerOfferAction: async () => ({ ok: true }),
  recordBuyerOutcomeAction: async () => ({ ok: true }),
  reopenBuyerAction: async () => ({ ok: true }),
  assignBuyerAction: async () => ({ ok: true }),
  selfAssignBuyerAction: async () => ({ ok: true }),
  releaseBuyerAction: async () => ({ ok: true }),
  upsertBuyerCriteriaAction: async () => ({ ok: true }),
  planifierVisiteAction: async () => ({ ok: true }),
}));

import { BuyerTaskList } from "./buyer-actions";

afterEach(() => {
  cleanup();
  modifie.mockClear();
  statut.mockClear();
});

const tache = (o: Partial<TaskRow> = {}): TaskRow =>
  ({
    id: "t-1",
    title: "Rappeler",
    status: "a_faire",
    due_at: "2026-10-20T09:00:00.000Z",
    kind: "rappel",
    ...o,
  }) as unknown as TaskRow;

/**
 * CE BLOC NE CRÉE PLUS DE TÂCHE.
 *
 * Il portait un second formulaire de planification, concurrent de « la suite
 * à donner » du bloc d'échange. Deux endroits pour poser un rappel, c'est une
 * décision saisie deux fois — et deux rappels quand on oublie l'avoir déjà
 * posé ailleurs.
 */
describe("tâches ouvertes", () => {
  it("n'offre AUCUN moyen de créer une tâche ici", () => {
    const { queryByRole, queryByText } = render(
      <BuyerTaskList buyerProfileId="bp-1" tasks={[tache()]} />,
    );
    expect(queryByRole("button", { name: "Ajouter" })).toBeNull();
    expect(queryByText("Prochaine action")).toBeNull();
  });

  it("dit où la prochaine tâche se programme, plutôt que de laisser un vide", () => {
    const { getByText } = render(<BuyerTaskList buyerProfileId="bp-1" tasks={[]} />);
    expect(getByText(/en enregistrant un échange/)).toBeTruthy();
  });

  it("solde une tâche", () => {
    const { getByRole } = render(<BuyerTaskList buyerProfileId="bp-1" tasks={[tache()]} />);
    fireEvent.click(getByRole("button", { name: "Terminer" }));
    expect(statut).toHaveBeenCalledWith({ buyerProfileId: "bp-1", taskId: "t-1", status: "fait" });
  });

  it("corrige l'intitulé et l'échéance — ce qui était impossible", () => {
    const { getByRole, getByLabelText } = render(
      <BuyerTaskList buyerProfileId="bp-1" tasks={[tache()]} />,
    );
    fireEvent.click(getByRole("button", { name: "Modifier" }));
    fireEvent.change(getByLabelText("Intitulé de la tâche"), {
      target: { value: "Rappeler après 18 h" },
    });
    fireEvent.click(getByRole("button", { name: "Enregistrer" }));
    const envoye = modifie.mock.calls[0]?.[0] as Charge;
    expect(envoye.title).toBe("Rappeler après 18 h");
    expect(envoye.effacerEcheance).toBe(false);
  });

  it("EFFACE l'échéance quand on vide le champ, au lieu de l'ignorer", () => {
    // Sans drapeau explicite, « enlever la date » et « ne pas y toucher »
    // s'écriraient pareil : un rappel resterait daté contre la volonté du
    // commercial.
    const { getByRole, getByLabelText } = render(
      <BuyerTaskList buyerProfileId="bp-1" tasks={[tache()]} />,
    );
    fireEvent.click(getByRole("button", { name: "Modifier" }));
    fireEvent.change(getByLabelText("Échéance"), { target: { value: "" } });
    fireEvent.click(getByRole("button", { name: "Enregistrer" }));
    const envoye = modifie.mock.calls[0]?.[0] as Charge;
    expect(envoye.effacerEcheance).toBe(true);
    expect(envoye.dueAt).toBeNull();
  });

  it("ne propose ni Terminer ni Modifier sur une tâche déjà soldée", () => {
    // Une tâche terminée est de l'historique : la réécrire changerait ce qui
    // s'est passé.
    const { queryByRole, getByText } = render(
      <BuyerTaskList buyerProfileId="bp-1" tasks={[tache({ status: "fait" })]} />,
    );
    expect(queryByRole("button", { name: "Modifier" })).toBeNull();
    expect(queryByRole("button", { name: "Terminer" })).toBeNull();
    expect(getByText(/Rappeler/)).toBeTruthy();
  });
});
