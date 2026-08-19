"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Chip, EmptyState, SectionTitle } from "@/components/crm/ui";
import {
  channelLabels,
  eventLabels,
  outboxStatusLabels,
  type CommunicationEvent,
} from "@/modules/communications";
import {
  processOutboxAction,
  scheduleRemindersAction,
} from "@/modules/communications/actions";

/**
 * Panneaux opérationnels du studio : file d'attente et état des fournisseurs.
 *
 * Les modèles, les oppositions et les automatisations ont leurs écrans dédiés
 * (`/crm/communications/modeles`, `/oppositions`, `/automatisations`) : aucune
 * interface n'est dupliquée ici.
 *
 * ⚠️ Aucun secret n'est affiché : l'état des fournisseurs se limite à des
 * booléens de présence et au NOM des variables manquantes — jamais leur valeur.
 */

function useAction() {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const run = (fn: () => Promise<{ ok: boolean; error?: string; info?: string }>) => {
    // Verrou anti-double soumission : le second clic ne déclenche rien.
    if (busy) return;
    setBusy(true);
    startTransition(async () => {
      const res = await fn();
      setFeedback(res.ok ? (res.info ?? "Action enregistrée.") : (res.error ?? "Action impossible."));
      setBusy(false);
      if (res.ok) router.refresh();
    });
  };

  return { feedback, busy: busy || pending, run };
}

function Feedback({ message }: { message: string | null }) {
  return (
    <>
      <p aria-live="polite" className="sr-only">
        {message ?? ""}
      </p>
      {message ? (
        <p className="rounded-[10px] border border-[var(--crm-line)] bg-[var(--crm-panel-2)] px-3 py-2 text-sm text-[var(--crm-text-dim)]">
          {message}
        </p>
      ) : null}
    </>
  );
}

// --- État des fournisseurs -----------------------------------------------------
export interface ProviderView {
  key: string;
  label: string;
  channel: string;
  configured: boolean;
  missing: string[];
}

export function ProvidersPanel({
  providers,
  dispatchEnabled,
}: {
  providers: ProviderView[];
  dispatchEnabled: boolean;
}) {
  return (
    <section className="rounded-[14px] border border-[var(--crm-line)] bg-[var(--crm-panel)] p-4">
      <SectionTitle eyebrow="Configuration" title="Fournisseurs d'envoi" />
      <p className="mb-3 text-sm text-[var(--crm-text-dim)]">
        Prodigio reste la source de vérité. Les fournisseurs ne sont que des infrastructures
        d&apos;envoi, remplaçables sans toucher aux dossiers ni aux consentements.
      </p>

      <div className="flex flex-col gap-2">
        {providers.map((p) => (
          <div
            key={p.key}
            className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="font-medium text-[var(--crm-text)]">
                {p.label}{" "}
                <span className="text-[12px] font-normal text-[var(--crm-text-faint)]">
                  · {channelLabels[p.channel as "email" | "sms"]}
                </span>
              </p>
              {p.missing.length > 0 ? (
                <p className="text-[12px] text-[var(--crm-text-faint)]">
                  Variables manquantes : {p.missing.join(", ")}
                </p>
              ) : null}
            </div>
            <Chip variant={p.configured ? "ok" : "neutral"} dot>
              {p.configured ? "Configuré" : "Non configuré"}
            </Chip>
          </div>
        ))}
      </div>

      <div
        className="mt-3 rounded-[10px] border px-3 py-2.5 text-sm"
        style={{
          borderColor: dispatchEnabled ? "var(--crm-st-signe)" : "var(--crm-line)",
          background: "var(--crm-panel-2)",
        }}
      >
        <p className="font-medium text-[var(--crm-text)]">
          Envoi réel : {dispatchEnabled ? "activé" : "désactivé"}
        </p>
        <p className="text-[var(--crm-text-dim)]">
          {dispatchEnabled
            ? "Les messages éligibles sont réellement transmis au fournisseur."
            : "Les messages sont préparés, la politique est appliquée et tout est tracé, mais aucun envoi n'a lieu."}
        </p>
      </div>
    </section>
  );
}

// --- File d'attente ------------------------------------------------------------
export interface OutboxView {
  id: string;
  eventType: string;
  status: string;
  templateKey: string;
  channel: string;
  availableAt: string;
  attemptCount: number;
  maxAttempts: number;
  skipReason: string | null;
}

export function OutboxPanel({
  rows,
  canManage,
}: {
  rows: OutboxView[];
  canManage: boolean;
}) {
  const { feedback, busy, run } = useAction();

  return (
    <section className="rounded-[14px] border border-[var(--crm-line)] bg-[var(--crm-panel)] p-4">
      <SectionTitle
        eyebrow="File d'attente"
        title="Événements à traiter"
        action={
          canManage ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="crm-btn crm-btn--sm"
                disabled={busy}
                onClick={() => run(() => processOutboxAction({ limit: 10 }))}
              >
                ▶ Traiter la file
              </button>
              <button
                type="button"
                className="crm-btn crm-btn--ghost crm-btn--sm"
                disabled={busy}
                onClick={() => run(() => scheduleRemindersAction({ hoursAhead: 24 }))}
              >
                ◷ Planifier les rappels
              </button>
            </div>
          ) : undefined
        }
      />
      <Feedback message={feedback} />

      {rows.length === 0 ? (
        <EmptyState title="File vide" hint="Aucun événement en attente de traitement." icon="◷" />
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="crm-ellipsis text-sm text-[var(--crm-text)]">
                  {eventLabels[row.eventType as CommunicationEvent] ?? row.eventType}
                </p>
                <p className="text-[12px] text-[var(--crm-text-faint)]">
                  {row.templateKey} · {channelLabels[row.channel as "email" | "sms"]} · tentative{" "}
                  {row.attemptCount}/{row.maxAttempts}
                  {row.skipReason ? ` · ${row.skipReason}` : ""}
                </p>
              </div>
              <Chip>{outboxStatusLabels[row.status as keyof typeof outboxStatusLabels] ?? row.status}</Chip>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
