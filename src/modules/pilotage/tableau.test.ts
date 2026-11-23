import { describe, expect, it } from "vitest";
import type {
  PilotageConditionsRow,
  PilotageCoutFixeRow,
  PilotageLotRow,
  PilotageLotVersionRow,
  PilotageMetaCouvertureRow,
  PilotageMetaSynchroRow,
  PilotageMetaTotalPubRow,
} from "@/lib/supabase/types";
import { centimesArrondis, divise, entier, plus, type Exact } from "./exact";
import { bornes } from "./meta/periodes";
import type { RegleRattachement } from "./meta/rattachement";
import {
  calculerTableau,
  CLE_NON_RATTACHEE,
  resoudrePeriode,
  type BienDuTableau,
  type Calcule,
  type ChoixPeriode,
  type DonneesMeta,
  type EntreeTableau,
} from "./tableau";

/**
 * LA PAGE PILOTAGE, CALCULÉE SUR DES DONNÉES FICTIVES. Seuls les deux exemples
 * de contrôle du brief (1 400 000 € à 3,75 % et 70 % → 29 518 € HT ;
 * 1 200 000 € à 3,75 % et 50 % → 18 072 € HT) sont des chiffres connus.
 */

const JOUR = "2026-11-23";
const A = "aaaaaaaa-0000-4000-8000-000000000001";
const B = "bbbbbbbb-0000-4000-8000-000000000002";
const C = "cccccccc-0000-4000-8000-000000000003";
const D = "dddddddd-0000-4000-8000-000000000004";

const euros = (x: Exact) => Math.round(centimesArrondis(x) / 100);
const ok = (c: Calcule): Exact => {
  expect(c.etat).toBe("ok");
  return (c as { etat: "ok"; valeur: Exact }).valeur;
};

function conditions(propertyId: string, p: Partial<PilotageConditionsRow> = {}): PilotageConditionsRow {
  return {
    id: `c-${propertyId}`,
    property_id: propertyId,
    date_effet: "2026-11-12",
    vente_par_lots: false,
    nature_prix: "fai",
    prix_affiche_cents: 140_000_000,
    taux_commission_pct: "3.75",
    base_honoraires: "TTC",
    part_prodigio_pct: "70",
    taux_tva_pct: "20",
    statut_commercial: "a_vendre",
    prix_vente_final_cents: null,
    vendu_le: null,
    motif: "fictif",
    saisi_le: "2026-11-12T10:00:00Z",
    saisi_par: null,
    ...p,
  } as PilotageConditionsRow;
}

function lot(id: string, numero: string): PilotageLotRow {
  return { id, property_id: B, numero, cree_le: "2026-11-12T10:00:00Z", cree_par: null };
}

function etat(lotId: string, prix: number | null, p: Partial<PilotageLotVersionRow> = {}): PilotageLotVersionRow {
  return {
    id: `v-${lotId}`,
    lot_id: lotId,
    description: null,
    prix_cents: prix,
    statut_commercial: "a_vendre",
    prix_vente_final_cents: null,
    vendu_le: null,
    retire: false,
    motif: "fictif",
    saisi_le: "2026-11-12T10:05:00Z",
    saisi_par: null,
    ...p,
  } as PilotageLotVersionRow;
}

function cout(propertyId: string, montant: number): PilotageCoutFixeRow {
  return {
    id: `k-${propertyId}-${montant}`,
    property_id: propertyId,
    type_cout: "production",
    montant_ht_cents: montant,
    note: null,
    saisi_le: "2026-11-13T09:00:00Z",
    saisi_par: null,
    cle_saisie: null,
    annule_le: null,
    annule_par: null,
    motif_annulation: null,
  } as PilotageCoutFixeRow;
}

function bien(id: string, nom: string, p: Partial<BienDuTableau> = {}): BienDuTableau {
  return { id, nom, conditions: [], lots: [], etatsDesLots: [], couts: [], photographieMandat: null, ...p };
}

/** Villa A (1 400 000 € FAI, 70 %) ; programme B en deux lots (1 200 000 € et 900 000 €, 50 %) ; C sans rien. */
function lesBiens(): BienDuTableau[] {
  return [
    bien(A, "Villa test A", { conditions: [conditions(A)], couts: [cout(A, 500_000)] }),
    bien(B, "Programme test B", {
      conditions: [
        conditions(B, { vente_par_lots: true, prix_affiche_cents: null, part_prodigio_pct: "50", statut_commercial: null, saisi_le: "2026-11-12T11:00:00Z" }),
      ],
      lots: [lot("l1", "1"), lot("l2", "2")],
      etatsDesLots: [etat("l1", 120_000_000), etat("l2", 90_000_000)],
      couts: [cout(B, 210_000)],
    }),
    bien(C, "Bien test C"),
  ];
}

function pub(adId: string, p: Partial<PilotageMetaTotalPubRow>): PilotageMetaTotalPubRow {
  return {
    ad_id: adId,
    ad_name: null,
    adset_id: "1",
    adset_name: "Ensemble",
    campaign_id: "500",
    campaign_name: "Campagne",
    depense_cents: 0,
    impressions: 0,
    clics: 0,
    clics_lien: 0,
    leads: 0,
    premier_jour: "2026-10-01",
    dernier_jour: "2026-11-22",
    ...p,
  };
}

const REGLES: RegleRattachement[] = [
  { id: "r1", type_regle: "jeton", valeur: "VILLA A", cible: "biens", biens: [A], retiree_le: null },
  { id: "r2", type_regle: "jeton", valeur: "GROUPE", cible: "biens", biens: [A, B], retiree_le: null },
  { id: "r3", type_regle: "campagne", valeur: "120000000000000099", cible: "hors_portefeuille", biens: [], retiree_le: null },
];

const DEPUIS = [
  pub("11", { ad_name: "VILLA A | VUE | REEL | V1", depense_cents: 100_000, impressions: 50_000, clics: 500, leads: 20 }),
  pub("22", { ad_name: "GROUPE | DUO | REEL | V1", depense_cents: 60_000, impressions: 30_000, clics: 300, leads: 6 }),
  pub("33", { campaign_id: "120000000000000099", campaign_name: "Ancien bien", depense_cents: 33_000, leads: 2 }),
  pub("44", { ad_name: "Copie de pub", depense_cents: 12_500, impressions: 4_000, clics: 40, leads: 1 }),
];

const PERIODE = [
  pub("11", { ad_name: "VILLA A | VUE | REEL | V1", depense_cents: 30_000, impressions: 15_000, clics: 150, leads: 6 }),
  pub("22", { ad_name: "GROUPE | DUO | REEL | V1", depense_cents: 10_000, impressions: 5_000, clics: 50, leads: 2 }),
  pub("44", { ad_name: "Copie de pub", depense_cents: 5_000, impressions: 1_000, clics: 10, leads: 1 }),
];

function lecture(p: Partial<PilotageMetaSynchroRow> = {}): PilotageMetaSynchroRow {
  return {
    id: "s1",
    demarree_le: "2026-11-23T05:17:00Z",
    terminee_le: "2026-11-23T05:18:00Z",
    declencheur: "matin",
    demandee_par: null,
    statut: "reussie",
    periode_debut: "2026-11-15",
    periode_fin: JOUR,
    couvert_jusqu_au: JOUR,
    appels_api: 31,
    lignes_lues: 151,
    devise: "EUR",
    erreur: null,
    details: null,
    ...p,
  };
}

function couverture(propertyId: string | null, c: number | null, impressions: number | null, p: Partial<PilotageMetaCouvertureRow> = {}): PilotageMetaCouvertureRow {
  const b = bornes("7_derniers_jours", JOUR);
  return {
    periode: "7_derniers_jours",
    property_id: propertyId,
    couverture: c,
    impressions,
    date_debut: b.debut,
    date_fin: b.fin,
    pubs: 2,
    raison: null,
    synchro_id: "s1",
    lu_le: "2026-11-23T05:18:00Z",
    ...p,
  };
}

function meta(p: Partial<DonneesMeta> = {}): DonneesMeta {
  return {
    lectures: [lecture()],
    depuisLeDebut: DEPUIS,
    surLaPeriode: PERIODE,
    parJour: [
      { jour: "2026-11-20", ad_id: "11", depense_cents: 10_000, leads: 2 },
      { jour: "2026-11-21", ad_id: "22", depense_cents: 10_000, leads: 2 },
      { jour: "2026-11-21", ad_id: "33", depense_cents: 9_999, leads: 9 },
      { jour: "2026-11-22", ad_id: "44", depense_cents: 5_000, leads: 1 },
    ],
    couverture: [couverture(null, 9_000, 20_000), couverture(A, 5_000, 12_000)],
    pubs: [{ ad_id: "11", ad_name: null, adset_id: null, campaign_id: null, statut: "ACTIVE", lien_apercu: "https://exemple.test/apercu/11", cree_le_chez_meta: null, vue_le: "2026-11-23T05:18:00Z", synchro_id: "s1" }],
    regles: REGLES,
    joursEnEcart: 0,
    ...p,
  };
}

function tableau(p: Partial<EntreeTableau> = {}) {
  const choix: ChoixPeriode = { type: "proposee", periode: "7_derniers_jours" };
  return calculerTableau({ jour: JOUR, choix, biens: lesBiens(), meta: meta(), ...p });
}

describe("les commissions, depuis le début", () => {
  it("rendent les deux exemples de contrôle du brief", () => {
    const t = tableau();
    const villa = t.biens.find((b) => b.id === A)!;
    expect(euros(villa.potentielHT!.centimes)).toBe(29_518);
    const prog = t.biens.find((b) => b.id === B)!;
    const lot1 = prog.lots!.find((l) => l.numero === "1")!;
    expect(lot1.potentiel!.comProdigioHT.ok && euros(lot1.potentiel!.comProdigioHT.centimes)).toBe(18_072);
    // Le total est la somme EXACTE des biens, arrondie seulement à l'affichage.
    expect(t.global.potentielHT.complet).toBe(true);
    expect(t.global.potentielHT.centimes).toEqual(plus(villa.potentielHT!.centimes, prog.potentielHT!.centimes));
  });

  it("un bien sans donnée ni dépense n'entre pas au pilotage ; les couleurs suivent l'ordre des premières saisies", () => {
    const t = tableau();
    expect(t.biens.map((b) => b.id)).toEqual([A, B]);
    expect(t.biens.map((b) => b.couleur)).toEqual([0, 1]);
  });

  it("une dépense rattachée à un bien sans conditions : commission « manquante », jamais 0 — et la rentabilité globale le dit", () => {
    const t = tableau({
      biens: [...lesBiens(), bien(D, "Bien test D")],
      meta: meta({ regles: [...REGLES, { id: "r4", type_regle: "jeton", valeur: "COPIE", cible: "biens", biens: [D], retiree_le: null }], depuisLeDebut: [...DEPUIS, pub("55", { ad_name: "COPIE | A | B | V1", depense_cents: 7_000 })] }),
    });
    const d = t.biens.find((b) => b.id === D)!;
    expect(d.potentielHT).toBeNull();
    expect(d.rentabilite.roas).toEqual({ etat: "manquant", raison: "aucune condition saisie" });
    expect(t.global.potentielHT.complet).toBe(false);
    expect(t.global.rentabilite.roas).toEqual({ etat: "manquant", raison: "un bien du pilotage n'a pas de conditions saisies" });
  });
});

describe("le rattachement : biens, groupe au prorata, hors portefeuille, non rattaché", () => {
  it("la pub commune se répartit au prorata du prix affiché (somme des lots pour un programme)", () => {
    const t = tableau();
    const villa = t.biens.find((b) => b.id === A)!;
    const prog = t.biens.find((b) => b.id === B)!;
    // Poids : 1 400 000 contre 2 100 000 → 40 % / 60 % de 60 000 centimes.
    expect(centimesArrondis(villa.depuisLeDebut!.depense)).toBe(100_000 + 24_000);
    expect(centimesArrondis(prog.depuisLeDebut!.depense)).toBe(36_000);
    expect(villa.depensesCommunes && prog.depensesCommunes).toBe(true);
    // Le total compte le non rattaché, pas le hors portefeuille.
    expect(centimesArrondis(t.global.depuisLeDebut!.depense)).toBe(100_000 + 60_000 + 12_500);
    expect(centimesArrondis(t.global.horsPortefeuille.depuisLeDebut)).toBe(33_000);
    expect(centimesArrondis(t.global.nonRattachee.depuisLeDebut)).toBe(12_500);
  });

  it("ROAS et marge nette d'un bien : commission HT ÷ pub, commission − pub − coûts fixes", () => {
    const villa = tableau().biens.find((b) => b.id === A)!;
    const com = villa.potentielHT!.centimes;
    expect(ok(villa.rentabilite.roas)).toEqual(divise(com, entier(124_000)));
    expect(centimesArrondis(ok(villa.rentabilite.margeNetteHT))).toBe(centimesArrondis(com) - 124_000 - 500_000);
  });

  it("les lots d'un programme : pub et coûts fixes au prorata du prix des lots", () => {
    const prog = tableau().biens.find((b) => b.id === B)!;
    const [l1, l2] = prog.lots!;
    expect(centimesArrondis(ok(l1!.pubHT))).toBe(Math.round((36_000 * 120) / 210));
    expect(centimesArrondis(ok(l2!.coutsFixesHT))).toBe(Math.round((210_000 * 90) / 210));
  });

  it("un lot sans prix rend la répartition entre lots « manquante »", () => {
    const biens = lesBiens();
    biens[1] = { ...biens[1]!, etatsDesLots: [etat("l1", 120_000_000), etat("l2", null)] };
    const prog = tableau({ biens }).biens.find((b) => b.id === B)!;
    expect(prog.lots!.every((l) => l.pubHT.etat === "manquant")).toBe(true);
  });

  it("un groupe dont un bien n'a pas de prix : la pub n'est pas répartie, elle est comptée et signalée", () => {
    const biens = lesBiens();
    biens[0] = { ...biens[0]!, conditions: [conditions(A, { prix_affiche_cents: null })] };
    const t = tableau({ biens });
    expect(centimesArrondis(t.global.nonRattachee.depuisLeDebut)).toBe(60_000 + 12_500);
    expect(t.alertes.some((a) => a.texte.startsWith("Une pub commune ne peut pas être répartie : prix manquant pour Villa test A"))).toBe(true);
  });
});

describe("la performance Meta sur la période", () => {
  it("coût par lead, CTR (tous les clics) et CPM se calculent sur les sommes, jamais en moyennant des taux", () => {
    const g = tableau().global.surLaPeriode!;
    expect(centimesArrondis(g.depense)).toBe(45_000);
    expect(ok(g.coutParLead)).toEqual(divise(entier(45_000), entier(9)));
    expect(ok(g.ctr)).toEqual(divise(entier(210), entier(21_000)));
    expect(ok(g.cpm)).toEqual(divise(entier(45_000 * 1000), entier(21_000)));
  });

  it("la fréquence : impressions ÷ couverture lues ensemble chez Meta, au total et par bien", () => {
    const t = tableau();
    expect(t.global.frequence).toMatchObject({ etat: "ok", valeur: 20_000 / 9_000 });
    expect(t.biens.find((b) => b.id === A)!.frequence).toMatchObject({ etat: "ok", valeur: 12_000 / 5_000 });
    // Pas de couverture lue pour B sur cette période : en attente, jamais 0.
    expect(t.biens.find((b) => b.id === B)!.frequence).toEqual({ etat: "en_attente" });
  });

  it("la fréquence vaut « — » pour des dates au choix, et « en attente » si la couverture date d'un autre jour", () => {
    expect(tableau({ choix: { type: "dates", debut: "2026-11-01", fin: "2026-11-10" } }).global.frequence).toEqual({ etat: "dates_au_choix" });
    const decalee = meta({ couverture: [couverture(null, 9_000, 20_000, { date_fin: "2026-11-21" })] });
    expect(tableau({ meta: decalee }).global.frequence).toEqual({ etat: "en_attente" });
    const illisible = meta({ couverture: [couverture(null, null, null, { raison: "trop de pubs (120) pour une seule lecture de couverture" })] });
    expect(tableau({ meta: illisible }).global.frequence).toEqual({ etat: "indisponible", raison: "trop de pubs (120) pour une seule lecture de couverture" });
  });

  it("Meta jamais lu : tout ce qui vient de Meta est « en attente », la commission reste calculée", () => {
    const t = tableau({ meta: meta({ lectures: [] }) });
    const villa = t.biens.find((b) => b.id === A)!;
    expect(villa.depuisLeDebut).toBeNull();
    expect(villa.surLaPeriode).toBeNull();
    expect(villa.rentabilite.pubHT).toEqual({ etat: "en_attente" });
    expect(villa.rentabilite.roas).toEqual({ etat: "en_attente" });
    expect(villa.frequence).toEqual({ etat: "en_attente" });
    expect(euros(villa.potentielHT!.centimes)).toBe(29_518);
    expect(t.alertes[0]!.texte).toMatch(/pas encore été lus/);
  });
});

describe("pubs gagnantes, série par jour, alertes", () => {
  it("le plus de leads, puis le moins cher par lead ; jamais une pub hors portefeuille", () => {
    const egalite = meta({
      surLaPeriode: [
        pub("11", { ad_name: "VILLA A | X | Y | V1", depense_cents: 9_000, leads: 3 }),
        pub("12", { ad_name: "VILLA A | Z | Y | V2", depense_cents: 6_000, leads: 3 }),
        pub("33", { campaign_id: "120000000000000099", depense_cents: 1_000, leads: 50 }),
      ],
    });
    const t = tableau({ meta: egalite });
    expect(t.global.pubsGagnantes.map((p) => p.adId)).toEqual(["12", "11"]);
    expect(t.biens.find((b) => b.id === A)!.pubsGagnantes.map((p) => p.adId)).toEqual(["12", "11"]);
    expect(tableau().global.pubsGagnantes[0]).toMatchObject({ adId: "11", lienApercu: "https://exemple.test/apercu/11" });
  });

  it("la série suit les biens (hors portefeuille exclu), jour par jour jusqu'à deux mois, puis semaine par semaine", () => {
    const t = tableau();
    expect(t.serie.pas).toBe("jour");
    expect(t.serie.points).toHaveLength(7);
    const le21 = t.serie.points.find((p) => p.debut === "2026-11-21")!;
    expect(centimesArrondis(le21.depense.get(A)!)).toBe(4_000);
    expect(centimesArrondis(le21.depense.get(B)!)).toBe(6_000);
    expect([...le21.depense.keys()]).not.toContain("33");
    expect(t.serie.points.find((p) => p.debut === "2026-11-22")!.depense.get(CLE_NON_RATTACHEE)).toBeDefined();

    const longue = tableau({ choix: { type: "proposee", periode: "toute_la_periode" } });
    expect(longue.periode.debut).toBe("2026-10-01");
    expect(longue.serie.pas).toBe("jour");
    const annee = tableau({ choix: { type: "dates", debut: "2026-08-01", fin: "2026-11-22" } });
    expect(annee.serie.pas).toBe("semaine");
    expect(annee.serie.points[1]!.debut).toBe("2026-08-03"); // un lundi
  });

  it("« À savoir » : non rattaché, hors portefeuille, lecture en échec, écarts de contrôle", () => {
    const t = tableau({ meta: meta({ lectures: [lecture({ id: "s2", statut: "echec", erreur: "Erreur inattendue pendant la lecture Meta." }), lecture()], joursEnEcart: 2 }) });
    const textes = t.alertes.map((a) => a.texte.replace(/[\u00a0\u202f]/g, " "));
    expect(textes).toContain("125 € de dépense ne sont rattachés à aucun bien (1 pub) : comptés dans les totaux, absents des biens.");
    expect(textes).toContain("330 € de dépense hors portefeuille (1 pub) : exclus des indicateurs.");
    expect(textes.some((x) => x.startsWith("La dernière lecture Meta a échoué"))).toBe(true);
    expect(textes).toContain("2 jours sur les 90 derniers : la somme des pubs s'écarte de la dépense du compte.");
  });

  it("les périodes : « toute la période » part du premier jour lu ; les dates au choix gardent leurs bornes", () => {
    expect(resoudrePeriode({ type: "proposee", periode: "toute_la_periode" }, JOUR, null)).toMatchObject({ debut: null, fin: JOUR });
    expect(resoudrePeriode({ type: "proposee", periode: "30_derniers_jours" }, JOUR, null)).toMatchObject({ debut: "2026-10-24", fin: "2026-11-22" });
    expect(resoudrePeriode({ type: "dates", debut: "2026-11-01", fin: "2026-11-10" }, JOUR, null).libelle).toBe("Du 1 nov. 2026 au 10 nov. 2026");
  });
});
