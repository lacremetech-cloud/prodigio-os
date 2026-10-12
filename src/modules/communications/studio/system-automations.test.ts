import { describe, expect, it } from "vitest";
import { EVENT_DEFINITIONS, GOOGLE_COVERED_EVENTS } from "../events";
import { COMMUNICATION_EVENTS } from "../types";
import {
  SYSTEM_AUTOMATIONS,
  SYSTEM_COVERED_EVENTS,
  isCoveredBySystem,
  systemAutomationFor,
} from "./system-automations";

/**
 * Les automatisations système ne sont pas des données : elles sont DÉRIVÉES du
 * catalogue d'événements existant. Ces tests refusent toute divergence, et donc
 * tout doublon : un second déclencheur ou un second message pour un événement
 * déjà couvert ne peut pas apparaître par ce chemin.
 */
describe("automatisations système", () => {
  it("projette exactement les six événements existants, sans en inventer", () => {
    expect(SYSTEM_AUTOMATIONS).toHaveLength(6);
    expect(SYSTEM_AUTOMATIONS).toHaveLength(EVENT_DEFINITIONS.length);
    expect([...SYSTEM_COVERED_EVENTS].sort()).toEqual([...COMMUNICATION_EVENTS].sort());
  });

  it("dérive chaque champ du catalogue : aucune valeur n'est ressaisie", () => {
    for (const definition of EVENT_DEFINITIONS) {
      const projected = systemAutomationFor(definition.event);
      expect(projected).not.toBeNull();
      expect(projected?.templateKey).toBe(definition.templateKey);
      expect(projected?.channel).toBe(definition.channel);
      expect(projected?.category).toBe(definition.category);
      expect(projected?.recipient).toBe(definition.recipient);
      expect(projected?.trigger).toBe(definition.trigger);
      expect(projected?.idempotency).toBe(definition.idempotency);
      expect(projected?.noMessageWhen).toEqual(definition.noMessageWhen);
    }
  });

  it("marque chaque automatisation système en LECTURE SEULE", () => {
    for (const automation of SYSTEM_AUTOMATIONS) {
      expect(automation.readOnly).toBe(true);
    }
  });

  it("n'ouvre aucune automatisation système marketing", () => {
    for (const automation of SYSTEM_AUTOMATIONS) {
      expect(automation.category).toBe("transactionnel");
    }
  });

  it("signale les événements couverts par Google, sans inclure le rappel", () => {
    const covered = SYSTEM_AUTOMATIONS.filter((a) => a.googleCovered).map((a) => a.event);
    expect([...covered].sort()).toEqual([...GOOGLE_COVERED_EVENTS].sort());
    expect(covered).not.toContain("estimation_rappel");
  });

  it("détecte qu'un couple (événement, canal) est déjà couvert — garde anti-doublon", () => {
    expect(isCoveredBySystem("demande_mandat_enregistree", "email")).toBe(true);
    // Même événement, autre canal : le système ne le couvre pas.
    expect(isCoveredBySystem("demande_mandat_enregistree", "sms")).toBe(false);
    expect(isCoveredBySystem("evenement_inexistant", "email")).toBe(false);
  });

  it("utilise une clé préfixée, jamais confondable avec une clé saisie", () => {
    for (const automation of SYSTEM_AUTOMATIONS) {
      expect(automation.key.startsWith("systeme_")).toBe(true);
    }
  });
});
