import type { Metadata } from "next";
import { requireCrmSession } from "@/modules/crm/auth/session";
import { canViewContactDetails, hasAnyRole } from "@/modules/crm/auth/roles";
import {
  env,
  isCommunicationDispatchEnabled,
  isLumailConfigured,
  isTwilioConfigured,
} from "@/config";
import { describeProviders, getCommunicationsOverview } from "@/modules/communications/queries";
import { getStudioOverview } from "@/modules/communications/studio/queries";
import {
  CommunicationFilters,
  MessageTable,
  type MessageRow,
} from "@/components/crm/communications/message-table";
import { OutboxPanel, ProvidersPanel } from "@/components/crm/communications/panels";
import { OverviewStats } from "@/components/crm/communications/studio/overview-stats";
import { ActivationCenter } from "@/components/crm/communications/studio/activation-center";

export const metadata: Metadata = { title: "Communications — Vue d’ensemble" };

/**
 * **Vue d'ensemble du studio.**
 *
 * Ne présente que des données réelles, comptées en base et filtrées par la RLS :
 * un agent immobilier ne voit et ne compte que ses dossiers ; `partenaire_lecture`
 * ne voit rien. Les coordonnées sont masquées **avant** d'atteindre le navigateur.
 *
 * ⚠️ Aucune valeur de secret n'est lue : l'état des fournisseurs se limite à des
 * booléens de présence et au NOM des variables manquantes.
 */
export default async function CommunicationsOverviewPage({
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

  const [overview, studio] = await Promise.all([
    getCommunicationsOverview(
      {
        channel: one("canal"),
        category: one("categorie"),
        status: one("statut"),
        search: one("q"),
      },
      { canViewDetails: canViewContacts, canManage },
    ),
    getStudioOverview(),
  ]);

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

  const lumailConfigured = isLumailConfigured();
  const twilioConfigured = isTwilioConfigured();

  const providers = describeProviders({
    lumailConfigured,
    twilioConfigured,
    hasLumailKey: Boolean(env.LUMAIL_API_KEY),
    hasLumailFrom: Boolean(env.LUMAIL_FROM_EMAIL),
    hasTwilioSid: Boolean(env.TWILIO_ACCOUNT_SID),
    hasTwilioToken: Boolean(env.TWILIO_AUTH_TOKEN),
    hasTwilioFrom: Boolean(env.TWILIO_FROM),
  });

  const dispatchEnabled =
    isCommunicationDispatchEnabled() && (lumailConfigured || twilioConfigured);

  const activeTemplateCount = overview.templates.filter((t) => t.status === "actif").length;

  return (
    <div className="flex min-w-0 flex-col gap-5">
      {!dispatchEnabled ? (
        <div
          role="status"
          className="rounded-[12px] border border-[var(--crm-line)] bg-[var(--crm-panel-2)] px-4 py-3 text-sm"
        >
          <p className="font-medium text-[var(--crm-text)]">Envoi réel désactivé</p>
          <p className="crm-wrap mt-0.5 text-[var(--crm-text-dim)]">
            La fondation est en place et auditable, mais aucun message ne part. Les brouillons du
            studio ne s&apos;exécutent pas, et aucune automatisation personnalisée ne peut être
            activée.
          </p>
        </div>
      ) : null}

      <OverviewStats
        stats={studio.stats}
        blockedReasons={studio.blockedReasons}
        skippedReasons={studio.skippedReasons}
      />

      <ActivationCenter
        readiness={{
          emailProviderConfigured: lumailConfigured,
          smsProviderConfigured: twilioConfigured,
          dispatchEnabled,
          activeTemplateCount,
          templateCount: overview.templates.length,
          queueProcessable: lumailConfigured || twilioConfigured,
          // Aucune remontée de statut fournisseur n'est branchée : le constat est
          // « non disponible », et il le restera tant qu'aucun webhook ni sondage
          // n'existe. On ne suppose jamais une preuve que le système n'a pas.
          deliveryProofAvailable: false,
        }}
      />

      <section className="flex min-w-0 flex-col gap-3">
        <CommunicationFilters
          channel={one("canal")}
          category={one("categorie")}
          status={one("statut")}
          search={one("q")}
        />
        <MessageTable rows={rows} canManage={canManage} />
      </section>

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
      </div>
    </div>
  );
}
