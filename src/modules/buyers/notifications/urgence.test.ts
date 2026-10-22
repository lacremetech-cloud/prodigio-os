import { describe, expect, it } from "vitest";

import {
  BUDGETS_AU_DESSUS_1M,
  BUDGETS_AU_DESSUS_1M_SELON_LE_CRM,
  dansLesHoraires,
  heureParis,
  meriteAlerteImmediate,
} from "./urgence";

/** 8h30 heure de Paris, en heure d'ETE (UTC+2) : 6h30 UTC. */
const ETE_8H30 = new Date("2026-10-20T06:30:00Z");
/** 8h30 heure de Paris, en heure d'HIVER (UTC+1) : 7h30 UTC. */
const HIVER_8H30 = new Date("2026-11-15T07:30:00Z");

describe("la liste des budgets prioritaires", () => {
  it("ne derive pas du filtre « Plus d'1 M€ » du CRM", () => {
    expect([...BUDGETS_AU_DESSUS_1M].sort()).toEqual(
      [...BUDGETS_AU_DESSUS_1M_SELON_LE_CRM].sort(),
    );
  });

  it("n'est pas vide — une liste vide couperait toutes les alertes en silence", () => {
    expect(BUDGETS_AU_DESSUS_1M.length).toBeGreaterThan(0);
  });
});

describe("l'heure de Paris", () => {
  it("vaut 8h quand il est 6h30 UTC en heure d'ete", () => {
    expect(heureParis(ETE_8H30)).toBe(8);
  });

  it("vaut encore 8h quand il est 7h30 UTC en heure d'hiver", () => {
    expect(heureParis(HIVER_8H30)).toBe(8);
  });

  it("ouvre a 8h et ferme a 19h, dans les deux saisons", () => {
    expect(dansLesHoraires(ETE_8H30)).toBe(true);
    expect(dansLesHoraires(HIVER_8H30)).toBe(true);
    // 7h30 Paris en hiver = 6h30 UTC.
    expect(dansLesHoraires(new Date("2026-11-15T06:30:00Z"))).toBe(false);
    // 19h00 Paris en hiver = 18h00 UTC : ferme.
    expect(dansLesHoraires(new Date("2026-11-15T18:00:00Z"))).toBe(false);
    // 18h59 Paris en hiver = 17h59 UTC : ouvert.
    expect(dansLesHoraires(new Date("2026-11-15T17:59:00Z"))).toBe(true);
  });
});

describe("la politique « tous »", () => {
  it("alerte meme un budget modeste au milieu de la nuit", () => {
    const nuit = new Date("2026-10-20T01:00:00Z");
    expect(meriteAlerteImmediate({ budgetChoice: "500k_1m", recuLe: nuit }, "tous")).toBe(true);
    expect(meriteAlerteImmediate({ budgetChoice: null, recuLe: nuit }, "tous")).toBe(true);
  });
});

describe("la politique « urgents »", () => {
  it("alerte un budget au-dessus d'1 M€ pendant les horaires", () => {
    for (const code of BUDGETS_AU_DESSUS_1M) {
      expect(meriteAlerteImmediate({ budgetChoice: code, recuLe: ETE_8H30 }, "urgents")).toBe(true);
    }
  });

  it("n'alerte pas la nuit, meme au-dessus d'1 M€", () => {
    const nuit = new Date("2026-10-20T01:00:00Z"); // 3h00 Paris
    expect(meriteAlerteImmediate({ budgetChoice: "plus_1m", recuLe: nuit }, "urgents")).toBe(false);
  });

  it("n'alerte pas les budgets sous le million, meme en pleine journee", () => {
    expect(meriteAlerteImmediate({ budgetChoice: "500k_1m", recuLe: ETE_8H30 }, "urgents")).toBe(
      false,
    );
    expect(meriteAlerteImmediate({ budgetChoice: "aucun_projet", recuLe: ETE_8H30 }, "urgents")).toBe(
      false,
    );
  });

  it("n'alerte pas un depot sans code budget — l'ancien tunnel passe par le recapitulatif", () => {
    expect(meriteAlerteImmediate({ budgetChoice: null, recuLe: ETE_8H30 }, "urgents")).toBe(false);
  });
});
