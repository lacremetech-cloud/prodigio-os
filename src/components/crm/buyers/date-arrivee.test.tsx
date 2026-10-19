// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { BuyerInbox } from "./buyer-inbox";
import { formatJour } from "@/modules/crm/format";
import type { BuyerInboxRow } from "@/modules/buyers/crm/queries";

/**
 * « Il manque la date du lead, et qu'on puisse classer du plus récent au plus
 * ancien ou inversement. »
 *
 * La date d'arrivée n'était lisible nulle part dans la liste, et le tri
 * « Date d'arrivée » n'existait que dans un sens — sans que son libellé dise
 * lequel.
 */

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
afterEach(() => cleanup());

const dossier = (over: Partial<BuyerInboxRow> = {}): BuyerInboxRow => ({
  interestId: "int-1",
  buyerProfileId: "bp-1",
  name: "Marie Line Simmerling",
  emailMasked: "ml@example.test",
  phoneMasked: "+33664629497",
  city: "Cassis",
  stage: "a_contacter",
  qualificationStatus: "non_qualifie",
  recommendedPriority: null,
  bestScore: null,
  interestCount: 1,
  lastInterestAt: "2026-10-17T07:15:00.000Z",
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
  highPotential: false,
  unassigned: true,
  budgetMinCents: null,
  budgetMaxCents: null,
  budgetChoice: "plus_1m",
  ...over,
});
const membres = [{ userId: "u-1", name: "Jean-Charles C." }];
const chargeA = "2026-10-19T12:00:00.000Z";

/** Les noms, dans l'ordre où la liste les affiche. */
const ordreAffiche = (c: HTMLElement) =>
  [...c.querySelectorAll("li.crm-ligne")].map(
    (li) => li.querySelector("span.font-bold")?.textContent?.trim() ?? "",
  );

describe("la date d'arrivée est lisible dans la ligne", () => {
  it("chaque ligne annonce quand le lead est arrivé", () => {
    const { getByText } = render(
      <BuyerInbox rows={[dossier()]} members={membres} chargeA={chargeA} />,
    );
    expect(getByText(`Arrivé le ${formatJour("2026-10-17T07:15:00.000Z")}`)).toBeTruthy();
  });

  it("le jour, sans l'heure : on balaie une liste, on ne lit pas un rappel", () => {
    expect(formatJour("2026-10-17T07:15:00.000Z")).toBe("17 oct. 2026");
    expect(formatJour(null)).toBe("—");
    expect(formatJour("pas une date")).toBe("—");
  });
});

describe("le tri par arrivée va dans LES DEUX sens", () => {
  const rows = [
    dossier({ buyerProfileId: "b", interestId: "i-b", name: "Milieu", createdAt: "2026-10-10T09:00:00.000Z" }),
    dossier({ buyerProfileId: "a", interestId: "i-a", name: "Ancien", createdAt: "2026-09-20T09:00:00.000Z" }),
    dossier({ buyerProfileId: "c", interestId: "i-c", name: "Recent", createdAt: "2026-10-18T09:00:00.000Z" }),
  ];

  const trier = (c: HTMLElement, valeur: string) => {
    const select = [...c.querySelectorAll("select")].find((s) =>
      [...s.options].some((o) => o.value === "arrivee"),
    );
    if (!select) throw new Error("sélecteur de tri introuvable");
    fireEvent.change(select, { target: { value: valeur } });
  };

  it("du plus récent au plus ancien", () => {
    const { container } = render(
      <BuyerInbox rows={rows} members={membres} chargeA={chargeA} />,
    );
    trier(container, "arrivee");
    expect(ordreAffiche(container)).toEqual(["Recent", "Milieu", "Ancien"]);
  });

  it("et inversement — pour retrouver ceux qui attendent depuis trois semaines", () => {
    const { container } = render(
      <BuyerInbox rows={rows} members={membres} chargeA={chargeA} />,
    );
    trier(container, "arrivee_ancienne");
    expect(ordreAffiche(container)).toEqual(["Ancien", "Milieu", "Recent"]);
  });

  it("les deux sens sont proposés, et chacun DIT son sens", () => {
    const { container } = render(
      <BuyerInbox rows={rows} members={membres} chargeA={chargeA} />,
    );
    const select = [...container.querySelectorAll("select")].find((s) =>
      [...s.options].some((o) => o.value === "arrivee"),
    )!;
    const libelles = [...select.options].map((o) => o.textContent ?? "");
    expect(libelles.join(" | ")).toContain("plus récente d’abord");
    expect(libelles.join(" | ")).toContain("plus ancienne d’abord");
  });
});
