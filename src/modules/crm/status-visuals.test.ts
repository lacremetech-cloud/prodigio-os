import { describe, expect, it } from "vitest";
import { KANBAN_COLUMNS, PIPELINE_STAGES } from "./labels";
import {
  appointmentVisual,
  cssVarRef,
  eligibilityVisual,
  stageVisual,
  timelineKindVisual,
  TIMELINE_KIND_LABELS,
} from "./status-visuals";

describe("stageVisual — correspondance centralisée des stades", () => {
  it("chaque stade du pipeline a une variable CSS + une icône + un libellé", () => {
    for (const stage of PIPELINE_STAGES) {
      const v = stageVisual(stage);
      expect(v.cssVar).toMatch(/^--crm-/);
      expect(v.icon.length).toBeGreaterThan(0);
      expect(v.label.length).toBeGreaterThan(0);
    }
  });

  it("chaque colonne Kanban a une couleur distincte de « neutre » (sauf perdu qui reste explicite)", () => {
    for (const col of KANBAN_COLUMNS) {
      const v = stageVisual(col);
      expect(v.cssVar).not.toBe("--crm-st-neutre");
    }
  });

  it("un stade inconnu retombe proprement sur neutre", () => {
    expect(stageVisual("inconnu").cssVar).toBe("--crm-st-neutre");
  });

  it("cssVarRef enveloppe en var()", () => {
    expect(cssVarRef("--crm-st-nouveau")).toBe("var(--crm-st-nouveau)");
  });
});

describe("appointmentVisual", () => {
  it("mappe les statuts de rendez-vous", () => {
    expect(appointmentVisual("planifie").cssVar).toBe("--crm-st-rdv_planifie");
    expect(appointmentVisual("realise").cssVar).toBe("--crm-st-rdv_realise");
    expect(appointmentVisual("annule").cssVar).toBe("--crm-st-perdu");
    expect(appointmentVisual("realise").icon.length).toBeGreaterThan(0);
  });
});

describe("eligibilityVisual", () => {
  it("distingue premium, classique, non retenu", () => {
    expect(eligibilityVisual("parcours_premium_prodigio").cssVar).toBe("--crm-st-eligibilite");
    expect(eligibilityVisual("non_retenu").cssVar).toBe("--crm-st-perdu");
  });
});

describe("timelineKindVisual", () => {
  it("chaque type d'événement a une icône + couleur + libellé", () => {
    for (const kind of Object.keys(TIMELINE_KIND_LABELS) as (keyof typeof TIMELINE_KIND_LABELS)[]) {
      const v = timelineKindVisual(kind);
      expect(v.cssVar).toMatch(/^--crm-/);
      expect(v.icon.length).toBeGreaterThan(0);
      expect(TIMELINE_KIND_LABELS[kind].length).toBeGreaterThan(0);
    }
  });

  it("aucune icône n'est un caractère de remplacement cassé", () => {
    for (const kind of Object.keys(TIMELINE_KIND_LABELS) as (keyof typeof TIMELINE_KIND_LABELS)[]) {
      expect(timelineKindVisual(kind).icon).not.toContain("�");
    }
  });
});
