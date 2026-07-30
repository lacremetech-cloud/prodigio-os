import { afterEach, describe, expect, it, vi } from "vitest";

// Mocks : on isole la LOGIQUE de rafraîchissement (client admin, chiffrement,
// appel OAuth), sans réseau ni base réels.
const credRow = { value: null as Record<string, unknown> | null };
const upserted: Record<string, unknown>[] = [];

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: credRow.value, error: null }),
        }),
      }),
      upsert: async (row: Record<string, unknown>) => {
        upserted.push(row);
        return { error: null };
      },
      delete: () => ({ eq: async () => ({ error: null }) }),
    }),
  }),
}));

// Chiffrement mocké en identité (préfixe) pour suivre les valeurs sans clé réelle.
vi.mock("./crypto", () => ({
  encryptToken: (v: string) => `enc(${v})`,
  decryptToken: (v: string) => v.replace(/^enc\(|\)$/g, ""),
}));

const refreshMock = vi.fn();
vi.mock("./oauth", () => ({
  refreshAccessToken: (rt: string) => refreshMock(rt),
}));

import {
  CalendarReconnectRequiredError,
  getFreshAccessToken,
} from "./credentials";

afterEach(() => {
  credRow.value = null;
  upserted.length = 0;
  refreshMock.mockReset();
});

describe("getFreshAccessToken", () => {
  it("renvoie l'access token en cours s'il est encore valide (pas de refresh)", async () => {
    credRow.value = {
      access_token_encrypted: "enc(access-valide)",
      refresh_token_encrypted: "enc(refresh)",
      access_token_expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    };
    const token = await getFreshAccessToken("conn-1");
    expect(token).toBe("access-valide");
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("rafraîchit l'access token expiré et stocke le nouveau", async () => {
    credRow.value = {
      access_token_encrypted: "enc(vieux)",
      refresh_token_encrypted: "enc(refresh-xyz)",
      access_token_expires_at: new Date(Date.now() - 60_000).toISOString(),
    };
    refreshMock.mockResolvedValue({
      accessToken: "access-neuf",
      refreshToken: "refresh-xyz",
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      scope: "s",
      tokenType: "Bearer",
      idToken: null,
    });
    const token = await getFreshAccessToken("conn-1");
    expect(refreshMock).toHaveBeenCalledWith("refresh-xyz");
    expect(token).toBe("access-neuf");
    // Le nouvel access token a bien été (re)chiffré et stocké.
    expect(upserted.at(-1)?.access_token_encrypted).toBe("enc(access-neuf)");
  });

  it("exige une reconnexion si le token est expiré SANS refresh token", async () => {
    credRow.value = {
      access_token_encrypted: "enc(vieux)",
      refresh_token_encrypted: null,
      access_token_expires_at: new Date(Date.now() - 60_000).toISOString(),
    };
    await expect(getFreshAccessToken("conn-1")).rejects.toBeInstanceOf(
      CalendarReconnectRequiredError,
    );
  });

  it("exige une reconnexion si aucune ligne de jetons n'existe", async () => {
    credRow.value = null;
    await expect(getFreshAccessToken("conn-1")).rejects.toBeInstanceOf(
      CalendarReconnectRequiredError,
    );
  });
});
