import { describe, expect, it } from "vitest";
import {
  computeAvailableSlots,
  isSlotStillFree,
  zonedWallTimeToUtc,
  zonedWeekday,
} from "./availability";
import { DEFAULT_ESTIMATION_CONFIG, resolveSchedulingConfig } from "./config";

// Config déterministe pour les tests : 09:00–12:00, créneaux 60 min, sans marge,
// délai minimum nul, tous les jours ouvrés.
const cfg = resolveSchedulingConfig({
  workingHours: { start: "09:00", end: "12:00" },
  defaultDurationMinutes: 60,
  slotGranularityMinutes: 60,
  minLeadMinutes: 0,
  marginBeforeMinutes: 0,
  marginAfterMinutes: 0,
  workingDays: [0, 1, 2, 3, 4, 5, 6],
});

// « Maintenant » très en amont pour ne pas filtrer les créneaux par délai.
const NOW = new Date("2026-08-01T00:00:00.000Z");

describe("conversion de fuseau (Europe/Paris)", () => {
  it("l'été, 09:00 Paris = 07:00 UTC (+2)", () => {
    const utc = zonedWallTimeToUtc(2026, 8, 5, 9, 0, "Europe/Paris");
    expect(utc.toISOString()).toBe("2026-08-05T07:00:00.000Z");
  });

  it("l'hiver, 09:00 Paris = 08:00 UTC (+1)", () => {
    const utc = zonedWallTimeToUtc(2026, 1, 15, 9, 0, "Europe/Paris");
    expect(utc.toISOString()).toBe("2026-01-15T08:00:00.000Z");
  });

  it("zonedWeekday : 2026-08-05 est un mercredi (3)", () => {
    expect(zonedWeekday("2026-08-05", "Europe/Paris")).toBe(3);
  });
});

describe("computeAvailableSlots", () => {
  it("génère les créneaux dans les horaires de travail (jour libre)", () => {
    const slots = computeAvailableSlots({ date: "2026-08-05", busy: [], config: cfg, now: NOW });
    // 09:00, 10:00, 11:00 (fin 12:00) → 3 créneaux ; en UTC été = 07/08/09h.
    expect(slots.map((s) => s.start)).toEqual([
      "2026-08-05T07:00:00.000Z",
      "2026-08-05T08:00:00.000Z",
      "2026-08-05T09:00:00.000Z",
    ]);
  });

  it("retire les créneaux qui chevauchent une plage occupée", () => {
    // Occupé 10:00–11:00 Paris (08:00–09:00 UTC été) → retire le créneau de 10:00.
    const slots = computeAvailableSlots({
      date: "2026-08-05",
      busy: [{ start: "2026-08-05T08:00:00.000Z", end: "2026-08-05T09:00:00.000Z" }],
      config: cfg,
      now: NOW,
    });
    expect(slots.map((s) => s.start)).toEqual([
      "2026-08-05T07:00:00.000Z",
      "2026-08-05T09:00:00.000Z",
    ]);
  });

  it("les marges tampon élargissent la zone d'exclusion", () => {
    const withMargin = resolveSchedulingConfig({
      ...cfg,
      marginBeforeMinutes: 30,
      marginAfterMinutes: 30,
    });
    // Occupé 10:00–10:30 Paris (08:00–08:30 UTC). Sans marge, seul le créneau de
    // 09:00 UTC (10:00 Paris) chevauche. Avec 30 min de marge, le créneau de
    // 07:00 UTC (09:00 Paris, fin 10:00 +30 = 10:30) est AUSSI exclu — il ne
    // reste que 09:00 UTC (11:00 Paris).
    const slots = computeAvailableSlots({
      date: "2026-08-05",
      busy: [{ start: "2026-08-05T08:00:00.000Z", end: "2026-08-05T08:30:00.000Z" }],
      config: withMargin,
      now: NOW,
    });
    expect(slots.map((s) => s.start)).toEqual(["2026-08-05T09:00:00.000Z"]);
  });

  it("applique le délai minimum avant rendez-vous", () => {
    // « Maintenant » = 07:30 UTC le jour même → délai 90 min ⇒ pas avant 09:00 UTC.
    const leadCfg = resolveSchedulingConfig({ ...cfg, minLeadMinutes: 90 });
    const slots = computeAvailableSlots({
      date: "2026-08-05",
      busy: [],
      config: leadCfg,
      now: new Date("2026-08-05T07:30:00.000Z"),
    });
    expect(slots.map((s) => s.start)).toEqual(["2026-08-05T09:00:00.000Z"]);
  });

  it("un jour non ouvré ne renvoie aucun créneau", () => {
    const noSunday = resolveSchedulingConfig({ ...cfg, workingDays: [1, 2, 3, 4, 5] });
    // 2026-08-02 est un dimanche.
    expect(
      computeAvailableSlots({ date: "2026-08-02", busy: [], config: noSunday, now: NOW }),
    ).toEqual([]);
  });

  it("respecte la durée demandée si supérieure au défaut", () => {
    const slots = computeAvailableSlots({
      date: "2026-08-05",
      busy: [],
      config: cfg,
      now: NOW,
      durationMinutes: 120,
    });
    // 09:00 (fin 11:00) et 10:00 (fin 12:00) tiennent ; 11:00 (fin 13:00) déborde.
    expect(slots.map((s) => s.start)).toEqual([
      "2026-08-05T07:00:00.000Z",
      "2026-08-05T08:00:00.000Z",
    ]);
  });
});

describe("isSlotStillFree", () => {
  it("vrai si aucun conflit, faux si chevauchement", () => {
    const busy = [{ start: "2026-08-05T08:00:00.000Z", end: "2026-08-05T09:00:00.000Z" }];
    expect(
      isSlotStillFree("2026-08-05T07:00:00.000Z", "2026-08-05T08:00:00.000Z", busy, cfg),
    ).toBe(true);
    expect(
      isSlotStillFree("2026-08-05T08:30:00.000Z", "2026-08-05T09:30:00.000Z", busy, cfg),
    ).toBe(false);
  });

  it("un créneau invalide (fin <= début) est refusé", () => {
    expect(isSlotStillFree("2026-08-05T09:00:00.000Z", "2026-08-05T09:00:00.000Z", [], cfg)).toBe(
      false,
    );
  });
});

describe("configuration par défaut", () => {
  it("expose des valeurs configurables et non des constantes codées en dur", () => {
    expect(DEFAULT_ESTIMATION_CONFIG.timeZone).toBe("Europe/Paris");
    expect(resolveSchedulingConfig({ defaultDurationMinutes: 45 }).defaultDurationMinutes).toBe(45);
    // Les surcharges ne mutent pas la constante partagée.
    expect(DEFAULT_ESTIMATION_CONFIG.defaultDurationMinutes).toBe(90);
  });
});
