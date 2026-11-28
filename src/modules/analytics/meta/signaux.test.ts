import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ production: true, signaux: "essai" as "essai" | "envoi", paliers: "essai" as "essai" | "envoi" }));

vi.mock("@/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config")>();
  return {
    ...actual,
    env: { ...actual.env, META_CAPI_PIXEL_ID: "123", META_CAPI_ACCESS_TOKEN: "jeton", META_CAPI_TEST_EVENT_CODE: undefined },
    isMetaCapiConfigured: () => true,
    isProductionDeployment: () => h.production,
    modeNouveauxSignaux: () => h.signaux,
    modePaliers: () => h.paliers,
  };
});

const { envoyerOuEssayer, paliersAtteints, signauxDeBudget, PALIERS } = await import("./signaux");

/**
 * LES NOUVEAUX SIGNAUX, EN ESSAI : rien ne part chez Meta tant que Victor n'a
 * pas posé l'interrupteur sur `envoi` ; le journal dit ce qui serait parti.
 */

const IDENTITE = { email: "camille@example.test", phone: "+33612345678" };

function journal() {
  const lignes: Record<string, unknown>[] = [];
  const supabase = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      if (fn === "crm_meta_conversion_log") lignes.push(args);
      if (fn === "crm_meta_conversion_deja_simulee" || fn === "crm_meta_conversion_deja_envoyee") return { data: false, error: null };
      return { data: null, error: null };
    },
  };
  return { supabase: supabase as unknown as Parameters<typeof envoyerOuEssayer>[0]["supabase"], lignes };
}

beforeEach(() => {
  h.production = true;
  h.signaux = "essai";
  h.paliers = "essai";
  vi.restoreAllMocks();
});

describe("les paliers d'une réponse", () => {
  it("cumulatifs : tous ceux dont le seuil ne dépasse pas le bas de la réponse", () => {
    expect(paliersAtteints("500k_1m")).toEqual(["LeadBudgetAuMoins500k"]);
    expect(paliersAtteints("plus_1m")).toEqual(["LeadBudgetAuMoins500k", "LeadBudgetAuMoins1M"]);
    expect(paliersAtteints("1m_2m")).toEqual(["LeadBudgetAuMoins500k", "LeadBudgetAuMoins1M"]);
    expect(paliersAtteints("2m_3m")).toEqual(["LeadBudgetAuMoins500k", "LeadBudgetAuMoins1M", "LeadBudgetAuMoins2M"]);
    expect(paliersAtteints("plus_3m")).toEqual(PALIERS.map((p) => p.nom));
  });

  it("« pas de projet », sans réponse ou réponse inconnue : aucun palier", () => {
    expect(paliersAtteints("aucun_projet")).toEqual([]);
    expect(paliersAtteints(null)).toEqual([]);
    expect(paliersAtteints(undefined)).toEqual([]);
    expect(paliersAtteints("moins_800k")).toEqual([]);
  });

  it("des noms qui disent ce qu'ils sont, jamais un montant ailleurs que dans le nom", () => {
    for (const p of PALIERS) expect(p.nom).toMatch(/^LeadBudgetAuMoins(500k|1M|2M|3M)$/);
  });
});

describe("en essai, rien ne part", () => {
  it("en production : aucun appel à Meta, le journal note « simulee »", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { supabase, lignes } = journal();
    const res = await envoyerOuEssayer({
      supabase,
      mode: "essai",
      interestId: "i-1",
      verifierDeja: true,
      conversion: { eventName: "LeadQualifie", eventId: "leadqualifie-i-1", identity: IDENTITE },
    });
    expect(res).toEqual({ sent: false, reason: "simulee" });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(lignes).toEqual([
      expect.objectContaining({ p_event_name: "LeadQualifie", p_resultat: "simulee", p_event_id: "leadqualifie-i-1", p_interest_id: "i-1" }),
    ]);
  });

  it("hors production : « hors_production », même en essai", async () => {
    h.production = false;
    const { supabase, lignes } = journal();
    const res = await envoyerOuEssayer({
      supabase,
      mode: "essai",
      interestId: "i-1",
      verifierDeja: false,
      conversion: { eventName: "Contact", eventId: "contact-i-1", identity: IDENTITE },
    });
    expect(res).toEqual({ sent: false, reason: "hors_production" });
    expect(lignes[0]).toMatchObject({ p_resultat: "hors_production" });
  });

  it("un signal que Meta ne saurait rattacher le dit, même en essai", async () => {
    const { supabase } = journal();
    const res = await envoyerOuEssayer({
      supabase,
      mode: "essai",
      interestId: "i-1",
      verifierDeja: false,
      conversion: { eventName: "SubmitApplication", eventId: "offre-i-1", identity: { firstName: "Camille" } },
    });
    expect(res).toEqual({ sent: false, reason: "sans_correspondance" });
  });

  it("déjà essayé : le journal le dit, rien ne se refait", async () => {
    const lignes: Record<string, unknown>[] = [];
    const supabase = {
      rpc: async (fn: string, args: Record<string, unknown>) => {
        if (fn === "crm_meta_conversion_log") lignes.push(args);
        if (fn === "crm_meta_conversion_deja_simulee") return { data: true, error: null };
        return { data: null, error: null };
      },
    } as unknown as Parameters<typeof envoyerOuEssayer>[0]["supabase"];
    const res = await envoyerOuEssayer({
      supabase,
      mode: "essai",
      interestId: "i-1",
      verifierDeja: true,
      conversion: { eventName: "LeadQualifie", eventId: "leadqualifie-i-1", identity: IDENTITE },
    });
    expect(res).toEqual({ sent: false, reason: "deja_envoyee" });
    expect(lignes).toHaveLength(1);
  });

  it("l'interrupteur sur « envoi » : l'envoi réel part", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    const { supabase, lignes } = journal();
    const res = await envoyerOuEssayer({
      supabase,
      mode: "envoi",
      interestId: "i-1",
      verifierDeja: true,
      conversion: { eventName: "Contact", eventId: "contact-i-1", identity: IDENTITE },
    });
    expect(res).toEqual({ sent: true });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(lignes[0]).toMatchObject({ p_resultat: "envoyee" });
  });
});

describe("les paliers au dépôt du formulaire", () => {
  it("un événement par palier atteint, en essai, avec un identifiant par palier et par demande", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { supabase, lignes } = journal();
    const res = await signauxDeBudget({
      supabase,
      interestId: "i-9",
      reponse: "plus_1m",
      identity: IDENTITE,
      sourceUrl: "https://exemple.test/bien/villa/interet",
      propertyName: "Villa essai",
      propertyId: "p-1",
    });
    expect(res).toEqual([
      { sent: false, reason: "simulee" },
      { sent: false, reason: "simulee" },
    ]);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(lignes.map((l) => [l.p_event_name, l.p_event_id])).toEqual([
      ["LeadBudgetAuMoins500k", "LeadBudgetAuMoins500k-i-9"],
      ["LeadBudgetAuMoins1M", "LeadBudgetAuMoins1M-i-9"],
    ]);
  });

  it("« pas de projet » : aucun palier, aucune ligne", async () => {
    const { supabase, lignes } = journal();
    expect(await signauxDeBudget({ supabase, interestId: "i-9", reponse: "aucun_projet", identity: IDENTITE, sourceUrl: null, propertyName: null, propertyId: null })).toEqual([]);
    expect(lignes).toEqual([]);
  });

  it("aucun montant ne part : le bien seulement, comme les autres conversions", async () => {
    h.paliers = "envoi";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    const { supabase } = journal();
    await signauxDeBudget({ supabase, interestId: "i-9", reponse: "plus_3m", identity: IDENTITE, sourceUrl: null, propertyName: "Villa essai", propertyId: "p-1" });
    const corps = JSON.parse(String((fetchSpy.mock.calls[0]![1] as RequestInit).body)) as { data: { custom_data?: Record<string, unknown> }[] };
    expect(corps.data[0]!.custom_data).toEqual({ content_name: "Villa essai", content_ids: ["p-1"], content_category: "bien_immobilier" });
    expect(JSON.stringify(corps)).not.toMatch(/plus_3m|300000000|3 000 000|budget_choice/);
  });
});
