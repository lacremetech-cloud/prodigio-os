// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { BuyerInbox } from "./buyer-inbox";
import type { BuyerInboxRow } from "@/modules/buyers/crm/queries";

/**
 * UN ÉCRAN VIDE DOIT DIRE POURQUOI IL EST VIDE.
 *
 * « Pourquoi par défaut ça se met sur en retard ? » — ça ne s'y mettait pas :
 * l'adresse portait `?signal=en_retard`, gardée par l'onglet. Mais la
 * question est venue parce que RIEN à l'écran ne désignait le coupable. On
 * lisait « Aucun dossier acquéreur ne correspond » et « Ajustez la recherche
 * ou les filtres » — ce qui se lit comme une panne, pas comme un filtre.
 *
 * Pire : « Retirer le filtre » n'était proposé que pour le signal. Si le
 * budget, l'étape, le responsable ou la recherche vidait l'écran, il n'y
 * avait aucune porte de sortie.
 */

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
afterEach(() => cleanup());

const dossier = (over: Partial<BuyerInboxRow> = {}): BuyerInboxRow =>
  ({
    interestId: "int-1",
    buyerProfileId: "bp-1",
    name: "Elyette GUILLOT",
    emailMasked: "e@example.test",
    phoneMasked: "+33686781798",
    city: "Cassis",
    stage: "a_contacter",
    qualificationStatus: "non_qualifie",
    recommendedPriority: null,
    bestScore: null,
    interestCount: 1,
    lastInterestAt: "2026-10-19T08:00:00.000Z",
    createdAt: "2026-10-19T08:00:00.000Z",
    lastPropertyId: "prop-1",
    lastPropertyLabel: "Villa Verdun",
    properties: [{ id: "prop-1", label: "Villa Verdun" }],
    projets: [],
    assigneeNames: [],
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
    highPotential: false,
    unassigned: true,
    budgetMinCents: null,
    budgetMaxCents: null,
    budgetChoice: "500k_1m",
    ...over,
  }) as BuyerInboxRow;

const membres = [{ userId: "u-1", name: "Jean-Charles C." }];
const monter = (props: Record<string, unknown> = {}) =>
  render(
    <BuyerInbox
      rows={[dossier()]}
      members={membres}
      chargeA="2026-10-19T12:00:00.000Z"
      {...props}
    />,
  );

describe("l'écran vide nomme ce qui le vide", () => {
  it("le signal venu de l'adresse est écrit en toutes lettres", () => {
    // `?signal=en_retard` sur un fichier sans aucun retard : zéro ligne.
    const { getByRole, getAllByText } = monter({ signalInitial: "en_retard" });
    expect(getByRole("status").textContent).toContain("0 dossier affiché sur 1");
    expect(getByRole("status").textContent).toContain("« En retard »");
    /* DEUX fois : sur la ligne de compte ET dans l'ecran vide lui-meme. Le
       texte doit etre la ou l'oeil tombe, et l'oeil tombe au milieu. */
    expect(getAllByText(/Filtré par « En retard »/).length).toBe(2);
  });

  it("le budget aussi — il n'avait AUCUNE porte de sortie", () => {
    const { getByRole } = monter({ budgetInitial: "plus_1m" });
    const ligne = getByRole("status").textContent ?? "";
    expect(ligne).toContain("budget");
    expect(ligne).toContain("Retirer le filtre");
  });

  it("plusieurs filtres : ils sont tous nommés, et se retirent d'un geste", () => {
    const { getByRole, getByText } = monter({
      signalInitial: "en_retard",
      budgetInitial: "plus_1m",
    });
    const ligne = getByRole("status").textContent ?? "";
    expect(ligne).toContain("« En retard »");
    expect(ligne).toContain("budget");
    expect(getByText("Tout retirer")).toBeTruthy();
  });

  it("« Tout retirer » ramène la liste entière", () => {
    const { getByText, queryByText } = monter({
      signalInitial: "en_retard",
      budgetInitial: "plus_1m",
    });
    expect(queryByText("Elyette GUILLOT")).toBeNull();
    fireEvent.click(getByText("Tout retirer"));
    expect(getByText("Elyette GUILLOT")).toBeTruthy();
  });

  it("sans filtre, on ne raconte rien : la ligne reste un simple compte", () => {
    const { getByRole } = monter();
    const ligne = getByRole("status").textContent ?? "";
    expect(ligne).toContain("1 dossier affiché sur 1");
    expect(ligne).not.toContain("Filtré par");
    expect(ligne).not.toContain("Retirer");
  });

  it("« aucun acquéreur » reste distinct de « vos filtres cachent tout »", () => {
    // Le premier ne se corrige pas en touchant aux filtres.
    const { getByText } = render(
      <BuyerInbox rows={[]} members={membres} chargeA="2026-10-19T12:00:00.000Z" />,
    );
    expect(getByText("Aucun acquéreur pour l’instant.")).toBeTruthy();
  });
});
