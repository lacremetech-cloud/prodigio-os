// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, within } from "@testing-library/react";
import { BuyerKanbanBoard } from "./buyer-kanban";
import type { BuyerInboxRow } from "@/modules/buyers/crm/queries";
import type { BuyerKanbanCard } from "@/modules/buyers/crm/pipeline";

/**
 * « Je trouve nulles les étiquettes, le "nouvel intérêt" qui reste, même le
 * truc de l'attribution — c'est pas la peine de mettre un gros truc rouge.
 * Faut qu'on voie les mêmes infos que sur la vue liste. »
 *
 * La carte alignait quatre pastilles — « Non affecté » et « Sans action » en
 * rouge, « Nouvel intérêt » en doré — là où la liste écrit calmement ces
 * mêmes faits sous un intitulé de colonne. Et elle taisait le budget, le
 * responsable, la prochaine action, la qualification et la date d'arrivée,
 * que la liste montre toutes.
 *
 * « Nouvel intérêt » était le pire : les 82 manifestations de la base sont au
 * statut « nouveau », et rien ne le remet jamais à zéro. L'étiquette était
 * donc allumée sur CHAQUE carte. Une alerte toujours vraie n'alerte de rien ;
 * elle noie celles qui comptent.
 */

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {}, push: () => {} }) }));
afterEach(() => cleanup());

const row: BuyerInboxRow = {
  interestId: "int-1",
  buyerProfileId: "bp-1",
  name: "Rayyan Test",
  emailMasked: "rayyan@example.test",
  phoneMasked: "+33625773592",
  city: "Cassis",
  stage: "pas_interesse",
  qualificationStatus: "non_qualifie",
  interestCount: 2,
  lastInterestAt: "2026-10-19T08:00:00.000Z",
  createdAt: "2026-10-17T07:15:00.000Z",
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
};

const card: BuyerKanbanCard = {
  interestId: row.interestId,
  propertyId: row.lastPropertyId,
  buyerProfileId: row.buyerProfileId,
  stage: row.stage,
  name: row.name,
  propertyLabel: row.lastPropertyLabel,
  properties: row.properties,
  city: row.city,
  qualificationLabel: "À qualifier",
  interestCount: row.interestCount,
  unassigned: true,
  overdue: false,
  noNextAction: true,
  newInterest: true,
  phoneMasked: row.phoneMasked,
};

/**
 * On vise la CARTE, pas la page : « En retard » et « Sans action » sont aussi
 * des filtres rapides dans la barre d'outils du tableau. Chercher ces textes
 * a l'echelle du document trouverait les boutons et ne prouverait rien.
 */
const monter = (over: Partial<BuyerInboxRow> = {}) =>
  render(
    <BuyerKanbanBoard
      cards={[{ ...card, overdue: over.overdue ?? card.overdue }]}
      canMove
      rows={[{ ...row, ...over }]}
      membres={[{ userId: "u-1", name: "Jean-Charles C." }]}
    />,
  );

/** La carte elle-meme, isolee du reste du tableau. */
const carte = (c: HTMLElement) =>
  within(c.querySelector(".crm-kanban-card") as HTMLElement);

describe("les étiquettes toujours allumées ont disparu", () => {
  it("plus de pastille « Nouvel intérêt » — elle l'était sur les 82 manifestations", () => {
    const { container } = monter();
    expect(carte(container).queryByText("Nouvel intérêt")).toBeNull();
  });

  it("plus de gros « Non affecté » rouge : c'est une valeur, pas une alerte", () => {
    const { container } = monter();
    const mention = carte(container).getByText("Non affecté");
    // Présente, mais pas dans une pastille de danger.
    expect(mention.closest(".crm-chip--danger")).toBeNull();
    expect(container.querySelectorAll(".crm-chip--danger").length).toBe(0);
  });

  it("plus de pastille « Sans action » : la liste écrit « À programmer »", () => {
    const { container } = monter();
    expect(carte(container).queryByText("Sans action")).toBeNull();
    expect(carte(container).getByText("À programmer")).toBeTruthy();
  });

  it("« En retard » RESTE : un rappel dépassé est un fait, pas un état permanent", () => {
    const { container } = monter({ overdue: true });
    expect(carte(container).getByText("En retard").className).toContain("crm-chip");
    // Et il ne s'affiche PAS quand rien n'est en retard.
    cleanup();
    const { container: sain } = monter();
    expect(carte(sain).queryByText("En retard")).toBeNull();
  });
});

describe("la carte montre les mêmes informations que la liste", () => {
  it("budget, responsable, prochaine action, qualification, date d'arrivée", () => {
    const { container } = monter();
    const c = carte(container);
    expect(c.getByText("Budget")).toBeTruthy();
    expect(c.getByText("Plus d'1 M€")).toBeTruthy();
    expect(c.getByText("Responsable")).toBeTruthy();
    expect(c.getByText("Prochaine action")).toBeTruthy();
    expect(c.getByText("À qualifier")).toBeTruthy();
    expect(c.getByText("Arrivé le 17 oct. 2026")).toBeTruthy();
  });

  it("le responsable est nommé quand il y en a un", () => {
    const { container } = monter({ assigneeNames: ["Jean-Charles C."] });
    expect(carte(container).getByText("Jean-Charles C.")).toBeTruthy();
    expect(carte(container).queryByText("Non affecté")).toBeNull();
  });

  it("la prochaine action est datée quand elle existe", () => {
    const { container } = monter({
      nextActionTitle: "Rappeler",
      nextActionAt: "2026-10-24T08:00:00.000Z",
    });
    expect(carte(container).getByText("Rappeler")).toBeTruthy();
    expect(carte(container).queryByText("À programmer")).toBeNull();
  });

  it("les boutons de contact sont là, comme dans la colonne Contact de la liste", () => {
    const { container } = monter();
    const dansLaCarte = container.querySelector(".crm-kanban-card") as HTMLElement;
    const liens = [...dansLaCarte.querySelectorAll("a")].map((a) => a.getAttribute("href") ?? "");
    expect(liens.some((h) => h.startsWith("tel:"))).toBe(true);
    expect(liens.some((h) => h.startsWith("mailto:"))).toBe(true);
  });

  it("sans les dossiers complets, la carte reste lisible plutôt que vide", () => {
    const { container } = render(<BuyerKanbanBoard cards={[card]} canMove />);
    expect(carte(container).getByText("Rayyan Test")).toBeTruthy();
    expect(carte(container).queryByText("Nouvel intérêt")).toBeNull();
  });
});

/**
 * « Quand on met un lead dans Vivier, on aurait besoin de voir d'un seul coup
 * d'œil ce que la personne recherche […] pour pouvoir mettre un bien en
 * face. »
 *
 * Traiter le vivier demandait d'ouvrir les quarante-six dossiers l'un après
 * l'autre. La note d'appel arrivait pourtant DÉJÀ dans le navigateur — le
 * panneau de traitement la reçoit avec le reste de la ligne — mais la carte
 * la jetait.
 *
 * Les critères structurés ne pouvaient pas rendre ce service : déduits du
 * bien par lequel la personne est arrivée, trente-huit des quarante-six
 * dossiers du vivier portent « villa / cassis », ce que la carte dit déjà.
 */
describe("la dernière note sur la carte", () => {
  it("affiche ce que la personne cherche, sans ouvrir la fiche", () => {
    const { container } = monter({
      lastNote: "Cherche un 3 pièces avec vue mer, budget 800 k, pas pressé.",
      lastNoteAt: "2026-11-18T09:30:00.000Z",
      lastNoteBy: "Édouard",
    });
    expect(carte(container).getByText(/3 pièces avec vue mer/)).toBeTruthy();
  });

  it("porte le texte ENTIER en survol, même quand l'affichage le coupe", () => {
    /* Trois lignes suffisent à la note médiane (179 caractères), pas aux plus
       longues — 1 817 au maximum. Couper sans rien offrir d'autre perdrait la
       fin de la phrase, qui est souvent le budget. */
    const longue = "A".repeat(900);
    const { container } = monter({ lastNote: longue, lastNoteAt: null, lastNoteBy: null });
    const note = container.querySelector(".crm-kanban-note") as HTMLElement;
    expect(note.getAttribute("title")).toBe(longue);
  });

  it("ne montre rien du tout quand il n'y a pas de note", () => {
    /* Deux cent cinquante-neuf cartes de la colonne « À contacter » n'en ont
       aucune : y écrire « Aucune note » ajouterait une ligne vide à chacune. */
    const { container } = monter({ lastNote: null });
    expect(container.querySelector(".crm-kanban-note")).toBeNull();
  });

  it("date la note : une phrase de juillet ne se lit pas comme celle d'hier", () => {
    const { container } = monter({
      lastNote: "Rappeler après les vacances.",
      lastNoteAt: "2026-11-18T09:30:00.000Z",
      lastNoteBy: "Nicolas",
    });
    const note = container.querySelector(".crm-kanban-note") as HTMLElement;
    expect(note.textContent).toContain("Nicolas");
    expect(note.textContent).toMatch(/18/);
  });
});
