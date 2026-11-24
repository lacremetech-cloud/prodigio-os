import { describe, expect, it } from "vitest";
import {
  creerClientGraph,
  ErreurMeta,
  estLimiteDeDebit,
  MESSAGE_DROITS,
  MESSAGE_JETON_REFUSE,
  META_GRAPH_VERSION,
} from "./graph";
import { creerPortMeta, identifiantDeCompte } from "./port-meta";

/**
 * UN FAUX META, SANS RÉSEAU. Chaque requête est enregistrée telle que le
 * client l'émet : méthode, adresse, en-têtes. On peut donc vérifier ce qui part
 * vraiment — et surtout ce qui ne part jamais (une écriture, un jeton dans
 * l'adresse).
 */
interface Requete {
  methode: string;
  url: URL;
  entetes: Record<string, string>;
}

function fauxMeta(reponses: ((r: Requete) => { status?: number; corps: unknown })[]) {
  const requetes: Requete[] = [];
  let i = 0;
  const fauxFetch = (async (entree: RequestInfo | URL, init?: RequestInit) => {
    const r: Requete = {
      methode: init?.method ?? "GET",
      url: new URL(String(entree)),
      entetes: (init?.headers ?? {}) as Record<string, string>,
    };
    requetes.push(r);
    const fabrique = reponses[Math.min(i, reponses.length - 1)]!;
    i += 1;
    const { status = 200, corps } = fabrique(r);
    return new Response(JSON.stringify(corps), { status, headers: { "content-type": "application/json" } });
  }) as typeof globalThis.fetch;
  return { fetch: fauxFetch, requetes };
}

const JETON = "faux-jeton-de-lecture-pour-les-tests";
const sansAttente = async () => {};

describe("le client Graph : lecture seule, jeton dans l'en-tête", () => {
  it("n'émet que des GET, en v27.0, jeton dans Authorization et jamais dans l'adresse", async () => {
    const meta = fauxMeta([() => ({ corps: { currency: "EUR", timezone_name: "Europe/Paris", created_time: "2025-06-01T10:00:00+0200" } })]);
    const port = creerPortMeta("act_1234567", { jeton: JETON, fetch: meta.fetch, attendre: sansAttente });
    await port.compte();
    const r = meta.requetes[0]!;
    expect(r.methode).toBe("GET");
    expect(r.url.pathname).toBe(`/${META_GRAPH_VERSION}/act_1234567`);
    expect(META_GRAPH_VERSION).toBe("v27.0");
    expect(r.entetes.Authorization).toBe(`Bearer ${JETON}`);
    expect(r.url.toString()).not.toContain(JETON);
    expect(r.url.searchParams.has("access_token")).toBe(false);
  });

  it("refuse de mettre un jeton dans l'adresse, même si on le lui demande", async () => {
    const meta = fauxMeta([() => ({ corps: {} })]);
    const graph = creerClientGraph({ jeton: JETON, fetch: meta.fetch, attendre: sansAttente });
    await expect(graph.objet("act_1", { access_token: "x" })).rejects.toThrow(/URL/);
    expect(meta.requetes).toHaveLength(0);
  });

  it("pagine par curseur, sans suivre le lien `next` de Meta (il peut porter le jeton)", async () => {
    const meta = fauxMeta([
      () => ({
        corps: {
          data: [{ n: 1 }, { n: 2 }],
          paging: { cursors: { after: "CURSEUR1" }, next: "https://graph.facebook.com/v27.0/x?access_token=FUITE&after=CURSEUR1" },
        },
      }),
      () => ({ corps: { data: [{ n: 3 }], paging: { cursors: { after: "CURSEUR2" } } } }),
    ]);
    const graph = creerClientGraph({ jeton: JETON, fetch: meta.fetch, attendre: sansAttente });
    const lignes = await graph.liste("act_1/insights", { level: "ad" });
    expect(lignes).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }]);
    expect(meta.requetes).toHaveLength(2);
    expect(meta.requetes[1]!.url.searchParams.get("after")).toBe("CURSEUR1");
    expect(meta.requetes[1]!.url.toString()).not.toContain("FUITE");
  });

  it("reprend après une limite de débit (17), puis réussit", async () => {
    const attentes: number[] = [];
    const meta = fauxMeta([
      () => ({ status: 400, corps: { error: { code: 17, message: "User request limit reached" } } }),
      () => ({ status: 400, corps: { error: { code: 80004, message: "too many calls" } } }),
      () => ({ corps: { data: [{ ok: true }] } }),
    ]);
    const graph = creerClientGraph({
      jeton: JETON,
      fetch: meta.fetch,
      attendre: async (ms) => {
        attentes.push(ms);
      },
    });
    expect(await graph.liste("act_1/insights", {})).toEqual([{ ok: true }]);
    expect(attentes).toEqual([1000, 2000]);
    expect(graph.appels).toBe(3);
    for (const code of [4, 17, 32, 613, 80000, 80014]) expect(estLimiteDeDebit(code)).toBe(true);
    expect(estLimiteDeDebit(80015)).toBe(false);
  });

  it("s'arrête proprement quand l'échéance approche, au lieu de reprendre sans fin", async () => {
    const meta = fauxMeta([() => ({ status: 400, corps: { error: { code: 613 } } })]);
    const graph = creerClientGraph({
      jeton: JETON,
      fetch: meta.fetch,
      attendre: sansAttente,
      maintenant: () => 1_000,
      echeanceMs: 1_500,
    });
    const erreur = await graph.liste("act_1/insights", {}).catch((e: unknown) => e);
    expect(erreur).toBeInstanceOf(ErreurMeta);
    expect((erreur as ErreurMeta).genre).toBe("limite");
    expect(meta.requetes).toHaveLength(1);
  });

  it("dit en clair un jeton refusé (190) et des droits manquants — sans le texte brut de Meta", async () => {
    const jeton = fauxMeta([() => ({ status: 400, corps: { error: { code: 190, message: "Error validating access token: texte-brut-de-meta" } } })]);
    const e1 = await creerClientGraph({ jeton: JETON, fetch: jeton.fetch, attendre: sansAttente })
      .objet("act_1", {})
      .catch((e: unknown) => e as ErreurMeta);
    expect(e1).toMatchObject({ genre: "jeton", message: MESSAGE_JETON_REFUSE });
    expect((e1 as ErreurMeta).message).not.toContain("texte-brut-de-meta");

    for (const [code, sousCode] of [[10, undefined], [200, undefined], [100, 33]] as const) {
      const droits = fauxMeta([() => ({ status: 400, corps: { error: { code, error_subcode: sousCode } } })]);
      const e2 = await creerClientGraph({ jeton: JETON, fetch: droits.fetch, attendre: sansAttente })
        .objet("act_1", {})
        .catch((e: unknown) => e as ErreurMeta);
      expect(e2).toMatchObject({ genre: "droits", message: MESSAGE_DROITS });
    }
  });

  it("une autre erreur ne rend que son code", async () => {
    const meta = fauxMeta([() => ({ status: 400, corps: { error: { code: 100, error_subcode: 1487534, message: "Invalid parameter (filtering)" } } })]);
    const e = await creerClientGraph({ jeton: JETON, fetch: meta.fetch, attendre: sansAttente })
      .objet("act_1", {})
      .catch((err: unknown) => err as ErreurMeta);
    expect(e).toMatchObject({ genre: "reponse", code: 100 });
    expect(e.message).toBe("Meta a refusé la lecture (code 100/1487534).");
  });

  it("un réseau coupé est repris, puis signalé sans détail technique", async () => {
    let n = 0;
    const panne = (async () => {
      n += 1;
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    const e = await creerClientGraph({ jeton: JETON, fetch: panne, attendre: sansAttente, maxReprises: 2 })
      .objet("act_1", {})
      .catch((err: unknown) => err as ErreurMeta);
    expect(n).toBe(3);
    expect(e.genre).toBe("reseau");
  });
});

describe("le port Meta : ce que l'on demande, exactement", () => {
  it("insights au niveau de la pub, jour par jour, avec les champs du brief", async () => {
    const meta = fauxMeta([() => ({ corps: { data: [] } })]);
    const port = creerPortMeta("1234567", { jeton: JETON, fetch: meta.fetch, attendre: sansAttente });
    await port.insights("2026-11-01", "2026-11-30");
    const p = meta.requetes[0]!.url.searchParams;
    expect(meta.requetes[0]!.url.pathname).toBe("/v27.0/act_1234567/insights");
    expect(p.get("level")).toBe("ad");
    expect(p.get("time_increment")).toBe("1");
    expect(JSON.parse(p.get("time_range")!)).toEqual({ since: "2026-11-01", until: "2026-11-30" });
    for (const champ of [
      "date_start", "date_stop", "campaign_id", "campaign_name", "adset_id", "adset_name", "ad_id", "ad_name",
      "spend", "impressions", "reach", "frequency", "clicks", "inline_link_clicks", "ctr", "cpm", "actions",
      "cost_per_action_type",
    ]) {
      expect(p.get("fields")!.split(",")).toContain(champ);
    }
  });

  it("le contrôle au niveau du compte, et la couverture filtrée sur les pubs du bien", async () => {
    const meta = fauxMeta([
      () => ({ corps: { data: [{ date_start: "2026-11-01", date_stop: "2026-11-01", spend: "10.00" }] } }),
      () => ({ corps: { data: [{ reach: "900", impressions: "2000", date_start: "2026-11-05", date_stop: "2026-11-11" }] } }),
      () => ({ corps: { data: [] } }),
    ]);
    const port = creerPortMeta("1234567", { jeton: JETON, fetch: meta.fetch, attendre: sansAttente });
    expect(await port.depenseCompte("2026-11-01", "2026-11-01")).toEqual([{ jour: "2026-11-01", depense_compte_cents: 1000 }]);
    expect(meta.requetes[0]!.url.searchParams.get("level")).toBe("account");

    expect(await port.couverture("7_derniers_jours", { inclure: ["111", "222"] })).toEqual({
      couverture: 900,
      impressions: 2000,
      debut: "2026-11-05",
      fin: "2026-11-11",
    });
    const p = meta.requetes[1]!.url.searchParams;
    expect(p.get("date_preset")).toBe("last_7d");
    expect(JSON.parse(p.get("filtering")!)).toEqual([{ field: "ad.id", operator: "IN", value: ["111", "222"] }]);

    // Aucune ligne : personne touché sur la période — un vrai zéro.
    expect(await port.couverture("aujourdhui", { exclure: [] })).toEqual({ couverture: 0, impressions: 0, debut: null, fin: null });
    expect(meta.requetes[2]!.url.searchParams.has("filtering")).toBe(false);
  });

  it("accepte l'identifiant de compte avec ou sans « act_ », et refuse le reste", () => {
    expect(identifiantDeCompte("act_1234567")).toBe("1234567");
    expect(identifiantDeCompte(" 1234567 ")).toBe("1234567");
    expect(() => identifiantDeCompte("mon-compte")).toThrow(RangeError);
  });
});
