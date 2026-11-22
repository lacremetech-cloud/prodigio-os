import { describe, expect, it } from "vitest";
import { ErreurMeta, MESSAGE_JETON_REFUSE } from "./graph";
import type { LigneInsight, PubLue } from "./lecture";
import type { FiltreCouverture, PortMeta } from "./port-meta";
import { PERIODES, type Periode } from "./periodes";
import type { RegleRattachement } from "./rattachement";
import {
  blocsDeJours,
  ecartsDuControle,
  lireMeta,
  porteesDeCouverture,
  type LigneCouverture,
  type PortBase,
  type PubDeLaPeriode,
} from "./synchro";

const AUJOURDHUI = "2026-11-12";

function ligne(jour: string, ad_id: string, depense: number, p: Partial<LigneInsight> = {}): LigneInsight {
  return {
    jour,
    ad_id,
    ad_name: "VERDUN | TERRASSE | VIDEO | V1",
    adset_id: "1",
    adset_name: "Large",
    campaign_id: "5001",
    campaign_name: "PRODIGIO | VERDUN | LEADS",
    depense_cents: depense,
    impressions: 100,
    couverture: 80,
    frequence: null,
    clics: 3,
    clics_lien: 2,
    ctr: null,
    cpm: null,
    leads: 1,
    actions: null,
    cout_par_action: null,
    ...p,
  };
}

/** Une fausse base : ce que la lecture écrit, et ce qu'elle lit. */
function fausseBase(options: { couvertJusquAu?: string | null; occupe?: boolean; regles?: RegleRattachement[]; pubs?: PubDeLaPeriode[] } = {}) {
  const ecritures: { debut: string; fin: string; lignes: number; controle: number }[] = [];
  const fins: Parameters<PortBase["terminer"]>[1][] = [];
  let couverture: LigneCouverture[] | null = null;
  const pubsEnregistrees: PubLue[] = [];
  const base: PortBase = {
    async demarrer() {
      return options.occupe ? { ok: false, occupe: true } : { ok: true, synchroId: "s1", couvertJusquAu: options.couvertJusquAu ?? null };
    },
    async remplacerTranche(_id, debut, fin, lignes, controle) {
      ecritures.push({ debut, fin, lignes: lignes.length, controle: controle.length });
    },
    async enregistrerPubs(_id, pubs) {
      pubsEnregistrees.push(...pubs);
    },
    async regles() {
      return options.regles ?? [];
    },
    async pubsDeLaPeriode() {
      return options.pubs ?? [];
    },
    async remplacerCouverture(_id, lignes) {
      couverture = lignes;
    },
    async terminer(_id, fin) {
      fins.push(fin);
    },
  };
  return { base, ecritures, fins, pubsEnregistrees, couverture: () => couverture };
}

/** Un faux Meta : il compte ses appels et n'a, lui non plus, aucun réseau. */
function fauxMeta(p: { creeLe?: string | null; lignes?: (debut: string, fin: string) => LigneInsight[]; erreurA?: number } = {}) {
  let appels = 0;
  const tranchesLues: [string, string][] = [];
  const couvertures: { periode: Periode; filtre: FiltreCouverture }[] = [];
  const meta: PortMeta = {
    async compte() {
      appels += 1;
      return { devise: "EUR", fuseau: "Europe/Paris", creeLe: p.creeLe ?? "2026-09-01T10:00:00+0200" };
    },
    async insights(debut, fin) {
      appels += 1;
      tranchesLues.push([debut, fin]);
      if (p.erreurA && tranchesLues.length === p.erreurA) throw new ErreurMeta("jeton", MESSAGE_JETON_REFUSE, 190);
      return p.lignes ? p.lignes(debut, fin) : [];
    },
    async depenseCompte(debut) {
      appels += 1;
      return [{ jour: debut, depense_compte_cents: 0 }];
    },
    async pubs() {
      appels += 1;
      return [{ ad_id: "111", ad_name: "VERDUN | A | B | V1", adset_id: "1", campaign_id: "5001", statut: "ACTIVE", lien_apercu: "https://fb.me/x", cree_le_chez_meta: null }];
    },
    async couverture(periode, filtre) {
      appels += 1;
      couvertures.push({ periode, filtre });
      return { couverture: 500, impressions: 900, debut: null, fin: null };
    },
    get appels() {
      return appels;
    },
  };
  return { meta, tranchesLues, couvertures };
}

const parametres = (meta: PortMeta, base: PortBase, echeanceMs = Number.POSITIVE_INFINITY) => ({
  meta,
  base,
  aujourdHui: AUJOURDHUI,
  maintenant: () => 0,
  echeanceMs,
  declencheur: "matin" as const,
  demandeePar: null,
});

describe("la lecture du matin", () => {
  it("la première fois, lit tout l'historique par tranches de 30 jours, jusqu'à aujourd'hui", async () => {
    const m = fauxMeta({ creeLe: "2026-09-01T10:00:00+0200" });
    const b = fausseBase();
    const bilan = await lireMeta(parametres(m.meta, b.base));
    expect(bilan.statut).toBe("reussie");
    expect(m.tranchesLues).toEqual([
      ["2026-09-01", "2026-09-30"],
      ["2026-10-01", "2026-10-30"],
      ["2026-10-31", "2026-11-12"],
    ]);
    expect(bilan.periode).toEqual({ debut: "2026-09-01", fin: AUJOURDHUI });
    expect(b.fins[0]?.statut).toBe("reussie");
  });

  it("ensuite, ne relit que les 7 jours qui précèdent le dernier jour enregistré", async () => {
    const m = fauxMeta();
    const b = fausseBase({ couvertJusquAu: "2026-11-11" });
    await lireMeta(parametres(m.meta, b.base));
    expect(m.tranchesLues).toEqual([["2026-11-04", "2026-11-12"]]);
  });

  it("remplace chaque période en entier, jours vides compris : ce que Meta ne renvoie plus disparaît", async () => {
    const m = fauxMeta({ lignes: () => [ligne("2026-11-05", "111", 1000)] });
    const b = fausseBase({ couvertJusquAu: "2026-11-11" });
    await lireMeta(parametres(m.meta, b.base));
    expect(b.ecritures).toEqual([{ debut: "2026-11-04", fin: "2026-11-12", lignes: 1, controle: 1 }]);
  });

  it("une lecture déjà en cours n'est pas doublée", async () => {
    const m = fauxMeta();
    const bilan = await lireMeta(parametres(m.meta, fausseBase({ occupe: true }).base));
    expect(bilan.statut).toBe("occupe");
    expect(m.tranchesLues).toEqual([]);
  });

  it("faute de temps, s'arrête après la tranche en cours et se dit partielle", async () => {
    const m = fauxMeta({ creeLe: "2026-01-01T00:00:00+0000" });
    const b = fausseBase();
    let t = 0;
    const bilan = await lireMeta({ ...parametres(m.meta, b.base, 2), maintenant: () => t++ });
    expect(bilan.statut).toBe("partielle");
    expect(m.tranchesLues.length).toBeGreaterThan(0);
    expect(m.tranchesLues.length).toBeLessThan(11);
    expect(b.fins[0]).toMatchObject({ statut: "partielle" });
    expect(b.fins[0]?.erreur).toMatch(/reprendra/);
    // La couverture n'est pas remplacée à moitié : celle de la veille reste.
    expect(b.couverture()).toBeNull();
  });

  it("un jeton refusé arrête la lecture, avec le message clair — ce qui est enregistré reste", async () => {
    const m = fauxMeta({ creeLe: "2026-08-01T00:00:00+0000", erreurA: 2 });
    const b = fausseBase();
    const bilan = await lireMeta(parametres(m.meta, b.base));
    expect(bilan.statut).toBe("echec");
    expect(bilan.message).toBe(MESSAGE_JETON_REFUSE);
    expect(b.ecritures).toHaveLength(1);
    expect(b.fins[0]).toMatchObject({ statut: "echec", erreur: MESSAGE_JETON_REFUSE });
  });

  it("enregistre les pubs, puis la couverture de chaque période, par bien et au total", async () => {
    const regles: RegleRattachement[] = [
      { id: "r1", type_regle: "jeton", valeur: "VERDUN", cible: "biens", biens: ["bien-1"], retiree_le: null },
      { id: "r2", type_regle: "campagne", valeur: "6001", cible: "hors_portefeuille", biens: [], retiree_le: null },
    ];
    const pubs: PubDeLaPeriode[] = [
      { ad_id: "111", campaign_id: "5001", campaign_name: "PRODIGIO | VERDUN | LEADS", ad_name: "VERDUN | A | B | V1" },
      { ad_id: "999", campaign_id: "6001", campaign_name: "ANCIEN BIEN", ad_name: "ancienne pub" },
    ];
    const m = fauxMeta();
    const b = fausseBase({ couvertJusquAu: "2026-11-11", regles, pubs });
    const bilan = await lireMeta(parametres(m.meta, b.base));
    expect(bilan.couverture).toBe("relue");
    expect(b.pubsEnregistrees).toHaveLength(1);
    const lignes = b.couverture()!;
    // Neuf périodes × (total + un bien).
    expect(lignes).toHaveLength(PERIODES.length * 2);
    const total = lignes.find((l) => l.periode === "7_derniers_jours" && l.property_id === null)!;
    expect(total).toMatchObject({ couverture: 500, pubs: 1 });
    // Le total écarte le hors portefeuille ; le bien ne compte que ses pubs.
    const filtres = m.couvertures.filter((c) => c.periode === "7_derniers_jours").map((c) => c.filtre);
    expect(filtres).toEqual([{ exclure: ["999"] }, { inclure: ["111"] }]);
  });
});

describe("le découpage des écritures et le contrôle", () => {
  it("des blocs de jours consécutifs, sans couper un jour, couvrant toute la tranche", () => {
    const lignes = [
      ...Array.from({ length: 3 }, (_, i) => ligne("2026-11-01", String(100 + i), 1)),
      ...Array.from({ length: 3 }, (_, i) => ligne("2026-11-02", String(200 + i), 1)),
      ligne("2026-11-04", "300", 1),
    ];
    const blocs = blocsDeJours("2026-11-01", "2026-11-05", lignes, 4);
    expect(blocs.map((b) => [b.debut, b.fin, b.lignes.length])).toEqual([
      ["2026-11-01", "2026-11-01", 3],
      ["2026-11-02", "2026-11-05", 4],
    ]);
  });

  it("le contrôle tolère un centime par pub (arrondis de Meta), pas davantage", () => {
    const lignes = [ligne("2026-11-01", "1", 1000), ligne("2026-11-01", "2", 500), ligne("2026-11-02", "1", 700)];
    expect(
      ecartsDuControle(lignes, [
        { jour: "2026-11-01", depense_compte_cents: 1502 },
        { jour: "2026-11-02", depense_compte_cents: 900 },
      ]),
    ).toEqual([{ jour: "2026-11-02", pubs_cents: 700, compte_cents: 900 }]);
  });

  it("les portées de couverture : un groupe compte pour chacun de ses biens", () => {
    const { exclues, parBien } = porteesDeCouverture(
      [{ ad_id: "1", campaign_id: "5", campaign_name: "PRODIGIO | CASSIS | LEADS", ad_name: "libre" }],
      [{ id: "r", type_regle: "jeton", valeur: "CASSIS", cible: "biens", biens: ["a", "b"], retiree_le: null }],
    );
    expect(exclues).toEqual([]);
    expect([...parBien.entries()]).toEqual([
      ["a", ["1"]],
      ["b", ["1"]],
    ]);
  });
});
