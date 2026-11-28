import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BUDGET_CHOICES_PROPOSES, BUYER_BUDGET_CHOICES, budgetChoiceBounds } from "./universal";
import {
  ciblesPossibles,
  erreurDeLaCible,
  erreurDesTranches,
  erreurDuReglage,
  lireTranchesDuFormulaire,
  reponsesDuFormulaire,
  TRANCHES_BUDGET,
  TRANCHES_PAR_DEFAUT,
  trierTranches,
  type TrancheBudget,
} from "./tranches";

/**
 * LES TRANCHES D'UN FORMULAIRE : la règle, ici et en base.
 *
 * La base (`public.pilotage_budget_erreur`, migration 20261128150000) fait
 * autorité ; le module la reprend pour répondre avant d'écrire, et pour que le
 * formulaire public retombe sur ses réponses d'aujourd'hui si un réglage est
 * illisible. Ces tests tiennent les deux ensemble.
 */

const MIGRATION = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20261128150000_budget_du_formulaire_par_bien.sql"),
  "utf8",
);

const M = 100_000_000; // 1 M€ en centimes

describe("l'échelle commune", () => {
  it("toutes les réponses du formulaire sauf « pas de projet », chacune avec une borne basse", () => {
    expect([...TRANCHES_BUDGET].sort()).toEqual(BUYER_BUDGET_CHOICES.filter((c) => c !== "aucun_projet").sort());
    for (const t of TRANCHES_BUDGET) expect(budgetChoiceBounds(t).min, t).toBeGreaterThan(0);
  });

  it("la base connaît exactement les mêmes tranches", () => {
    const m = /v_connues constant text\[\] := array\[([^\]]*)\]/.exec(MIGRATION);
    expect(m, "liste des tranches introuvable dans la migration").not.toBeNull();
    const enBase = [...m![1]!.matchAll(/'([a-z0-9_]+)'/g)].map((x) => x[1]!);
    expect(enBase).toEqual([...TRANCHES_BUDGET]);
  });

  it("sans réglage, le formulaire garde ses trois réponses d'aujourd'hui", () => {
    expect(TRANCHES_PAR_DEFAUT).toEqual(["500k_1m", "plus_1m"]);
    expect(reponsesDuFormulaire(null)).toEqual([...BUDGET_CHOICES_PROPOSES]);
    expect(reponsesDuFormulaire(["1m_2m", "2m_3m", "plus_3m"])).toEqual(["aucun_projet", "1m_2m", "2m_3m", "plus_3m"]);
  });

  it("trier : de la plus basse à la plus haute, la tranche ouverte après celle qui partage sa borne basse", () => {
    expect(trierTranches(["plus_3m", "500k_1m", "2m_3m", "1m_2m"])).toEqual(["500k_1m", "1m_2m", "2m_3m", "plus_3m"]);
    expect(trierTranches(["plus_1m", "1m_2m"])).toEqual(["1m_2m", "plus_1m"]);
  });
});

describe("la règle d'un réglage — les mêmes cas qu'en base", () => {
  const valables: [TrancheBudget[], number][] = [
    [["500k_1m", "plus_1m"], 0.5 * M],
    [["500k_1m", "plus_1m"], 1 * M],
    [["1m_2m", "2m_3m", "plus_3m"], 2 * M],
    [["500k_1m", "1m_2m", "2m_3m", "plus_3m"], 3 * M],
    [["plus_3m"], 3 * M],
    [["plus_1m"], 1 * M],
  ];
  for (const [tranches, cible] of valables) {
    it(`valable : ${tranches.join(", ")} · cible ${cible / M} M€`, () => {
      expect(erreurDuReglage(tranches, cible)).toBeNull();
    });
  }

  const refuses: [string[] | null, number | null, RegExp][] = [
    [["500k_1m", "plus_1m"], 2 * M, /bas d’une des tranches/],
    [["500k_1m"], 0.5 * M, /dernière tranche doit être ouverte/],
    [["plus_1m", "500k_1m"], 0.5 * M, /ferme la liste/],
    [["500k_1m", "2m_3m", "plus_3m"], 0.5 * M, /sans trou ni chevauchement/],
    [["plus_1m", "2m_3m"], 1 * M, /ferme la liste/],
    [["1m_2m", "plus_1m", "2m_3m"], 1 * M, /sans trou ni chevauchement/],
    [["500k_1m", "plus_1m", "plus_1m"], 0.5 * M, /deux fois/],
    [["aucun_projet", "500k_1m", "plus_1m"], 0.5 * M, /inconnue/],
    [[], 0.5 * M, /au moins une tranche/],
    [null, 0.5 * M, /au moins une tranche/],
    [["500k_1m", "plus_1m"], null, /Choisissez la cible/],
    [["500k_1m", "1m_2m", "2m_3m", "plus_3m", "plus_1m"], 0.5 * M, /Quatre tranches/],
  ];
  for (const [tranches, cible, motif] of refuses) {
    it(`refusé : ${tranches === null ? "aucune liste" : tranches.join(", ") || "liste vide"} · cible ${cible === null ? "aucune" : `${cible / M} M€`}`, () => {
      expect(erreurDuReglage(tranches ?? [], cible)).toMatch(motif);
    });
  }

  it("chaque phrase de refus du module existe aussi en base (au mot près, à la casse près)", () => {
    const phrases = [
      erreurDesTranches([]),
      erreurDesTranches(["500k_1m", "1m_2m", "2m_3m", "plus_3m", "plus_1m"]),
      erreurDesTranches(["plus_1m", "plus_1m"]),
      erreurDesTranches(["x"]),
      erreurDesTranches(["plus_1m", "500k_1m"]),
      erreurDesTranches(["500k_1m", "2m_3m", "plus_3m"]),
      erreurDesTranches(["500k_1m"]),
      erreurDeLaCible(["500k_1m", "plus_1m"], null),
      erreurDeLaCible(["500k_1m", "plus_1m"], 2 * M),
    ];
    const base = MIGRATION.replace(/''/g, "'").toLowerCase();
    for (const p of phrases) {
      expect(p).not.toBeNull();
      const corps = p!.replace(/\.$/, "").replace(/’/g, "'").toLowerCase();
      expect(base, corps).toContain(corps);
    }
  });

  it("les cibles possibles : la borne basse de chaque tranche proposée", () => {
    expect(ciblesPossibles(["500k_1m", "plus_1m"])).toEqual([0.5 * M, 1 * M]);
    expect(ciblesPossibles(["500k_1m", "1m_2m", "2m_3m", "plus_3m"])).toEqual([0.5 * M, 1 * M, 2 * M, 3 * M]);
  });
});

describe("ce que le formulaire public relit", () => {
  it("une liste valable passe telle quelle", () => {
    expect(lireTranchesDuFormulaire(["1m_2m", "2m_3m", "plus_3m"])).toEqual(["1m_2m", "2m_3m", "plus_3m"]);
  });

  it("tout le reste retombe sur les réponses d'aujourd'hui (null), sans exception", () => {
    for (const brut of [null, undefined, "500k_1m", 3, {}, [1, 2], ["inconnue"], ["500k_1m"], ["plus_1m", "500k_1m"], []]) {
      expect(lireTranchesDuFormulaire(brut), JSON.stringify(brut)).toBeNull();
    }
  });
});
