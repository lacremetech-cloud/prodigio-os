import { describe, expect, it, vi } from "vitest";
import { UNSETTLED_LEGAL_BASIS } from "../policy";
import { SYNTHETIC_RECIPIENTS, syntheticRecipient } from "./fixtures";
import { simulateWorkflow, type SimulationInput, type SimulationTemplate } from "./simulator";

/**
 * Le simulateur doit démontrer une décision **sans jamais** produire d'effet :
 * aucune écriture, aucun appel réseau, aucune donnée réelle.
 */

const TEMPLATE: SimulationTemplate = {
  templateKey: "mandat_demande_accusee",
  version: 1,
  status: "actif",
  channel: "email",
  category: "transactionnel",
  subject: "Votre demande a bien été reçue",
  body: "Bonjour {{prenom}}, votre bien à {{ville}} est bien enregistré.",
  bodyFormat: "markdown",
  allowedVariables: ["prenom", "nom", "ville"],
};

function input(overrides: Partial<SimulationInput> = {}): SimulationInput {
  return {
    recipientId: "fictif_nominal",
    event: "demande_mandat_enregistree",
    channel: "email",
    category: "transactionnel",
    delayMinutes: 0,
    conditions: {},
    template: TEMPLATE,
    dispatchEnabled: true,
    ...overrides,
  };
}

describe("simulateur — étanchéité", () => {
  it("refuse toute entrée qui n'est pas un destinataire fictif", () => {
    const result = simulateWorkflow(
      input({ recipientId: "e1c1f2a4-0000-4000-8000-000000000000" }),
    );
    expect(result.ran).toBe(false);
    expect(result.decision).toBe("refuse");
    expect(result.reason).toMatch(/destinataires fictifs/i);
    expect(result.steps).toEqual([]);
  });

  it("marque TOUJOURS son résultat comme synthétique", () => {
    expect(simulateWorkflow(input()).synthetic).toBe(true);
    expect(simulateWorkflow(input({ recipientId: "inexistant" })).synthetic).toBe(true);
  });

  it("n'émet AUCUN appel réseau : `fetch` n'est jamais invoqué", () => {
    const spy = vi.spyOn(globalThis, "fetch");
    for (const recipient of SYNTHETIC_RECIPIENTS) {
      simulateWorkflow(input({ recipientId: recipient.id }));
    }
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("est déterministe : deux exécutions identiques donnent le même résultat", () => {
    const a = simulateWorkflow(input());
    const b = simulateWorkflow(input());
    expect(a).toEqual(b);
  });
});

describe("simulateur — déroulé complet", () => {
  it("expose les dix étapes attendues, dans l'ordre", () => {
    const result = simulateWorkflow(input());
    expect(result.steps.map((s) => s.key)).toEqual([
      "evenement",
      "conditions",
      "eligibilite",
      "base_legale",
      "oppositions",
      "canal",
      "delai",
      "modele",
      "variables",
      "decision",
    ]);
  });

  it("prépare un message lorsque tout est réuni, sans jamais l'envoyer", () => {
    const result = simulateWorkflow(input());
    expect(result.decision).toBe("prepare");
    expect(result.blockedReason).toBeNull();
    expect(result.renderedBody).toContain("Camille");
    expect(result.steps.at(-1)?.detail).toMatch(/aucun fournisseur n'est contacté/i);
  });

  it("constate la base légale sans jamais la déclarer validée", () => {
    const step = simulateWorkflow(input()).steps.find((s) => s.key === "base_legale");
    expect(step?.detail).toMatch(/non tranchée/i);
    expect(step?.items?.join(" ")).toContain(UNSETTLED_LEGAL_BASIS);
    expect(step?.detail).not.toMatch(/conforme/i);
  });
});

describe("simulateur — motifs de blocage", () => {
  it("bloque quand aucune coordonnée n'existe pour le canal", () => {
    const result = simulateWorkflow(input({ recipientId: "fictif_sans_coordonnee" }));
    expect(result.decision).toBe("bloque");
    expect(result.blockedReason).toBe("coordonnee_absente");
    expect(result.reason).toMatch(/coordonnée/i);
  });

  it("fait prévaloir « ne plus contacter » sur toute autre règle", () => {
    const result = simulateWorkflow(input({ recipientId: "fictif_ne_plus_contacter" }));
    expect(result.blockedReason).toBe("ne_plus_contacter");
  });

  it("fait prévaloir une opposition GLOBALE sur tous les canaux et toutes les catégories", () => {
    for (const channel of ["email", "sms"] as const) {
      for (const category of ["transactionnel", "marketing"] as const) {
        const result = simulateWorkflow(
          input({
            recipientId: "fictif_opposition_globale",
            channel,
            category,
            template: { ...TEMPLATE, channel, category },
          }),
        );
        expect(result.decision).toBe("bloque");
        expect(result.blockedReason).toBe("opposition_active");
      }
    }
  });

  it("signale l'opposition globale comme prévalant, dans l'étape dédiée", () => {
    const step = simulateWorkflow(input({ recipientId: "fictif_opposition_globale" })).steps.find(
      (s) => s.key === "oppositions",
    );
    expect(step?.outcome).toBe("bloquant");
    expect(step?.detail).toMatch(/globale/i);
  });

  it("refuse le marketing tant que la base légale n'est pas tranchée", () => {
    const result = simulateWorkflow(
      input({
        category: "marketing",
        template: { ...TEMPLATE, category: "marketing" },
      }),
    );
    expect(result.blockedReason).toBe("base_legale_insuffisante");
  });

  it("bloque sur un modèle absent, puis sur un modèle non actif", () => {
    expect(simulateWorkflow(input({ template: null })).blockedReason).toBe("modele_absent");
    expect(
      simulateWorkflow(input({ template: { ...TEMPLATE, status: "brouillon" } })).blockedReason,
    ).toBe("modele_inactif");
  });

  it("bloque lorsque Google Calendar couvre déjà l'envoi (aucun doublon)", () => {
    expect(simulateWorkflow(input({ googleCovers: true })).blockedReason).toBe(
      "google_couvre_l_envoi",
    );
  });

  it("bloque quand l'envoi réel est désactivé", () => {
    expect(simulateWorkflow(input({ dispatchEnabled: false })).blockedReason).toBe(
      "envoi_desactive",
    );
  });

  it("bloque, avec les variables en cause, quand une valeur manque", () => {
    const result = simulateWorkflow(input({ recipientId: "fictif_variable_manquante" }));
    expect(result.decision).toBe("bloque");
    expect(result.reason).toMatch(/\{\{ville\}\}/);
    expect(result.renderedBody).toBeNull();
  });

  it("bloque quand une condition déclarée n'est pas remplie, en disant laquelle", () => {
    const result = simulateWorkflow(input({ conditions: { segment: "hors_cible_premium" } }));
    expect(result.decision).toBe("bloque");
    expect(result.reason).toMatch(/conditions/i);
    const step = result.steps.find((s) => s.key === "conditions");
    expect(step?.items?.join(" ")).toMatch(/non remplie/);
  });

  it("évalue « aucun message récent » comme un seuil, pas une égalité", () => {
    // Le destinataire nominal porte 72 h sans message.
    expect(
      simulateWorkflow(input({ conditions: { sans_message_recent: 48 } })).decision,
    ).toBe("prepare");
    expect(
      simulateWorkflow(input({ conditions: { sans_message_recent: 96 } })).decision,
    ).toBe("bloque");
  });
});

describe("jeu de données du simulateur", () => {
  it("n'utilise que des coordonnées non routables et explicitement fictives", () => {
    for (const recipient of SYNTHETIC_RECIPIENTS) {
      expect(recipient.displayName).toContain("FICTIF");
      if (recipient.email) expect(recipient.email.endsWith(".invalid")).toBe(true);
      // Plage française réservée à la fiction (+336 39 98 xx xx).
      if (recipient.phone) expect(recipient.phone.startsWith("+336399800")).toBe(true);
    }
  });

  it("couvre au moins un cas nominal et chaque grand motif de blocage", () => {
    for (const id of [
      "fictif_nominal",
      "fictif_sans_coordonnee",
      "fictif_opposition_email",
      "fictif_opposition_globale",
      "fictif_ne_plus_contacter",
      "fictif_variable_manquante",
    ]) {
      expect(syntheticRecipient(id)).not.toBeNull();
    }
  });

  it("ne présume jamais une base légale tranchée", () => {
    for (const recipient of SYNTHETIC_RECIPIENTS) {
      for (const privacy of recipient.privacy) {
        expect(privacy.legalBasis).toBe(UNSETTLED_LEGAL_BASIS);
      }
    }
  });
});
