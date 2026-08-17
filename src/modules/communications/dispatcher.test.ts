import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { dispatchPending, type DispatcherDeps } from "./dispatcher";
import type { EmailProvider, SmsProvider } from "./providers/types";

/**
 * Le dispatcher est le SEUL point qui touche un fournisseur. Ces tests
 * garantissent qu'il ne peut pas :
 *   • envoyer quoi que ce soit tant que l'envoi réel n'est pas activé ;
 *   • dupliquer un message sur un rejeu ;
 *   • envoyer un message que la politique a bloqué ;
 *   • laisser une panne fournisseur invalider un dossier métier.
 *
 * Aucune API réelle n'est appelée : les fournisseurs sont des doublures.
 */

interface FakeState {
  claim: unknown;
  prepare: Record<string, unknown>;
  message: Record<string, unknown> | null;
  template: Record<string, unknown> | null;
  contact: Record<string, unknown> | null;
}

/** Doublure de client Supabase : ne joint jamais le réseau. */
function fakeSupabase(state: FakeState) {
  const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];

  const table = (rows: Record<string, unknown> | null) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      in: () => chain,
      order: () => chain,
      limit: () => chain,
      maybeSingle: async () => ({ data: rows, error: null }),
    };
    return chain;
  };

  const client = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      if (fn === "crm_comm_claim_outbox") return { data: state.claim, error: null };
      if (fn === "crm_comm_prepare_message") return { data: state.prepare, error: null };
      return { data: { ok: true }, error: null };
    },
    from: (name: string) => {
      if (name === "communication_messages") return table(state.message);
      if (name === "communication_templates") return table(state.template);
      if (name === "contacts") return table(state.contact);
      return table(null);
    },
  };

  return { client: client as unknown as SupabaseClient<Database>, rpcCalls };
}

function providers(sent: string[]) {
  const email: EmailProvider = {
    key: "lumail",
    isConfigured: () => true,
    send: async (input) => {
      sent.push(`email:${input.to}`);
      return { ok: true, providerMessageId: "prov_1" };
    },
  };
  const sms: SmsProvider = {
    key: "twilio",
    isConfigured: () => true,
    send: async (input) => {
      sent.push(`sms:${input.to}`);
      return { ok: true, providerMessageId: "sms_1" };
    },
  };
  return { email, sms };
}

const READY_STATE: FakeState = {
  claim: { items: [{ id: "outbox-1", event_type: "demande_mandat_enregistree", channel: "email" }] },
  prepare: { ok: true, message_id: "msg-1", blocked: false, reason: null },
  message: {
    id: "msg-1",
    channel: "email",
    status: "en_attente",
    blocked_reason: null,
    template_id: "tpl-1",
    contact_id: "contact-1",
    appointment_id: null,
    property_id: null,
  },
  template: {
    subject: "Bonjour {{prenom}}",
    body: "Merci {{prenom}}.",
    body_format: "markdown",
    preview_text: null,
    allowed_variables: ["prenom"],
  },
  contact: {
    first_name: "Claire",
    last_name: "Test",
    email: "claire@exemple.invalid",
    phone: null,
  },
};

function deps(state: FakeState, dispatchEnabled: boolean, sent: string[]): DispatcherDeps {
  const { client } = fakeSupabase(state);
  const p = providers(sent);
  return {
    supabase: client,
    emailProvider: p.email,
    smsProvider: p.sms,
    dispatchEnabled,
  };
}

describe("dispatchPending — simulation", () => {
  it("n'émet AUCUN appel fournisseur tant que l'envoi réel est désactivé", async () => {
    const sent: string[] = [];
    const report = await dispatchPending(deps(READY_STATE, false, sent));

    expect(report.claimed).toBe(1);
    expect(report.outcomes[0]?.result).toBe("simule");
    expect(sent).toEqual([]);
  });

  it("applique tout de même la politique et prépare le message", async () => {
    const { client, rpcCalls } = fakeSupabase(READY_STATE);
    const p = providers([]);
    await dispatchPending({
      supabase: client,
      emailProvider: p.email,
      smsProvider: p.sms,
      dispatchEnabled: false,
    });

    expect(rpcCalls.map((c) => c.fn)).toContain("crm_comm_prepare_message");
    // Aucun envoi n'est rapporté : rien n'est parti.
    expect(rpcCalls.some((c) => c.fn === "crm_comm_record_send")).toBe(false);
  });
});

describe("dispatchPending — envoi activé", () => {
  it("transmet au bon adaptateur et rapporte l'envoi", async () => {
    const sent: string[] = [];
    const { client, rpcCalls } = fakeSupabase(READY_STATE);
    const p = providers(sent);

    const report = await dispatchPending({
      supabase: client,
      emailProvider: p.email,
      smsProvider: p.sms,
      dispatchEnabled: true,
    });

    expect(report.outcomes[0]?.result).toBe("envoye");
    expect(sent).toEqual(["email:claire@exemple.invalid"]);

    const record = rpcCalls.find((c) => c.fn === "crm_comm_record_send");
    expect(record?.args.p_status).toBe("envoye");
    expect(record?.args.p_provider).toBe("lumail");
    expect(record?.args.p_provider_message_id).toBe("prov_1");
  });

  it("route un SMS vers l'adaptateur SMS, avec le téléphone", async () => {
    const sent: string[] = [];
    const state: FakeState = {
      ...READY_STATE,
      claim: { items: [{ id: "o1", event_type: "estimation_rappel", channel: "sms" }] },
      message: { ...READY_STATE.message, channel: "sms" } as Record<string, unknown>,
      template: { ...READY_STATE.template, subject: null } as Record<string, unknown>,
      contact: { first_name: "Claire", last_name: "Test", email: null, phone: "+33612345678" },
    };

    await dispatchPending(deps(state, true, sent));
    expect(sent).toEqual(["sms:+33612345678"]);
  });
});

describe("dispatchPending — refus et pannes", () => {
  it("n'envoie jamais un message bloqué par la politique", async () => {
    const sent: string[] = [];
    const state: FakeState = {
      ...READY_STATE,
      prepare: { ok: true, message_id: "msg-2", blocked: true, reason: "opposition_active" },
    };

    const report = await dispatchPending(deps(state, true, sent));
    expect(report.outcomes[0]).toMatchObject({ result: "bloque", reason: "opposition_active" });
    expect(sent).toEqual([]);
  });

  it("neutralise un rejeu : aucun second envoi", async () => {
    const sent: string[] = [];
    const state: FakeState = {
      ...READY_STATE,
      prepare: { ok: true, message_id: "msg-1", duplicate: true },
    };

    const report = await dispatchPending(deps(state, true, sent));
    expect(report.outcomes[0]?.result).toBe("doublon");
    expect(sent).toEqual([]);
  });

  it("refuse d'envoyer un rendu incomplet", async () => {
    const sent: string[] = [];
    const state: FakeState = {
      ...READY_STATE,
      // Le modèle exige {{ville}}, que rien ne fournit.
      template: {
        subject: "Objet",
        body: "Bonjour {{prenom}} de {{ville}}",
        body_format: "markdown",
        preview_text: null,
        allowed_variables: ["prenom", "ville"],
      },
    };

    const report = await dispatchPending(deps(state, true, sent));
    expect(report.outcomes[0]?.result).toBe("echec");
    expect(sent).toEqual([]);
  });

  it("échoue proprement sans destinataire, sans appeler le fournisseur", async () => {
    const sent: string[] = [];
    const state: FakeState = {
      ...READY_STATE,
      contact: { first_name: "Claire", last_name: "Test", email: null, phone: null },
    };

    const report = await dispatchPending(deps(state, true, sent));
    expect(report.outcomes[0]).toMatchObject({
      result: "echec",
      errorCode: "destinataire_invalide",
    });
    expect(sent).toEqual([]);
  });

  it("rapporte une panne fournisseur sans lever d'exception (le dossier reste valide)", async () => {
    const { client, rpcCalls } = fakeSupabase(READY_STATE);
    const failing: EmailProvider = {
      key: "lumail",
      isConfigured: () => true,
      send: async () => ({ ok: false, errorCode: "indisponible", detail: "HTTP 503" }),
    };

    const report = await dispatchPending({
      supabase: client,
      emailProvider: failing,
      smsProvider: providers([]).sms,
      dispatchEnabled: true,
    });

    expect(report.outcomes[0]).toMatchObject({ result: "echec", errorCode: "indisponible" });
    // Un échec transitoire est signalé comme rejouable — jamais réessayé en boucle ici.
    expect(report.outcomes[0]?.reason).toBe("réessai possible");

    const record = rpcCalls.find((c) => c.fn === "crm_comm_record_send");
    expect(record?.args.p_status).toBe("echec");
    expect(record?.args.p_error_code).toBe("indisponible");
  });

  it("distingue un échec définitif d'un échec transitoire", async () => {
    const { client } = fakeSupabase(READY_STATE);
    const failing: EmailProvider = {
      key: "lumail",
      isConfigured: () => true,
      send: async () => ({ ok: false, errorCode: "destinataire_invalide" }),
    };

    const report = await dispatchPending({
      supabase: client,
      emailProvider: failing,
      smsProvider: providers([]).sms,
      dispatchEnabled: true,
    });
    expect(report.outcomes[0]?.reason).toBe("échec définitif");
  });

  it("traite une file vide sans rien tenter", async () => {
    const sent: string[] = [];
    const report = await dispatchPending(deps({ ...READY_STATE, claim: { items: [] } }, true, sent));
    expect(report).toEqual({ claimed: 0, outcomes: [] });
    expect(sent).toEqual([]);
  });
});

describe("dispatchPending — journalisation", () => {
  it("ne journalise ni contenu, ni coordonnée, ni secret", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const sent: string[] = [];
    await dispatchPending(deps(READY_STATE, true, sent));

    const logged = JSON.stringify(spy.mock.calls);
    expect(logged).not.toContain("claire@exemple.invalid");
    expect(logged).not.toContain("Merci");
    expect(logged).not.toContain("lum_");
    spy.mockRestore();
  });
});
