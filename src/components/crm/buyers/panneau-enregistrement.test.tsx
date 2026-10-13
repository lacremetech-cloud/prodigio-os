// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { createRef } from "react";

/**
 * « Enregistrer et suivant » : ni doublon, ni saisie perdue.
 *
 * Ces deux garanties ne se vérifient pas à l'écran sans session ni base — le
 * banc d'essai se fait rediriger vers la connexion dès le premier envoi. Elles
 * se vérifient ici, en simulant l'action serveur : un envoi lent pour le
 * double-clic, un envoi qui échoue pour la saisie.
 *
 * Ce qui est en jeu : une note dictée au téléphone et perdue parce que le
 * réseau a coupé, et l'outil est abandonné le jour même.
 */

const envoyer = vi.fn();
vi.mock("@/modules/buyers/crm/actions", () => ({
  recordBuyerTreatmentAction: (...args: unknown[]) => envoyer(...args),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import { PanneauTraitement } from "./panneau-traitement";
import { DOSSIERS_FICTIFS } from "@/modules/buyers/crm/dossiers-fictifs";

const dossier = DOSSIERS_FICTIFS.find((d) => d.name === "Sophie Marchand")!;

function monter(onSuivant = vi.fn(), onEnregistre = vi.fn()) {
  return render(
    <PanneauTraitement
      row={dossier}
      position={1}
      total={4}
      resteUnSuivant
      saleRef={createRef<boolean>() as React.MutableRefObject<boolean>}
      contexte=""
      onFermer={vi.fn()}
      onEnregistre={onEnregistre}
      onSuivant={onSuivant}
    />,
  );
}

describe("enregistrer et suivant", () => {
  beforeEach(() => envoyer.mockReset());
  afterEach(cleanup);

  /* Deux clics pendant que le réseau répond : UN seul enregistrement. Sans ce
     garde-fou, un appel consigné deux fois fausse le compteur de tentatives et
     pose deux rappels pour la même personne. */
  it("deux clics rapides ne produisent qu’un enregistrement", async () => {
    let debloquer: (v: unknown) => void = () => {};
    const enVol = new Promise((r) => { debloquer = r; });
    envoyer.mockImplementation(() => enVol);
    const vue = within(monter().container);

    fireEvent.click(vue.getByRole("button", { name: /Injoignable/i }));
    const bouton = vue.getByRole("button", { name: /Enregistrer et suivant/i });
    fireEvent.click(bouton);
    fireEvent.click(bouton);
    fireEvent.click(bouton);

    await waitFor(() => expect(envoyer).toHaveBeenCalledTimes(1));
    // On libère l'envoi avant de sortir : un test ne doit pas laisser une
    // promesse en vol derrière lui.
    debloquer({ ok: true });
    await enVol;
    await waitFor(() => expect(envoyer).toHaveBeenCalledTimes(1));
  });

  /* L'enregistrement échoue : la note reste, le résultat d'appel reste, et on
     NE CHANGE PAS de dossier. Passer au suivant en perdant la saisie serait la
     pire des réponses à une coupure réseau. */
  it("un échec garde la saisie et ne fait pas changer de dossier", async () => {
    /* `safeAction` transforme une action qui lève en `{ ok: false }` : c'est
       cette forme-là que le panneau reçoit réellement. */
    envoyer.mockResolvedValue({ ok: false, error: "L’enregistrement a échoué. Réessayez." });
    const onSuivant = vi.fn();
    const vue = within(monter(onSuivant).container);

    fireEvent.click(vue.getByRole("button", { name: /Injoignable/i }));
    const note = vue.getByPlaceholderText(/Objection, contexte/i);
    fireEvent.change(note, { target: { value: "Ne décroche pas, rappel demain." } });
    fireEvent.click(vue.getByRole("button", { name: /Enregistrer et suivant/i }));

    await waitFor(() => expect(envoyer).toHaveBeenCalled());
    await waitFor(() =>
      expect((note as HTMLTextAreaElement).value).toBe("Ne décroche pas, rappel demain."),
    );
    expect(vue.getByRole("button", { name: /Injoignable/i }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(onSuivant).not.toHaveBeenCalled();
  });

  /* Quatre qualifications, pas cinq : « Qualifié » a disparu de l'échelle. */
  it("le panneau propose exactement les quatre qualifications", () => {
    envoyer.mockResolvedValue({ ok: true });
    const vue = within(monter().container);
    for (const libelle of ["À qualifier", "Gros potentiel", "En réflexion", "Non qualifié"]) {
      expect(vue.getByRole("button", { name: libelle })).toBeTruthy();
    }
    expect(vue.queryByRole("button", { name: /^Qualifié$/ })).toBeNull();
  });
});
