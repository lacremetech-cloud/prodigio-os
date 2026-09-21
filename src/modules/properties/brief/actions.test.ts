import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests des actions serveur de la Fabrique « bien à partir d'un brief ».
 *
 * Trois garanties vérifiées ici :
 *  1. « Analyser » n'écrit RIEN — ni organisation, ni bien ;
 *  2. les droits sont refusés côté serveur, pas seulement dans l'interface ;
 *  3. un déploiement de prévisualisation ne crée jamais de vraie donnée.
 *
 * Aucun réseau, aucune base : Supabase et la session sont mockés.
 */

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  roles: ["administrateur"] as string[],
  preview: false,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config")>();
  return { ...actual, isPreviewDeployment: () => h.preview };
});

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ rpc: h.rpc, from: h.from }),
}));

vi.mock("@/modules/crm/auth/session", () => ({
  requireCrmSession: async () => ({ userId: "u-1", email: null, roles: h.roles }),
}));

const ORGANIZATIONS = [
  { id: "11111111-1111-4111-8111-111111111111", name: "JCA", slug: "jca", kind: "agence_partenaire" },
];

function organizationsQuery() {
  return { select: () => ({ order: async () => ({ data: ORGANIZATIONS, error: null }) }) };
}

const { analyzeBriefAction, createPropertyFromBriefAction } = await import("./actions");

beforeEach(() => {
  h.rpc.mockReset();
  h.from.mockReset();
  h.roles = ["administrateur"];
  h.preview = false;
  h.from.mockImplementation(() => organizationsQuery());
});

const BRIEF = ["Nom : Villa Jean Jaurès", "Ville : Cassis", "Organisation : JCA"].join("\n");

describe("analyzeBriefAction", () => {
  it("analyse sans jamais écrire : aucune fonction de mutation n'est appelée", async () => {
    const res = await analyzeBriefAction({ brief: BRIEF });
    expect(res.ok).toBe(true);
    expect(h.rpc).not.toHaveBeenCalled();
    expect(res.data?.analysis.draft.projectName).toBe("Villa Jean Jaurès");
  });

  it("réutilise l'organisation connue au lieu de proposer un doublon", async () => {
    const res = await analyzeBriefAction({ brief: BRIEF });
    expect(res.data?.organization.status).toBe("existante");
  });

  it("refuse un brief vide", async () => {
    const res = await analyzeBriefAction({ brief: "" });
    expect(res.ok).toBe(false);
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("refuse un setter : l'analyse est réservée aux décisionnaires", async () => {
    h.roles = ["setter"];
    const res = await analyzeBriefAction({ brief: BRIEF });
    expect(res.ok).toBe(false);
    expect(h.from).not.toHaveBeenCalled();
  });

  it("refuse un agent immobilier sans droit de décision", async () => {
    h.roles = ["agent_immobilier"];
    expect((await analyzeBriefAction({ brief: BRIEF })).ok).toBe(false);
  });
});

describe("createPropertyFromBriefAction", () => {
  const base = {
    organizationId: ORGANIZATIONS[0]!.id,
    projectName: "Villa Jean Jaurès",
  };

  it("crée le bien via la fonction SQL dédiée, jamais par une écriture directe", async () => {
    h.rpc.mockResolvedValueOnce({ data: { ok: true, id: "p-1", already: false }, error: null });
    h.rpc.mockResolvedValueOnce({ data: { ok: true }, error: null });
    const res = await createPropertyFromBriefAction(base);
    expect(res.ok).toBe(true);
    expect(h.rpc.mock.calls[0]?.[0]).toBe("crm_property_create_partner");
    expect(h.rpc.mock.calls[1]?.[0]).toBe("crm_property_update_identity");
    expect(res.data?.propertyId).toBe("p-1");
  });

  it("remonte l'idempotence sans dupliquer le bien", async () => {
    h.rpc.mockResolvedValueOnce({ data: { ok: true, id: "p-1", already: true }, error: null });
    h.rpc.mockResolvedValueOnce({ data: { ok: true }, error: null });
    const res = await createPropertyFromBriefAction(base);
    expect(res.data?.alreadyExisted).toBe(true);
  });

  it("refuse toute écriture depuis un déploiement de prévisualisation", async () => {
    h.preview = true;
    const res = await createPropertyFromBriefAction(base);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/prévisualisation/i);
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("exige une organisation porteuse", async () => {
    const res = await createPropertyFromBriefAction({
      projectName: "Villa Jean Jaurès",
      organizationId: null,
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/organisation porteuse/i);
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("exige un nom de bien", async () => {
    const res = await createPropertyFromBriefAction({ ...base, projectName: "  " });
    expect(res.ok).toBe(false);
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("refuse un setter, même si l'interface le laissait passer", async () => {
    h.roles = ["setter"];
    const res = await createPropertyFromBriefAction(base);
    expect(res.ok).toBe(false);
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("refuse une année de construction aberrante", async () => {
    const res = await createPropertyFromBriefAction({ ...base, yearBuilt: 12_345 });
    expect(res.ok).toBe(false);
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("n'enregistre une nouvelle organisation que pour un administrateur", async () => {
    h.roles = ["manager"];
    const res = await createPropertyFromBriefAction({
      projectName: "Villa Verdun",
      newOrganizationName: "Agence Inconnue",
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/administrateur/i);
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("réutilise une organisation existante plutôt que d'en enregistrer une seconde", async () => {
    h.rpc.mockResolvedValueOnce({ data: { ok: true, id: "p-2", already: false }, error: null });
    h.rpc.mockResolvedValueOnce({ data: { ok: true }, error: null });
    const res = await createPropertyFromBriefAction({
      projectName: "Villa Verdun",
      newOrganizationName: "jca",
    });
    expect(res.ok).toBe(true);
    expect(res.data?.organizationCreated).toBe(false);
    expect(h.rpc.mock.calls.map((call) => call[0])).not.toContain(
      "crm_register_partner_organization",
    );
  });

  it("dit que l'organisation est enregistrée quand seule la création du bien échoue", async () => {
    h.rpc.mockResolvedValueOnce({ data: { ok: true, id: "org-9", slug: "agence-neuve" }, error: null });
    h.rpc.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "droits" } });
    const res = await createPropertyFromBriefAction({
      projectName: "Villa Verdun",
      newOrganizationName: "Agence Neuve",
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/est enregistrée/i);
    expect(res.error).toMatch(/n'en créez pas une seconde/i);
  });

  it("conserve le bien créé lorsque seule la mise à jour de la fiche échoue", async () => {
    h.rpc.mockResolvedValueOnce({ data: { ok: true, id: "p-3", already: false }, error: null });
    h.rpc.mockResolvedValueOnce({ data: null, error: { code: "22023", message: "bien introuvable" } });
    const res = await createPropertyFromBriefAction(base);
    expect(res.ok).toBe(false);
    expect(res.data?.propertyId).toBe("p-3");
    expect(res.error).toMatch(/cockpit/i);
  });
});
