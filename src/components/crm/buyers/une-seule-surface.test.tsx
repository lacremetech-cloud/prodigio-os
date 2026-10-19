// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { BuyerInbox } from "./buyer-inbox";
import { BuyerKanbanBoard } from "./buyer-kanban";
import type { BuyerInboxRow } from "@/modules/buyers/crm/queries";
import type { BuyerKanbanCard } from "@/modules/buyers/crm/pipeline";
import { roleHome } from "@/modules/crm/auth/roles";

/**
 * TROIS POINTS D'UN RETOUR CLIENT FILME, TENUS PAR DES TESTS.
 *
 * 1. « Ce n'est pas toujours tres fluide de savoir s'il faut aller sur la
 *    fiche complete ou sur la fiche resumee. » — La ligne avait DEUX
 *    destinations : le nom menait a la fiche, le reste de la ligne au
 *    panneau, et rien ne le disait. Un geste, une destination.
 *
 * 2. « Les actions directes quand c'est en mode pipeline, ca ne marche pas.
 *    Il faut aller dans la vraie fiche. » — Le pipeline n'avait aucun
 *    panneau : noter un message vocal obligeait a quitter le pipeline.
 *
 * 3. « Le tableau de bord, je le trouve sans utilite de gestion des leads au
 *    quotidien. » — Le commercial y atterrissait a chaque connexion.
 */

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {}, push: () => {} }) }));

afterEach(() => cleanup());

const dossier = (over: Partial<BuyerInboxRow> = {}): BuyerInboxRow => ({
  interestId: "int-1",
  buyerProfileId: "bp-1",
  name: "Rose Philippi",
  emailMasked: "rose@example.test",
  phoneMasked: "+33612345678",
  city: "Cassis",
  stage: "a_contacter",
  qualificationStatus: "non_qualifie",
  recommendedPriority: null,
  bestScore: null,
  interestCount: 1,
  lastInterestAt: "2026-10-12T08:00:00.000Z",
  createdAt: "2026-10-12T08:00:00.000Z",
  lastPropertyId: "prop-1",
  lastPropertyLabel: "Villa Verdun",
  properties: [{ id: "prop-1", label: "Villa Verdun" }],
  projets: [{ interestId: "int-1", label: "Villa Verdun" }],
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
  budgetChoice: "plus_1m",
  ...over,
});
const membres = [{ userId: "u-1", name: "Jean-Charles C." }];

/** Les liens qui mènent à une fiche acquéreur, dans le DOM rendu. */
const liensFiche = (c: HTMLElement) =>
  [...c.querySelectorAll('a[href*="/crm/acquereurs/"]')].map((a) => a.getAttribute("href"));

// ===========================================================================
describe("1. Une seule destination par geste, dans la liste", () => {
  it("le nom n'est plus un lien vers la fiche", () => {
    const { container, getByText } = render(
      <BuyerInbox rows={[dossier()]} members={membres} chargeA="2026-10-13T12:00:00.000Z" />,
    );
    expect(getByText("Rose Philippi")).toBeTruthy();
    expect(liensFiche(container)).toEqual([]);
  });

  it("cliquer la ligne — n'importe où, le nom compris — ouvre le panneau", () => {
    const { getByText, getAllByText } = render(
      <BuyerInbox rows={[dossier()]} members={membres} chargeA="2026-10-13T12:00:00.000Z" />,
    );
    fireEvent.click(getByText("Rose Philippi"));
    // Le panneau, et lui seul, propose d'ouvrir la fiche complète.
    expect(getAllByText("Ouvrir la fiche complète").length).toBe(1);
  });
});

// ===========================================================================
describe("2. Le même panneau sur le pipeline", () => {
  const rows = [dossier()];
  /* La carte, ecrite a la main : c'est exactement le sous-ensemble que le
     pipeline charge — et c'est ce manque de donnees qui imposait d'aller
     chercher le reste sur la fiche. */
  const cards: BuyerKanbanCard[] = rows.map((r) => ({
    interestId: r.interestId,
    propertyId: r.lastPropertyId,
    buyerProfileId: r.buyerProfileId,
    stage: r.stage,
    name: r.name,
    propertyLabel: r.lastPropertyLabel,
    properties: r.properties,
    city: r.city,
    bestScore: r.bestScore,
    recommendedPriority: null,
    qualificationLabel: "À qualifier",
    interestCount: r.interestCount,
    unassigned: r.unassigned,
    overdue: r.overdue,
    noNextAction: r.noNextAction,
    newInterest: r.newInterest,
    phoneMasked: r.phoneMasked,
  }));

  it("cliquer une carte ouvre le panneau SANS quitter le pipeline", () => {
    const { container, getByText, getByTitle } = render(
      <BuyerKanbanBoard cards={cards} canMove rows={rows} membres={membres} />,
    );
    fireEvent.click(getByTitle("Traiter Rose Philippi"));
    expect(getByText("Ouvrir la fiche complète")).toBeTruthy();
    /* Les COLONNES sont toujours là : le pipeline n'a pas été quitté. On vise
       leurs en-têtes, et non le texte « À contacter » — il apparaît aussi dans
       le sélecteur d'étape du panneau, ce qui ne prouverait rien. */
    const entetes = [...container.querySelectorAll(".crm-kanban-head__pastille")].map(
      (h) => h.textContent ?? "",
    );
    expect(entetes.length).toBe(7);
    expect(entetes.join(" ")).toContain("À contacter");
  });

  it("sans les dossiers complets, la carte ne prétend pas pouvoir les ouvrir", () => {
    // Le panneau a besoin de l'e-mail, de la qualification, de la dernière
    // note : sans eux, mieux vaut ne rien promettre qu'ouvrir un panneau vide.
    const { queryByTitle } = render(<BuyerKanbanBoard cards={cards} canMove />);
    expect(queryByTitle("Traiter Rose Philippi")).toBeNull();
  });
});

// ===========================================================================
describe("3. Le commercial n'atterrit plus sur le tableau de bord", () => {
  it("il arrive sur ses leads, filtrés au-dessus d'un million", () => {
    expect(roleHome(["commercial"])).toBe("/crm/acquereurs?budget=plus_1m");
  });

  it("les autres rôles gardent le tableau de bord", () => {
    expect(roleHome(["administrateur"])).toBe("/crm");
    expect(roleHome(["manager"])).toBe("/crm");
    expect(roleHome(["setter"])).toBe("/crm");
    expect(roleHome(["agent_immobilier"])).toBe("/crm");
    // Un commercial qui est AUSSI setter opère : il garde le tableau de bord.
    expect(roleHome(["commercial", "setter"])).toBe("/crm");
  });

  it("le tableau de bord reste atteignable : ce n'est pas une suppression", () => {
    // `/crm` n'est redirigé par personne — seule la DESTINATION change.
    expect(roleHome(["commercial"])).not.toBe("/acces");
  });

  it("`?budget=plus_1m` présélectionne bien la tranche dans la liste", () => {
    const { getByLabelText } = render(
      <BuyerInbox
        rows={[dossier()]}
        members={membres}
        chargeA="2026-10-13T12:00:00.000Z"
        budgetInitial="plus_1m"
      />,
    );
    expect((getByLabelText("Budget") as HTMLSelectElement).value).toBe("plus_1m");
  });

  it("une valeur de budget inconnue ne filtre rien", () => {
    const { getByLabelText } = render(
      <BuyerInbox
        rows={[dossier()]}
        members={membres}
        chargeA="2026-10-13T12:00:00.000Z"
        budgetInitial="n_importe_quoi"
      />,
    );
    expect((getByLabelText("Budget") as HTMLSelectElement).value).toBe("tous");
  });
});
