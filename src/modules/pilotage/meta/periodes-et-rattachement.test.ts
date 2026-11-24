import { describe, expect, it } from "vitest";
import {
  ajouterJours,
  bornes,
  fenetreDeLecture,
  nombreDeJours,
  PERIODES,
  periodeLabels,
  premierJourLisible,
  presetMeta,
  tranches,
} from "./periodes";
import {
  dansLesIndicateurs,
  indexerRegles,
  jetonDeLaCampagne,
  jetonDeLaPub,
  normaliserJeton,
  rattacher,
  repartirAuProrata,
  type RegleRattachement,
} from "./rattachement";
import { egal, entier, eurosArrondis, somme } from "../exact";

// Jeudi 12 novembre 2026.
const JEUDI = "2026-11-12";

describe("les périodes du cockpit", () => {
  it("les 7 et 30 derniers jours s'arrêtent à hier, comme dans le Gestionnaire de publicités", () => {
    expect(bornes("7_derniers_jours", JEUDI)).toEqual({ debut: "2026-11-05", fin: "2026-11-11" });
    expect(nombreDeJours("2026-11-05", "2026-11-11")).toBe(7);
    expect(bornes("30_derniers_jours", JEUDI)).toEqual({ debut: "2026-10-13", fin: "2026-11-11" });
    expect(nombreDeJours("2026-10-13", "2026-11-11")).toBe(30);
  });

  it("cette semaine part du lundi", () => {
    expect(bornes("cette_semaine", JEUDI)).toEqual({ debut: "2026-11-09", fin: JEUDI });
    expect(bornes("cette_semaine", "2026-11-09")).toEqual({ debut: "2026-11-09", fin: "2026-11-09" });
    // Un dimanche appartient à la semaine commencée le lundi précédent.
    expect(bornes("cette_semaine", "2026-11-15")).toEqual({ debut: "2026-11-09", fin: "2026-11-15" });
  });

  it("aujourd'hui, hier, ce mois, le mois dernier, cette année, toute la période", () => {
    expect(bornes("aujourdhui", JEUDI)).toEqual({ debut: JEUDI, fin: JEUDI });
    expect(bornes("hier", JEUDI)).toEqual({ debut: "2026-11-11", fin: "2026-11-11" });
    expect(bornes("ce_mois", JEUDI)).toEqual({ debut: "2026-11-01", fin: JEUDI });
    expect(bornes("mois_dernier", JEUDI)).toEqual({ debut: "2026-10-01", fin: "2026-10-31" });
    expect(bornes("mois_dernier", "2026-03-15")).toEqual({ debut: "2026-02-01", fin: "2026-02-28" });
    expect(bornes("mois_dernier", "2026-01-10")).toEqual({ debut: "2025-12-01", fin: "2025-12-31" });
    expect(bornes("cette_annee", JEUDI)).toEqual({ debut: "2026-01-01", fin: JEUDI });
    expect(bornes("toute_la_periode", JEUDI)).toEqual({ debut: null, fin: JEUDI });
  });

  it("chaque période a son libellé et son préréglage Meta", () => {
    for (const p of PERIODES) {
      expect(periodeLabels[p]).toBeTruthy();
      expect(presetMeta[p]).toBeTruthy();
    }
    expect(presetMeta["7_derniers_jours"]).toBe("last_7d");
    expect(presetMeta.cette_semaine).toBe("this_week_mon_today");
    expect(presetMeta.toute_la_periode).toBe("maximum");
  });
});

describe("le découpage des lectures", () => {
  it("des tranches de 30 jours consécutives, qui couvrent tout sans chevauchement", () => {
    const t = tranches("2026-01-01", "2026-03-15", 30);
    expect(t).toEqual([
      ["2026-01-01", "2026-01-30"],
      ["2026-01-31", "2026-03-01"],
      ["2026-03-02", "2026-03-15"],
    ]);
    expect(tranches("2026-03-15", "2026-03-15")).toEqual([["2026-03-15", "2026-03-15"]]);
    expect(tranches("2026-03-16", "2026-03-15")).toEqual([]);
  });

  it("la première fois, tout l'historique ; ensuite, les 7 jours qui précèdent le dernier jour lu", () => {
    expect(fenetreDeLecture(null, "2025-06-01T10:00:00+0200", JEUDI)).toEqual({
      debut: "2025-06-01",
      fin: JEUDI,
      premiereFois: true,
    });
    expect(fenetreDeLecture("2026-11-11", "2025-06-01T10:00:00+0200", JEUDI)).toEqual({
      debut: "2026-11-04",
      fin: JEUDI,
      premiereFois: false,
    });
  });

  it("Meta ne rend que 37 mois : on ne remonte pas au-delà", () => {
    expect(premierJourLisible("2019-01-01T00:00:00+0000", JEUDI)).toBe("2023-10-13");
    expect(premierJourLisible(null, JEUDI)).toBe("2023-10-13");
    expect(premierJourLisible("2025-06-01", JEUDI)).toBe("2025-06-01");
    expect(ajouterJours("2026-03-01", -1)).toBe("2026-02-28");
  });
});

const VERDUN = "b1";
const JAURES = "b2";
const AIRELLES = "b3";

function regle(p: Partial<RegleRattachement> & Pick<RegleRattachement, "type_regle" | "valeur">): RegleRattachement {
  return { id: `r-${p.valeur}`, cible: "biens", biens: [VERDUN], retiree_le: null, ...p };
}

const REGLES = indexerRegles([
  regle({ type_regle: "jeton", valeur: "VERDUN", biens: [VERDUN] }),
  regle({ type_regle: "jeton", valeur: "JAURES", biens: [JAURES] }),
  regle({ type_regle: "jeton", valeur: "CASSIS", biens: [VERDUN, JAURES] }),
  regle({ type_regle: "jeton", valeur: "AIRELLES", biens: [AIRELLES] }),
  regle({ type_regle: "campagne", valeur: "6001", cible: "hors_portefeuille", biens: [] }),
  regle({ type_regle: "jeton", valeur: "ANCIEN", biens: [AIRELLES], retiree_le: "2026-11-10T10:00:00Z" }),
]);

describe("le rattachement d'une pub à un bien", () => {
  it("lit la convention de nommage, accents et casse compris", () => {
    expect(normaliserJeton("  Jaurès  ")).toBe("JAURES");
    expect(jetonDeLaPub("Verdun | Terrasse | Vidéo | V1")).toBe("VERDUN");
    expect(jetonDeLaPub("Vidéo - Terrasse - v3")).toBeNull();
    expect(jetonDeLaCampagne("PRODIGIO | Cassis | LEADS")).toBe("CASSIS");
    expect(jetonDeLaCampagne("Campagne Cassis")).toBeNull();
    expect(jetonDeLaCampagne("AUTRE | CASSIS | LEADS")).toBeNull();
  });

  it("la pub, plus précise, passe avant la campagne", () => {
    const r = rattacher(
      { campaign_id: "5001", campaign_name: "PRODIGIO | CASSIS | LEADS", ad_name: "JAURES | VUE | REEL | V2" },
      REGLES,
    );
    expect(r).toMatchObject({ type: "biens", biens: [JAURES], source: "nom_pub", jeton: "JAURES" });
  });

  it("une pub au nom libre retombe sur la campagne — un groupe, à répartir", () => {
    const r = rattacher(
      { campaign_id: "5001", campaign_name: "PRODIGIO | CASSIS | LEADS", ad_name: "Vidéo - Terrasse - v3" },
      REGLES,
    );
    expect(r).toMatchObject({ type: "biens", biens: [VERDUN, JAURES], source: "nom_campagne" });
  });

  it("une exception par campagne prime sur tout : l'ancien bien est hors portefeuille", () => {
    const r = rattacher({ campaign_id: "6001", campaign_name: "PRODIGIO | VERDUN | LEADS", ad_name: "VERDUN | A | B | V1" }, REGLES);
    expect(r).toMatchObject({ type: "hors_portefeuille", source: "exception_campagne" });
    expect(dansLesIndicateurs(r)).toBe(false);
  });

  it("sans règle : orpheline, comptée et signalée — et une règle retirée ne compte plus", () => {
    const r = rattacher({ campaign_id: "7001", campaign_name: "PRODIGIO | ANCIEN | LEADS", ad_name: "ANCIEN | X | Y | V1" }, REGLES);
    expect(r).toEqual({ type: "orpheline", jetonPub: "ANCIEN", jetonCampagne: "ANCIEN" });
    expect(dansLesIndicateurs(r)).toBe(true);
    expect(rattacher({ campaign_id: null, campaign_name: null, ad_name: null }, REGLES).type).toBe("orpheline");
  });
});

describe("la répartition d'une dépense commune, au prorata du prix affiché", () => {
  const prix = new Map<string, number | null>([
    [VERDUN, 150_000_000],
    [JAURES, 130_000_000],
    [AIRELLES, null],
  ]);

  it("un bien seul prend tout", () => {
    const r = repartirAuProrata(10_000, [VERDUN], prix);
    expect(r.ok && egal(r.parts.get(VERDUN)!, entier(10_000))).toBe(true);
  });

  it("deux biens : au prorata, et la somme des parts vaut exactement le montant", () => {
    const r = repartirAuProrata(280_00, [VERDUN, JAURES], prix);
    if (!r.ok) throw new Error("répartition attendue");
    expect(eurosArrondis(r.parts.get(VERDUN)!)).toBe(150);
    expect(eurosArrondis(r.parts.get(JAURES)!)).toBe(130);
    expect(egal(somme([...r.parts.values()]), entier(280_00))).toBe(true);
  });

  it("un prix manquant rend la répartition impossible, et dit lequel — jamais une part égale par défaut", () => {
    expect(repartirAuProrata(10_000, [VERDUN, AIRELLES], prix)).toEqual({ ok: false, biensSansPrix: [AIRELLES] });
  });
});
