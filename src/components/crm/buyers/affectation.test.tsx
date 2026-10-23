// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

import { BuyerAssignmentForm } from "./buyer-actions";
import { canTreatBuyers } from "@/modules/crm/auth/roles";

/* Le formulaire rafraîchit la page après coup : sans routeur monté, React
   lève avant même d'avoir rendu quoi que ce soit. */
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

afterEach(cleanup);

/**
 * « Je comprends pas pourquoi sur le panneau latéral et sur la fiche complète,
 * sur l'attribution, j'ai pas l'ensemble des personnes. Donc Antoine, Nicolas,
 * Jean-Charles. C'est tout simple, je veux pas plus que ça. »
 *
 * La fiche demandait `canOperate` — administrateur, manager ou setter — là où
 * la base a ouvert l'affectation aux commerciaux. Un commercial n'y voyait donc
 * que « M'attribuer ce lead », jamais ses collègues.
 */
const EQUIPE = [
  { userId: "u-antoine", name: "Antoine" },
  { userId: "u-jc", name: "JC" },
  { userId: "u-nicolas", name: "Nicolas" },
];

function monter(canAssign: boolean) {
  render(
    <BuyerAssignmentForm
      buyerProfileId="p-1"
      assignees={[]}
      members={EQUIPE}
      canAssign={canAssign}
      canSelfAssign
      currentUserId="u-jc"
    />,
  );
}

describe("qui peut confier un dossier", () => {
  it("un commercial franchit la même porte que le panneau et que la base", () => {
    expect(canTreatBuyers(["commercial"])).toBe(true);
    expect(canTreatBuyers(["administrateur"])).toBe(true);
    expect(canTreatBuyers(["manager"])).toBe(true);
    // Un simple lecteur ne confie rien.
    expect(canTreatBuyers(["partenaire_lecture"])).toBe(false);
  });
});

describe("le bloc Affectation de la fiche", () => {
  it("propose TOUTE l'équipe, pas seulement soi", () => {
    monter(true);
    const liste = screen.getByRole("combobox", { name: /Membre à affecter/ });
    const noms = within(liste).getAllByRole("option").map((o) => o.textContent);
    expect(noms).toContain("Antoine");
    expect(noms).toContain("JC");
    expect(noms).toContain("Nicolas");
  });

  it("ne demande QUE le nom : un seul menu, pas de responsabilité", () => {
    monter(true);
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
    expect(screen.queryByRole("combobox", { name: /Responsabilité/ })).toBeNull();
  });

  it("garde le raccourci « M'attribuer » quand le dossier est libre", () => {
    monter(true);
    expect(screen.getByRole("button", { name: /M’attribuer ce lead/ })).toBeTruthy();
  });

  it("n'affiche aucun menu à qui n'a pas le droit de confier", () => {
    monter(false);
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("affiche le responsable par son nom seul, sans jeton de responsabilité", () => {
    render(
      <BuyerAssignmentForm
        buyerProfileId="p-1"
        assignees={[{ userId: "u-jc", name: "JC", responsibility: "commercial" }]}
        members={EQUIPE}
        canAssign
        canSelfAssign
        currentUserId="u-jc"
      />,
    );
    /* La puce, pas l'option du menu qui porte le même nom. */
    const puce = screen.getByRole("listitem");
    expect(puce.textContent).toContain("JC");
    expect(puce.textContent).not.toMatch(/commercial|setter|·/i);
  });
});
