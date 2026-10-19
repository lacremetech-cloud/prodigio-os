// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";

/**
 * « Il faut détacher les sections suivi et prochaine action visuellement,
 * qu'on puisse enregistrer l'étape suivi avec un bouton enregistrer, et qu'on
 * puisse prochaine action enregistrer aussi. »
 *
 * Les deux partageaient un bouton. Noter un message vocal obligeait à
 * répondre aussi à « et ensuite ? », et revenir trois jours plus tard pour
 * planifier un rappel renvoyait dans un formulaire d'activité vide.
 *
 * Ce sont deux moments différents du même dossier. Deux blocs, deux
 * enregistrements — et surtout : enregistrer l'un ne doit RIEN envoyer de
 * l'autre.
 */

const appels: Record<string, unknown>[] = [];
vi.mock("@/modules/buyers/crm/actions", () => ({
  enregistrerTraitementAction: async (p: unknown) => {
    appels.push(p as Record<string, unknown>);
    return { ok: true as const };
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {}, push: () => {} }) }));

import { BuyerActivityForm } from "./buyer-actions";

afterEach(() => {
  cleanup();
  appels.length = 0;
});

const monter = () =>
  render(
    <BuyerActivityForm
      buyerProfileId="bp-1"
      interests={[{ id: "int-1", label: "Villa Verdun" }]}
      members={[{ userId: "u-1", name: "Jean-Charles C." }]}
    />,
  );

describe("deux blocs, deux enregistrements", () => {
  it("chacun a son propre bouton", () => {
    const { getByText } = monter();
    expect(getByText("Enregistrer le suivi")).toBeTruthy();
    expect(getByText("Enregistrer la prochaine action")).toBeTruthy();
  });

  it("ils sont détachés visuellement, pas séparés par un simple trait", () => {
    const { container } = monter();
    const blocs = container.querySelectorAll(".crm-sous-bloc");
    expect(blocs.length).toBe(2);
    expect([...blocs].map((b) => b.querySelector(".crm-sous-bloc__titre")?.textContent)).toEqual([
      "Suivi",
      "Prochaine action",
    ]);
  });

  it("enregistrer le suivi N'ENVOIE PAS de prochaine action", () => {
    const { getByText } = monter();
    fireEvent.click(getByText("Message vocal laissé"));
    fireEvent.click(getByText("Enregistrer le suivi"));
    expect(appels.length).toBe(1);
    expect(appels[0]).toHaveProperty("activite");
    expect(appels[0]).not.toHaveProperty("nextActionKind");
    expect(appels[0]).not.toHaveProperty("stage");
  });

  it("enregistrer la prochaine action N'ENVOIE PAS d'activité", () => {
    const { getByText } = monter();
    fireEvent.click(getByText("Rappeler"));
    fireEvent.click(getByText("Enregistrer la prochaine action"));
    expect(appels.length).toBe(1);
    expect(appels[0]).toHaveProperty("nextActionKind", "rappel");
    expect(appels[0]).not.toHaveProperty("activite");
    expect(appels[0]).not.toHaveProperty("note");
  });

  it("le bouton du suivi reste inerte tant qu'il n'y a rien à enregistrer", () => {
    const { getByText } = monter();
    expect((getByText("Enregistrer le suivi") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(getByText("Note libre"));
    expect((getByText("Enregistrer le suivi") as HTMLButtonElement).disabled).toBe(false);
  });

  it("« Rien à planifier » ne s'enregistre pas : c'est l'absence d'action", () => {
    // Et surtout, cela n'efface jamais un rappel existant.
    const { getByText } = monter();
    expect((getByText("Enregistrer la prochaine action") as HTMLButtonElement).disabled).toBe(true);
  });

  it("une visite rattache le bien ET pose l'étape, dans le même envoi", () => {
    const { getByText, getByLabelText } = monter();
    fireEvent.click(getByText("Planifier une visite"));
    fireEvent.change(getByLabelText(/Bien concerné/i), { target: { value: "int-1" } });
    fireEvent.click(getByText("Enregistrer la prochaine action"));
    expect(appels[0]).toHaveProperty("interestId", "int-1");
    expect(appels[0]).toHaveProperty("stage", "visite_planifiee");
  });
});
