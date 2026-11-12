import { describe, expect, it } from "vitest";
import { estUnJour, parseEurosToCents, parsePourcentage } from "./saisie";
import { annulationSchema, conditionsSchema, coutFixeSchema, lotSchema, premierMessage } from "./schemas";
import { estNonInstalle, MESSAGE_NON_INSTALLE, messagePilotage } from "./erreurs";
import { centimesPourSaisie, pourcentagePourSaisie } from "./affichage";

const BIEN = "6f1d2c3b-4a5e-4f60-8a9b-0c1d2e3f4a5b";
const LOT = "7a2b3c4d-5e6f-4a1b-9c2d-3e4f5a6b7c8d";

describe("saisies françaises", () => {
  it("un pourcentage s'écrit avec une virgule, un point, ou un signe %", () => {
    expect(parsePourcentage("3,75", 4)).toBe(3.75);
    expect(parsePourcentage(" 3.75 % ", 4)).toBe(3.75);
    expect(parsePourcentage("70", 2)).toBe(70);
    expect(parsePourcentage("", 2)).toBeNull();
    expect(parsePourcentage(null, 2)).toBeNull();
  });

  it("on refuse plutôt que de deviner", () => {
    expect(parsePourcentage("3,75001", 4)).toBeUndefined();
    expect(parsePourcentage("70,5", 0)).toBeUndefined();
    expect(parsePourcentage("abc", 2)).toBeUndefined();
    expect(parsePourcentage("150", 2)).toBeUndefined();
    expect(parsePourcentage("-3", 2)).toBeUndefined();
  });

  it("les montants réutilisent le lecteur des mandats (espaces, €, virgule)", () => {
    expect(parseEurosToCents("1 450 000 €")).toBe(145_000_000);
    expect(parseEurosToCents("3 500,50")).toBe(350_050);
  });

  it("un montant prérempli se relit à l'identique, espaces de milliers comprises", () => {
    // Intl écrit les milliers avec une espace fine insécable (U+202F).
    expect(centimesPourSaisie(145_000_000)).toMatch(/^1\s450\s000$/u);
    for (const c of [145_000_000, 350_050, 100, 48_000_000]) {
      expect(parseEurosToCents(centimesPourSaisie(c))).toBe(c);
    }
    expect(centimesPourSaisie(null)).toBe("");
  });

  it("un pourcentage prérempli se relit à l'identique", () => {
    expect(pourcentagePourSaisie(3.75, 4)).toBe("3,75");
    expect(parsePourcentage(pourcentagePourSaisie("3.7500", 4), 4)).toBe(3.75);
    expect(pourcentagePourSaisie(null, 2)).toBe("");
  });

  it("une date doit exister", () => {
    expect(estUnJour("2026-11-12")).toBe(true);
    expect(estUnJour("2026-02-31")).toBe(false);
    expect(estUnJour("12/11/2026")).toBe(false);
  });
});

const conditionsValides = {
  propertyId: BIEN,
  dateEffet: "2026-11-12",
  venteParLots: false,
  naturePrix: "fai",
  prixAfficheCentimes: 145_000_000,
  tauxCommissionPct: 3.75,
  baseHonoraires: "TTC",
  partProdigioPct: 70,
  tauxTvaPct: 20,
  statutCommercial: "a_vendre",
  prixVenteFinalCentimes: null,
  venduLe: null,
  motif: "Saisie initiale",
};

describe("validation des conditions", () => {
  it("accepte une saisie complète", () => {
    expect(conditionsSchema.safeParse(conditionsValides).success).toBe(true);
  });

  it("accepte des données manquantes : elles s'afficheront « manquant »", () => {
    const r = conditionsSchema.safeParse({
      ...conditionsValides,
      prixAfficheCentimes: null,
      tauxCommissionPct: null,
      partProdigioPct: null,
      tauxTvaPct: null,
    });
    expect(r.success).toBe(true);
  });

  it("exige un motif et une base des honoraires", () => {
    const sansMotif = conditionsSchema.safeParse({ ...conditionsValides, motif: "   " });
    expect(sansMotif.success).toBe(false);
    if (!sansMotif.success) expect(premierMessage(sansMotif.error)).toMatch(/Motif requis/);
    expect(conditionsSchema.safeParse({ ...conditionsValides, baseHonoraires: "" }).success).toBe(false);
  });

  it("par lots : ni prix, ni statut au niveau du bien", () => {
    const r = conditionsSchema.safeParse({ ...conditionsValides, venteParLots: true });
    expect(r.success).toBe(false);
    if (!r.success) expect(premierMessage(r.error)).toMatch(/lot par lot/);
    expect(
      conditionsSchema.safeParse({
        ...conditionsValides,
        venteParLots: true,
        prixAfficheCentimes: null,
        statutCommercial: null,
      }).success,
    ).toBe(true);
  });

  it("le prix final n'existe que pour un bien vendu", () => {
    expect(conditionsSchema.safeParse({ ...conditionsValides, prixVenteFinalCentimes: 140_000_000 }).success).toBe(false);
    expect(
      conditionsSchema.safeParse({
        ...conditionsValides,
        statutCommercial: "vendu",
        prixVenteFinalCentimes: 140_000_000,
        venduLe: "2026-12-15",
      }).success,
    ).toBe(true);
  });

  it("refuse un taux trop précis, une part au-delà de 100 %, un montant décimal", () => {
    expect(conditionsSchema.safeParse({ ...conditionsValides, tauxCommissionPct: 3.75001 }).success).toBe(false);
    expect(conditionsSchema.safeParse({ ...conditionsValides, partProdigioPct: 120 }).success).toBe(false);
    expect(conditionsSchema.safeParse({ ...conditionsValides, prixAfficheCentimes: 1.5 }).success).toBe(false);
  });
});

describe("validation des lots et des coûts", () => {
  const lot = {
    lotId: null,
    propertyId: BIEN,
    numero: "5",
    description: null,
    prixCentimes: 48_000_000,
    statutCommercial: "a_vendre",
    prixVenteFinalCentimes: null,
    venduLe: null,
    retire: false,
    motif: "Grille du promoteur",
  };

  it("un nouveau lot a un numéro, et ne naît pas retiré", () => {
    expect(lotSchema.safeParse(lot).success).toBe(true);
    expect(lotSchema.safeParse({ ...lot, numero: null }).success).toBe(false);
    expect(lotSchema.safeParse({ ...lot, retire: true }).success).toBe(false);
    expect(lotSchema.safeParse({ ...lot, lotId: LOT, numero: null, retire: true }).success).toBe(true);
  });

  it("un coût a un type, un montant positif et sa clé de saisie", () => {
    const cout = { propertyId: BIEN, typeCout: "production", montantHtCentimes: 350_000, note: null, cleSaisie: LOT };
    expect(coutFixeSchema.safeParse(cout).success).toBe(true);
    expect(coutFixeSchema.safeParse({ ...cout, montantHtCentimes: 0 }).success).toBe(false);
    expect(coutFixeSchema.safeParse({ ...cout, typeCout: "drone" }).success).toBe(false);
    expect(coutFixeSchema.safeParse({ ...cout, cleSaisie: "pas-une-cle" }).success).toBe(false);
    expect(annulationSchema.safeParse({ coutId: LOT, motif: null }).success).toBe(true);
  });
});

describe("ce que l'écran dit quand la base refuse", () => {
  it("la migration pas encore appliquée se reconnaît et se dit en clair", () => {
    for (const code of ["42P01", "42883", "PGRST202", "PGRST205"]) {
      expect(estNonInstalle(code)).toBe(true);
      expect(messagePilotage(code, "relation does not exist")).toBe(MESSAGE_NON_INSTALLE);
    }
    expect(estNonInstalle("42501")).toBe(false);
  });

  it("nos refus passent, en français, avec une capitale", () => {
    expect(messagePilotage("22023", "motif requis : dites pourquoi ces conditions s'appliquent")).toBe(
      "Motif requis : dites pourquoi ces conditions s'appliquent.",
    );
    expect(messagePilotage("42501", "droits insuffisants")).toBe("Droits insuffisants.");
    expect(messagePilotage("28000", "authentification requise")).toBe("Session expirée. Reconnectez-vous.");
  });

  it("le jargon de PostgreSQL ne passe jamais", () => {
    expect(messagePilotage("22023", 'new row violates check constraint "x"')).toBe(
      "Action refusée. Vérifiez les informations saisies.",
    );
    expect(messagePilotage("XX000", "internal error")).toMatch(/erreur technique/);
  });
});
