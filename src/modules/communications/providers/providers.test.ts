import { describe, expect, it, vi } from "vitest";
import { createLumailProvider } from "./lumail";
import { createTwilioProvider } from "./twilio";
import { httpStatusToErrorCode, toE164 } from "./types";

/**
 * ⚠️ AUCUN test n'appelle une API réelle : `fetchImpl` est TOUJOURS injecté.
 * Un appel réseau involontaire ferait échouer le test (le `fetch` global n'est
 * jamais utilisé ici).
 */

const failIfCalled = vi.fn(async () => {
  throw new Error("appel réseau interdit dans les tests");
});

describe("normalisation E.164", () => {
  it("conserve un numéro déjà international", () => {
    expect(toE164("+33 6 12 34 56 78")).toBe("+33612345678");
  });

  it("convertit un numéro national français", () => {
    expect(toE164("06.12.34.56.78")).toBe("+33612345678");
    expect(toE164("01 23 45 67 89")).toBe("+33123456789");
  });

  it("convertit le préfixe 00", () => {
    expect(toE164("0044 7700 900000")).toBe("+447700900000");
  });

  it("refuse plutôt que d'inventer un indicatif", () => {
    expect(toE164("12345")).toBeNull();
    expect(toE164("bonjour")).toBeNull();
    expect(toE164(null)).toBeNull();
    expect(toE164("")).toBeNull();
  });
});

describe("traduction des statuts HTTP", () => {
  it("distingue authentification, destinataire, débit et indisponibilité", () => {
    expect(httpStatusToErrorCode(401)).toBe("authentification_refusee");
    expect(httpStatusToErrorCode(404)).toBe("destinataire_invalide");
    expect(httpStatusToErrorCode(429)).toBe("limite_debit");
    expect(httpStatusToErrorCode(503)).toBe("indisponible");
  });
});

describe("adaptateur Lumail", () => {
  const configured = { apiKey: "lum_test_key", fromAddress: "envoi@exemple.invalid" };

  it("est « non configuré » sans clé ni expéditeur, et n'appelle rien", async () => {
    const provider = createLumailProvider({ apiKey: null, fromAddress: null });
    expect(provider.isConfigured()).toBe(false);

    const res = await provider.send(
      { to: "x@exemple.invalid", subject: "s", body: "b", bodyFormat: "markdown" },
      { fetchImpl: failIfCalled as unknown as typeof fetch },
    );
    expect(res).toEqual({ ok: false, errorCode: "configuration_absente" });
    expect(failIfCalled).not.toHaveBeenCalled();
  });

  it("refuse une adresse expéditrice mal formée", () => {
    expect(createLumailProvider({ apiKey: "lum_x", fromAddress: "pas-une-adresse" }).isConfigured()).toBe(
      false,
    );
  });

  it("envoie sur le bon endpoint, avec Bearer, et sans traçage pour un transactionnel", async () => {
    let captured: { url: string; init: RequestInit } | null = null;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      captured = { url, init };
      return new Response(JSON.stringify({ success: true, qstashMessageId: "q_123" }), {
        status: 200,
      });
    }) as unknown as typeof fetch;

    const res = await createLumailProvider(configured).send(
      {
        to: "destinataire@exemple.invalid",
        subject: "Votre demande",
        body: "Bonjour",
        bodyFormat: "markdown",
        previewText: "aperçu",
      },
      { fetchImpl },
    );

    expect(res).toEqual({ ok: true, providerMessageId: "q_123", providerStatus: "queued" });

    const call = captured as unknown as { url: string; init: RequestInit };
    expect(call.url).toBe("https://lumail.io/api/v1/emails");
    expect(call.init.method).toBe("POST");
    const headers = call.init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer lum_test_key");

    const body = JSON.parse(call.init.body as string);
    expect(body.to).toBe("destinataire@exemple.invalid");
    expect(body.from).toBe("envoi@exemple.invalid");
    expect(body.contentType).toBe("MARKDOWN");
    // Transactionnel : ni pixel d'ouverture, ni réécriture des liens.
    expect(body.tracking).toEqual({ links: false, open: false });
  });

  it("utilise HTML lorsque le modèle est en HTML", async () => {
    let body: Record<string, unknown> = {};
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      body = JSON.parse(init.body as string);
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }) as unknown as typeof fetch;

    await createLumailProvider(configured).send(
      { to: "a@exemple.invalid", subject: "s", body: "<p>b</p>", bodyFormat: "html" },
      { fetchImpl },
    );
    expect(body.contentType).toBe("HTML");
  });

  it("normalise une panne fournisseur sans jamais divulguer le corps de réponse", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ error: "destinataire@exemple.invalid inconnu" }), {
        status: 503,
      })) as unknown as typeof fetch;

    const res = await createLumailProvider(configured).send(
      { to: "a@exemple.invalid", subject: "s", body: "b", bodyFormat: "markdown" },
      { fetchImpl },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errorCode).toBe("indisponible");
      expect(res.detail).toBe("HTTP 503");
      expect(JSON.stringify(res)).not.toContain("exemple.invalid");
    }
  });

  it("traduit un dépassement de délai", async () => {
    const fetchImpl = (async (_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      })) as unknown as typeof fetch;

    const res = await createLumailProvider(configured).send(
      { to: "a@exemple.invalid", subject: "s", body: "b", bodyFormat: "markdown" },
      { fetchImpl, timeoutMs: 5 },
    );
    expect(res).toEqual({ ok: false, errorCode: "delai_depasse" });
  });

  it("traite une réponse « success: false » comme un rejet définitif", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ success: false }), { status: 200 })) as unknown as typeof fetch;

    const res = await createLumailProvider(configured).send(
      { to: "a@exemple.invalid", subject: "s", body: "b", bodyFormat: "markdown" },
      { fetchImpl },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errorCode).toBe("rejet_permanent");
  });
});

describe("adaptateur Twilio", () => {
  const configured = { accountSid: "AC_test", authToken: "tok_test", from: "+33600000000" };

  it("est « non configuré » sans identifiants, et n'appelle rien", async () => {
    const provider = createTwilioProvider({ accountSid: null, authToken: null, from: null });
    expect(provider.isConfigured()).toBe(false);

    const res = await provider.send(
      { to: "+33612345678", body: "b" },
      { fetchImpl: failIfCalled as unknown as typeof fetch },
    );
    expect(res).toEqual({ ok: false, errorCode: "configuration_absente" });
  });

  it("refuse un numéro non normalisable AVANT tout appel réseau", async () => {
    const spy = vi.fn();
    const res = await createTwilioProvider(configured).send(
      { to: "12345", body: "b" },
      { fetchImpl: spy as unknown as typeof fetch },
    );
    expect(res).toEqual({ ok: false, errorCode: "destinataire_invalide" });
    expect(spy).not.toHaveBeenCalled();
  });

  it("envoie en form-encoded avec authentification Basic", async () => {
    let captured: { url: string; init: RequestInit } | null = null;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      captured = { url, init };
      return new Response(JSON.stringify({ sid: "SM123", status: "queued" }), { status: 201 });
    }) as unknown as typeof fetch;

    const res = await createTwilioProvider(configured).send(
      { to: "06 12 34 56 78", body: "Rappel" },
      { fetchImpl },
    );
    expect(res).toEqual({ ok: true, providerMessageId: "SM123", providerStatus: "queued" });

    const call = captured as unknown as { url: string; init: RequestInit };
    expect(call.url).toContain("/Accounts/AC_test/Messages.json");
    const headers = call.init.headers as Record<string, string>;
    expect(headers.authorization).toMatch(/^Basic /);

    const params = new URLSearchParams(call.init.body as string);
    expect(params.get("To")).toBe("+33612345678");
    expect(params.get("From")).toBe("+33600000000");
    expect(params.get("Body")).toBe("Rappel");
  });

  it("utilise MessagingServiceSid lorsque l'expéditeur est un service", async () => {
    let body = "";
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      body = init.body as string;
      return new Response(JSON.stringify({ sid: "SM1" }), { status: 201 });
    }) as unknown as typeof fetch;

    await createTwilioProvider({ ...configured, from: "MG_service" }).send(
      { to: "+33612345678", body: "b" },
      { fetchImpl },
    );
    const params = new URLSearchParams(body);
    expect(params.get("MessagingServiceSid")).toBe("MG_service");
    expect(params.get("From")).toBeNull();
  });

  it("traduit les codes d'erreur Twilio connus", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ error_code: 21610 }), { status: 400 })) as unknown as typeof fetch;

    const res = await createTwilioProvider(configured).send(
      { to: "+33612345678", body: "b" },
      { fetchImpl },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errorCode).toBe("rejet_permanent");
  });
});
