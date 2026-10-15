import { describe, expect, it } from "vitest";
import {
  agingLevel,
  contactName,
  formatDateCourte,
  formatDateTime,
  initials,
  timeSince,
} from "./format";

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

describe("le fuseau de l'agence", () => {
  /* La fiche est rendue sur le serveur, dont l'horloge est en UTC ; le panneau
     dans le navigateur du commercial, à Paris. Sans fuseau fixé, le MÊME appel
     s'affichait « 18:38 » d'un côté et « 20:38 » de l'autre. */
  const APPEL_UTC = "2026-10-14T18:38:00.000Z";

  it("affiche l'heure de Paris, quelle que soit l'horloge de la machine", () => {
    expect(formatDateTime(APPEL_UTC)).toContain("20:38");
    expect(formatDateCourte(APPEL_UTC)).toContain("20:38");
  });

  it("donne la même heure à la fiche et au panneau", () => {
    const heure = (s: string) => s.match(/\d{2}:\d{2}/)?.[0];
    expect(heure(formatDateTime(APPEL_UTC))).toBe(heure(formatDateCourte(APPEL_UTC)));
  });

  it("suit l'heure d'hiver comme l'heure d'été", () => {
    /* En janvier, Paris est à UTC+1 et non +2 : une constante « +2 h » aurait
       été fausse la moitié de l'année. */
    expect(formatDateTime("2026-01-14T18:38:00.000Z")).toContain("19:38");
  });
});
