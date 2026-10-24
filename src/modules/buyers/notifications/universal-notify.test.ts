import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { LIBELLES_BUDGET_TRANSMIS } from "./universal-notify";

/**
 * CE TEST EXISTE POUR UNE PANNE SILENCIEUSE.
 *
 * Le sous-scénario Make « JCAN IMMO — premier contact » choisit lequel des
 * trois messages part en comparant `budget_libelle` par égalité stricte. Un
 * libellé renommé ici ne provoque aucune erreur : le lead ne correspond à
 * aucune branche et repart sans e-mail. On l'a payé sur « 1 à 2 M€ », écrit
 * avec un tiret côté Make.
 *
 * Donc : ces six chaînes sont un CONTRAT. Si ce test casse, ouvrez le
 * scénario 10034711 AVANT de corriger l'attendu.
 */
describe("libelles de budget transmis a Make", () => {
  it("sont exactement ceux que les filtres du scenario comparent", () => {
    expect(LIBELLES_BUDGET_TRANSMIS).toEqual({
      aucun_projet: "Aucun projet déclaré",
      "500k_1m": "500 k€ à 1 M€",
      plus_1m: "Plus d'1 M€",
      "1m_2m": "1 – 2 M€",
      "2m_3m": "2 – 3 M€",
      plus_3m: "Plus de 3 M€",
    });
  });

  it("n'ecrit jamais une tranche avec « a » quand Make attend un tiret", () => {
    // La divergence se reconnait a ce seul caractere : autant la nommer.
    for (const [choix, libelle] of Object.entries(LIBELLES_BUDGET_TRANSMIS)) {
      if (choix === "1m_2m" || choix === "2m_3m") {
        expect(libelle, choix).toContain(" – ");
        expect(libelle, choix).not.toContain(" à ");
      }
    }
  });

  it("couvre les trois branches vivantes du scenario", () => {
    // Les seules tranches qu'un formulaire propose encore aujourd'hui.
    const vivantes = ["aucun_projet", "500k_1m", "plus_1m"];
    for (const choix of vivantes) {
      expect(LIBELLES_BUDGET_TRANSMIS[choix], choix).toBeTruthy();
    }
  });
});
