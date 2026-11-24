import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * LA ROUTE DU MATIN NE S'OUVRE QU'AVEC LE SECRET DE VERCEL CRON.
 * Sans secret configuré, elle n'existe pas ; avec, tout appel qui ne le porte
 * pas est refusé — et la lecture n'est jamais lancée.
 */

const configuration = vi.hoisted(() => ({ secret: undefined as string | undefined }));
const lancer = vi.hoisted(() => vi.fn());

vi.mock("@/config", () => ({
  env: {
    get CRON_SECRET() {
      return configuration.secret;
    },
  },
  isPilotageCronConfigured: () => typeof configuration.secret === "string" && configuration.secret.length >= 16,
}));
vi.mock("@/modules/pilotage/meta/lancer", () => ({ lancerLectureMeta: lancer }));

import { GET } from "./route";

const SECRET = "0123456789abcdef0123456789abcdef";

function appel(autorisation?: string) {
  return new Request("https://exemple.test/api/pilotage/meta/synchro", {
    headers: autorisation ? { authorization: autorisation } : {},
  });
}

afterEach(() => {
  configuration.secret = undefined;
  lancer.mockReset();
});

describe("la route du matin", () => {
  it("n'existe pas tant que CRON_SECRET n'est pas configuré", async () => {
    const r = await GET(appel(`Bearer ${SECRET}`));
    expect(r.status).toBe(404);
    expect(lancer).not.toHaveBeenCalled();
  });

  it("refuse un appel sans le bon secret", async () => {
    configuration.secret = SECRET;
    for (const a of [undefined, "Bearer mauvais", `Bearer ${SECRET}x`, SECRET.slice(1)]) {
      const r = await GET(appel(a));
      expect(r.status).toBe(401);
    }
    expect(lancer).not.toHaveBeenCalled();
  });

  it("avec le secret, lance la lecture « matin » et rend un bilan sans aucune valeur sensible", async () => {
    configuration.secret = SECRET;
    lancer.mockResolvedValue({
      ok: true,
      bilan: {
        statut: "reussie",
        synchroId: "s1",
        periode: { debut: "2026-11-05", fin: "2026-11-12" },
        lignes: 42,
        tranches: 1,
        appels: 40,
        devise: "EUR",
        couverture: "relue",
        ecarts: [],
        message: null,
      },
    });
    const r = await GET(appel(`Bearer ${SECRET}`));
    expect(r.status).toBe(200);
    expect(lancer).toHaveBeenCalledWith("matin", null);
    const corps = await r.json();
    expect(corps).toMatchObject({ ok: true, statut: "reussie", lignes: 42, ecarts_de_controle: 0 });
    expect(JSON.stringify(corps)).not.toContain(SECRET);
  });

  it("une configuration Meta manquante se dit, sans planter", async () => {
    configuration.secret = SECRET;
    lancer.mockResolvedValue({ ok: false, raison: "meta_non_configure", message: "…" });
    const r = await GET(appel(`Bearer ${SECRET}`));
    expect(await r.json()).toEqual({ ok: false, raison: "meta_non_configure" });
  });
});
