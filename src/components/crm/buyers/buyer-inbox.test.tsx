// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { BuyerInbox } from "./buyer-inbox";
import type { BuyerInboxRow } from "@/modules/buyers/crm/queries";

/**
 * Garde-fou né d'une vraie erreur : en retirant la rangée de filtres rapides,
 * le `return true` final du prédicat de filtrage est parti avec elle. Le
 * prédicat renvoyait `undefined`, et la boîte de réception s'affichait **vide**
 * alors que les dossiers étaient bien là. Rien ne l'a signalé — ni le
 * typage, ni le linter, ni les tests.
 *
 * Ce test tient donc la seule chose qui compte ici : sans filtre actif, tout
 * ce qui est autorisé par la RLS s'affiche.
 */

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

afterEach(() => cleanup());

const dossier = (over: Partial<BuyerInboxRow> = {}): BuyerInboxRow => ({
  interestId: "int-1",
  buyerProfileId: "bp-1",
  name: "Maya Labeille",
  emailMasked: "maya@example.test",
  phoneMasked: "+33612345678",
  city: "Cassis",
  stage: "nouveau",
  qualificationStatus: "non_qualifie",
  recommendedPriority: null,
  bestScore: null,
  interestCount: 1,
  lastInterestAt: "2026-10-12T08:00:00.000Z",
  createdAt: "2026-10-12T08:00:00.000Z",
  lastPropertyId: "prop-1",
  lastPropertyLabel: "Villa Jean Jaurès",
  assigneeNames: [],
  assigneeIds: [],
  nextActionAt: null,
  nextActionTitle: null,
  overdue: false,
  noNextAction: true,
  newInterest: true,
  highPotential: false,
  unassigned: true,
  budgetMinCents: null,
  budgetChoice: "1m_2m",
  budgetMaxCents: null,
  ...over,
});
const membres = [{ userId: "u-1", name: "Jean-Charles C." }];

describe("BuyerInbox", () => {
  it("affiche tous les dossiers quand aucun filtre n'est actif", () => {
    const rows = [
      dossier(),
      dossier({ buyerProfileId: "bp-2", name: "BANAT CLUB", stage: "en_discussion" }),
      dossier({ buyerProfileId: "bp-3", name: "Camille Durand", stage: "visite" }),
    ];
    const { getByText, getByRole } = render(
      <BuyerInbox rows={rows} members={membres} />,
    );
    expect(getByText("Maya Labeille")).toBeTruthy();
    expect(getByText("BANAT CLUB")).toBeTruthy();
    expect(getByText("Camille Durand")).toBeTruthy();
    expect(getByRole("status").textContent).toContain("3 dossiers affichés sur 3");
  });

  it("une liste vide affiche l'état vide, pas une page blanche", () => {
    const { getByText } = render(
      <BuyerInbox rows={[]} members={membres} />,
    );
    expect(getByText("Aucun acquéreur pour l’instant.")).toBeTruthy();
  });

  // Sans acquéreur du tout, inviter à « ajuster les filtres » envoie le
  // commercial chercher une panne qui n'existe pas.
  it("distingue « rien à afficher » de « les filtres cachent tout »", () => {
    const { getByText, getByLabelText } = render(
      <BuyerInbox
        rows={[dossier({ stage: "nouveau" })]}
        members={membres}
      />,
    );
    fireEvent.change(getByLabelText("Étape"), { target: { value: "signe" } });
    expect(getByText("Aucun dossier acquéreur ne correspond.")).toBeTruthy();
    expect(getByText("Ajustez la recherche ou les filtres.")).toBeTruthy();
  });

  it("ne montre plus ni score ni qualification", () => {
    const { queryByText } = render(
      <BuyerInbox
        rows={[dossier({ bestScore: 45, qualificationStatus: "non_qualifie" })]}
        members={membres}
      />,
    );
    expect(queryByText(/Score 45/)).toBeNull();
    expect(queryByText(/Qualification/)).toBeNull();
    expect(queryByText("Non qualifié")).toBeNull();
  });
});
