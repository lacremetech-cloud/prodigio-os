import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { adressePeriode, lirePeriode, PERIODE_PAR_DEFAUT } from "./periode-choisie";

const JOUR = "2026-11-23";

describe("la période lue dans l'adresse, jamais crue sur parole", () => {
  it("une période proposée", () => {
    expect(lirePeriode({ periode: "7_derniers_jours" }, JOUR)).toEqual({
      choix: { type: "proposee", periode: "7_derniers_jours" },
      corrigee: false,
    });
  });

  it("rien : la période par défaut, sans le signaler", () => {
    expect(lirePeriode({}, JOUR)).toEqual({ choix: { type: "proposee", periode: PERIODE_PAR_DEFAUT }, corrigee: false });
  });

  it("des dates au choix, valides et dans l'ordre, jusqu'à aujourd'hui", () => {
    expect(lirePeriode({ du: "2026-11-01", au: "2026-11-15" }, JOUR).choix).toEqual({ type: "dates", debut: "2026-11-01", fin: "2026-11-15" });
    expect(lirePeriode({ du: "2026-11-23", au: "2026-11-23" }, JOUR).corrigee).toBe(false);
  });

  it("l'illisible retombe sur la période par défaut, et le dit", () => {
    for (const p of [
      { periode: "hier; drop table" },
      { du: "2026-11-15", au: "2026-11-01" },
      { du: "2026-02-30", au: "2026-03-01" },
      { du: "2026-11-01", au: "2026-11-24" },
      { du: "2026-11-01" },
      { du: ["2026-11-01", "x"], au: "pas une date" },
    ]) {
      expect(lirePeriode(p, JOUR)).toEqual({ choix: { type: "proposee", periode: PERIODE_PAR_DEFAUT }, corrigee: true });
    }
  });

  it("l'adresse d'une période se relit à l'identique", () => {
    expect(adressePeriode("/crm/pilotage", { type: "proposee", periode: "ce_mois" })).toBe("/crm/pilotage?periode=ce_mois");
    const a = adressePeriode("", { type: "dates", debut: "2026-11-01", fin: "2026-11-15" });
    expect(lirePeriode(Object.fromEntries(new URLSearchParams(a.slice(1))), JOUR).choix).toEqual({
      type: "dates",
      debut: "2026-11-01",
      fin: "2026-11-15",
    });
  });
});

/** Toutes les pages du pilotage, lues comme du texte. */
function pages(dossier: string): { fichier: string; code: string }[] {
  const out: { fichier: string; code: string }[] = [];
  for (const e of readdirSync(dossier)) {
    const chemin = join(dossier, e);
    if (statSync(chemin).isDirectory()) out.push(...pages(chemin));
    else if (e === "page.tsx") out.push({ fichier: chemin, code: readFileSync(chemin, "utf8") });
  }
  return out;
}

describe("chaque page du pilotage vérifie le rôle administrateur avant de lire", () => {
  const toutes = pages(join(process.cwd(), "src", "app", "crm", "pilotage"));

  it("on lit bien les pages (vue générale, onglet d'un bien, saisies, Meta)", () => {
    expect(toutes.length).toBeGreaterThanOrEqual(5);
  });

  for (const { fichier, code } of toutes) {
    it(fichier.split("/src/app/")[1]!, () => {
      const garde = code.indexOf("if (!canPiloter(session.roles)) return <AccesReserve />;");
      expect(garde).toBeGreaterThan(-1);
      for (const lecture of ["lireTableauPilotage(", "lirePilotage(", "lireTableauMeta("]) {
        const i = code.indexOf(lecture);
        if (i > -1) expect(i, `${lecture} avant le contrôle du rôle`).toBeGreaterThan(garde);
      }
    });
  }
});
