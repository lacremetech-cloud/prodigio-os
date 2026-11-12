import { describe, expect, it } from "vitest";
import {
  etatCourant,
  etatDeLaVersion,
  historique,
  jourParis,
  versionEnVigueur,
  versionsAVenir,
} from "./versions";

function v(id: string, date_effet: string, saisi_le: string) {
  return { id, date_effet, saisi_le };
}

const JOUR = "2026-11-12";

describe("la version en vigueur", () => {
  const initiale = v("a", "2026-11-12", "2026-11-12T09:00:00Z");
  const corrigee = v("b", "2026-11-12", "2026-11-12T10:00:00Z");
  const aVenir = v("c", "2027-01-01", "2026-11-12T11:00:00Z");
  const ancienne = v("d", "2026-10-01", "2026-11-12T12:00:00Z");

  it("une correction du jour l'emporte sur la saisie qu'elle corrige", () => {
    expect(versionEnVigueur([initiale, corrigee], JOUR)?.id).toBe("b");
    expect(versionEnVigueur([corrigee, initiale], JOUR)?.id).toBe("b");
  });

  it("une version datée de demain ne s'applique pas aujourd'hui", () => {
    expect(versionEnVigueur([initiale, aVenir], JOUR)?.id).toBe("a");
    expect(versionEnVigueur([initiale, aVenir], "2027-01-01")?.id).toBe("c");
  });

  it("une version saisie après coup avec une date d'effet plus ancienne ne remplace pas la plus récente", () => {
    // Elle complète l'historique ; elle ne réécrit pas le présent.
    expect(versionEnVigueur([initiale, ancienne], JOUR)?.id).toBe("a");
    expect(versionEnVigueur([initiale, ancienne], "2026-10-15")?.id).toBe("d");
  });

  it("sans version applicable : rien, plutôt qu'une version inventée", () => {
    expect(versionEnVigueur([aVenir], JOUR)).toBeNull();
    expect(versionEnVigueur([], JOUR)).toBeNull();
  });

  it("les versions à venir, de la plus proche à la plus lointaine", () => {
    const plusLoin = v("e", "2027-06-01", "2026-11-12T08:00:00Z");
    expect(versionsAVenir([plusLoin, initiale, aVenir], JOUR).map((x) => x.id)).toEqual(["c", "e"]);
  });

  it("chaque version de l'historique sait ce qu'elle est devenue", () => {
    const toutes = [initiale, corrigee, aVenir, ancienne];
    const courante = versionEnVigueur(toutes, JOUR);
    expect(historique(toutes).map((x) => [x.id, etatDeLaVersion(x, courante, JOUR)])).toEqual([
      ["c", "a_venir"],
      ["b", "en_vigueur"],
      ["a", "remplacee"],
      ["d", "remplacee"],
    ]);
  });
});

describe("l'état courant d'un lot", () => {
  it("est le dernier saisi", () => {
    const etats = [
      { id: "1", saisi_le: "2026-11-12T09:00:00Z" },
      { id: "2", saisi_le: "2026-12-15T09:00:00Z" },
      { id: "3", saisi_le: "2026-11-20T09:00:00Z" },
    ];
    expect(etatCourant(etats)?.id).toBe("2");
    expect(etatCourant([])).toBeNull();
  });
});

describe("le jour de l'agence", () => {
  it("est celui de Paris, pas celui du serveur en UTC", () => {
    // 23 h 30 UTC le 12 novembre = 0 h 30 le 13 à Paris (heure d'hiver).
    expect(jourParis(new Date("2026-11-12T23:30:00Z"))).toBe("2026-11-13");
    expect(jourParis(new Date("2026-11-12T10:00:00Z"))).toBe("2026-11-12");
    // Heure d'été : 22 h 30 UTC le 30 juin = 0 h 30 le 1er juillet.
    expect(jourParis(new Date("2026-06-30T22:30:00Z"))).toBe("2026-07-01");
  });
});
