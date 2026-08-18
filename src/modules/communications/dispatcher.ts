import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { EmailProvider, SmsProvider } from "./providers/types";
import { renderTemplate, type BodyFormat } from "./templates/render";
import { isRetryable, type ErrorCode } from "./types";

/**
 * `CommunicationDispatcher` — consomme l'outbox et **rapporte** le résultat.
 *
 * Garanties, dans cet ordre :
 *   1. **Aucune décision d'envoi n'est prise ici.** La base réserve la ligne
 *      (`crm_comm_claim_outbox`, `for update skip locked`) et applique la
 *      politique (`crm_comm_prepare_message`). Le dispatcher exécute, puis
 *      rapporte via `crm_comm_record_send`.
 *   2. **Simulation par défaut** : sans `dispatchEnabled`, aucun appel réseau
 *      n'est émis. Les messages sont préparés, la politique est appliquée, mais
 *      rien ne part.
 *   3. **Retries bornés** : une tentative par passage, un réessai uniquement sur
 *      cause transitoire, et le compteur d'outbox borne le total. Aucune boucle.
 *   4. **Aucune perte silencieuse** : chaque issue est écrite en base et
 *      visible dans le centre de communications.
 *   5. **Aucun contenu, aucune coordonnée, aucun secret journalisé.**
 */

const LOG_EVENT = "communication_dispatch";

type Client = SupabaseClient<Database>;

export interface DispatcherDeps {
  supabase: Client;
  emailProvider: EmailProvider;
  smsProvider: SmsProvider;
  /** Faux ⇒ simulation stricte : la politique s'applique, rien n'est émis. */
  dispatchEnabled: boolean;
  /** Injecté dans les tests pour n'appeler aucune API réelle. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export interface DispatchOutcome {
  outboxId: string;
  messageId: string | null;
  result: "en_file_fournisseur" | "bloque" | "echec" | "simule" | "doublon" | "ignore";
  reason?: string | null;
  errorCode?: ErrorCode | null;
}

export interface DispatchReport {
  claimed: number;
  outcomes: DispatchOutcome[];
}

interface ClaimedRow {
  id: string;
  event_type: string;
  channel: string;
}

interface PreparedMessage {
  id: string;
  channel: string;
  status: string;
  blocked_reason: string | null;
  subject: string | null;
  body: string;
  body_format: BodyFormat;
  preview_text: string | null;
  allowed_variables: string[];
  recipient: string | null;
  variables: Record<string, string | null>;
}

/**
 * Traite au plus `limit` événements. Chaque événement est indépendant : l'échec
 * de l'un n'interrompt jamais les autres, et ne remet en cause aucun dossier.
 */
export async function dispatchPending(
  deps: DispatcherDeps,
  limit = 10,
): Promise<DispatchReport> {
  const claimed = await claimBatch(deps.supabase, limit);
  const outcomes: DispatchOutcome[] = [];

  for (const row of claimed) {
    outcomes.push(await processOne(deps, row));
  }

  console.info(LOG_EVENT, {
    claimed: claimed.length,
    queued: outcomes.filter((o) => o.result === "en_file_fournisseur").length,
    simulated: outcomes.filter((o) => o.result === "simule").length,
    blocked: outcomes.filter((o) => o.result === "bloque").length,
    failed: outcomes.filter((o) => o.result === "echec").length,
  });

  return { claimed: claimed.length, outcomes };
}

async function claimBatch(supabase: Client, limit: number): Promise<ClaimedRow[]> {
  const { data, error } = await supabase.rpc("crm_comm_claim_outbox", { p_limit: limit });
  if (error) throw new Error("réservation de la file impossible");
  const payload = data as { items?: ClaimedRow[] } | null;
  return payload?.items ?? [];
}

async function processOne(deps: DispatcherDeps, row: ClaimedRow): Promise<DispatchOutcome> {
  // 1. La BASE applique la politique et crée (ou retrouve) le message.
  const { data, error } = await deps.supabase.rpc("crm_comm_prepare_message", {
    p_outbox_id: row.id,
  });
  if (error) {
    return { outboxId: row.id, messageId: null, result: "echec", errorCode: "erreur_inconnue" };
  }

  const prepared = data as {
    message_id?: string;
    blocked?: boolean;
    reason?: string | null;
    duplicate?: boolean;
  } | null;

  const messageId = prepared?.message_id ?? null;
  if (prepared?.duplicate) {
    return { outboxId: row.id, messageId, result: "doublon" };
  }
  if (prepared?.blocked) {
    return { outboxId: row.id, messageId, result: "bloque", reason: prepared.reason ?? null };
  }
  if (!messageId) {
    return { outboxId: row.id, messageId: null, result: "ignore", reason: "message non créé" };
  }

  // 2. Résolution du contenu et du destinataire (vue serveur, sous RLS).
  const message = await loadPrepared(deps.supabase, messageId);
  if (!message || !message.recipient) {
    await recordFailure(deps.supabase, messageId, "destinataire_invalide");
    return { outboxId: row.id, messageId, result: "echec", errorCode: "destinataire_invalide" };
  }

  // 3. Rendu — un rendu incomplet ne part JAMAIS.
  const rendered = renderTemplate({
    subject: message.subject,
    body: message.body,
    bodyFormat: message.body_format,
    allowedVariables: message.allowed_variables,
    values: message.variables,
  });
  if (!rendered.ok) {
    await recordFailure(deps.supabase, messageId, "erreur_inconnue", rendered.code);
    return { outboxId: row.id, messageId, result: "echec", errorCode: "erreur_inconnue" };
  }

  // 4. SIMULATION : la politique a été appliquée, mais rien n'est émis.
  if (!deps.dispatchEnabled) {
    return { outboxId: row.id, messageId, result: "simule", reason: "envoi_desactive" };
  }

  // 5. Envoi réel via l'adaptateur — le seul endroit qui touche un fournisseur.
  const transport = { fetchImpl: deps.fetchImpl, timeoutMs: deps.timeoutMs };
  const sent =
    message.channel === "sms"
      ? await deps.smsProvider.send({ to: message.recipient, body: rendered.body }, transport)
      : await deps.emailProvider.send(
          {
            to: message.recipient,
            subject: rendered.subject ?? "",
            body: rendered.body,
            bodyFormat: message.body_format,
            previewText: message.preview_text,
          },
          transport,
        );

  const provider = message.channel === "sms" ? deps.smsProvider.key : deps.emailProvider.key;

  if (sent.ok) {
    await deps.supabase.rpc("crm_comm_record_send", {
      p_message_id: messageId,
      p_status: "en_file_fournisseur",
      p_provider: provider,
      p_provider_message_id: sent.providerMessageId,
      p_rendered_subject: rendered.subject,
      p_rendered_body: rendered.body,
    });
    return { outboxId: row.id, messageId, result: "en_file_fournisseur" };
  }

  await deps.supabase.rpc("crm_comm_record_send", {
    p_message_id: messageId,
    p_status: "echec",
    p_provider: provider,
    p_error_code: sent.errorCode,
    // `detail` ne contient qu'un code technique : jamais l'adresse ni le contenu.
    p_error_detail: sent.detail ?? null,
  });

  return {
    outboxId: row.id,
    messageId,
    result: "echec",
    errorCode: sent.errorCode,
    reason: isRetryable(sent.errorCode) ? "réessai possible" : "échec définitif",
  };
}

async function recordFailure(
  supabase: Client,
  messageId: string,
  code: ErrorCode,
  detail?: string,
): Promise<void> {
  await supabase.rpc("crm_comm_record_send", {
    p_message_id: messageId,
    p_status: "echec",
    p_provider: "aucun",
    p_error_code: code,
    p_error_detail: detail ?? null,
  });
}

/**
 * Charge le message préparé, son modèle et les variables résolues. La résolution
 * des variables est faite ICI (côté serveur), à partir du contact et du dossier :
 * la charge utile de l'outbox ne contient jamais de donnée personnelle.
 */
async function loadPrepared(supabase: Client, messageId: string): Promise<PreparedMessage | null> {
  const { data: msg } = await supabase
    .from("communication_messages")
    .select(
      "id, channel, status, blocked_reason, template_id, contact_id, appointment_id, property_id",
    )
    .eq("id", messageId)
    .maybeSingle();
  if (!msg) return null;

  const { data: tpl } = msg.template_id
    ? await supabase
        .from("communication_templates")
        .select("subject, body, body_format, preview_text, allowed_variables")
        .eq("id", msg.template_id)
        .maybeSingle()
    : { data: null };
  if (!tpl) return null;

  const { data: contact } = await supabase
    .from("contacts")
    .select("first_name, last_name, email, phone")
    .eq("id", msg.contact_id)
    .maybeSingle();
  if (!contact) return null;

  const variables: Record<string, string | null> = {
    prenom: contact.first_name,
    nom: contact.last_name,
    ville: null,
    date_rdv: null,
    heure_rdv: null,
    adresse: null,
    nom_bien: null,
  };

  if (msg.appointment_id) {
    const { data: appt } = await supabase
      .from("estimation_appointments")
      .select("starts_at, timezone, address")
      .eq("id", msg.appointment_id)
      .maybeSingle();
    if (appt) {
      const at = new Date(appt.starts_at);
      const tz = appt.timezone || "Europe/Paris";
      variables.date_rdv = new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "long",
        timeZone: tz,
      }).format(at);
      variables.heure_rdv = new Intl.DateTimeFormat("fr-FR", {
        timeStyle: "short",
        timeZone: tz,
      }).format(at);
      variables.adresse = appt.address;
    }
  }

  if (msg.property_id) {
    const { data: property } = await supabase
      .from("properties")
      .select("project_name, location_city")
      .eq("id", msg.property_id)
      .maybeSingle();
    if (property) {
      variables.nom_bien = property.project_name;
      variables.ville = property.location_city;
    }
  }

  return {
    id: msg.id,
    channel: msg.channel,
    status: msg.status,
    blocked_reason: msg.blocked_reason,
    subject: tpl.subject,
    body: tpl.body,
    body_format: tpl.body_format as BodyFormat,
    preview_text: tpl.preview_text,
    allowed_variables: tpl.allowed_variables ?? [],
    recipient: msg.channel === "sms" ? contact.phone : contact.email,
    variables,
  };
}
