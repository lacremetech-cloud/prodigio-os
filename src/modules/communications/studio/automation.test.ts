import { describe, expect, it } from "vitest";
import { COMMUNICATION_EVENTS } from "../types";
import {
  CONDITION_DEFINITIONS,
  CONDITION_KEYS,
  DRAFT_AUTOMATION_STATUSES,
  MAX_DELAY_MINUTES,
  canRunCustomAutomation,
  conditionDefinition,
  draftAutomationStatusLabels,
  draftAutomationStatusVisual,
  formatDelay,
  isDraftAutomationStatus,
  validateDraftAutomation,
  type DraftAutomation,
} from "./automation";

const VALID: DraftAutomation = {
  automationKey: "relance_estimation",
  name: "Relance après estimation",
  triggerEvent: "estimation_planifiee",
  channel: "email",
  templateKey: "estimation_planifiee",
  templateVersion: 1,
  delayMinutes: 120,
  conditions: { segment: "cible_prodigio_premium", sans_opposition: true },
  status: "brouillon",
};

describe("automatisations personnalisées — brouillon strict", () => {
  it("n'expose AUCUN statut actif : l'activation n'existe pas dans le domaine", () => {
    expect(DRAFT_AUTOMATION_STATUSES).not.toContain("actif");
    expect([...DRAFT_AUTOMATION_STATUSES].sort()).toEqual([
      "archive",
      "brouillon",
      "en_pause",
      "pret_pour_revue",
    ]);
    expect(isDraftAutomationStatus("actif")).toBe(false);
  });

  it("refuse explicitement une tentative d'activation, avec un message lisible", () => {
    const issues = validateDraftAutomation({ ...VALID, status: "actif" as never });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.field).toBe("status");
    expect(issues[0]?.message).toMatch(/ne peut pas être activée/i);
  });

  it("ne peut jamais être exécutée en V1", () => {
    expect(canRunCustomAutomation()).toBe(false);
  });

  it("accepte un brouillon valide sans aucun problème signalé", () => {
    expect(validateDraftAutomation(VALID)).toEqual([]);
  });

  it("n'accepte qu'un déclencheur du catalogue métier existant", () => {
    const issues = validateDraftAutomation({ ...VALID, triggerEvent: "evenement_invente" as never });
    expect(issues.map((i) => i.field)).toContain("triggerEvent");

    for (const event of COMMUNICATION_EVENTS) {
      expect(validateDraftAutomation({ ...VALID, triggerEvent: event })).toEqual([]);
    }
  });

  it("refuse une condition hors catalogue", () => {
    const issues = validateDraftAutomation({
      ...VALID,
      conditions: { humeur_du_jour: "bonne" } as never,
    });
    expect(issues.map((i) => i.field)).toContain("conditions.humeur_du_jour");
  });

  it("refuse une condition dont la valeur n'est pas un scalaire (aucun code arbitraire)", () => {
    const issues = validateDraftAutomation({
      ...VALID,
      conditions: { segment: { $gt: 10 } } as never,
    });
    expect(issues.map((i) => i.field)).toContain("conditions.segment");
  });

  it("borne le délai et refuse une valeur non entière ou hors bornes", () => {
    expect(validateDraftAutomation({ ...VALID, delayMinutes: -1 })).not.toEqual([]);
    expect(validateDraftAutomation({ ...VALID, delayMinutes: MAX_DELAY_MINUTES + 1 })).not.toEqual([]);
    expect(validateDraftAutomation({ ...VALID, delayMinutes: 1.5 })).not.toEqual([]);
    expect(validateDraftAutomation({ ...VALID, delayMinutes: MAX_DELAY_MINUTES })).toEqual([]);
  });

  it("refuse une version de modèle invalide", () => {
    expect(validateDraftAutomation({ ...VALID, templateVersion: 0 })).not.toEqual([]);
    expect(validateDraftAutomation({ ...VALID, templateVersion: null })).toEqual([]);
  });

  it("signale TOUS les problèmes d'un coup, jamais seulement le premier", () => {
    const issues = validateDraftAutomation({
      automationKey: "X",
      name: "a",
      delayMinutes: -5,
    });
    expect(issues.length).toBeGreaterThanOrEqual(4);
  });
});

describe("catalogue de conditions", () => {
  it("est fermé et cohérent entre la liste de clés et les définitions", () => {
    expect(CONDITION_DEFINITIONS.map((c) => c.key).sort()).toEqual([...CONDITION_KEYS].sort());
  });

  it("documente ce que chaque condition vérifie", () => {
    for (const definition of CONDITION_DEFINITIONS) {
      expect(definition.label.length).toBeGreaterThan(2);
      expect(definition.describes.length).toBeGreaterThan(10);
      expect(conditionDefinition(definition.key)).toBe(definition);
    }
    expect(conditionDefinition("inconnue")).toBeNull();
  });
});

describe("présentation", () => {
  it("associe à chaque statut un libellé ET une icône (la couleur n'est jamais seule)", () => {
    for (const status of DRAFT_AUTOMATION_STATUSES) {
      expect(draftAutomationStatusLabels[status]).toBeTruthy();
      const visual = draftAutomationStatusVisual(status);
      expect(visual.icon).toBeTruthy();
      expect(visual.cssVar.startsWith("--")).toBe(true);
    }
  });

  it("formate le délai de façon lisible", () => {
    expect(formatDelay(0)).toBe("Immédiat");
    expect(formatDelay(-10)).toBe("Immédiat");
    expect(formatDelay(30)).toBe("30 min");
    expect(formatDelay(120)).toBe("2 h");
    expect(formatDelay(90)).toBe("1 h 30 min");
    expect(formatDelay(2880)).toBe("2 j");
  });
});
