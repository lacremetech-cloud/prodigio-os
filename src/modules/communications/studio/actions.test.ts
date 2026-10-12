import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests des **actions serveur** du studio, avec un client Supabase injecté.
 *
 * Objectif : prouver qu'une décision refusée l'est **avant** d'atteindre la
 * base, et qu'aucune action du studio ne peut activer un workflow, appeler un
 * fournisseur ou traiter la file.
 */

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePath(p) }));

const requireCrmSession = vi.fn(async () => ({ userId: "u1", email: null, roles: ["administrateur"] }));
vi.mock("@/modules/crm/auth/session", () => ({
  requireCrmSession: () => requireCrmSession(),
}));

type RpcResult = { data: unknown; error: { code?: string; message: string } | null };
const rpc = vi.fn<(fn: string, args?: unknown) => Promise<RpcResult>>(async () => ({
  data: { ok: true },
  error: null,
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ rpc: (fn: string, args: unknown) => rpc(fn, args) }),
}));

// `fetch` est surveillé globalement : aucune action du studio ne doit sortir.
const fetchSpy = vi.spyOn(globalThis, "fetch");

import {
  releaseSuppressionAction,
  setAutomationStatusAction,
  upsertAutomationAction,
} from "../actions";

beforeEach(() => {
  rpc.mockClear();
  revalidatePath.mockClear();
  requireCrmSession.mockClear();
  fetchSpy.mockClear();
});

describe("setAutomationStatusAction", () => {
  const id = "11111111-1111-4111-8111-111111111111";

  it("refuse `actif` SANS jamais appeler la base", async () => {
    const res = await setAutomationStatusAction({ automationId: id, status: "actif" });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/ne peut pas être activée/i);
    expect(rpc).not.toHaveBeenCalled();
    expect(requireCrmSession).not.toHaveBeenCalled();
  });

  it("refuse tout statut inventé", async () => {
    for (const status of ["active", "en_cours", "publie", ""]) {
      const res = await setAutomationStatusAction({ automationId: id, status });
      expect(res.ok).toBe(false);
      expect(rpc).not.toHaveBeenCalled();
    }
  });

  it("accepte les quatre statuts de brouillon, en déléguant à la base", async () => {
    for (const status of ["brouillon", "pret_pour_revue", "en_pause", "archive"]) {
      rpc.mockClear();
      const res = await setAutomationStatusAction({ automationId: id, status });
      expect(res.ok).toBe(true);
      expect(rpc).toHaveBeenCalledWith("crm_comm_set_automation_status", {
        p_automation_id: id,
        p_status: status,
      });
    }
  });
});

describe("upsertAutomationAction", () => {
  const valid = {
    automationKey: "relance_estimation",
    name: "Relance après estimation",
    triggerEvent: "estimation_planifiee",
    templateKey: "estimation_planifiee",
    templateVersion: 2,
    channel: "email",
    delayMinutes: 60,
    conditions: { segment: "cible_prodigio_premium" },
  };

  it("n'accepte AUCUN statut depuis le navigateur : le brouillon est imposé en base", async () => {
    const res = await upsertAutomationAction({ ...valid, status: "actif" });
    expect(res.ok).toBe(true);
    const [, args] = rpc.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(Object.keys(args)).not.toContain("p_status");
    expect(res.info).toMatch(/brouillon/i);
    expect(res.info).toMatch(/ne peut pas être activée/i);
  });

  it("transmet la version de modèle épinglée", async () => {
    await upsertAutomationAction(valid);
    const [fn, args] = rpc.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(fn).toBe("crm_comm_upsert_automation");
    expect(args.p_template_version).toBe(2);
  });

  it("refuse un déclencheur hors du catalogue métier, sans appeler la base", async () => {
    const res = await upsertAutomationAction({ ...valid, triggerEvent: "evenement_invente" });
    expect(res.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuse une condition hors catalogue, sans appeler la base", async () => {
    const res = await upsertAutomationAction({
      ...valid,
      conditions: { humeur_du_jour: "bonne" },
    });
    expect(res.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuse une condition non scalaire (aucun code arbitraire)", async () => {
    const res = await upsertAutomationAction({
      ...valid,
      conditions: { segment: { $gt: 1 } },
    });
    expect(res.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("releaseSuppressionAction", () => {
  const id = "22222222-2222-4222-8222-222222222222";

  it("exige un motif : sans motif, la base n'est jamais sollicitée", async () => {
    for (const reason of ["", "  ", "ok"]) {
      const res = await releaseSuppressionAction({ suppressionId: id, reason });
      expect(res.ok).toBe(false);
      expect(rpc).not.toHaveBeenCalled();
    }
  });

  it("délègue la décision à la base, qui re-vérifie le rôle administrateur", async () => {
    const res = await releaseSuppressionAction({
      suppressionId: id,
      reason: "Demande écrite de la personne, vérifiée le 12 mars.",
    });
    expect(res.ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith("crm_comm_release_suppression", {
      p_id: id,
      p_reason: "Demande écrite de la personne, vérifiée le 12 mars.",
    });
  });

  it("remonte un refus de droits sans le masquer", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "42501", message: "droits insuffisants" },
    });
    const res = await releaseSuppressionAction({ suppressionId: id, reason: "motif suffisant" });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/droits insuffisants/i);
  });
});

describe("étanchéité des actions du studio", () => {
  it("n'émet AUCUN appel réseau", async () => {
    await setAutomationStatusAction({
      automationId: "33333333-3333-4333-8333-333333333333",
      status: "pret_pour_revue",
    });
    await upsertAutomationAction({
      automationKey: "test_workflow",
      name: "Test workflow",
      triggerEvent: "estimation_rappel",
      templateKey: "estimation_rappel",
      channel: "email",
      delayMinutes: 0,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
