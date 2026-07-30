import { describe, expect, it } from "vitest";
import { agingLevel, contactName, initials, timeSince } from "./format";

const NOW = Date.parse("2026-07-30T12:00:00.000Z");

describe("timeSince", () => {
  it("formate les durées en français", () => {
    expect(timeSince("2026-07-30T11:59:40.000Z", NOW)).toBe("à l'instant");
    expect(timeSince("2026-07-30T11:30:00.000Z", NOW)).toBe("il y a 30 min");
    expect(timeSince("2026-07-30T09:00:00.000Z", NOW)).toBe("il y a 3 h");
    expect(timeSince("2026-07-28T12:00:00.000Z", NOW)).toBe("il y a 2 j");
    expect(timeSince(null, NOW)).toBe("—");
  });
});

describe("agingLevel", () => {
  it("classe l'ancienneté", () => {
    expect(agingLevel("2026-07-30T06:00:00.000Z", NOW)).toBe("frais");
    expect(agingLevel("2026-07-28T12:00:00.000Z", NOW)).toBe("tiede");
    expect(agingLevel("2026-07-25T12:00:00.000Z", NOW)).toBe("chaud");
  });
});

describe("contactName / initials", () => {
  it("compose un nom lisible", () => {
    expect(contactName("Marie", "Dupont")).toBe("Marie Dupont");
    expect(contactName(null, "Dupont")).toBe("Dupont");
    expect(contactName(null, null)).toBe("Contact sans nom");
  });
  it("calcule des initiales sûres", () => {
    expect(initials("Marie Dupont")).toBe("MD");
    expect(initials("Marie")).toBe("MA");
    expect(initials("")).toBe("?");
  });
});
