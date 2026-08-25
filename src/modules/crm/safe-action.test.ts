import { describe, expect, it } from "vitest";
import {
  ACTION_FAILURE_MESSAGE,
  ACTION_NETWORK_MESSAGE,
  ACTION_STALE_BUILD_MESSAGE,
  describeActionFailure,
  isFrameworkControlFlow,
  safeAction,
} from "./safe-action";

/**
 * Garde-fou : une action serveur qui échoue ne doit jamais faire remonter son
 * rejet jusqu'à la frontière d'erreur — sans quoi l'écran est remplacé et la
 * saisie en cours est perdue.
 */

function withDigest(digest: string): Error {
  const error = new Error("boom");
  (error as Error & { digest: string }).digest = digest;
  return error;
}

describe("safeAction — aucun rejet ne s'échappe", () => {
  it("renvoie le résultat tel quel quand l'action aboutit", async () => {
    const res = await safeAction(async () => ({ ok: true as const, info: "fait" }));
    expect(res).toEqual({ ok: true, info: "fait" });
  });

  it("laisse passer un échec MÉTIER sans le réécrire", async () => {
    const res = await safeAction(async () => ({ ok: false as const, error: "Droits insuffisants." }));
    expect(res).toEqual({ ok: false, error: "Droits insuffisants." });
  });

  it("convertit une exception en échec lisible, au lieu de la propager", async () => {
    const res = await safeAction(async () => {
      throw new Error("Boom interne avec details techniques");
    });
    expect(res.ok).toBe(false);
    expect(res.error).toBe(ACTION_FAILURE_MESSAGE);
  });

  it("ne divulgue jamais le détail technique de l'exception", async () => {
    const res = await safeAction(async () => {
      throw new Error("connect ECONNREFUSED 10.0.0.1:5432 password=hunter2");
    });
    expect(res.error).not.toMatch(/ECONNREFUSED|10\.0\.0\.1|hunter2|password/);
  });

  it("survit à un rejet qui n'est pas une Error", async () => {
    for (const thrown of [null, undefined, "texte", 42, { quelconque: true }]) {
      const res = await safeAction(async () => {
        throw thrown;
      });
      expect(res.ok).toBe(false);
      expect(typeof res.error).toBe("string");
    }
  });

  it("dit toujours que la saisie est conservée et que rien n'a changé", async () => {
    expect(ACTION_FAILURE_MESSAGE).toMatch(/saisie est conservée/i);
    expect(ACTION_FAILURE_MESSAGE).toMatch(/rien n'a été modifié/i);
    expect(ACTION_NETWORK_MESSAGE).toMatch(/saisie est conservée/i);
  });
});

describe("contrôle de flux du framework", () => {
  it("relance une redirection : elle doit atteindre Next.js", async () => {
    const redirect = withDigest("NEXT_REDIRECT;replace;/connexion;307;");
    await expect(safeAction(async () => { throw redirect; })).rejects.toBe(redirect);
  });

  it("relance un `notFound()`", async () => {
    const notFound = withDigest("NEXT_NOT_FOUND");
    await expect(safeAction(async () => { throw notFound; })).rejects.toBe(notFound);
  });

  it("reconnaît les digests de contrôle de flux, et eux seuls", () => {
    expect(isFrameworkControlFlow(withDigest("NEXT_REDIRECT;push;/crm;303;"))).toBe(true);
    expect(isFrameworkControlFlow(withDigest("NEXT_NOT_FOUND"))).toBe(true);
    expect(isFrameworkControlFlow(withDigest("NEXT_HTTP_ERROR_FALLBACK;403"))).toBe(true);
    expect(isFrameworkControlFlow(withDigest("1234567890"))).toBe(false);
    expect(isFrameworkControlFlow(new Error("boom"))).toBe(false);
    expect(isFrameworkControlFlow(null)).toBe(false);
    expect(isFrameworkControlFlow("NEXT_REDIRECT")).toBe(false);
  });

  it("une session expirée continue donc de rediriger vers la connexion", async () => {
    // `requireCrmSession()` appelle `redirect()` : le rejet DOIT traverser.
    const redirect = withDigest("NEXT_REDIRECT;replace;/connexion?redirect=%2Fcrm;307;");
    await expect(
      safeAction(async () => {
        throw redirect;
      }),
    ).rejects.toBe(redirect);
  });
});

describe("messages spécifiques", () => {
  it("reconnaît un build remplacé et demande un rechargement", () => {
    const res = describeActionFailure(
      new Error('Failed to find Server Action "7f3a". This request might be from an older or newer deployment.'),
    );
    expect(res.error).toBe(ACTION_STALE_BUILD_MESSAGE);
    expect(res.requiresReload).toBe(true);
    expect(res.error).toMatch(/Copiez votre saisie/i);
  });

  it("reconnaît un échec de transport", () => {
    for (const message of ["fetch failed", "Failed to fetch", "socket hang up", "ETIMEDOUT"]) {
      expect(describeActionFailure(new Error(message)).error).toBe(ACTION_NETWORK_MESSAGE);
    }
  });

  it("retombe sur le message générique pour toute autre cause", () => {
    expect(describeActionFailure(new Error("erreur imprévue")).error).toBe(ACTION_FAILURE_MESSAGE);
    expect(describeActionFailure(new Error("erreur imprévue")).requiresReload).toBeUndefined();
  });
});
