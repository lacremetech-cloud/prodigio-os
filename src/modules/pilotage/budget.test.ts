import { describe, expect, it } from "vitest";
import type { PilotageBudgetFormulaireRow } from "@/lib/supabase/types";
import { divise, entier, type Exact } from "./exact";
import type { MetaEnFace } from "./crm";
import type { Calcule, TableauPilotage } from "./tableau";
import {
  calculerBudget,
  dansLaCible,
  libelleCible,
  libelleReponse,
  proposerReglage,
  reglageEnVigueur,
  type LigneCrmBudget,
  type ReglageBudget,
} from "./budget";

/**
 * LE BUDGET DÉCLARÉ DANS PILOTAGE PUB, SUR DES DONNÉES FICTIVES.
 * Aucun chiffre réel du CRM ni du portefeuille : le dépôt est public.
 */

const M = 100_000_000; // 1 M€ en centimes
const BIEN = "aaaaaaaa-0000-4000-8000-000000000001";
const AUTRE = "bbbbbbbb-0000-4000-8000-000000000002";

const ok = (c: Calcule): Exact => {
  expect(c.etat).toBe("ok");
  return (c as { etat: "ok"; valeur: Exact }).valeur;
};

function version(p: Partial<PilotageBudgetFormulaireRow> = {}): PilotageBudgetFormulaireRow {
  return {
    id: "v1",
    property_id: BIEN,
    date_effet: "2026-11-28",
    tranches: ["500k_1m", "plus_1m"],
    cible_min_cents: 1 * M,
    motif: "fictif",
    saisi_le: "2026-11-28T10:00:00Z",
    saisi_par: null,
    ...p,
  };
}

/** Juste ce que le calcul lit du tableau : la période, l'état de la lecture Meta, la dépense par pub et par jour. */
function tableau(p: { lu?: boolean; debut?: string | null; fin?: string; parPub?: Record<string, Record<string, number>> } = {}): TableauPilotage {
  const pubs = new Map<string, Map<string, Exact>>();
  for (const [ad, jours] of Object.entries(p.parPub ?? {})) {
    pubs.set(ad, new Map(Object.entries(jours).map(([j, c]) => [j, entier(c)])));
  }
  return {
    periode: { debut: p.debut === undefined ? "2026-11-01" : p.debut, fin: p.fin ?? "2026-11-27" },
    lecture: { lu: p.lu ?? true },
    quotidienParPub: new Map([[BIEN, pubs]]),
  } as unknown as TableauPilotage;
}

function l(p: Partial<LigneCrmBudget>): LigneCrmBudget {
  return {
    regroupement: "bien",
    property_id: BIEN,
    niveau: null,
    ad_id: null,
    campaign_id: null,
    reponse: null,
    demandes: 0,
    personnes: 0,
    qualifies: 0,
    ...p,
  };
}

const META: MetaEnFace = { etat: "ok", depuis: "2026-11-01", decale: false, depense: entier(120_000), leads: entier(12) };

describe("la cible", () => {
  it("une demande est dans la cible si la borne basse de sa réponse l'atteint", () => {
    expect(dansLaCible("plus_1m", 1 * M)).toBe(true);
    expect(dansLaCible("1m_2m", 1 * M)).toBe(true);
    expect(dansLaCible("500k_1m", 1 * M)).toBe(false);
    expect(dansLaCible("500k_1m", 0.5 * M)).toBe(true);
    expect(dansLaCible("2m_3m", 3 * M)).toBe(false);
    expect(dansLaCible("plus_3m", 3 * M)).toBe(true);
  });

  it("« pas de projet » n'y est jamais ; sans réponse, ni dedans ni dehors", () => {
    expect(dansLaCible("aucun_projet", 0.5 * M)).toBe(false);
    expect(dansLaCible(null, 0.5 * M)).toBeNull();
    expect(dansLaCible("tranche_inconnue", 0.5 * M)).toBeNull();
  });

  it("les libellés", () => {
    expect(libelleCible(1 * M)).toBe("à partir de 1 M€");
    expect(libelleCible(3 * M)).toBe("à partir de 3 M€");
    expect(libelleCible(0.5 * M).replace(/[  ]/g, " ")).toBe("à partir de 500 000 €");
    expect(libelleReponse(null)).toBe("Sans réponse");
    expect(libelleReponse("plus_1m")).toBe("Plus d'1 M€");
    expect(libelleReponse("aucun_projet")).toBe("Pas de projet");
  });
});

describe("le réglage en vigueur, et la proposition d'après le prix", () => {
  it("la version en vigueur : la plus récente par date d'effet sans dépasser le jour ; une version à venir attend", () => {
    const versions = [
      version({ id: "v1", date_effet: "2026-11-20", cible_min_cents: 0.5 * M }),
      version({ id: "v2", date_effet: "2026-11-28", cible_min_cents: 1 * M }),
      version({ id: "v3", date_effet: "2026-12-15", tranches: ["1m_2m", "2m_3m", "plus_3m"], cible_min_cents: 2 * M }),
    ];
    expect(reglageEnVigueur(versions, "2026-11-27")?.version.id).toBe("v1");
    expect(reglageEnVigueur(versions, "2026-11-28")).toMatchObject({ cibleMinCentimes: 1 * M, tranches: ["500k_1m", "plus_1m"] });
    expect(reglageEnVigueur(versions, "2026-11-19")).toBeNull();
  });

  it("sous 2 M€ : les tranches d'aujourd'hui ; la cible : la plus haute borne basse sous le prix", () => {
    expect(proposerReglage({ centimes: 1.25 * M, depuis: "prix_affiche" })).toMatchObject({
      tranches: ["500k_1m", "plus_1m"],
      cibleMinCentimes: 1 * M,
    });
    expect(proposerReglage({ centimes: 0.55 * M, depuis: "lot_le_moins_cher" })).toMatchObject({
      tranches: ["500k_1m", "plus_1m"],
      cibleMinCentimes: 0.5 * M,
    });
    // Sous toutes les bornes : la plus basse.
    expect(proposerReglage({ centimes: 0.4 * M, depuis: "prix_affiche" })?.cibleMinCentimes).toBe(0.5 * M);
  });

  it("à partir de 2 M€ : 1–2 M€, 2–3 M€, plus de 3 M€", () => {
    expect(proposerReglage({ centimes: 2 * M, depuis: "prix_affiche" })).toMatchObject({
      tranches: ["1m_2m", "2m_3m", "plus_3m"],
      cibleMinCentimes: 2 * M,
    });
    expect(proposerReglage({ centimes: 4 * M, depuis: "prix_affiche" })?.cibleMinCentimes).toBe(3 * M);
  });

  it("sans prix connu : aucune proposition", () => {
    expect(proposerReglage(null)).toBeNull();
    expect(proposerReglage({ centimes: 0, depuis: "prix_affiche" })).toBeNull();
  });
});

describe("le budget déclaré d'un bien, sur la période", () => {
  const reglage = reglageEnVigueur([version()], "2026-11-28") as ReglageBudget;
  const lignes: LigneCrmBudget[] = [
    l({ reponse: "aucun_projet", demandes: 4, personnes: 4, qualifies: 0 }),
    l({ reponse: "500k_1m", demandes: 3, personnes: 3, qualifies: 1 }),
    l({ reponse: "plus_1m", demandes: 6, personnes: 5, qualifies: 3 }),
    l({ reponse: "1m_2m", demandes: 1, personnes: 1, qualifies: 1 }), // une ancienne tranche, toujours lue
    l({ reponse: null, demandes: 2, personnes: 2, qualifies: 0 }),
    // Un autre bien et le total : ignorés pour ce bien.
    l({ property_id: AUTRE, reponse: "plus_1m", demandes: 50 }),
    l({ regroupement: "total", property_id: null, reponse: "plus_1m", demandes: 56 }),
    // Pub par pub.
    l({ regroupement: "pub", niveau: "pub", ad_id: "11", reponse: "plus_1m", demandes: 4 }),
    l({ regroupement: "pub", niveau: "pub", ad_id: "11", reponse: "500k_1m", demandes: 2 }),
    l({ regroupement: "pub", niveau: "pub", ad_id: "11", reponse: "aucun_projet", demandes: 2 }),
    l({ regroupement: "pub", niveau: "pub", ad_id: "22", reponse: "aucun_projet", demandes: 2 }),
    l({ regroupement: "pub", niveau: "pub", ad_id: "22", reponse: "500k_1m", demandes: 1 }),
    l({ regroupement: "pub", niveau: "campagne", campaign_id: "903", reponse: "plus_1m", demandes: 2 }),
    l({ regroupement: "pub", niveau: "aucun", reponse: "1m_2m", demandes: 1 }),
    l({ regroupement: "pub", niveau: "aucun", reponse: null, demandes: 2 }),
  ];
  const t = tableau({ parPub: { "11": { "2026-10-30": 99_999, "2026-11-02": 30_000, "2026-11-20": 10_000 }, "22": { "2026-11-05": 20_000 } } });
  const b = calculerBudget({ t, bien: BIEN, lignes, reglage, meta: META, premiereDemande: "2026-10-14" });

  it("par réponse, dans l'ordre de l'échelle ; « sans réponse » en dernier ; les réponses proposées, même à zéro", () => {
    expect(b.lignes.map((x) => x.reponse)).toEqual(["aucun_projet", "500k_1m", "1m_2m", "plus_1m", null]);
    expect(b.lignes.map((x) => x.proposee)).toEqual([true, true, false, true, false]);
    const vide = calculerBudget({ t, bien: BIEN, lignes: [], reglage, meta: META, premiereDemande: null });
    expect(vide.lignes.map((x) => [x.reponse, x.demandes])).toEqual([
      ["aucun_projet", 0],
      ["500k_1m", 0],
      ["plus_1m", 0],
    ]);
  });

  it("la part dans la cible se calcule sur les demandes qui ont répondu", () => {
    expect(b.demandes).toBe(16);
    expect(b.avecReponse).toBe(14);
    expect(b.dansLaCible).toBe(7); // plus d'1 M€ (6) + 1–2 M€ (1)
    expect(ok(b.part)).toEqual(divise(entier(7), entier(14)));
    expect(b.qualifies).toBe(5);
    expect(b.qualifiesDansLaCible).toBe(4);
  });

  it("le coût par demande dans la cible : la dépense des mêmes jours ÷ ces demandes", () => {
    expect(ok(b.cout)).toEqual(divise(entier(120_000), entier(7)));
  });

  it("pub par pub : part et coût sur les mêmes jours que le CRM ; campagne et non rattachées sans coût", () => {
    const pub = (ad: string) => b.parPub.find((p) => p.ad_id === ad)!;
    expect(pub("11")).toMatchObject({ demandes: 8, avecReponse: 8, dansLaCible: 4 });
    expect(ok(pub("11").part)).toEqual(divise(entier(4), entier(8)));
    // Le 30/10 est hors période : 30 000 + 10 000 centimes, pour 4 demandes dans la cible.
    expect(ok(pub("11").cout)).toEqual(divise(entier(40_000), entier(4)));
    expect(pub("22")).toMatchObject({ demandes: 3, dansLaCible: 0 });
    expect(pub("22").cout).toEqual({ etat: "sans_objet", raison: "aucune demande dans la cible" });
    const campagne = b.parPub.find((p) => p.niveau === "campagne")!;
    expect(campagne.dansLaCible).toBe(2);
    expect(campagne.cout.etat).toBe("sans_objet");
    const aucune = b.parPub.find((p) => p.niveau === "aucun")!;
    expect(aucune).toMatchObject({ demandes: 3, avecReponse: 1, dansLaCible: 1 });
    expect(b.parPub.map((p) => p.niveau)).toEqual(["pub", "pub", "campagne", "aucun"]);
  });

  it("les mêmes jours : la dépense d'une pub ne compte qu'à partir de la première demande du CRM", () => {
    const tardif = calculerBudget({ t, bien: BIEN, lignes, reglage, meta: META, premiereDemande: "2026-11-10" });
    expect(ok(tardif.parPub.find((p) => p.ad_id === "11")!.cout)).toEqual(divise(entier(10_000), entier(4)));
    const sansCrm = calculerBudget({ t, bien: BIEN, lignes, reglage, meta: META, premiereDemande: null });
    expect(sansCrm.parPub.find((p) => p.ad_id === "11")!.cout).toEqual({
      etat: "sans_objet",
      raison: "aucune demande reçue dans le CRM",
    });
  });

  it("Meta pas encore lu : le coût attend, la part se calcule", () => {
    const attente = calculerBudget({
      t: tableau({ lu: false }),
      bien: BIEN,
      lignes,
      reglage,
      meta: { etat: "en_attente" },
      premiereDemande: "2026-10-14",
    });
    expect(attente.cout).toEqual({ etat: "en_attente" });
    expect(attente.parPub.find((p) => p.ad_id === "11")!.cout).toEqual({ etat: "en_attente" });
    expect(attente.part.etat).toBe("ok");
  });

  it("sans cible réglée : les réponses se lisent, la part et le coût sont « manquants », jamais 0", () => {
    const sans = calculerBudget({ t, bien: BIEN, lignes, reglage: null, meta: META, premiereDemande: "2026-10-14" });
    expect(sans.lignes.every((x) => x.dansLaCible === null)).toBe(true);
    expect(sans.dansLaCible).toBeNull();
    expect(sans.part).toEqual({ etat: "manquant", raison: "cible non réglée" });
    expect(sans.cout).toEqual({ etat: "manquant", raison: "cible non réglée" });
    expect(sans.parPub.every((p) => p.dansLaCible === null && p.part.etat === "manquant")).toBe(true);
    // Sans réglage, le formulaire propose les réponses d'aujourd'hui.
    expect(sans.lignes.filter((x) => x.proposee).map((x) => x.reponse)).toEqual(["aucun_projet", "500k_1m", "plus_1m"]);
  });

  it("aucune demande n'a répondu : la part est sans objet, pas 0 %", () => {
    const muettes = calculerBudget({
      t,
      bien: BIEN,
      lignes: [l({ reponse: null, demandes: 3, personnes: 3 })],
      reglage,
      meta: META,
      premiereDemande: "2026-10-14",
    });
    expect(muettes.part).toEqual({ etat: "sans_objet", raison: "aucune demande n'a répondu" });
    expect(muettes.cout).toEqual({ etat: "sans_objet", raison: "aucune demande dans la cible" });
  });
});
