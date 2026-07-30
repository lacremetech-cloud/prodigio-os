import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Teste la garde d'accès serveur `requireCrmSession` :
 *  - visiteur non authentifié → redirection vers /connexion ;
 *  - authentifié SANS rôle/organisation → redirection /connexion?error=acces ;
 *  - authentifié AVEC rôle → session renvoyée (accès autorisé).
 */

const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url) }));

const createSupabaseServerClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => createSupabaseServerClient(),
}));

function fakeClient(user: { id: string; email: string } | null, roles: string[]) {
  return {
    auth: { getUser: async () => ({ data: { user } }) },
    rpc: async (fn: string) => (fn === "crm_active_roles" ? { data: roles } : { data: null }),
  };
}

// Import après les mocks.
import { requireCrmSession } from "./session";

beforeEach(() => {
  redirect.mockClear();
  createSupabaseServerClient.mockReset();
});

describe("requireCrmSession", () => {
  it("redirige un visiteur non authentifié vers la connexion", async () => {
    createSupabaseServerClient.mockResolvedValue(fakeClient(null, []));
    await expect(requireCrmSession("/crm/mandats")).rejects.toThrow(
      "REDIRECT:/connexion?redirect=%2Fcrm%2Fmandats",
    );
  });

  it("redirige un utilisateur authentifié sans rôle/organisation vers /acces", async () => {
    // Distinct de /connexion : l'utilisateur EST connecté (évite la boucle de
    // redirection avec le middleware). Écran « Accès non autorisé ».
    createSupabaseServerClient.mockResolvedValue(
      fakeClient({ id: "u1", email: "sans-role@prodigio.fr" }, []),
    );
    await expect(requireCrmSession()).rejects.toThrow("REDIRECT:/acces");
  });

  it("autorise un utilisateur disposant d'un rôle actif", async () => {
    createSupabaseServerClient.mockResolvedValue(
      fakeClient({ id: "u1", email: "setter@prodigio.fr" }, ["setter"]),
    );
    const session = await requireCrmSession();
    expect(session.userId).toBe("u1");
    expect(session.roles).toEqual(["setter"]);
    expect(redirect).not.toHaveBeenCalled();
  });
});
