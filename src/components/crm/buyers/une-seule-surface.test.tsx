// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { BuyerInbox } from "./buyer-inbox";
import { BuyerKanbanBoard } from "./buyer-kanban";
import type { BuyerInboxRow } from "@/modules/buyers/crm/queries";
import type { BuyerKanbanCard } from "@/modules/buyers/crm/pipeline";

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

/* Le panneau du pipeline ne recoit plus les 506 dossiers d'avance : il demande
   le sien a l'ouverture. On simule donc la reponse du serveur. */
const dossierDemande = vi.fn();
vi.mock("@/modules/buyers/crm/actions", () => ({
  chargerDossierAction: (...a: unknown[]) => dossierDemande(...a),
  moveBuyerCardAction: vi.fn(),
  structurerNoteAction: vi.fn(),
  logBuyerActivityAction: vi.fn(),
  assignBuyerAction: vi.fn(),
  setBuyerQualificationAction: vi.fn(),
  setBuyerStageAction: vi.fn(),
  scheduleBuyerTaskAction: vi.fn(),
  completeBuyerTaskAction: vi.fn(),
}));

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
  unassigned: true,
  budgetMinCents: null,
  budgetMaxCents: null,
  budgetChoice: "plus_1m",
  budgetDeclare: "plus_1m",
  firstName: null,
  whatsappMessage: null,
  budgetCorrige: null,
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
    budgetLabel: null,
    assigneeNames: r.assigneeNames,
    nextActionTitle: r.nextActionTitle,
    nextActionAt: r.nextActionAt,
    createdAt: r.createdAt,
    qualification: r.qualification,
    lastNote: r.lastNote,
    lastNoteAt: r.lastNoteAt,
    lastNoteBy: r.lastNoteBy,
    emailMasked: r.emailMasked,
    whatsappMessage: r.whatsappMessage,
    firstName: r.firstName,
    interestId: r.interestId,
    propertyId: r.lastPropertyId,
    buyerProfileId: r.buyerProfileId,
    stage: r.stage,
    name: r.name,
    propertyLabel: r.lastPropertyLabel,
    properties: r.properties,
    city: r.city,
    qualificationLabel: "À qualifier",
    interestCount: r.interestCount,
    unassigned: r.unassigned,
    overdue: r.overdue,
    noNextAction: r.noNextAction,
    newInterest: r.newInterest,
    phoneMasked: r.phoneMasked,
  }));

  it("cliquer une carte ouvre le panneau SANS quitter le pipeline", async () => {
    dossierDemande.mockResolvedValue({ ok: true, dossier: rows[0] });
    const { container, findByText, getByTitle } = render(
      <BuyerKanbanBoard cards={cards} canMove membres={membres} />,
    );
    fireEvent.click(getByTitle("Traiter Rose Philippi"));
    /* Le dossier arrive du serveur : on attend la reponse, au lieu de
       supposer qu'elle etait deja la. */
    expect(await findByText("Ouvrir la fiche complète")).toBeTruthy();
    /* Les COLONNES sont toujours là : le pipeline n'a pas été quitté. On vise
       leurs en-têtes, et non le texte « À contacter » — il apparaît aussi dans
       le sélecteur d'étape du panneau, ce qui ne prouverait rien. */
    const entetes = [...container.querySelectorAll(".crm-kanban-head__pastille")].map(
      (h) => h.textContent ?? "",
    );
    expect(entetes.length).toBe(9);
    expect(entetes.join(" ")).toContain("À contacter");
    /* Les deux colonnes ajoutées le 09/11/2026 sont rendues comme les autres :
       si elles manquaient, le compte ci-dessus le dirait, mais pas lesquelles. */
    expect(entetes.join(" ")).toContain("R1 planifié");
    expect(entetes.join(" ")).toContain("Offre en cours");
  });

  it("demande le dossier au serveur, au lieu de les recevoir tous d'avance", async () => {
    /* La regle a CHANGE le 24/11/2026, et c'est le fond de ce test.
       Avant : la page envoyait les 506 dossiers au navigateur, et la carte ne
       proposait l'ouverture que si le sien etait du lot. Pres de 1,6 Mo de
       JSON pour en lire un — et 281 personnes deposees dans un navigateur
       pour en ouvrir une seule.
       Depuis : toute carte s'ouvre, et le panneau demande SON dossier. Ce
       test verrouille la demande — c'est elle qui garantit qu'on n'est pas
       revenu a l'envoi en masse. */
    dossierDemande.mockResolvedValue({ ok: true, dossier: rows[0] });
    const { getByTitle, findByText } = render(<BuyerKanbanBoard cards={cards} canMove />);
    fireEvent.click(getByTitle("Traiter Rose Philippi"));
    expect(await findByText("Ouvrir la fiche complète")).toBeTruthy();
    expect(dossierDemande).toHaveBeenCalledWith(
      expect.objectContaining({ buyerProfileId: rows[0]!.buyerProfileId }),
    );
  });
});

// ===========================================================================
describe("3. Le commercial n'atterrit plus sur le tableau de bord", () => {
  const rows = [dossier()];
  /* La destination elle-même, et surtout son CÂBLAGE, sont tenus par
     `src/modules/crm/auth/destination-apres-connexion.test.ts` : la premiere
     version de ce correctif modifiait une fonction que personne n'appelait. */

  /** La pastille de budget active, s'il y en a une. */
  const tranche = (c: HTMLElement) =>
    [...c.querySelectorAll('.crm-rapide[aria-pressed="true"]')]
      .map((b) => b.textContent ?? "")
      .find((t) => /M€|projet|réponse|budgets/.test(t));

  it("`?budget=plus_1m` présélectionne bien la tranche dans la liste", () => {
    const { container } = render(
      <BuyerInbox
        rows={rows}
        members={membres}
        chargeA="2026-10-13T12:00:00.000Z"
        budgetInitial="plus_1m"
      />,
    );
    expect(tranche(container)).toContain("Plus d'1 M€");
  });

  it("une valeur de budget inconnue ne filtre rien", () => {
    const { container } = render(
      <BuyerInbox
        rows={rows}
        members={membres}
        chargeA="2026-10-13T12:00:00.000Z"
        budgetInitial="n_importe_quoi"
      />,
    );
    expect(tranche(container)).toContain("Tous budgets");
  });
});
