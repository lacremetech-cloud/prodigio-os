// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { createRef } from "react";
import type { BuyerInboxRow } from "@/modules/buyers/crm/queries";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

type Charge = Record<string, unknown>;
const enregistre = vi.fn(async (_p: Charge) => ({ ok: true as const }));
const attribue = vi.fn(async (_p: Charge) => ({ ok: true as const }));
vi.mock("@/modules/buyers/crm/actions", () => ({
  enregistrerTraitementAction: (p: unknown) => enregistre(p as Charge),
  selfAssignBuyerAction: (p: unknown) => attribue(p as Charge),
}));

import { PanneauTraitement } from "./panneau-traitement";

afterEach(() => {
  cleanup();
  enregistre.mockClear();
  attribue.mockClear();
});

const dossier = (over: Partial<BuyerInboxRow> = {}): BuyerInboxRow =>
  ({
    interestId: "int-1",
    buyerProfileId: "bp-1",
    name: "Maya Labeille",
    emailMasked: "maya@example.test",
    phoneMasked: "+33612345678",
    city: "Cassis",
    stage: "a_contacter",
    lastPropertyId: "prop-1",
    lastPropertyLabel: "Villa Jean Jaurès",
    properties: [{ id: "prop-1", label: "Villa Jean Jaurès" }],
    projets: [{ interestId: "int-1", label: "Villa Jean Jaurès" }],
    assigneeIds: [],
    nextActionAt: null,
    nextActionTitle: null,
    nextActionId: null,
    nextActionKind: null,
    qualification: "a_qualifier",
    qualificationReason: null,
    callAttempts: 0,
    lastCallAt: null,
    lastCallOutcome: null,
    lastNote: null,
    lastNoteAt: null,
    lastNoteBy: null,
    phoneInvalid: false,
    overdue: false,
    noNextAction: true,
    newInterest: true,
    unassigned: true,
    budgetMinCents: null,
    budgetMaxCents: null,
    budgetChoice: "plus_1m",
    ...over,
  }) as unknown as BuyerInboxRow;

const membres = [{ userId: "u-1", name: "Jean-Charles C." }];

function monter(row: BuyerInboxRow) {
  return render(
    <PanneauTraitement
      row={row}
      position={1}
      total={3}
      onFermer={() => {}}
      onEnregistre={() => {}}
      onSuivant={() => {}}
      resteUnSuivant
      saleRef={createRef<boolean>() as never}
      membres={membres}
      contexte=""
    />,
  );
}

describe("en-tête : comprendre et contacter", () => {
  it("porte les DEUX axes, visibles sans rien déplier", () => {
    const { getByRole } = monter(dossier({ stage: "a_rappeler", qualification: "qualifie" }));
    expect(getByRole("button", { name: /Étape/ }).textContent).toContain("À rappeler");
    expect(getByRole("button", { name: /Qualification/ }).textContent).toContain("Qualifié");
  });

  it("propose « M’attribuer » sur un dossier libre", () => {
    const { getByRole } = monter(dossier({ assigneeIds: [] }));
    expect(getByRole("button", { name: /M’attribuer/ })).toBeTruthy();
  });

  it("nomme le responsable au lieu de le proposer, quand il y en a un", () => {
    const { queryByRole, getByText } = monter(dossier({ assigneeIds: ["u-1"] }));
    expect(getByText(/Jean-Charles C\./)).toBeTruthy();
    expect(queryByRole("button", { name: /M’attribuer/ })).toBeNull();
  });

  it("prend le dossier sans quitter l'écran", async () => {
    const { getByRole } = monter(dossier());
    fireEvent.click(getByRole("button", { name: /M’attribuer/ }));
    await vi.waitFor(() => expect(attribue).toHaveBeenCalledWith({ buyerProfileId: "bp-1" }));
  });
});

describe("le contexte vient AVANT le formulaire", () => {
  it("dit franchement qu'il n'y a rien eu", () => {
    const { getByText } = monter(dossier());
    expect(getByText("Aucun échange enregistré")).toBeTruthy();
    expect(getByText("Rien de programmé")).toBeTruthy();
  });

  it("montre la prochaine tâche et signale le retard", () => {
    const { getByLabelText } = monter(
      dossier({ nextActionAt: "2026-10-18T09:00:00.000Z", nextActionTitle: "Rappeler", overdue: true }),
    );
    const ctx = getByLabelText("Où en est ce dossier");
    expect(within(ctx).getByText(/Rappeler/)).toBeTruthy();
    expect(ctx.textContent).toContain("en retard");
  });

  it("montre la note EN ENTIER, pas tronquée", () => {
    const longue =
      "Rappeler après 18 h, il est en déplacement toute la semaine et ne décroche jamais avant.";
    const { getByText } = monter(dossier({ lastNote: longue, lastNoteAt: "2026-10-18T09:00:00.000Z" }));
    expect(getByText(longue)).toBeTruthy();
  });

  it("place le contexte AVANT le bloc de saisie dans le document", () => {
    // C'est tout l'objet du changement : ce qu'on doit savoir passe avant ce
    // qu'on doit saisir.
    const { getByLabelText, getByText } = monter(dossier());
    const ctx = getByLabelText("Où en est ce dossier");
    const saisie = getByText("Enregistrer un échange");
    expect(ctx.compareDocumentPosition(saisie) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("nomme la plus RÉCENTE des deux traces", () => {
    // Un appel sans réponse ne laisse pas de note ; un e-mail consigné depuis
    // ne laisse pas d'appel. Afficher une seule des deux en perd une.
    const { getByLabelText } = monter(
      dossier({
        lastCallAt: "2026-10-18T09:00:00.000Z",
        lastCallOutcome: "appel_sans_reponse",
        lastNoteAt: "2026-10-19T09:00:00.000Z",
        lastNoteBy: "Antoine",
        lastNote: "A rappelé lui-même",
      }),
    );
    expect(getByLabelText("Où en est ce dossier").textContent).toContain("Note de Antoine");
  });
});

describe("la suite à donner porte l'étape, sans la redemander", () => {
  it("annonce « À rappeler » dès qu'un rappel est programmé", () => {
    const { getByRole, getByText } = monter(dossier({ stage: "a_contacter" }));
    fireEvent.click(getByRole("button", { name: "Appel — sans réponse" }));
    // Un appel sans réponse propose déjà un rappel.
    expect(getByText(/L’étape passera à « À rappeler »/)).toBeTruthy();
  });

  it("NE repêche PAS un dossier sorti du traitement", () => {
    // Rappeler quelqu'un rangé en vivier ne doit pas le ramener en silence
    // dans la file d'appels : sortir un dossier reste une décision humaine.
    const { getByRole, queryByText } = monter(dossier({ stage: "vivier" }));
    fireEvent.click(getByRole("button", { name: "Appel — sans réponse" }));
    expect(queryByText(/L’étape passera à/)).toBeNull();
  });

  it("laisse le choix manuel PRIMER sur la déduction", () => {
    const { getByRole, queryByText } = monter(dossier({ stage: "a_contacter" }));
    fireEvent.click(getByRole("button", { name: "Appel — sans réponse" }));
    fireEvent.click(getByRole("button", { name: /Étape/ }));
    fireEvent.click(
      within(getByRole("listbox")).getByRole("option", { name: /En discussion/ }),
    );
    expect(queryByText(/L’étape passera à/)).toBeNull();
  });

  it("envoie l'étape déduite avec le reste, en UNE sauvegarde", async () => {
    const { getByRole } = monter(dossier({ stage: "a_contacter" }));
    fireEvent.click(getByRole("button", { name: "Appel — sans réponse" }));
    fireEvent.click(getByRole("button", { name: "Enregistrer" }));
    await vi.waitFor(() => expect(enregistre).toHaveBeenCalled());
    const envoye = enregistre.mock.calls[0]?.[0] as Charge;
    expect(envoye.stage).toBe("a_rappeler");
    expect(envoye.activite).toBe("appel_sans_reponse");
    expect(envoye.nextActionKind).toBe("rappel");
  });

  it("enregistre une correction de qualification SANS exiger d'activité", async () => {
    const { getByRole } = monter(dossier());
    fireEvent.click(getByRole("button", { name: /Qualification/ }));
    fireEvent.click(within(getByRole("listbox")).getByRole("option", { name: /Qualifié/ }));
    fireEvent.click(getByRole("button", { name: "Enregistrer" }));
    await vi.waitFor(() => expect(enregistre).toHaveBeenCalled());
    const envoye = enregistre.mock.calls[0]?.[0] as Charge;
    expect(envoye.qualification).toBe("qualifie");
    expect(envoye.activite).toBeNull();
  });
});
