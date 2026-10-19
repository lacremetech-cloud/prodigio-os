// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { createRef } from "react";
import type { BuyerInboxRow } from "@/modules/buyers/crm/queries";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

type Charge = Record<string, unknown>;
const enregistre = vi.fn(async (_p: Charge) => ({ ok: true as const }));
const attribue = vi.fn(async (_p: Charge) => ({ ok: true as const }));
const confie = vi.fn(async (_p: Charge) => ({ ok: true as const }));
vi.mock("@/modules/buyers/crm/actions", () => ({
  enregistrerTraitementAction: (p: unknown) => enregistre(p as Charge),
  selfAssignBuyerAction: (p: unknown) => attribue(p as Charge),
  assignBuyerAction: (p: unknown) => confie(p as Charge),
}));

import { PanneauTraitement } from "./panneau-traitement";

afterEach(() => {
  cleanup();
  enregistre.mockClear();
  attribue.mockClear();
  confie.mockClear();
});

const dossier = (over: Partial<BuyerInboxRow> = {}): BuyerInboxRow =>
  ({
    interestId: "int-1",
    buyerProfileId: "bp-1",
    name: "Maya Labeille",
    emailMasked: "maya@example.test",
    phoneMasked: "+33612345678",
    city: "Cassis",
    stage: "a_contacter",
    lastPropertyId: "prop-1",
    lastPropertyLabel: "Villa Jean Jaurès",
    properties: [{ id: "prop-1", label: "Villa Jean Jaurès" }],
    projets: [{ interestId: "int-1", label: "Villa Jean Jaurès" }],
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
    ...over,
  }) as unknown as BuyerInboxRow;

const membres = [
  { userId: "u-1", name: "Jean-Charles C." },
  { userId: "u-2", name: "Antoine D." },
];

function monter(
  row: BuyerInboxRow,
  droits: { moiUserId?: string | null; peutAffecterAutrui?: boolean } = {},
) {
  return render(
    <PanneauTraitement
      row={row}
      moiUserId={droits.moiUserId ?? "u-1"}
      peutAffecterAutrui={droits.peutAffecterAutrui ?? false}
      position={1}
      total={3}
      onFermer={() => {}}
      onEnregistre={() => {}}
      onSuivant={() => {}}
      resteUnSuivant
      saleRef={createRef<boolean>() as never}
      membres={membres}
      contexte=""
    />,
  );
}

describe("en-tête : comprendre et contacter", () => {
  it("porte les DEUX axes, visibles sans rien déplier", () => {
    const { getByRole } = monter(dossier({ stage: "a_rappeler", qualification: "qualifie" }));
    expect(getByRole("button", { name: /Étape/ }).textContent).toContain("À rappeler");
    expect(getByRole("button", { name: /Qualification/ }).textContent).toContain("Qualifié");
  });

  /* « M'attribuer » ne disait pas qu'on pouvait confier le dossier a
     quelqu'un d'autre, et obligeait a ouvrir la fiche pour le faire. C'est
     une liste de NOMS.

     La base reservait la reaffectation a l'encadrement. La regle a saute :
     les commerciaux travaillent ensemble et se repassent les dossiers.
     `crm_buyer_assign` passe desormais par `crm_buyer_can_operate`, la meme
     porte que le changement d'etape — qui peut traiter un dossier peut le
     confier. */
  it("propose TOUTE l'équipe, pas un bouton unique", () => {
    const { getByLabelText } = monter(dossier({ assigneeIds: [] }), {
      peutAffecterAutrui: true,
    });
    const noms = [...(getByLabelText("Confier ce dossier") as HTMLSelectElement).options]
      .map((o) => o.textContent);
    expect(noms).toContain("Jean-Charles C. (moi)");
    expect(noms).toContain("Antoine D.");
  });

  it("on peut confier un dossier DÉJÀ suivi, sans ouvrir la fiche", () => {
    const { container, getByLabelText } = monter(dossier({ assigneeIds: ["u-1"] }), {
      peutAffecterAutrui: true,
    });
    /* Le responsable actuel reste lisible — on vise la mention elle-meme, et
       non le texte : le nom figure AUSSI dans la liste, c'est tout l'objet du
       test. */
    expect(container.querySelector(".crm-panneau__suivi")?.textContent).toContain(
      "Jean-Charles C.",
    );
    // ...et la liste reste ouverte, pour le repasser a un collegue.
    const choix = getByLabelText("Confier ce dossier") as HTMLSelectElement;
    expect(choix.options[0]!.textContent).toBe("Confier aussi à…");
    expect([...choix.options].map((o) => o.textContent)).toContain("Antoine D.");
  });

  it("un rôle qui ne traite rien ne se voit proposer que son propre nom", () => {
    const { getByLabelText } = monter(dossier({ assigneeIds: [] }), {
      peutAffecterAutrui: false,
    });
    const noms = [...(getByLabelText("Confier ce dossier") as HTMLSelectElement).options]
      .map((o) => o.textContent);
    expect(noms).toContain("Jean-Charles C. (moi)");
    expect(noms).not.toContain("Antoine D.");
  });

  it("me prendre le dossier passe par « claim », pas par une reaffectation", async () => {
    const { getByLabelText } = monter(dossier());
    fireEvent.change(getByLabelText("Confier ce dossier"), { target: { value: "u-1" } });
    await vi.waitFor(() => expect(attribue).toHaveBeenCalledWith({ buyerProfileId: "bp-1" }));
    expect(confie).not.toHaveBeenCalled();
  });

  it("confier a un collegue passe par la reaffectation, reservee a l'encadrement", async () => {
    const { getByLabelText } = monter(dossier(), { peutAffecterAutrui: true });
    fireEvent.change(getByLabelText("Confier ce dossier"), { target: { value: "u-2" } });
    await vi.waitFor(() =>
      expect(confie).toHaveBeenCalledWith({ buyerProfileId: "bp-1", userId: "u-2" }),
    );
    expect(attribue).not.toHaveBeenCalled();
  });
});

describe("le contexte vient AVANT le formulaire", () => {
  it("dit franchement qu'il n'y a rien eu", () => {
    const { getByText } = monter(dossier());
    expect(getByText("Aucun échange enregistré")).toBeTruthy();
    expect(getByText("Rien de programmé")).toBeTruthy();
  });

  it("montre la prochaine tâche et signale le retard", () => {
    const { getByLabelText } = monter(
      dossier({ nextActionAt: "2026-10-18T09:00:00.000Z", nextActionTitle: "Rappeler", overdue: true }),
    );
    const ctx = getByLabelText("Où en est ce dossier");
    expect(within(ctx).getByText(/Rappeler/)).toBeTruthy();
    expect(ctx.textContent).toContain("en retard");
  });

  it("montre la note EN ENTIER, pas tronquée", () => {
    const longue =
      "Rappeler après 18 h, il est en déplacement toute la semaine et ne décroche jamais avant.";
    const { getByText } = monter(dossier({ lastNote: longue, lastNoteAt: "2026-10-18T09:00:00.000Z" }));
    expect(getByText(longue)).toBeTruthy();
  });

  it("place le contexte AVANT le bloc de saisie dans le document", () => {
    // C'est tout l'objet du changement : ce qu'on doit savoir passe avant ce
    // qu'on doit saisir.
    const { getByLabelText, getByText } = monter(dossier());
    const ctx = getByLabelText("Où en est ce dossier");
    const saisie = getByText("Enregistrer un échange");
    expect(ctx.compareDocumentPosition(saisie) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("nomme la plus RÉCENTE des deux traces", () => {
    // Un appel sans réponse ne laisse pas de note ; un e-mail consigné depuis
    // ne laisse pas d'appel. Afficher une seule des deux en perd une.
    const { getByLabelText } = monter(
      dossier({
        lastCallAt: "2026-10-18T09:00:00.000Z",
        lastCallOutcome: "appel_sans_reponse",
        lastNoteAt: "2026-10-19T09:00:00.000Z",
        lastNoteBy: "Antoine",
        lastNote: "A rappelé lui-même",
      }),
    );
    expect(getByLabelText("Où en est ce dossier").textContent).toContain("Note de Antoine");
  });
});

describe("la suite à donner porte l'étape, sans la redemander", () => {
  it("annonce « À rappeler » dès qu'un rappel est programmé", () => {
    const { getByRole, getByText } = monter(dossier({ stage: "a_contacter" }));
    fireEvent.click(getByRole("button", { name: "Appel — sans réponse" }));
    // Un appel sans réponse propose déjà un rappel.
    expect(getByText(/L’étape passera à « À rappeler »/)).toBeTruthy();
  });

  it("NE repêche PAS un dossier sorti du traitement", () => {
    // Rappeler quelqu'un rangé en vivier ne doit pas le ramener en silence
    // dans la file d'appels : sortir un dossier reste une décision humaine.
    const { getByRole, queryByText } = monter(dossier({ stage: "vivier" }));
    fireEvent.click(getByRole("button", { name: "Appel — sans réponse" }));
    expect(queryByText(/L’étape passera à/)).toBeNull();
  });

  it("laisse le choix manuel PRIMER sur la déduction", () => {
    const { getByRole, queryByText } = monter(dossier({ stage: "a_contacter" }));
    fireEvent.click(getByRole("button", { name: "Appel — sans réponse" }));
    fireEvent.click(getByRole("button", { name: /Étape/ }));
    fireEvent.click(
      within(getByRole("listbox")).getByRole("option", { name: /En discussion/ }),
    );
    expect(queryByText(/L’étape passera à/)).toBeNull();
  });

  it("envoie l'étape déduite avec le reste, en UNE sauvegarde", async () => {
    const { getByRole } = monter(dossier({ stage: "a_contacter" }));
    fireEvent.click(getByRole("button", { name: "Appel — sans réponse" }));
    fireEvent.click(getByRole("button", { name: "Enregistrer" }));
    await vi.waitFor(() => expect(enregistre).toHaveBeenCalled());
    const envoye = enregistre.mock.calls[0]?.[0] as Charge;
    expect(envoye.stage).toBe("a_rappeler");
    expect(envoye.activite).toBe("appel_sans_reponse");
    expect(envoye.nextActionKind).toBe("rappel");
  });

  it("enregistre une correction de qualification SANS exiger d'activité", async () => {
    const { getByRole } = monter(dossier());
    fireEvent.click(getByRole("button", { name: /Qualification/ }));
    fireEvent.click(within(getByRole("listbox")).getByRole("option", { name: /Qualifié/ }));
    fireEvent.click(getByRole("button", { name: "Enregistrer" }));
    await vi.waitFor(() => expect(enregistre).toHaveBeenCalled());
    const envoye = enregistre.mock.calls[0]?.[0] as Charge;
    expect(envoye.qualification).toBe("qualifie");
    expect(envoye.activite).toBeNull();
  });
});

/**
 * LES TROIS PARCOURS RÉELS D'ANTOINE.
 *
 * Le critère de réussite tient en une phrase : voir immédiatement qui
 * appeler, ce qui s'est dit et ce qu'il faut faire, puis enregistrer le
 * résultat SANS renseigner deux fois la même décision. Ces trois tests
 * l'exigent, et comptent les sauvegardes.
 */
describe("parcours 1 — premier appel, sans réponse", () => {
  it("un geste, une sauvegarde : l'activité, le rappel et l'étape partent ensemble", async () => {
    const { getByRole } = monter(dossier({ stage: "a_contacter" }));

    fireEvent.click(getByRole("button", { name: "Appel — sans réponse" }));
    fireEvent.click(getByRole("button", { name: "Enregistrer" }));

    await vi.waitFor(() => expect(enregistre).toHaveBeenCalledTimes(1));
    const e = enregistre.mock.calls[0]?.[0] as Charge;
    expect(e.activite).toBe("appel_sans_reponse");
    expect(e.nextActionKind).toBe("rappel"); // proposé, pas imposé
    expect(e.nextActionAt).toBeTruthy();
    expect(e.stage).toBe("a_rappeler"); // jamais choisi à la main
  });
});

describe("parcours 2 — rappel honoré, échange, puis visite", () => {
  it("solde la tâche qui a amené le dossier ET programme la visite, en une fois", async () => {
    const { getByRole, getByLabelText } = monter(
      dossier({
        stage: "a_rappeler",
        nextActionId: "t-9",
        nextActionTitle: "Rappeler",
        nextActionAt: "2026-10-19T08:00:00.000Z",
      }),
    );

    fireEvent.click(getByRole("button", { name: "Appel — échange effectué" }));
    fireEvent.click(getByRole("button", { name: "Planifier une visite" }));
    fireEvent.change(getByLabelText(/Bien concerné/), { target: { value: "int-1" } });
    fireEvent.click(getByRole("button", { name: "Enregistrer" }));

    await vi.waitFor(() => expect(enregistre).toHaveBeenCalledTimes(1));
    const e = enregistre.mock.calls[0]?.[0] as Charge;
    expect(e.activite).toBe("appel_echange");
    expect(e.nextActionKind).toBe("visite");
    expect(e.interestId).toBe("int-1"); // une visite se rattache à un bien
    expect(e.stage).toBe("visite_planifiee");
    expect(e.completeTaskId).toBe("t-9"); // la tâche honorée est soldée
  });

  it("annonce la tâche qu'il va solder, avant de la solder", () => {
    const { getByRole, getByText } = monter(
      dossier({ nextActionId: "t-9", nextActionTitle: "Rappeler", nextActionAt: "2026-10-19T08:00:00.000Z" }),
    );
    fireEvent.click(getByRole("button", { name: "Appel — échange effectué" }));
    expect(getByText(/« Rappeler » sera marquée faite/)).toBeTruthy();
  });
});

describe("parcours 3 — refus après échange", () => {
  it("écarte le dossier avec son motif, sans rien programmer", async () => {
    const { getByRole, getByLabelText } = monter(dossier({ stage: "a_rappeler" }));

    fireEvent.click(getByRole("button", { name: "Appel — échange effectué" }));

    fireEvent.click(getByRole("button", { name: /Qualification/ }));
    fireEvent.click(within(getByRole("listbox")).getByRole("option", { name: /Non qualifié/ }));
    const motif = getByLabelText("Motif") as HTMLSelectElement;
    fireEvent.change(motif, { target: { value: motif.options[1]?.value } });

    fireEvent.click(getByRole("button", { name: /Étape/ }));
    fireEvent.click(within(getByRole("listbox")).getByRole("option", { name: /Pas intéressé/ }));

    fireEvent.click(getByRole("button", { name: "Enregistrer" }));

    await vi.waitFor(() => expect(enregistre).toHaveBeenCalledTimes(1));
    const e = enregistre.mock.calls[0]?.[0] as Charge;
    expect(e.qualification).toBe("non_qualifie");
    expect(e.qualificationReason).toBeTruthy(); // un refus se motive
    expect(e.stage).toBe("pas_interesse");
    expect(e.nextActionKind).toBeNull(); // rien à planifier
  });
});

describe("« Rien à planifier » n'efface rien", () => {
  it("ne solde PAS un rappel existant quand on corrige seulement la qualification", async () => {
    // Le rappel était soldé à CHAQUE sauvegarde. Corriger une étiquette
    // faisait disparaître un rappel qu'on n'avait pas honoré.
    const { getByRole } = monter(
      dossier({ nextActionId: "t-9", nextActionTitle: "Rappeler", nextActionAt: "2026-10-19T08:00:00.000Z" }),
    );
    fireEvent.click(getByRole("button", { name: /Qualification/ }));
    fireEvent.click(within(getByRole("listbox")).getByRole("option", { name: /Gros potentiel/ }));
    fireEvent.click(getByRole("button", { name: "Enregistrer" }));

    await vi.waitFor(() => expect(enregistre).toHaveBeenCalled());
    const e = enregistre.mock.calls[0]?.[0] as Charge;
    expect(e.completeTaskId).toBeNull();
    expect(e.nextActionKind).toBeNull();
  });
});
