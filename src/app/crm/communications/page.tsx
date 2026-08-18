import type { Metadata } from "next";
import { requireCrmSession } from "@/modules/crm/auth/session";
import { canViewContactDetails, hasAnyRole } from "@/modules/crm/auth/roles";
import { contactName } from "@/modules/crm/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  env,
  isCommunicationDispatchEnabled,
  isLumailConfigured,
  isTwilioConfigured,
} from "@/config";
import { describeProviders, getCommunicationsOverview } from "@/modules/communications/queries";
import {
  CommunicationFilters,
  MessageTable,
  type MessageRow,
} from "@/components/crm/communications/message-table";
import {
  AutomationsPanel,
  OutboxPanel,
  ProvidersPanel,
  SuppressionsPanel,
  TemplatesPanel,
} from "@/components/crm/communications/panels";

export const metadata: Metadata = { title: "Communications" };

/**
 * Centre de communications.
 *
 * L'autorisation est vérifiée côté serveur (session + RLS) : la liste ne
 * contient que les communications réellement visibles. Les coordonnées sont
 * masquées **avant** d'atteindre le navigateur, selon le rôle.
 *
 * ⚠️ Aucune valeur de secret n'est lue ni transmise : l'état des fournisseurs se
 * limite à des booléens de présence et au NOM des variables manquantes.
 */
export default async function CommunicationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireCrmSession("/crm/communications");
  const params = await searchParams;
  const one = (key: string) => {
    const v = params[key];
    return typeof v === "string" ? v : "";
  };

  const canViewContacts = canViewContactDetails(session.roles);
  const canManage = hasAnyRole(session.roles, ["administrateur", "manager"]);
  const canRelease = hasAnyRole(session.roles, ["administrateur"]);

  const overview = await getCommunicationsOverview(
    {
      channel: one("canal"),
      category: one("categorie"),
      status: one("statut"),
      search: one("q"),
    },
    { canViewDetails: canViewContacts, canManage },
  );

  const rows: MessageRow[] = overview.messages.map((item) => ({
    id: item.message.id,
    createdAt: item.message.created_at,
    contactName: item.contactName,
    emailMasked: item.emailMasked,
    phoneMasked: item.phoneMasked,
    channel: item.message.channel,
    category: item.message.category,
    eventType: item.message.event_type,
    templateKey: item.message.template_key,
    templateVersion: item.message.template_version,
    status: item.message.status,
    blockedReason: item.message.blocked_reason,
    errorCode: item.message.error_code,
    provider: item.message.provider,
    sentAt: item.message.sent_at,
    deliveredAt: item.message.delivered_at,
    subject: item.message.rendered_subject,
    href: null,
  }));

  // Noms des contacts visés par une opposition (masquage déjà appliqué ailleurs :
  // ici seul le NOM est nécessaire, jamais la coordonnée).
  const supabase = await createSupabaseServerClient();
  const suppressionContactIds = [...new Set(overview.suppressions.map((s) => s.contact_id))];
  const { data: suppressionContacts } = suppressionContactIds.length
    ? await supabase
        .from("contacts")
        .select("id, first_name, last_name, company_name")
        .in("id", suppressionContactIds)
    : { data: [] };
  const nameById = new Map(
    (suppressionContacts ?? []).map((c) => [
      c.id,
      c.company_name?.trim() || contactName(c.first_name, c.last_name),
    ]),
  );

  const providers = describeProviders({
    lumailConfigured: isLumailConfigured(),
    twilioConfigured: isTwilioConfigured(),
    hasLumailKey: Boolean(env.LUMAIL_API_KEY),
    hasLumailFrom: Boolean(env.LUMAIL_FROM_EMAIL),
    hasTwilioSid: Boolean(env.TWILIO_ACCOUNT_SID),
    hasTwilioToken: Boolean(env.TWILIO_AUTH_TOKEN),
    hasTwilioFrom: Boolean(env.TWILIO_FROM),
  });

  const dispatchEnabled =
    isCommunicationDispatchEnabled() && (isLumailConfigured() || isTwilioConfigured());

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <header>
        <p className="crm-eyebrow">Communications</p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--crm-text)]">
          Centre de communications
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-[var(--crm-text-dim)]">
          Prodigio conserve les contacts, les consentements, les modèles, l&apos;historique et
          l&apos;audit. Lumail et Twilio ne sont que des infrastructures d&apos;envoi, remplaçables.
        </p>
      </header>

      {!dispatchEnabled ? (
        <div
          role="status"
          className="rounded-[12px] border border-[var(--crm-line)] bg-[var(--crm-panel-2)] px-4 py-3 text-sm"
        >
          <p className="font-medium text-[var(--crm-text)]">Envoi réel désactivé</p>
          <p className="mt-0.5 text-[var(--crm-text-dim)]">
            La fondation est en place et auditable, mais aucun message ne part. La base légale des
            traitements reste <strong>à valider juridiquement</strong> : aucune activation marketing
            n&apos;est possible tant que ce point n&apos;est pas tranché.
          </p>
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {(
          [
            ["Total", overview.counts.total],
            ["En attente", overview.counts.enAttente],
            ["En file", overview.counts.enFile],
            ["Livrés", overview.counts.livres],
            ["Échecs", overview.counts.echecs],
            ["Bloqués", overview.counts.bloques],
          ] as const
        ).map(([label, value]) => (
          <div
            key={label}
            className="rounded-[12px] border border-[var(--crm-line)] bg-[var(--crm-panel)] px-3 py-2.5"
          >
            <p className="text-[11px] uppercase tracking-wide text-[var(--crm-text-faint)]">
              {label}
            </p>
            <p className="mt-0.5 text-xl font-semibold text-[var(--crm-text)]">{value}</p>
          </div>
        ))}
      </section>

      <CommunicationFilters
        channel={one("canal")}
        category={one("categorie")}
        status={one("statut")}
        search={one("q")}
      />

      <MessageTable rows={rows} canManage={canManage} />

      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <OutboxPanel
          canManage={canManage}
          rows={overview.outbox.map((o) => ({
            id: o.id,
            eventType: o.event_type,
            status: o.status,
            templateKey: o.template_key,
            channel: o.channel,
            availableAt: o.available_at,
            attemptCount: o.attempt_count,
            maxAttempts: o.max_attempts,
            skipReason: o.skip_reason,
          }))}
        />
        <ProvidersPanel providers={providers} dispatchEnabled={dispatchEnabled} />
        <TemplatesPanel
          canManage={canManage}
          rows={overview.templates.map((t) => ({
            id: t.id,
            templateKey: t.template_key,
            version: t.version,
            name: t.name,
            channel: t.channel,
            category: t.category,
            status: t.status,
            allowedVariables: t.allowed_variables ?? [],
          }))}
        />
        <SuppressionsPanel
          canRelease={canRelease}
          rows={overview.suppressions.map((s) => ({
            id: s.id,
            contactName: nameById.get(s.contact_id) ?? "Contact inconnu",
            channel: s.channel,
            scope: s.scope,
            reason: s.reason,
            createdAt: s.created_at,
          }))}
        />
        <AutomationsPanel
          canManage={canManage}
          rows={overview.automations.map((a) => ({
            id: a.id,
            automationKey: a.automation_key,
            version: a.version,
            name: a.name,
            triggerEvent: a.trigger_event,
            templateKey: a.template_key,
            channel: a.channel,
            delayMinutes: a.delay_minutes,
            status: a.status,
          }))}
        />
      </div>
    </div>
  );
}
