import { describe, expect, it } from "vitest";
import { lireSignal, porteLeSignal, type Signal } from "./signaux";
import type { BuyerInboxRow } from "./queries";

function dossier(p: Partial<BuyerInboxRow>): BuyerInboxRow {
  return {
    stage: "en_discussion",
    overdue: false,
    highPotential: false,
    noNextAction: false,
    unassigned: false,
    ...p,
  } as BuyerInboxRow;
}

describe("lireSignal", () => {
  it("accepte les signaux connus", () => {
    expect(lireSignal("en_retard")).toBe("en_retard");
    expect(lireSignal("non_affectes")).toBe("non_affectes");
  });

  it("ne filtre rien sur une valeur inconnue ou absente", () => {
    // Un paramètre d'URL vient de l'extérieur : une valeur fantaisiste doit
    // rendre la liste complète, jamais une liste vide inexplicable.
    expect(lireSignal("n_importe_quoi")).toBe("tous");
    expect(lireSignal(undefined)).toBe("tous");
    expect(lireSignal([])).toBe("tous");
  });

  it("retient la première valeur quand le paramètre est répété", () => {
    expect(lireSignal(["en_retard", "nouveaux"])).toBe("en_retard");
  });
});

describe("porteLeSignal", () => {
  it("fait correspondre chaque signal au bon champ", () => {
    const cas: [Signal, Partial<BuyerInboxRow>][] = [
      ["nouveaux", { stage: "nouveau" }],
      ["en_retard", { overdue: true }],
      ["fort_potentiel", { highPotential: true }],
      ["sans_action", { noNextAction: true }],
      ["non_affectes", { unassigned: true }],
    ];
    for (const [signal, champ] of cas) {
      expect(porteLeSignal(dossier(champ), signal)).toBe(true);
      expect(porteLeSignal(dossier({}), signal)).toBe(false);
    }
  });

  it("laisse tout passer sur « tous »", () => {
    expect(porteLeSignal(dossier({}), "tous")).toBe(true);
  });
});

/**
 * Les filtres rapides sont ceux que le commercial se pose vraiment en arrivant.
 * Deux pièges s'y cachent, et ce sont eux qui sont vérifiés ici.
 */
describe("filtres rapides de traitement", () => {
  const base = (over: Partial<BuyerInboxRow>): BuyerInboxRow => dossier(over);

  /* « À contacter » n'est PAS « sans prochaine action » : un dossier appelé
     trois fois sans succès n'est plus à contacter, il est à rappeler. */
  it("« à contacter » ne retient que ceux à qui personne n'a parlé", () => {
    expect(porteLeSignal(base({ callAttempts: 0 }), "a_contacter")).toBe(true);
    expect(porteLeSignal(base({ callAttempts: 3, noNextAction: true }), "a_contacter")).toBe(false);
  });

  /* « Injoignable » porte sur le DERNIER appel. Quelqu'un qu'on a fini par
     joindre n'est plus injoignable, même s'il l'a été dix fois avant. */
  it("« injoignables » regarde le dernier appel, pas l'historique", () => {
    expect(porteLeSignal(base({ lastCallOutcome: "sans_reponse" }), "injoignables")).toBe(true);
    expect(porteLeSignal(base({ lastCallOutcome: "message_laisse" }), "injoignables")).toBe(true);
    expect(
      porteLeSignal(base({ callAttempts: 10, lastCallOutcome: "contact_etabli" }), "injoignables"),
    ).toBe(false);
  });

  it("les qualifications se filtrent une à une", () => {
    expect(porteLeSignal(base({ qualification: "gros_potentiel" }), "gros_potentiel")).toBe(true);
    expect(porteLeSignal(base({ qualification: "en_reflexion" }), "en_reflexion")).toBe(true);
    expect(porteLeSignal(base({ qualification: "non_qualifie" }), "non_qualifies")).toBe(true);
    expect(porteLeSignal(base({ qualification: "gros_potentiel" }), "non_qualifies")).toBe(false);
  });

  it("un numéro invalide se retrouve en un clic", () => {
    expect(porteLeSignal(base({ phoneInvalid: true }), "numero_invalide")).toBe(true);
  });
});
