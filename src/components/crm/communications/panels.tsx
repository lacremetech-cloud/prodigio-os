"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Chip, EmptyState, SectionTitle } from "@/components/crm/ui";
import {
  automationStatusLabels,
  categoryLabels,
  channelLabels,
  eventLabels,
  outboxStatusLabels,
  suppressionReasonLabels,
  templateStatusLabels,
  type CommunicationEvent,
} from "@/modules/communications";
import {
  processOutboxAction,
  releaseSuppressionAction,
  scheduleRemindersAction,
  setAutomationStatusAction,
  setTemplateStatusAction,
} from "@/modules/communications/actions";
import { safeAction } from "@/modules/crm/safe-action";

/**
 * Panneaux du centre de communications : file d'attente, modèles, oppositions,
 * automatisations et état des fournisseurs.
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
      const res = await safeAction(fn);
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

// --- Modèles --------------------------------------------------------------------
export interface TemplateView {
  id: string;
  templateKey: string;
  version: number;
  name: string;
  channel: string;
  category: string;
  status: string;
  allowedVariables: string[];
}

export function TemplatesPanel({
  rows,
  canManage,
}: {
  rows: TemplateView[];
  canManage: boolean;
}) {
  const { feedback, busy, run } = useAction();

  return (
    <section className="rounded-[14px] border border-[var(--crm-line)] bg-[var(--crm-panel)] p-4">
      <SectionTitle eyebrow="Contenus" title="Modèles de messages" />
      <p className="mb-3 text-sm text-[var(--crm-text-dim)]">
        Chaque modèle est <strong>versionné</strong> et déclare ses variables. Un modèle en
        brouillon ou archivé ne peut jamais partir.
      </p>
      <Feedback message={feedback} />

      {rows.length === 0 ? (
        <EmptyState title="Aucun modèle" hint="Créez un modèle pour activer un événement." icon="✎" />
      ) : (
        <div className="crm-scroll mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <caption className="sr-only">Modèles de messages, par clé et version.</caption>
            <thead>
              <tr className="border-b border-[var(--crm-line)] text-left">
                <th scope="col" className="px-2 py-2 font-medium text-[var(--crm-text-dim)]">Modèle</th>
                <th scope="col" className="px-2 py-2 font-medium text-[var(--crm-text-dim)]">Canal</th>
                <th scope="col" className="px-2 py-2 font-medium text-[var(--crm-text-dim)]">Catégorie</th>
                <th scope="col" className="px-2 py-2 font-medium text-[var(--crm-text-dim)]">Statut</th>
                <th scope="col" className="px-2 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="border-b border-[var(--crm-line-soft)] last:border-0">
                  <td className="px-2 py-2.5">
                    <p className="crm-ellipsis text-[var(--crm-text)]">{t.name}</p>
                    <p className="text-[12px] text-[var(--crm-text-faint)]">
                      {t.templateKey} · v{t.version}
                      {t.allowedVariables.length > 0
                        ? ` · ${t.allowedVariables.map((v) => `{{${v}}}`).join(" ")}`
                        : ""}
                    </p>
                  </td>
                  <td className="px-2 py-2.5 text-[var(--crm-text-dim)]">
                    {channelLabels[t.channel as "email" | "sms"]}
                  </td>
                  <td className="px-2 py-2.5">
                    <Chip variant={t.category === "marketing" ? "gold" : "neutral"}>
                      {categoryLabels[t.category as "transactionnel" | "marketing"]}
                    </Chip>
                  </td>
                  <td className="px-2 py-2.5">
                    <Chip variant={t.status === "actif" ? "ok" : "neutral"}>
                      {templateStatusLabels[t.status] ?? t.status}
                    </Chip>
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    {canManage && t.status !== "actif" ? (
                      <button
                        type="button"
                        className="crm-btn crm-btn--ghost crm-btn--sm"
                        disabled={busy}
                        onClick={() =>
                          run(() => setTemplateStatusAction({ templateId: t.id, status: "actif" }))
                        }
                      >
                        Activer
                      </button>
                    ) : null}
                    {canManage && t.status === "actif" ? (
                      <button
                        type="button"
                        className="crm-btn crm-btn--ghost crm-btn--sm"
                        disabled={busy}
                        onClick={() =>
                          run(() => setTemplateStatusAction({ templateId: t.id, status: "archive" }))
                        }
                      >
                        Archiver
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// --- Oppositions -----------------------------------------------------------------
export interface SuppressionView {
  id: string;
  contactName: string;
  channel: string;
  scope: string;
  reason: string;
  createdAt: string;
}

export function SuppressionsPanel({
  rows,
  canRelease,
}: {
  rows: SuppressionView[];
  canRelease: boolean;
}) {
  const { feedback, busy, run } = useAction();

  return (
    <section className="rounded-[14px] border border-[var(--crm-line)] bg-[var(--crm-panel)] p-4">
      <SectionTitle eyebrow="Protection des personnes" title="Oppositions actives" />
      <p className="mb-3 text-sm text-[var(--crm-text-dim)]">
        Une opposition <strong>bloque</strong> l&apos;envoi, quelle que soit la base légale. Elle ne
        peut jamais autoriser un envoi. La levée est réservée aux administrateurs et exige un motif.
      </p>
      <Feedback message={feedback} />

      {rows.length === 0 ? (
        <EmptyState title="Aucune opposition active" icon="⦸" />
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {rows.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="crm-ellipsis text-sm text-[var(--crm-text)]">{s.contactName}</p>
                <p className="text-[12px] text-[var(--crm-text-faint)]">
                  {suppressionReasonLabels[s.reason as keyof typeof suppressionReasonLabels] ?? s.reason}{" "}
                  · {s.channel} · {s.scope}
                </p>
              </div>
              {canRelease ? (
                <button
                  type="button"
                  className="crm-btn crm-btn--ghost crm-btn--sm"
                  disabled={busy}
                  onClick={() => {
                    const reason = window.prompt("Motif de la levée (obligatoire, tracé) ?");
                    if (!reason) return;
                    run(() => releaseSuppressionAction({ suppressionId: s.id, reason }));
                  }}
                >
                  Lever
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// --- Automatisations ---------------------------------------------------------------
export interface AutomationView {
  id: string;
  automationKey: string;
  version: number;
  name: string;
  triggerEvent: string;
  templateKey: string;
  channel: string;
  delayMinutes: number;
  status: string;
}

export function AutomationsPanel({
  rows,
  canManage,
}: {
  rows: AutomationView[];
  canManage: boolean;
}) {
  const { feedback, busy, run } = useAction();

  return (
    <section className="rounded-[14px] border border-[var(--crm-line)] bg-[var(--crm-panel)] p-4">
      <SectionTitle eyebrow="Fondation" title="Automatisations" />
      <p className="mb-3 text-sm text-[var(--crm-text-dim)]">
        Définitions versionnées : déclencheur, conditions, délai, action. Aucune exécution autonome
        n&apos;est activée en V1 — une automatisation en brouillon ou en pause ne produit rien.
      </p>
      <Feedback message={feedback} />

      {rows.length === 0 ? (
        <EmptyState
          title="Aucune automatisation"
          hint="La fondation est en place ; les scénarios viendront en V1.1."
          icon="⚙"
        />
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {rows.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="crm-ellipsis text-sm text-[var(--crm-text)]">
                  {a.name} <span className="text-[var(--crm-text-faint)]">v{a.version}</span>
                </p>
                <p className="text-[12px] text-[var(--crm-text-faint)]">
                  {eventLabels[a.triggerEvent as CommunicationEvent] ?? a.triggerEvent} →{" "}
                  {a.templateKey} · délai {a.delayMinutes} min
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Chip variant={a.status === "actif" ? "ok" : "neutral"}>
                  {automationStatusLabels[a.status] ?? a.status}
                </Chip>
                {canManage && a.status === "actif" ? (
                  <button
                    type="button"
                    className="crm-btn crm-btn--ghost crm-btn--sm"
                    disabled={busy}
                    onClick={() =>
                      run(() => setAutomationStatusAction({ automationId: a.id, status: "en_pause" }))
                    }
                  >
                    Mettre en pause
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
