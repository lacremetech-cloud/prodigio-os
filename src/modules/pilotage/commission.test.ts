import { describe, expect, it } from "vitest";
import {
  calculerCommission,
  calculerEncaisse,
  partApplicable,
  totaliser,
  type CalculCommission,
  type Montant,
} from "./commission";
import { centimesArrondis, egal, entier, eurosArrondis, plus } from "./exact";
import { formatMontant, formatTotal } from "./affichage";

/** La valeur à l'euro, ou ce qui manque — pour écrire les attentes en clair. */
function e(m: Montant): number | string {
  return m.ok ? eurosArrondis(m.centimes) : m.manque;
}

function enEuros(c: CalculCommission) {
  return {
    prixAffiche: e(c.prixAffiche),
    netVendeur: e(c.netVendeur),
    comTotaleTTC: e(c.comTotaleTTC),
    comProdigioTTC: e(c.comProdigioTTC),
    comProdigioHT: e(c.comProdigioHT),
  };
}

const TTC = { baseHonoraires: "TTC" as const, tauxTvaPct: 20 };

describe("les chiffres de contrôle validés par Victor (12/11/2026)", () => {
  it("villa à 1 400 000 € FAI, 3,75 %, 70 %", () => {
    const c = calculerCommission({
      ...TTC,
      prixCentimes: 140_000_000,
      tauxCommissionPct: 3.75,
      partProdigioPct: 70,
    });
    expect(enEuros(c)).toEqual({
      prixAffiche: 1_400_000,
      netVendeur: 1_349_398,
      comTotaleTTC: 50_602,
      comProdigioTTC: 35_422,
      comProdigioHT: 29_518,
    });
  });

  it("appartement à 1 200 000 € FAI, 3,75 %, 50 %", () => {
    const c = calculerCommission({
      ...TTC,
      prixCentimes: 120_000_000,
      tauxCommissionPct: 3.75,
      partProdigioPct: 50,
    });
    expect(enEuros(c)).toEqual({
      prixAffiche: 1_200_000,
      netVendeur: 1_156_627,
      comTotaleTTC: 43_373,
      comProdigioTTC: 21_687,
      comProdigioHT: 18_072,
    });
  });

  it("les taux lus en base comme texte donnent exactement les mêmes chiffres", () => {
    // PostgREST peut renvoyer un `numeric` en texte : « 3.7500 ».
    const c = calculerCommission({
      baseHonoraires: "TTC",
      prixCentimes: 140_000_000,
      tauxCommissionPct: "3.7500",
      partProdigioPct: "70.00",
      tauxTvaPct: "20.00",
    });
    expect(enEuros(c).comProdigioHT).toBe(29_518);
  });
});

describe("un calcul exact, arrondi seulement à l'affichage", () => {
  const c = calculerCommission({ ...TTC, prixCentimes: 140_000_000, tauxCommissionPct: 3.75, partProdigioPct: 70 });

  it("net vendeur + commission totale = prix affiché, au centime exact (aucune perte d'arrondi)", () => {
    if (!c.netVendeur.ok || !c.comTotaleTTC.ok) throw new Error("calcul attendu");
    expect(egal(plus(c.netVendeur.centimes, c.comTotaleTTC.centimes), entier(140_000_000))).toBe(true);
  });

  it("le net vendeur ne tombe pas juste : il reste une fraction, pas un nombre approché", () => {
    if (!c.netVendeur.ok) throw new Error("calcul attendu");
    // 140 000 000 × 80 / 83 centimes.
    expect(c.netVendeur.centimes.d).toBe(BigInt(83));
    expect(centimesArrondis(c.netVendeur.centimes)).toBe(134_939_759);
  });

  it("l'affichage arrondit à l'euro, avec le symbole", () => {
    expect(formatMontant(c.comProdigioHT)).toMatch(/^29\s?518\s?€$/u);
  });
});

describe("une donnée manquante reste manquante — jamais 0", () => {
  it("sans prix : tout ce qui en découle manque, pour cette raison", () => {
    const c = calculerCommission({ ...TTC, prixCentimes: null, tauxCommissionPct: 3.75, partProdigioPct: 70 });
    expect(enEuros(c)).toEqual({
      prixAffiche: "prix_manquant",
      netVendeur: "prix_manquant",
      comTotaleTTC: "prix_manquant",
      comProdigioTTC: "prix_manquant",
      comProdigioHT: "prix_manquant",
    });
    expect(formatMontant(c.comProdigioHT)).toBe("manquant — prix manquant");
  });

  it("sans taux : le prix reste, le reste manque", () => {
    const c = calculerCommission({ ...TTC, prixCentimes: 140_000_000, tauxCommissionPct: null, partProdigioPct: 70 });
    expect(enEuros(c).prixAffiche).toBe(1_400_000);
    expect(enEuros(c).comTotaleTTC).toBe("taux_manquant");
  });

  it("sans part : la commission totale est connue, celle de Prodigio non", () => {
    const c = calculerCommission({ ...TTC, prixCentimes: 140_000_000, tauxCommissionPct: 3.75, partProdigioPct: null });
    expect(enEuros(c).comTotaleTTC).toBe(50_602);
    expect(enEuros(c).comProdigioTTC).toBe("part_manquante");
    expect(enEuros(c).comProdigioHT).toBe("part_manquante");
  });

  it("sans TVA : la commission TTC est connue, la HT non", () => {
    const c = calculerCommission({
      baseHonoraires: "TTC",
      prixCentimes: 140_000_000,
      tauxCommissionPct: 3.75,
      partProdigioPct: 70,
      tauxTvaPct: null,
    });
    expect(enEuros(c).comProdigioTTC).toBe(35_422);
    expect(enEuros(c).comProdigioHT).toBe("tva_manquante");
  });

  it("une part de 0 % est une vraie valeur, pas une absence", () => {
    const c = calculerCommission({ ...TTC, prixCentimes: 140_000_000, tauxCommissionPct: 3.75, partProdigioPct: 0 });
    expect(enEuros(c).comProdigioHT).toBe(0);
  });
});

describe("la base des honoraires : la règle validée suppose un taux TTC", () => {
  it("base « à confirmer » : rien n'est calculé, et on dit pourquoi", () => {
    const c = calculerCommission({
      baseHonoraires: "a_confirmer",
      prixCentimes: 140_000_000,
      tauxCommissionPct: 3.75,
      partProdigioPct: 70,
      tauxTvaPct: 20,
    });
    expect(enEuros(c).prixAffiche).toBe(1_400_000);
    expect(enEuros(c).netVendeur).toBe("base_a_confirmer");
    expect(enEuros(c).comProdigioHT).toBe("base_a_confirmer");
  });

  it("base HT : aucune formule validée, donc aucun chiffre approché", () => {
    const c = calculerCommission({
      baseHonoraires: "HT",
      prixCentimes: 140_000_000,
      tauxCommissionPct: 3.75,
      partProdigioPct: 70,
      tauxTvaPct: 20,
    });
    expect(enEuros(c).comTotaleTTC).toBe("base_ht_non_prevue");
  });
});

describe("la commission encaissée : seulement pour un bien vendu, sur le prix final", () => {
  const conditions = { ...TTC, tauxCommissionPct: 3.75, partProdigioPct: 70 };

  it("ne s'applique pas tant que le bien n'est pas vendu", () => {
    expect(calculerEncaisse("a_vendre", null, conditions)).toBeNull();
    expect(calculerEncaisse("compromis_signe", null, conditions)).toBeNull();
  });

  it("vendu sans prix final saisi : manquante, et pas remplacée par le prix affiché", () => {
    const c = calculerEncaisse("vendu", null, conditions);
    expect(c && enEuros(c).comProdigioHT).toBe("prix_vente_final_manquant");
  });

  it("vendu avec prix final : même règle, sur le prix réellement payé", () => {
    const c = calculerEncaisse("vendu", 120_000_000, { ...conditions, partProdigioPct: 50 });
    expect(c && enEuros(c).comProdigioHT).toBe(18_072);
  });
});

describe("les totaux : exacts, et honnêtes sur ce qui leur manque", () => {
  /** Un programme FICTIF de neuf lots, 6 425 000 € en tout, 3,75 %, 50 %. */
  const grille = [48_000_000, 51_500_000, 56_000_000, 61_000_000, 64_500_000, 69_000_000, 73_500_000, 98_000_000, 121_000_000];
  const lots = grille.map((prixCentimes) =>
    calculerCommission({ ...TTC, prixCentimes, tauxCommissionPct: 3.75, partProdigioPct: 50 }),
  );

  it("additionne les valeurs exactes, pas les valeurs arrondies lot par lot", () => {
    const total = totaliser(lots.map((l) => l.comProdigioHT));
    expect(total.complet).toBe(true);
    expect(eurosArrondis(total.centimes)).toBe(96_762);
    // Arrondir chaque lot puis additionner donnerait 96 763 € : c'est
    // précisément l'erreur que le calcul exact évite.
    const arrondisLotParLot = lots.reduce((s, l) => s + (l.comProdigioHT.ok ? eurosArrondis(l.comProdigioHT.centimes) : 0), 0);
    expect(arrondisLotParLot).toBe(96_763);
  });

  it("le prix total de la grille vaut bien 6 425 000 €", () => {
    expect(eurosArrondis(totaliser(lots.map((l) => l.prixAffiche)).centimes)).toBe(6_425_000);
  });

  it("un lot sans prix rend le total partiel, et l'affichage le dit", () => {
    const avecUnTrou = [
      ...lots,
      calculerCommission({ ...TTC, prixCentimes: null, tauxCommissionPct: 3.75, partProdigioPct: 50 }),
    ];
    const total = totaliser(avecUnTrou.map((l) => l.comProdigioHT));
    expect(total.complet).toBe(false);
    expect(total.absents).toBe(1);
    expect(total.manques).toEqual(["prix_manquant"]);
    expect(formatTotal(total)).toMatch(/^au moins 96\s?762\s?€ \(1 ligne manque\)$/u);
  });

  it("un total vide est un vrai zéro, complet", () => {
    const total = totaliser([]);
    expect(total.complet).toBe(true);
    expect(eurosArrondis(total.centimes)).toBe(0);
  });
});

describe("la part de Prodigio : saisie, ou photographie du mandat", () => {
  it("la part saisie prime", () => {
    expect(partApplicable(70, null)).toEqual({ pct: 70, source: "saisie", pctMandat: null, ecart: false });
  });

  it("sans part saisie, celle du mandat", () => {
    expect(partApplicable(null, "70.00")).toEqual({ pct: "70.00", source: "mandat", pctMandat: "70.00", ecart: false });
  });

  it("deux parts égales ne sont pas un écart, même écrites différemment", () => {
    expect(partApplicable(70, "70.00").ecart).toBe(false);
  });

  it("deux parts différentes : l'écart est signalé, jamais tranché en silence", () => {
    const p = partApplicable(70, 60);
    expect(p.ecart).toBe(true);
    expect(p.source).toBe("saisie");
    expect(p.pctMandat).toBe(60);
  });

  it("aucune part nulle part : manquante", () => {
    expect(partApplicable(null, null)).toEqual({ pct: null, source: null, pctMandat: null, ecart: false });
  });
});
