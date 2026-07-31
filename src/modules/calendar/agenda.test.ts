import { describe, expect, it } from "vitest";
import {
  addDaysToKey,
  applyAgendaFilters,
  dayKeyOf,
  dayLayout,
  durationMinutes,
  EMPTY_AGENDA_FILTERS,
  groupByDay,
  isSameMonth,
  monthGridKeys,
  startOfWeekKey,
  weekdayOfKey,
  weekKeys,
  zonedParts,
  type AgendaEvent,
} from "./agenda";

const TZ = "Europe/Paris";

function evt(over: Partial<AgendaEvent> = {}): AgendaEvent {
  return {
    id: over.id ?? "a1",
    opportunityId: over.opportunityId ?? "opp",
    agentUserId: over.agentUserId ?? "agent-1",
    agentName: over.agentName ?? "Agent Un",
    contactLabel: over.contactLabel ?? "Marie Dupont",
    city: over.city ?? "Annecy",
    address: over.address ?? "3 rue du Lac",
    ownerPhone: over.ownerPhone ?? null,
    ownerEmail: over.ownerEmail ?? null,
    startsAt: over.startsAt ?? "2026-07-15T12:00:00.000Z",
    endsAt: over.endsAt ?? "2026-07-15T13:30:00.000Z",
    timezone: over.timezone ?? TZ,
    status: over.status ?? "planifie",
    googleHtmlLink: over.googleHtmlLink ?? null,
    kind: "estimation",
  };
}

describe("zonedParts / dayKeyOf — fuseau Europe/Paris", () => {
  it("été (CEST = UTC+2)", () => {
    const p = zonedParts("2026-07-15T12:00:00.000Z", TZ)!;
    expect(p.hour).toBe(14);
    expect(p.dayKey).toBe("2026-07-15");
  });

  it("hiver (CET = UTC+1)", () => {
    const p = zonedParts("2026-01-15T12:00:00.000Z", TZ)!;
    expect(p.hour).toBe(13);
    expect(p.dayKey).toBe("2026-01-15");
  });

  it("passage à l'heure d'été (29 mars 2026, 01:00 UTC → 03:00 local)", () => {
    // Avant le saut : 00:30 UTC = 01:30 CET.
    expect(zonedParts("2026-03-29T00:30:00.000Z", TZ)!.hour).toBe(1);
    // Après le saut : 01:30 UTC = 03:30 CEST (02:00 n'existe pas localement).
    expect(zonedParts("2026-03-29T01:30:00.000Z", TZ)!.hour).toBe(3);
  });

  it("passage à l'heure d'hiver (25 octobre 2026)", () => {
    // Avant : 00:30 UTC = 02:30 CEST. Après : 01:30 UTC = 02:30 CET (heure répétée).
    expect(zonedParts("2026-10-25T00:30:00.000Z", TZ)!.hour).toBe(2);
    expect(zonedParts("2026-10-25T01:30:00.000Z", TZ)!.hour).toBe(2);
  });

  it("weekday : 0 = lundi", () => {
    // 2026-07-13 est un lundi.
    expect(zonedParts("2026-07-13T09:00:00.000Z", TZ)!.weekday).toBe(0);
    // 2026-07-19 est un dimanche.
    expect(zonedParts("2026-07-19T09:00:00.000Z", TZ)!.weekday).toBe(6);
  });
});

describe("arithmétique de clés (indépendante du fuseau / DST)", () => {
  it("addDaysToKey traverse un mois", () => {
    expect(addDaysToKey("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDaysToKey("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("addDaysToKey traverse le passage à l'heure d'été sans dérive", () => {
    // +1 jour à travers le 29 mars donne bien le 30 mars.
    expect(addDaysToKey("2026-03-29", 1)).toBe("2026-03-30");
    expect(addDaysToKey("2026-03-28", 7)).toBe("2026-04-04");
  });

  it("weekdayOfKey : lundi = 0", () => {
    expect(weekdayOfKey("2026-07-13")).toBe(0);
    expect(weekdayOfKey("2026-07-19")).toBe(6);
  });

  it("startOfWeekKey ramène au lundi", () => {
    expect(startOfWeekKey("2026-07-15")).toBe("2026-07-13"); // mercredi → lundi
    expect(startOfWeekKey("2026-07-13")).toBe("2026-07-13");
  });

  it("weekKeys : 7 jours lundi → dimanche", () => {
    const keys = weekKeys("2026-07-15");
    expect(keys).toHaveLength(7);
    expect(keys[0]).toBe("2026-07-13");
    expect(keys[6]).toBe("2026-07-19");
  });

  it("monthGridKeys : 42 clés, aligné lundi", () => {
    const keys = monthGridKeys("2026-07-15");
    expect(keys).toHaveLength(42);
    expect(weekdayOfKey(keys[0]!)).toBe(0); // commence un lundi
    // juillet 2026 commence un mercredi → la grille démarre le lundi 29 juin.
    expect(keys[0]).toBe("2026-06-29");
    expect(keys.some((k) => k === "2026-07-01")).toBe(true);
    expect(keys.some((k) => k === "2026-07-31")).toBe(true);
  });

  it("isSameMonth", () => {
    expect(isSameMonth("2026-07-01", "2026-07-15")).toBe(true);
    expect(isSameMonth("2026-06-29", "2026-07-15")).toBe(false);
  });
});

describe("groupByDay — rendez-vous traversant une limite de journée", () => {
  it("un événement est rattaché à son jour de DÉBUT (jamais dupliqué)", () => {
    // Début 23:30 Paris (21:30 UTC), fin 01:30 Paris le lendemain (23:30 UTC).
    const e = evt({ startsAt: "2026-07-15T21:30:00.000Z", endsAt: "2026-07-15T23:30:00.000Z" });
    expect(dayKeyOf(e.startsAt, TZ)).toBe("2026-07-15");
    expect(dayKeyOf(e.endsAt, TZ)).toBe("2026-07-16");
    const map = groupByDay([e], TZ);
    expect(map.get("2026-07-15")).toHaveLength(1);
    expect(map.get("2026-07-16")).toBeUndefined(); // non dupliqué
  });

  it("trie les événements par heure de début dans chaque jour", () => {
    const a = evt({ id: "late", startsAt: "2026-07-15T16:00:00.000Z" });
    const b = evt({ id: "early", startsAt: "2026-07-15T08:00:00.000Z" });
    const map = groupByDay([a, b], TZ);
    expect(map.get("2026-07-15")!.map((x) => x.id)).toEqual(["early", "late"]);
  });
});

describe("dayLayout — position dans la grille horaire", () => {
  it("positionne l'événement selon son heure de début (Paris)", () => {
    const e = evt({ startsAt: "2026-07-15T12:00:00.000Z", endsAt: "2026-07-15T13:30:00.000Z" }); // 14:00–15:30
    const layout = dayLayout(e, "2026-07-15", TZ)!;
    expect(layout.topPct).toBeCloseTo((14 * 60) / 1440 * 100, 1);
  });

  it("borne un événement qui déborde sur le lendemain, et ne s'affiche pas le jour suivant", () => {
    const e = evt({ startsAt: "2026-07-15T21:30:00.000Z", endsAt: "2026-07-15T23:30:00.000Z" });
    const day1 = dayLayout(e, "2026-07-15", TZ)!;
    expect(day1.topPct + day1.heightPct).toBeLessThanOrEqual(100.01);
    expect(dayLayout(e, "2026-07-16", TZ)).toBeNull();
  });
});

describe("applyAgendaFilters", () => {
  const now = new Date("2026-07-15T12:00:00.000Z").getTime();
  const past = evt({ id: "past", startsAt: "2026-07-01T09:00:00.000Z", contactLabel: "Paul Ancien" });
  const future = evt({ id: "future", startsAt: "2026-07-20T09:00:00.000Z", city: "Chamonix", agentUserId: "agent-2", status: "confirme" });
  const events = [past, future];

  it("sans filtre : tout est renvoyé", () => {
    expect(applyAgendaFilters(events, EMPTY_AGENDA_FILTERS, now)).toHaveLength(2);
  });

  it("filtre agent", () => {
    const r = applyAgendaFilters(events, { ...EMPTY_AGENDA_FILTERS, agentUserId: "agent-2" }, now);
    expect(r.map((e) => e.id)).toEqual(["future"]);
  });

  it("filtre statut", () => {
    const r = applyAgendaFilters(events, { ...EMPTY_AGENDA_FILTERS, status: "confirme" }, now);
    expect(r.map((e) => e.id)).toEqual(["future"]);
  });

  it("filtre temporel à venir / passés", () => {
    expect(applyAgendaFilters(events, { ...EMPTY_AGENDA_FILTERS, temporal: "a_venir" }, now).map((e) => e.id)).toEqual(["future"]);
    expect(applyAgendaFilters(events, { ...EMPTY_AGENDA_FILTERS, temporal: "passes" }, now).map((e) => e.id)).toEqual(["past"]);
  });

  it("recherche (propriétaire / ville, insensible à la casse)", () => {
    expect(applyAgendaFilters(events, { ...EMPTY_AGENDA_FILTERS, search: "chamonix" }, now).map((e) => e.id)).toEqual(["future"]);
    expect(applyAgendaFilters(events, { ...EMPTY_AGENDA_FILTERS, search: "paul" }, now).map((e) => e.id)).toEqual(["past"]);
  });
});

describe("durationMinutes", () => {
  it("calcule la durée en minutes", () => {
    expect(durationMinutes("2026-07-15T12:00:00.000Z", "2026-07-15T13:30:00.000Z")).toBe(90);
  });
  it("ne renvoie jamais de valeur négative", () => {
    expect(durationMinutes("2026-07-15T13:30:00.000Z", "2026-07-15T12:00:00.000Z")).toBe(0);
  });
});
