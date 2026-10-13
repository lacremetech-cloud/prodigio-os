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

/* `useRouter` n'existe pas hors d'une application montée. La boîte de réception
   s'en sert pour recharger les DONNÉES après un enregistrement, sans démonter
   la liste. */
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

afterEach(() => cleanup());

const dossier = (over: Partial<BuyerInboxRow> = {}): BuyerInboxRow => ({
  interestId: "int-1",
  buyerProfileId: "bp-1",
  name: "Maya Labeille",
  emailMasked: "maya@example.test",
  phoneMasked: "+33612345678",
  city: "Cassis",
  stage: "nouveau",
  interestCount: 1,
  lastInterestAt: "2026-10-12T08:00:00.000Z",
  createdAt: "2026-10-12T08:00:00.000Z",
  propertyId: "prop-1",
  propertyLabel: "Villa Jean Jaurès",
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
      <BuyerInbox rows={rows} members={membres} chargeA="2026-10-13T12:00:00.000Z" />,
    );
    expect(getByText("Maya Labeille")).toBeTruthy();
    expect(getByText("BANAT CLUB")).toBeTruthy();
    expect(getByText("Camille Durand")).toBeTruthy();
    expect(getByRole("status").textContent).toContain("3 dossiers affichés sur 3");
  });

  it("une liste vide affiche l'état vide, pas une page blanche", () => {
    const { getByText } = render(
      <BuyerInbox rows={[]} members={membres} chargeA="2026-10-13T12:00:00.000Z" />,
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
        chargeA="2026-10-13T12:00:00.000Z"
      />,
    );
    /* L'étape vit derrière « Filtres » : elle sert moins souvent que les trois
       pastilles, et la déplier en permanence repoussait le premier dossier
       sous une page de réglages. Elle reste à un clic. */
    fireEvent.click(getByText("Filtres"));
    fireEvent.change(getByLabelText("Étape"), { target: { value: "signe" } });
    expect(getByText("Aucun dossier acquéreur ne correspond.")).toBeTruthy();
    expect(getByText("Ajustez la recherche ou les filtres.")).toBeTruthy();
  });

  /**
   * Le SCORE automatique reste caché : c'est un calcul, pas un jugement, et
   * l'afficher à côté d'une qualification humaine fait croire à deux avis.
   *
   * La QUALIFICATION, elle, est désormais affichée — et c'est celle de la
   * MANIFESTATION (`qualification`), pas l'ancien statut du profil
   * (`qualificationStatus`), dont le vocabulaire porte un sens différent.
   */
  it("montre la qualification du projet, jamais le score automatique", () => {
    const { queryByText, getAllByText } = render(
      <BuyerInbox
        rows={[
          dossier({
            qualification: "gros_potentiel",
          }),
        ]}
        members={membres}
        chargeA="2026-10-13T12:00:00.000Z"
      />,
    );
    expect(queryByText(/Score 45/)).toBeNull();
    expect(getAllByText("Gros potentiel").length).toBeGreaterThan(0);
    // L'ancien statut du profil ne doit surtout pas s'afficher à sa place.
    expect(queryByText("Non qualifié")).toBeNull();
  });

  /* La couleur de ligne ne dit QUE la qualification. Un gros potentiel qui n'a
     pas décroché doit rester vert : c'est ce qui évite de rappeler en priorité
     les gens qu'on vient d'écarter. */
  it("colore la ligne selon la qualification, pas selon le retard", () => {
    const { container } = render(
      <BuyerInbox
        rows={[dossier({ qualification: "gros_potentiel", overdue: true })]}
        members={membres}
        chargeA="2026-10-13T12:00:00.000Z"
      />,
    );
    const ligne = container.querySelector(".crm-ligne");
    expect(ligne?.className).toContain("crm-ligne--vert");
    expect(ligne?.className).not.toContain("crm-ligne--rouge");
  });
});
