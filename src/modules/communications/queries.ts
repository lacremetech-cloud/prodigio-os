import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { contactName } from "@/modules/crm/format";
import { maskContactValue } from "@/modules/crm/auth/roles";
import type {
  CommunicationAutomationRow,
  CommunicationMessageRow,
  CommunicationMessageStatus,
  CommunicationOutboxRow,
  CommunicationSuppressionRow,
  CommunicationTemplateRow,
  ContactRow,
} from "@/lib/supabase/types";
import { MESSAGE_STATUSES, isCategory, isChannel } from "./types";

/**
 * Couche d'accès en LECTURE du centre de communications.
 *
 * Toutes les requêtes passent par le client serveur (JWT de l'utilisateur) : la
 * **RLS applique les permissions**. Un agent immobilier ne voit que les
 * communications rattachées à ses dossiers ou biens ; `partenaire_lecture` n'en
 * voit aucune (aucun partage de communication n'existe en V1).
 *
 * Les coordonnées sont masquées **côté serveur** selon le rôle : le navigateur
 * ne reçoit jamais une valeur qu'il n'a pas le droit de voir.
 */

export interface MessageListItem {
  message: CommunicationMessageRow;
  contactName: string;
  emailMasked: string | null;
  phoneMasked: string | null;
}

export interface CommunicationCounts {
  total: number;
  enAttente: number;
  enFile: number;
  livres: number;
  echecs: number;
  bloques: number;
}

export interface CommunicationsOverview {
  messages: MessageListItem[];
  counts: CommunicationCounts;
  templates: CommunicationTemplateRow[];
  suppressions: CommunicationSuppressionRow[];
  automations: CommunicationAutomationRow[];
  outbox: CommunicationOutboxRow[];
  canManage: boolean;
}

export interface MessageFilters {
  channel?: string | null;
  category?: string | null;
  status?: string | null;
  search?: string | null;
}

function isMessageStatus(value: unknown): value is CommunicationMessageStatus {
  return typeof value === "string" && (MESSAGE_STATUSES as readonly string[]).includes(value);
}

const MESSAGE_COLUMNS =
  "id, created_at, updated_at, organization_id, contact_id, opportunity_id, buyer_profile_id, property_id, appointment_id, channel, category, event_type, template_id, template_key, template_version, status, provider, provider_message_id, provider_status, scheduled_at, sent_at, delivered_at, failed_at, error_code, error_detail, blocked_reason, rendered_subject, rendered_body, idempotency_key, attempt_count, created_by";

/** Enrichit des messages avec le nom du contact, coordonnées masquées par rôle. */
async function attachContacts(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  messages: CommunicationMessageRow[],
  canViewDetails: boolean,
): Promise<MessageListItem[]> {
  const ids = [...new Set(messages.map((m) => m.contact_id))];
  if (ids.length === 0) return [];

  const { data } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, company_name, email, phone")
    .in("id", ids);

  const byId = new Map<string, Partial<ContactRow>>();
  for (const c of data ?? []) byId.set(c.id, c as Partial<ContactRow>);

  return messages.map((message) => {
    const contact = byId.get(message.contact_id);
    return {
      message,
      contactName: contact
        ? contact.company_name?.trim() || contactName(contact.first_name, contact.last_name)
        : "Contact inconnu",
      emailMasked: maskContactValue(contact?.email ?? null, canViewDetails),
      phoneMasked: maskContactValue(contact?.phone ?? null, canViewDetails),
    };
  });
}

/** Vue d'ensemble du centre de communications. */
export async function getCommunicationsOverview(
  filters: MessageFilters,
  opts: { canViewDetails: boolean; canManage: boolean },
): Promise<CommunicationsOverview> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("communication_messages")
    .select(MESSAGE_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(200);

  // Les filtres arrivent de l'URL : on ne transmet que des valeurs RECONNUES,
  // jamais la chaîne brute.
  if (isChannel(filters.channel)) query = query.eq("channel", filters.channel);
  if (isCategory(filters.category)) query = query.eq("category", filters.category);
  if (isMessageStatus(filters.status)) query = query.eq("status", filters.status);

  const [{ data: rawMessages }, { data: templates }, { data: suppressions }, { data: automations }, { data: outbox }] =
    await Promise.all([
      query,
      supabase
        .from("communication_templates")
        .select("*")
        .order("template_key")
        .order("version", { ascending: false }),
      supabase
        .from("communication_suppressions")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("communication_automations")
        .select("*")
        .order("automation_key")
        .order("version", { ascending: false }),
      supabase
        .from("communication_outbox")
        .select("*")
        .in("status", ["en_attente", "en_cours", "echec"])
        .order("available_at")
        .limit(100),
    ]);

  let messages = (rawMessages ?? []) as CommunicationMessageRow[];
  const items = await attachContacts(supabase, messages, opts.canViewDetails);

  // La recherche porte sur le NOM du contact et sur l'événement, jamais sur une
  // coordonnée masquée : filtrer sur une valeur cachée la révélerait par déduction.
  const search = filters.search?.trim().toLowerCase();
  const filtered = search
    ? items.filter(
        (i) =>
          i.contactName.toLowerCase().includes(search) ||
          i.message.event_type.toLowerCase().includes(search) ||
          (i.message.template_key ?? "").toLowerCase().includes(search),
      )
    : items;

  messages = filtered.map((i) => i.message);

  return {
    messages: filtered,
    counts: {
      total: messages.length,
      enAttente: messages.filter((m) => m.status === "en_attente" || m.status === "planifie").length,
      enFile: messages.filter((m) => m.status === "en_file_fournisseur").length,
      livres: messages.filter((m) => m.status === "livre").length,
      echecs: messages.filter((m) => m.status === "echec").length,
      bloques: messages.filter((m) => m.status === "bloque").length,
    },
    templates: (templates ?? []) as CommunicationTemplateRow[],
    suppressions: (suppressions ?? []) as CommunicationSuppressionRow[],
    automations: (automations ?? []) as CommunicationAutomationRow[],
    outbox: (outbox ?? []) as CommunicationOutboxRow[],
    canManage: opts.canManage,
  };
}

/**
 * Communications rattachées à une entité (dossier Mandat, dossier Acquéreur,
 * bien ou rendez-vous). La RLS filtre : une entité inaccessible renvoie une
 * liste vide, jamais une erreur révélant son existence.
 */
export async function getMessagesForEntity(
  entity: "opportunity" | "buyer_profile" | "property" | "appointment",
  id: string,
  opts: { canViewDetails: boolean; limit?: number },
): Promise<MessageListItem[]> {
  const supabase = await createSupabaseServerClient();
  const column = {
    opportunity: "opportunity_id",
    buyer_profile: "buyer_profile_id",
    property: "property_id",
    appointment: "appointment_id",
  }[entity];

  const { data } = await supabase
    .from("communication_messages")
    .select(MESSAGE_COLUMNS)
    .eq(column, id)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 25);

  return attachContacts(supabase, (data ?? []) as CommunicationMessageRow[], opts.canViewDetails);
}

/**
 * État de configuration des fournisseurs, **sans jamais exposer un secret** :
 * uniquement des booléens de présence et l'état de l'interrupteur d'envoi.
 */
export interface ProviderStatus {
  key: "lumail" | "twilio";
  label: string;
  channel: "email" | "sms";
  configured: boolean;
  /** Ce qui manque, en clair — jamais la valeur attendue. */
  missing: string[];
}

export function describeProviders(flags: {
  lumailConfigured: boolean;
  twilioConfigured: boolean;
  hasLumailKey: boolean;
  hasLumailFrom: boolean;
  hasTwilioSid: boolean;
  hasTwilioToken: boolean;
  hasTwilioFrom: boolean;
}): ProviderStatus[] {
  return [
    {
      key: "lumail",
      label: "Lumail",
      channel: "email",
      configured: flags.lumailConfigured,
      missing: [
        !flags.hasLumailKey ? "LUMAIL_API_KEY" : null,
        !flags.hasLumailFrom ? "LUMAIL_FROM_EMAIL" : null,
      ].filter((v): v is string => v !== null),
    },
    {
      key: "twilio",
      label: "Twilio",
      channel: "sms",
      configured: flags.twilioConfigured,
      missing: [
        !flags.hasTwilioSid ? "TWILIO_ACCOUNT_SID" : null,
        !flags.hasTwilioToken ? "TWILIO_AUTH_TOKEN" : null,
        !flags.hasTwilioFrom ? "TWILIO_FROM" : null,
      ].filter((v): v is string => v !== null),
    },
  ];
}
