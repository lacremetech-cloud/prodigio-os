// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { BUDGET_FILTERS, BuyerInbox, budgetCorrespond } from "./buyer-inbox";
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
  qualificationStatus: "non_qualifie",
  recommendedPriority: null,
  bestScore: null,
  interestCount: 1,
  lastInterestAt: "2026-10-12T08:00:00.000Z",
  createdAt: "2026-10-12T08:00:00.000Z",
  lastPropertyId: "prop-1",
  lastPropertyLabel: "Villa Jean Jaurès",
  properties: [{ id: "prop-1", label: "Villa Jean Jaurès" }],
  projets: [{ interestId: "int-1", label: "Villa Jean Jaurès" }],
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
    const { getByText, getAllByText, getByLabelText } = render(
      <BuyerInbox
        rows={[dossier({ stage: "nouveau" })]}
        members={membres}
        chargeA="2026-10-13T12:00:00.000Z"
      />,
    );
    /* « vivier » : une etape REELLE, qui existe dans le menu. « signe »
       n'en est pas une, et le `<select>` retombait alors a "" — ce qui
       faisait annoncer un filtre sans nom. */
    fireEvent.change(getByLabelText("Étape"), { target: { value: "vivier" } });
    expect(getByText("Aucun dossier acquéreur ne correspond.")).toBeTruthy();
    /* L'indication NOMME ce qui filtre, aux DEUX endroits : la ligne de
       compte et l'ecran vide. « Ajustez la recherche ou les filtres »
       laissait chercher lequel des cinq etait en cause. */
    expect(getAllByText(/Filtré par étape « Vivier »/).length).toBe(2);
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
            bestScore: 45,
            qualificationStatus: "non_qualifie",
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

/**
 * LE FILTRE BUDGET NE RENVOYAIT RIEN, ET PERSONNE NE POUVAIT LE VOIR.
 *
 * Il recoupait `budget_min_cents` / `budget_max_cents`, qui ne sont remplis que
 * si un commercial saisit les criteres a la main. Aucun ne l'avait fait : les
 * 76 depots avaient ces bornes a NULL, et le recoupement ecartait d'office
 * toute ligne sans fourchette. Choisir une tranche vidait la liste.
 *
 * Ces tests tiennent la correction : le filtre porte sur la REPONSE DONNEE.
 */
describe("filtre budget", () => {
  const avec = (choix: string | null) => dossier({ budgetChoice: choix } as never);

  it("ne propose QUE les trois reponses du formulaire", () => {
    expect(BUDGET_FILTERS.map((b) => b.value)).toEqual([
      "tous",
      "aucun_projet",
      "500k_1m",
      "plus_1m",
      "sans_reponse",
    ]);
  });

  it("ne propose plus les tranches de l'ancien tunnel", () => {
    const libelles = BUDGET_FILTERS.map((b) => b.label).join(" ");
    expect(libelles).not.toContain("800");
    expect(libelles).not.toContain("1,2");
    expect(libelles).not.toContain("3 M€");
  });

  it("retient la reponse exacte", () => {
    expect(budgetCorrespond(avec("500k_1m"), "500k_1m")).toBe(true);
    expect(budgetCorrespond(avec("aucun_projet"), "500k_1m")).toBe(false);
  });

  it("trouve « pas de projet », que l'ancien filtre rendait INTROUVABLE", () => {
    // Sans fourchette, le recoupement renvoyait false pour toutes les tranches.
    expect(budgetCorrespond(avec("aucun_projet"), "aucun_projet")).toBe(true);
  });

  it("replie les tranches retirees sur « Plus d'1 M€ »", () => {
    // Cinq dossiers portent encore « 1m_2m » : ils doivent rester atteignables.
    for (const ancien of ["1m_2m", "2m_3m", "plus_3m"]) {
      expect(budgetCorrespond(avec(ancien), "plus_1m")).toBe(true);
    }
    expect(budgetCorrespond(avec("plus_1m"), "plus_1m")).toBe(true);
  });

  it("n'ecarte jamais un dossier de « Tous budgets »", () => {
    for (const c of ["aucun_projet", "500k_1m", "plus_1m", "1m_2m", null]) {
      expect(budgetCorrespond(avec(c), "tous")).toBe(true);
    }
  });

  it("COUVRE toute ligne : une fiche sans reponse reste atteignable", () => {
    // Une fiche qu'aucun filtre n'atteint est une fiche perdue — le defaut
    // exact qu'on corrige ici.
    expect(budgetCorrespond(avec(null), "sans_reponse")).toBe(true);
    expect(budgetCorrespond(avec("500k_1m"), "sans_reponse")).toBe(false);
  });

  it("filtre reellement la liste affichee", () => {
    const rows = [
      dossier({ name: "Sans projet", budgetChoice: "aucun_projet" } as never),
      dossier({ buyerProfileId: "bp-2", name: "Au million", budgetChoice: "plus_1m" } as never),
    ];
    const { getByText, queryByText, getAllByRole } = render(
      <BuyerInbox rows={rows} members={membres} chargeA="2026-10-13T12:00:00.000Z" />,
    );
    /* Le menu deroulant replie est devenu une rangee de pastilles : « ils ont
       besoin de trier les 500 k – 1 M€ et les plus d'1 M€ assez vite », et
       trois clics pour y arriver, ce n'est pas vite. */
    const pastille = getAllByRole("button").find((b) =>
      (b.textContent ?? "").startsWith("Plus d'1 M€"),
    );
    expect(pastille, "pastille « Plus d'1 M€ » introuvable").toBeTruthy();
    fireEvent.click(pastille!);
    expect(getByText("Au million")).toBeTruthy();
    expect(queryByText("Sans projet")).toBeNull();
  });
});
