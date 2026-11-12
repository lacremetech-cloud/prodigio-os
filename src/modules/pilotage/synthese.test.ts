import { describe, expect, it } from "vitest";
import type {
  PilotageConditionsRow,
  PilotageCoutFixeRow,
  PilotageLotRow,
  PilotageLotVersionRow,
} from "@/lib/supabase/types";
import { eurosArrondis } from "./exact";
import type { Montant } from "./commission";
import { partDuMandat, syntheseDuBien, type EntreeSynthese } from "./synthese";

const JOUR = "2026-11-12";
const BIEN = "10000000-0000-0000-0000-000000000001";

function conditions(p: Partial<PilotageConditionsRow> = {}): PilotageConditionsRow {
  return {
    id: "c1",
    property_id: BIEN,
    date_effet: JOUR,
    vente_par_lots: false,
    nature_prix: "fai",
    prix_affiche_cents: 140_000_000,
    taux_commission_pct: 3.75,
    base_honoraires: "TTC",
    part_prodigio_pct: 70,
    taux_tva_pct: 20,
    statut_commercial: "a_vendre",
    prix_vente_final_cents: null,
    vendu_le: null,
    motif: "Saisie initiale",
    saisi_le: "2026-11-12T09:00:00Z",
    saisi_par: "admin",
    ...p,
  };
}

function lot(id: string, numero: string): PilotageLotRow {
  return { id, property_id: BIEN, numero, cree_le: "2026-11-12T09:00:00Z", cree_par: "admin" };
}

function etat(lotId: string, p: Partial<PilotageLotVersionRow> = {}): PilotageLotVersionRow {
  return {
    id: `${lotId}-v${p.saisi_le ?? ""}`,
    lot_id: lotId,
    description: null,
    prix_cents: 48_000_000,
    statut_commercial: "a_vendre",
    prix_vente_final_cents: null,
    vendu_le: null,
    retire: false,
    motif: "Grille",
    saisi_le: "2026-11-12T09:00:00Z",
    saisi_par: "admin",
    ...p,
  };
}

function cout(id: string, p: Partial<PilotageCoutFixeRow> = {}): PilotageCoutFixeRow {
  return {
    id,
    property_id: BIEN,
    type_cout: "production",
    montant_ht_cents: 350_000,
    note: null,
    saisi_le: "2026-11-12T09:00:00Z",
    saisi_par: "admin",
    cle_saisie: null,
    annule_le: null,
    annule_par: null,
    motif_annulation: null,
    ...p,
  };
}

function entree(p: Partial<EntreeSynthese> = {}): EntreeSynthese {
  return { jour: JOUR, conditions: [], lots: [], etatsDesLots: [], couts: [], photographieMandat: null, ...p };
}

const euros = (m: Montant | undefined) => (m && m.ok ? eurosArrondis(m.centimes) : m?.manque);
const textes = (s: ReturnType<typeof syntheseDuBien>) => s.alertes.map((a) => a.texte).join(" | ");

describe("un bien vendu en un seul bloc", () => {
  it("prend la version en vigueur et calcule sa commission", () => {
    const s = syntheseDuBien(entree({ conditions: [conditions()] }));
    expect(s.enVigueur?.id).toBe("c1");
    expect(euros(s.potentiel?.comProdigioHT)).toBe(29_518);
    expect(s.encaisse).toBeNull();
    expect(s.lots).toEqual([]);
    expect(s.alertes).toEqual([]);
  });

  it("une correction du jour remplace la saisie, qui reste dans l'historique", () => {
    const s = syntheseDuBien(
      entree({
        conditions: [
          conditions(),
          conditions({ id: "c2", prix_affiche_cents: 120_000_000, part_prodigio_pct: 50, saisi_le: "2026-11-12T10:00:00Z" }),
        ],
      }),
    );
    expect(s.enVigueur?.id).toBe("c2");
    expect(euros(s.potentiel?.comProdigioHT)).toBe(18_072);
    expect(s.historique.map((h) => [h.version.id, h.etat])).toEqual([
      ["c2", "en_vigueur"],
      ["c1", "remplacee"],
    ]);
  });

  it("vendu : la commission encaissée se calcule sur le prix final", () => {
    const s = syntheseDuBien(
      entree({
        conditions: [
          conditions({
            statut_commercial: "vendu",
            prix_vente_final_cents: 120_000_000,
            part_prodigio_pct: 50,
            vendu_le: "2026-12-15",
          }),
        ],
      }),
    );
    expect(euros(s.encaisse?.comProdigioHT)).toBe(18_072);
  });

  it("des lots saisis sur un bien vendu en bloc sont ignorés, et on le dit", () => {
    const s = syntheseDuBien(
      entree({ conditions: [conditions()], lots: [lot("l5", "5")], etatsDesLots: [etat("l5")] }),
    );
    expect(euros(s.potentiel?.comProdigioHT)).toBe(29_518);
    expect(textes(s)).toContain("se vend en un seul bloc : les lots sont ignorés");
  });
});

describe("la part de Prodigio et le mandat", () => {
  it("sans part saisie, la photographie du mandat s'applique, et c'est écrit", () => {
    const s = syntheseDuBien(
      entree({
        conditions: [conditions({ part_prodigio_pct: null })],
        photographieMandat: { prodigio_share_pct: 70, fee_basis: "TTC" },
      }),
    );
    expect(s.part.source).toBe("mandat");
    expect(euros(s.potentiel?.comProdigioHT)).toBe(29_518);
    expect(textes(s)).toContain("reprise de la photographie du mandat");
  });

  it("une part saisie différente du mandat est signalée", () => {
    const s = syntheseDuBien(
      entree({ conditions: [conditions({ part_prodigio_pct: 70 })], photographieMandat: { prodigio_share_pct: 60 } }),
    );
    expect(s.part.ecart).toBe(true);
    expect(textes(s)).toMatch(/70 %.*diffère.*60 %/u);
  });

  it("une photographie sans part, ou absente, ne fabrique pas de part", () => {
    expect(partDuMandat(null)).toBeNull();
    expect(partDuMandat({ prodigio_share_pct: null })).toBeNull();
    expect(partDuMandat([1, 2])).toBeNull();
    expect(partDuMandat({ prodigio_share_pct: "70.00" })).toBe("70.00");
  });
});

describe("un programme vendu par lots (Les Airelles)", () => {
  const conditionsProgramme = conditions({
    vente_par_lots: true,
    nature_prix: "ht_grille_promoteur",
    prix_affiche_cents: null,
    statut_commercial: null,
    part_prodigio_pct: 50,
  });

  it("calcule lot par lot, totalise exactement, écarte les lots retirés", () => {
    const s = syntheseDuBien(
      entree({
        conditions: [conditionsProgramme],
        lots: [lot("l13", "13"), lot("l5", "5"), lot("l99", "99")],
        etatsDesLots: [
          etat("l5", { prix_cents: 120_000_000 }),
          etat("l13", { prix_cents: 140_000_000 }),
          etat("l99", { prix_cents: 50_000_000 }),
          // Le lot 99 était une erreur de saisie : retiré, pas effacé.
          etat("l99", { prix_cents: 50_000_000, retire: true, saisi_le: "2026-11-12T11:00:00Z" }),
        ],
      }),
    );
    // Tri par numéro, numérique : 5 avant 13.
    expect(s.lots.map((l) => l.lot.numero)).toEqual(["5", "13"]);
    expect(s.lotsRetires.map((l) => l.lot.numero)).toEqual(["99"]);
    expect(s.lots.map((l) => euros(l.potentiel?.comProdigioHT))).toEqual([18_072, 21_084]);
    expect(s.totalLots?.prix.complet).toBe(true);
    expect(eurosArrondis(s.totalLots!.prix.centimes)).toBe(2_600_000);
    // 18 072,29 + 21 084,34 = 39 156,63 → 39 157 € (arrondi une seule fois).
    expect(eurosArrondis(s.totalLots!.comProdigioHT.centimes)).toBe(39_157);
    expect(s.potentiel).toBeNull();
  });

  it("le dernier état d'un lot fait foi", () => {
    const s = syntheseDuBien(
      entree({
        conditions: [conditionsProgramme],
        lots: [lot("l5", "5")],
        etatsDesLots: [
          etat("l5", { prix_cents: 48_000_000 }),
          etat("l5", {
            prix_cents: 48_000_000,
            statut_commercial: "vendu",
            prix_vente_final_cents: 47_000_000,
            saisi_le: "2026-12-15T09:00:00Z",
          }),
        ],
      }),
    );
    expect(s.lots[0]?.etat?.statut_commercial).toBe("vendu");
    expect(s.lots[0]?.etats).toHaveLength(2);
    expect(s.lots[0]?.encaisse?.comProdigioHT.ok).toBe(true);
  });

  it("dit que le prix HT de la grille est pris comme prix affiché (question ouverte)", () => {
    const s = syntheseDuBien(entree({ conditions: [conditionsProgramme], lots: [lot("l5", "5")], etatsDesLots: [etat("l5")] }));
    expect(textes(s)).toContain("prix HT de la grille du promoteur est pris comme prix affiché");
  });

  it("un lot sans prix rend les totaux partiels, et c'est signalé", () => {
    const s = syntheseDuBien(
      entree({
        conditions: [conditionsProgramme],
        lots: [lot("l5", "5"), lot("l6", "6")],
        etatsDesLots: [etat("l5"), etat("l6", { prix_cents: null })],
      }),
    );
    expect(s.totalLots?.comProdigioHT.complet).toBe(false);
    expect(textes(s)).toContain("Un lot n'a pas de prix");
  });

  it("par lots sans aucun lot : signalé", () => {
    const s = syntheseDuBien(entree({ conditions: [conditionsProgramme] }));
    expect(textes(s)).toContain("aucun lot n'est saisi");
  });
});

describe("ce qui empêche le calcul est dit, jamais remplacé par un chiffre", () => {
  it("aucune condition : le bien n'entre pas dans le pilotage", () => {
    const s = syntheseDuBien(entree());
    expect(s.enVigueur).toBeNull();
    expect(s.potentiel).toBeNull();
    expect(textes(s)).toContain("Aucune condition saisie");
  });

  it("des conditions à venir seulement : rien n'est calculé d'ici là", () => {
    const s = syntheseDuBien(entree({ conditions: [conditions({ date_effet: "2027-01-01" })] }));
    expect(s.enVigueur).toBeNull();
    expect(s.aVenir).toHaveLength(1);
    expect(textes(s)).toContain("ne prennent effet que le");
  });

  it("base à confirmer : alerte, et aucune commission", () => {
    const s = syntheseDuBien(entree({ conditions: [conditions({ base_honoraires: "a_confirmer" })] }));
    expect(euros(s.potentiel?.comProdigioHT)).toBe("base_a_confirmer");
    expect(textes(s)).toContain("suppose un taux TTC");
  });

  it("TVA manquante : alerte, la commission TTC reste connue", () => {
    const s = syntheseDuBien(entree({ conditions: [conditions({ taux_tva_pct: null })] }));
    expect(euros(s.potentiel?.comProdigioTTC)).toBe(35_422);
    expect(textes(s)).toContain("Taux de TVA manquant");
  });
});

describe("les coûts fixes", () => {
  it("un coût annulé reste visible mais sort des totaux", () => {
    const s = syntheseDuBien(
      entree({
        couts: [
          cout("a", { type_cout: "production", montant_ht_cents: 350_000 }),
          cout("b", { type_cout: "photos", montant_ht_cents: 80_000, saisi_le: "2026-11-13T09:00:00Z" }),
          cout("c", {
            type_cout: "photos",
            montant_ht_cents: 80_000,
            saisi_le: "2026-11-13T09:05:00Z",
            annule_le: "2026-11-13T09:06:00Z",
            annule_par: "admin",
          }),
        ],
      }),
    );
    expect(s.couts.totalHtCentimes).toBe(430_000);
    expect(s.couts.parType).toEqual({ production: 350_000, montage: 0, photos: 80_000, autre: 0 });
    expect(s.couts.actifs.map((c) => c.id)).toEqual(["b", "a"]);
    expect(s.couts.annules.map((c) => c.id)).toEqual(["c"]);
  });
});
