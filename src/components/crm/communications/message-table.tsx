"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { StatusBadge, Chip, EmptyState } from "@/components/crm/ui";
import { cssVarRef } from "@/modules/crm/status-visuals";
import {
  CATEGORIES,
  CHANNELS,
  MESSAGE_STATUSES,
  categoryLabels,
  channelLabels,
  errorCodeLabels,
  eventLabels,
  messageStatusLabels,
  messageStatusVisual,
  BLOCKED_REASON_HINTS,
  BLOCKED_REASON_LABELS,
  type Category,
  type Channel,
  type CommunicationEvent,
  type MessageStatus,
} from "@/modules/communications";
import { cancelMessageAction, retryMessageAction } from "@/modules/communications/actions";

/**
 * Tableau des communications. L'utilisateur doit comprendre **immédiatement** :
 * quel message, à qui, pourquoi, quand, par quel canal, livré ou échoué, et si
 * une opposition bloque l'envoi.
 *
 * Accessibilité : en-têtes de colonne explicites, statut porté par une icône ET
 * un libellé (jamais par la seule couleur), actions au clavier, `aria-live` pour
 * les retours. Le tableau défile horizontalement dans son propre conteneur : la
 * page ne défile jamais latéralement.
 */

export interface MessageRow {
  id: string;
  createdAt: string;
  contactName: string;
  emailMasked: string | null;
  phoneMasked: string | null;
  channel: Channel;
  category: Category;
  eventType: string;
  templateKey: string | null;
  templateVersion: number | null;
  status: MessageStatus;
  blockedReason: string | null;
  errorCode: string | null;
  provider: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  subject: string | null;
  href: string | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(iso),
  );
}

function eventLabel(eventType: string): string {
  return eventLabels[eventType as CommunicationEvent] ?? eventType;
}

export function MessageTable({
  rows,
  canManage,
}: {
  rows: MessageRow[];
  canManage: boolean;
}) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const run = (id: string, fn: () => Promise<{ ok: boolean; error?: string }>) => {
    // Verrou anti-double envoi : un second clic pendant le traitement est ignoré.
    if (busyId) return;
    setBusyId(id);
    startTransition(async () => {
      const res = await fn();
      setFeedback(res.ok ? "Action enregistrée." : (res.error ?? "Action impossible."));
      setBusyId(null);
      if (res.ok) router.refresh();
    });
  };

  if (rows.length === 0) {
    return (
      <EmptyState
        title="Aucune communication"
        hint="Les messages apparaissent ici dès qu'un événement métier est traité."
        icon="✉"
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p aria-live="polite" className="sr-only">
        {feedback ?? ""}
      </p>
      {feedback ? (
        <p className="rounded-[10px] border border-[var(--crm-line)] bg-[var(--crm-panel-2)] px-3 py-2 text-sm text-[var(--crm-text-dim)]">
          {feedback}
        </p>
      ) : null}

      <div className="crm-scroll overflow-x-auto rounded-[14px] border border-[var(--crm-line)] bg-[var(--crm-panel)]">
        <table className="w-full min-w-[880px] border-collapse text-sm">
          <caption className="sr-only">
            Historique des communications : destinataire, motif, canal, statut de livraison.
          </caption>
          <thead>
            <tr className="border-b border-[var(--crm-line)] text-left">
              <th scope="col" className="px-3 py-2.5 font-medium text-[var(--crm-text-dim)]">Destinataire</th>
              <th scope="col" className="px-3 py-2.5 font-medium text-[var(--crm-text-dim)]">Pourquoi</th>
              <th scope="col" className="px-3 py-2.5 font-medium text-[var(--crm-text-dim)]">Canal</th>
              <th scope="col" className="px-3 py-2.5 font-medium text-[var(--crm-text-dim)]">Statut</th>
              <th scope="col" className="px-3 py-2.5 font-medium text-[var(--crm-text-dim)]">Quand</th>
              <th scope="col" className="px-3 py-2.5 font-medium text-[var(--crm-text-dim)]">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const visual = messageStatusVisual(row.status);
              const blocked = row.blockedReason as keyof typeof BLOCKED_REASON_LABELS | null;
              return (
                <tr
                  key={row.id}
                  className="border-b border-[var(--crm-line-soft)] align-top last:border-0"
                >
                  <td className="px-3 py-3">
                    <p className="crm-ellipsis font-medium text-[var(--crm-text)]">{row.contactName}</p>
                    <p className="crm-ellipsis text-[12px] text-[var(--crm-text-faint)]">
                      {row.channel === "sms" ? row.phoneMasked : row.emailMasked}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <p className="text-[var(--crm-text)]">{eventLabel(row.eventType)}</p>
                    {row.subject ? (
                      <p className="crm-ellipsis text-[12px] text-[var(--crm-text-faint)]" title={row.subject}>
                        {row.subject}
                      </p>
                    ) : null}
                    <span className="mt-1 inline-block">
                      <Chip variant={row.category === "marketing" ? "gold" : "neutral"}>
                        {categoryLabels[row.category]}
                      </Chip>
                    </span>
                  </td>
                  <td className="px-3 py-3 text-[var(--crm-text-dim)]">
                    {channelLabels[row.channel]}
                    {row.provider && row.provider !== "aucun" ? (
                      <p className="text-[12px] text-[var(--crm-text-faint)]">{row.provider}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge
                      cssVar={visual.cssVar}
                      icon={visual.icon}
                      label={messageStatusLabels[row.status]}
                    />
                    {blocked ? (
                      <p className="mt-1 max-w-[280px] text-[12px] text-[var(--crm-text-dim)]">
                        {BLOCKED_REASON_LABELS[blocked]}
                        <span className="block text-[var(--crm-text-faint)]">
                          {BLOCKED_REASON_HINTS[blocked]}
                        </span>
                      </p>
                    ) : null}
                    {row.errorCode ? (
                      <p
                        className="mt-1 text-[12px]"
                        style={{ color: cssVarRef("--crm-st-perdu") }}
                      >
                        {errorCodeLabels[row.errorCode as keyof typeof errorCodeLabels] ?? row.errorCode}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 text-[12px] text-[var(--crm-text-dim)]">
                    <p>Créé {formatDate(row.createdAt)}</p>
                    {row.sentAt ? <p>Envoyé {formatDate(row.sentAt)}</p> : null}
                    {row.deliveredAt ? <p>Livré {formatDate(row.deliveredAt)}</p> : null}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {canManage && row.status === "echec" ? (
                        <button
                          type="button"
                          className="crm-btn crm-btn--ghost crm-btn--sm"
                          disabled={pending && busyId === row.id}
                          onClick={() => run(row.id, () => retryMessageAction({ messageId: row.id }))}
                        >
                          ↻ Rejouer
                        </button>
                      ) : null}
                      {canManage && (row.status === "en_attente" || row.status === "planifie") ? (
                        <button
                          type="button"
                          className="crm-btn crm-btn--ghost crm-btn--sm"
                          disabled={pending && busyId === row.id}
                          onClick={() => {
                            const reason = window.prompt("Motif de l'annulation ?");
                            if (!reason) return;
                            run(row.id, () => cancelMessageAction({ messageId: row.id, reason }));
                          }}
                        >
                          × Annuler
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Barre de filtres — canal, catégorie, statut, recherche. Conserve l'URL. */
export function CommunicationFilters({
  channel,
  category,
  status,
  search,
}: {
  channel: string;
  category: string;
  status: string;
  search: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(search);

  const push = useMemo(
    () => (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      router.push(`${pathname}?${next.toString()}`);
    },
    [params, pathname, router],
  );

  return (
    <div className="flex flex-wrap items-end gap-3">
      <form
        role="search"
        className="flex min-w-[220px] flex-1 gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          push({ q: q.trim() || null });
        }}
      >
        <label className="sr-only" htmlFor="comm-search">
          Rechercher une communication
        </label>
        <input
          id="comm-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Contact, événement, modèle…"
          className="crm-input"
        />
        <button type="submit" className="crm-btn crm-btn--sm">
          Rechercher
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-[var(--crm-text-faint)]">
          Canal
          <select
            className="crm-input"
            value={channel}
            onChange={(e) => push({ canal: e.target.value || null })}
          >
            <option value="">Tous</option>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {channelLabels[c]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-[var(--crm-text-faint)]">
          Catégorie
          <select
            className="crm-input"
            value={category}
            onChange={(e) => push({ categorie: e.target.value || null })}
          >
            <option value="">Toutes</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {categoryLabels[c]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-[var(--crm-text-faint)]">
          Statut
          <select
            className="crm-input"
            value={status}
            onChange={(e) => push({ statut: e.target.value || null })}
          >
            <option value="">Tous</option>
            {MESSAGE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {messageStatusLabels[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
