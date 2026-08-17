import Link from "next/link";
import { Chip, EmptyState, StatusBadge } from "@/components/crm/ui";
import {
  BLOCKED_REASON_HINTS,
  BLOCKED_REASON_LABELS,
  categoryLabels,
  channelLabels,
  errorCodeLabels,
  eventLabels,
  messageStatusLabels,
  messageStatusVisual,
  type CommunicationEvent,
} from "@/modules/communications";
import type { MessageListItem } from "@/modules/communications/queries";

/**
 * Section « Communications » réutilisable, affichée dans la fiche Mandat, la
 * fiche Acquéreur, la fiche Bien et le rendez-vous.
 *
 * Server component pur : les coordonnées reçues sont **déjà masquées** selon le
 * rôle. Répond aux six questions attendues : quel message, à qui, pourquoi,
 * quand, par quel canal, et s'il a été livré, a échoué, ou est bloqué.
 */
export function EntityCommunications({
  items,
  emptyHint,
}: {
  items: MessageListItem[];
  emptyHint?: string;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="Aucune communication"
        hint={emptyHint ?? "Aucun message n'a encore été préparé pour ce dossier."}
        icon="✉"
      />
    );
  }

  return (
    <ul className="flex min-w-0 flex-col gap-2">
      {items.map(({ message, contactName, emailMasked, phoneMasked }) => {
        const visual = messageStatusVisual(message.status);
        const blocked = message.blocked_reason;
        return (
          <li
            key={message.id}
            className="min-w-0 rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] px-3 py-2.5"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="crm-ellipsis text-sm font-medium text-[var(--crm-text)]">
                  {eventLabels[message.event_type as CommunicationEvent] ?? message.event_type}
                </p>
                <p className="crm-ellipsis text-[12px] text-[var(--crm-text-faint)]">
                  {contactName} ·{" "}
                  {message.channel === "sms" ? phoneMasked : emailMasked} ·{" "}
                  {channelLabels[message.channel]}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Chip variant={message.category === "marketing" ? "gold" : "neutral"}>
                  {categoryLabels[message.category]}
                </Chip>
                <StatusBadge
                  cssVar={visual.cssVar}
                  icon={visual.icon}
                  label={messageStatusLabels[message.status]}
                />
              </div>
            </div>

            {message.rendered_subject ? (
              <p className="crm-ellipsis mt-1 text-[13px] text-[var(--crm-text-dim)]">
                {message.rendered_subject}
              </p>
            ) : null}

            {blocked ? (
              <p className="mt-1 text-[12px] text-[var(--crm-text-dim)]">
                {BLOCKED_REASON_LABELS[blocked]}{" "}
                <span className="text-[var(--crm-text-faint)]">{BLOCKED_REASON_HINTS[blocked]}</span>
              </p>
            ) : null}

            {message.error_code ? (
              <p className="mt-1 text-[12px] text-[var(--crm-text-dim)]">
                {errorCodeLabels[message.error_code]}
              </p>
            ) : null}

            <p className="mt-1 text-[11px] text-[var(--crm-text-faint)]">
              {new Intl.DateTimeFormat("fr-FR", {
                dateStyle: "short",
                timeStyle: "short",
              }).format(new Date(message.sent_at ?? message.created_at))}
              {message.template_key
                ? ` · ${message.template_key}${message.template_version ? ` v${message.template_version}` : ""}`
                : ""}
            </p>
          </li>
        );
      })}
      <li>
        <Link href="/crm/communications" className="text-[12px] text-[var(--crm-gold)] hover:underline">
          Voir le centre de communications →
        </Link>
      </li>
    </ul>
  );
}
