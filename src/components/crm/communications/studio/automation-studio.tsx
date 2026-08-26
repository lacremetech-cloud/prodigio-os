"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { Chip, EmptyState, SectionTitle, StatusBadge } from "@/components/crm/ui";
import { cssVarRef } from "@/modules/crm/status-visuals";
import {
  categoryLabels,
  channelLabels,
  eventLabels,
  COMMUNICATION_EVENTS,
  CHANNELS,
  type Channel,
  type CommunicationEvent,
} from "@/modules/communications";
import {
  CONDITION_DEFINITIONS,
  DRAFT_AUTOMATION_STATUSES,
  SYSTEM_AUTOMATIONS,
  conditionDefinition,
  draftAutomationStatusHints,
  draftAutomationStatusLabels,
  draftAutomationStatusVisual,
  formatDelay,
  isCoveredBySystem,
  validateDraftAutomation,
  type ConditionKey,
  type ConditionValue,
  type DraftAutomationStatus,
} from "@/modules/communications/studio";
import {
  setAutomationStatusAction,
  upsertAutomationAction,
} from "@/modules/communications/actions";
import { safeAction } from "@/modules/crm/safe-action";

/**
 * **Studio des automatisations.**
 *
 * Deux catégories, jamais mélangées :
 *   1. **Système** — les six communications transactionnelles existantes,
 *      projetées en LECTURE SEULE depuis le catalogue d'événements. Aucune ligne
 *      n'est dupliquée en base, et rien n'est modifiable depuis cet écran.
 *   2. **Personnalisées** — des brouillons. Elles ne s'exécutent pas et ne
 *      peuvent pas être activées : ni ici, ni par l'action serveur, ni en base.
 */

export interface CustomAutomationView {
  id: string;
  automationKey: string;
  version: number;
  name: string;
  triggerEvent: string;
  templateKey: string;
  templateVersion: number | null;
  channel: string;
  delayMinutes: number;
  conditions: Record<string, ConditionValue>;
  status: string;
  notes: string | null;
  updatedAt: string;
}

export interface TemplateOption {
  templateKey: string;
  channel: string;
  versions: number[];
}

function useAction() {
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const run = (fn: () => Promise<{ ok: boolean; error?: string; info?: string }>) => {
    if (busy) return;
    setBusy(true);
    startTransition(async () => {
      const res = await safeAction(fn);
      setFeedback({
        ok: res.ok,
        message: res.ok ? (res.info ?? "Action enregistrée.") : (res.error ?? "Action impossible."),
      });
      setBusy(false);
      if (res.ok) router.refresh();
    });
  };

  return { feedback, busy: busy || pending, run };
}

// --- Automatisations système (lecture seule) --------------------------------------
function SystemAutomations() {
  return (
    <section className="min-w-0 rounded-[14px] border border-[var(--crm-line)] bg-[var(--crm-panel)] p-4">
      <SectionTitle eyebrow="En production" title="Automatisations système" />
      <p className="crm-wrap mb-3 text-sm text-[var(--crm-text-dim)]">
        Les communications transactionnelles déjà en place. Elles sont portées par les déclencheurs
        de la base, en <strong>lecture seule</strong> : le studio les affiche, il ne les redéfinit
        pas et n&apos;en crée aucun doublon.
      </p>

      <ul className="flex flex-col gap-2">
        {SYSTEM_AUTOMATIONS.map((a) => (
          <li
            key={a.key}
            className="min-w-0 rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] px-3 py-3"
          >
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="crm-wrap text-sm font-medium text-[var(--crm-text)]">{a.label}</p>
                <p className="crm-wrap text-[12px] text-[var(--crm-text-faint)]">
                  {a.templateKey} · {channelLabels[a.channel]} · {categoryLabels[a.category]}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Chip variant="ok" dot>
                  Système
                </Chip>
                <Chip>Lecture seule</Chip>
                {a.googleCovered ? <Chip variant="gold">Couvert par Google Calendar</Chip> : null}
              </div>
            </div>

            <dl className="mt-2 grid gap-1.5 text-[12px] text-[var(--crm-text-dim)] sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="crm-label">Destinataire</dt>
                <dd className="crm-wrap">{a.recipient}</dd>
              </div>
              <div className="min-w-0">
                <dt className="crm-label">Pourquoi transactionnel</dt>
                <dd className="crm-wrap">{a.rationale}</dd>
              </div>
              <div className="min-w-0">
                <dt className="crm-label">Déclencheur</dt>
                <dd className="crm-wrap">{a.trigger}</dd>
              </div>
              <div className="min-w-0">
                <dt className="crm-label">Idempotence</dt>
                <dd className="crm-wrap">{a.idempotency}</dd>
              </div>
            </dl>

            <details className="mt-2">
              <summary className="cursor-pointer text-[12px] text-[var(--crm-gold)]">
                Cas où aucun message n&apos;est créé
              </summary>
              <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-5 text-[12px] text-[var(--crm-text-dim)]">
                {a.noMessageWhen.map((c) => (
                  <li key={c} className="crm-wrap">
                    {c}
                  </li>
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}

// --- Éditeur de brouillon personnalisé ---------------------------------------------
interface DraftForm {
  automationKey: string;
  name: string;
  triggerEvent: CommunicationEvent;
  channel: Channel;
  templateKey: string;
  templateVersion: number | null;
  delayMinutes: number;
  conditions: Partial<Record<ConditionKey, ConditionValue>>;
  notes: string;
}

const EMPTY_DRAFT: DraftForm = {
  automationKey: "",
  name: "",
  triggerEvent: COMMUNICATION_EVENTS[0],
  channel: "email",
  templateKey: "",
  templateVersion: null,
  delayMinutes: 0,
  conditions: {},
  notes: "",
};

function ConditionEditor({
  conditions,
  onChange,
}: {
  conditions: Partial<Record<ConditionKey, ConditionValue>>;
  onChange: (next: Partial<Record<ConditionKey, ConditionValue>>) => void;
}) {
  return (
    <fieldset className="min-w-0 rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] p-3">
      <legend className="crm-label px-1">Conditions déclaratives</legend>
      <p className="crm-wrap mb-2 text-[11px] text-[var(--crm-text-faint)]">
        Catalogue fermé, valeurs simples, évaluation déterministe. Aucune expression, aucun code.
      </p>
      <ul className="flex flex-col gap-2">
        {CONDITION_DEFINITIONS.map((definition) => {
          const enabled = definition.key in conditions;
          const value = conditions[definition.key];
          const inputId = `condition-${definition.key}`;
          return (
            <li key={definition.key} className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <label className="flex min-w-0 flex-1 items-center gap-2 text-[13px] text-[var(--crm-text)]">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => {
                      const next = { ...conditions };
                      if (e.target.checked) {
                        next[definition.key] =
                          definition.kind === "booleen"
                            ? true
                            : definition.kind === "nombre"
                              ? 24
                              : (definition.options?.[0]?.value ?? "");
                      } else {
                        delete next[definition.key];
                      }
                      onChange(next);
                    }}
                  />
                  <span className="crm-wrap">{definition.label}</span>
                </label>

                {enabled ? (
                  definition.kind === "booleen" ? (
                    <select
                      id={inputId}
                      aria-label={`Valeur attendue — ${definition.label}`}
                      className="crm-select w-auto min-w-[9rem]"
                      value={String(value)}
                      onChange={(e) =>
                        onChange({ ...conditions, [definition.key]: e.target.value === "true" })
                      }
                    >
                      <option value="true">Oui</option>
                      <option value="false">Non</option>
                    </select>
                  ) : definition.kind === "nombre" ? (
                    <input
                      id={inputId}
                      aria-label={`Valeur attendue — ${definition.label}`}
                      type="number"
                      min={0}
                      className="crm-input w-auto min-w-[7rem]"
                      value={Number(value ?? 0)}
                      onChange={(e) =>
                        onChange({
                          ...conditions,
                          [definition.key]: Number.parseInt(e.target.value, 10) || 0,
                        })
                      }
                    />
                  ) : definition.options ? (
                    <select
                      id={inputId}
                      aria-label={`Valeur attendue — ${definition.label}`}
                      className="crm-select w-auto min-w-[12rem]"
                      value={String(value ?? "")}
                      onChange={(e) => onChange({ ...conditions, [definition.key]: e.target.value })}
                    >
                      {definition.options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={inputId}
                      aria-label={`Valeur attendue — ${definition.label}`}
                      className="crm-input w-auto min-w-[12rem]"
                      value={String(value ?? "")}
                      maxLength={120}
                      onChange={(e) => onChange({ ...conditions, [definition.key]: e.target.value })}
                    />
                  )
                ) : null}
              </div>
              <p className="crm-wrap pl-6 text-[11px] text-[var(--crm-text-faint)]">
                {definition.describes}
              </p>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

function DraftEditor({
  templates,
  busy,
  onSubmit,
}: {
  templates: TemplateOption[];
  busy: boolean;
  onSubmit: (draft: DraftForm) => void;
}) {
  const [draft, setDraft] = useState<DraftForm>(EMPTY_DRAFT);

  const issues = useMemo(
    () =>
      validateDraftAutomation({
        ...draft,
        templateVersion: draft.templateVersion,
        status: "brouillon",
      }),
    [draft],
  );

  const availableTemplates = templates.filter((t) => t.channel === draft.channel);
  const selectedTemplate = availableTemplates.find((t) => t.templateKey === draft.templateKey);
  const duplicateWarning = isCoveredBySystem(draft.triggerEvent, draft.channel);

  const update = (patch: Partial<DraftForm>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <form
      className="flex min-w-0 flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (issues.length > 0) return;
        onSubmit(draft);
        setDraft(EMPTY_DRAFT);
      }}
    >
      <p
        className="crm-wrap rounded-[10px] border px-3 py-2 text-[12px] text-[var(--crm-text-dim)]"
        style={{ borderColor: "var(--crm-warning)", background: "var(--crm-panel-2)" }}
      >
        Une automatisation personnalisée reste un <strong>brouillon</strong>. Elle n&apos;est reliée
        à aucun runtime, ne s&apos;exécute jamais et ne peut pas être activée en V1.
      </p>

      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="crm-label">Nom</span>
          <input
            className="crm-input"
            value={draft.name}
            maxLength={160}
            required
            onChange={(e) => update({ name: e.target.value })}
          />
        </label>

        <label className="flex min-w-0 flex-col gap-1">
          <span className="crm-label">Clé technique</span>
          <input
            className="crm-input font-mono text-[13px]"
            value={draft.automationKey}
            placeholder="relance_estimation"
            required
            onChange={(e) => update({ automationKey: e.target.value.trim().toLowerCase() })}
          />
        </label>

        <label className="flex min-w-0 flex-col gap-1">
          <span className="crm-label">Événement déclencheur</span>
          <select
            className="crm-select"
            value={draft.triggerEvent}
            onChange={(e) => update({ triggerEvent: e.target.value as CommunicationEvent })}
          >
            {COMMUNICATION_EVENTS.map((event) => (
              <option key={event} value={event}>
                {eventLabels[event]}
              </option>
            ))}
          </select>
          <span className="crm-wrap text-[11px] text-[var(--crm-text-faint)]">
            Uniquement des événements du catalogue métier existant : aucun nouvel événement
            n&apos;est inventé.
          </span>
        </label>

        <label className="flex min-w-0 flex-col gap-1">
          <span className="crm-label">Canal</span>
          <select
            className="crm-select"
            value={draft.channel}
            onChange={(e) =>
              update({ channel: e.target.value as Channel, templateKey: "", templateVersion: null })
            }
          >
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {channelLabels[c]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-0 flex-col gap-1">
          <span className="crm-label">Modèle</span>
          <select
            className="crm-select"
            value={draft.templateKey}
            required
            onChange={(e) => update({ templateKey: e.target.value, templateVersion: null })}
          >
            <option value="">— Choisir un modèle —</option>
            {availableTemplates.map((t) => (
              <option key={t.templateKey} value={t.templateKey}>
                {t.templateKey}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-0 flex-col gap-1">
          <span className="crm-label">Version du modèle</span>
          <select
            className="crm-select"
            value={draft.templateVersion == null ? "" : String(draft.templateVersion)}
            onChange={(e) =>
              update({
                templateVersion: e.target.value === "" ? null : Number.parseInt(e.target.value, 10),
              })
            }
          >
            <option value="">Version active à l&apos;exécution</option>
            {(selectedTemplate?.versions ?? []).map((v) => (
              <option key={v} value={v}>
                v{v}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-0 flex-col gap-1">
          <span className="crm-label">Délai (minutes)</span>
          <input
            type="number"
            min={0}
            max={525600}
            className="crm-input"
            value={draft.delayMinutes}
            onChange={(e) =>
              update({ delayMinutes: Number.parseInt(e.target.value, 10) || 0 })
            }
          />
          <span className="text-[11px] text-[var(--crm-text-faint)]">
            {formatDelay(draft.delayMinutes)}
          </span>
        </label>

        <label className="flex min-w-0 flex-col gap-1">
          <span className="crm-label">Notes internes</span>
          <input
            className="crm-input"
            value={draft.notes}
            maxLength={2000}
            onChange={(e) => update({ notes: e.target.value })}
          />
        </label>
      </div>

      <ConditionEditor
        conditions={draft.conditions}
        onChange={(conditions) => update({ conditions })}
      />

      {duplicateWarning ? (
        <p
          role="status"
          className="crm-wrap rounded-[10px] border px-3 py-2 text-[12px] text-[var(--crm-text-dim)]"
          style={{ borderColor: "var(--crm-warning)", background: "var(--crm-panel-2)" }}
        >
          Cet événement est <strong>déjà couvert</strong> par une automatisation système sur ce
          canal. Un brouillon reste possible pour préparer une évolution, mais il ne doit pas
          reproduire un envoi déjà assuré.
        </p>
      ) : null}

      {issues.length > 0 ? (
        <ul
          className="flex flex-col gap-1 rounded-[10px] border px-3 py-2 text-[12px]"
          style={{ borderColor: "var(--crm-danger)", background: "var(--crm-panel-2)" }}
        >
          {issues.map((issue) => (
            <li key={issue.field} className="crm-wrap text-[var(--crm-text-dim)]">
              {issue.message}
            </li>
          ))}
        </ul>
      ) : null}

      <div>
        <button
          type="submit"
          className="crm-btn crm-btn--gold"
          disabled={busy || issues.length > 0}
        >
          Enregistrer le brouillon
        </button>
      </div>
    </form>
  );
}

// --- Écran principal ----------------------------------------------------------------
export function AutomationStudio({
  automations,
  templates,
}: {
  automations: CustomAutomationView[];
  templates: TemplateOption[];
}) {
  const { feedback, busy, run } = useAction();

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <SystemAutomations />

      <section className="min-w-0 rounded-[14px] border border-[var(--crm-line)] bg-[var(--crm-panel)] p-4">
        <SectionTitle eyebrow="Brouillons" title="Automatisations personnalisées" />
        <p className="crm-wrap mb-3 text-sm text-[var(--crm-text-dim)]">
          Chaque enregistrement crée une <strong>nouvelle version</strong> sans écraser la
          précédente. Statuts possibles : brouillon, prêt pour revue, suspendu, archivé —{" "}
          <strong>jamais « actif »</strong>.
        </p>

        <p aria-live="polite" className="sr-only">
          {feedback?.message ?? ""}
        </p>
        {feedback ? (
          <p
            className="crm-wrap mb-3 rounded-[10px] border px-3 py-2 text-sm text-[var(--crm-text-dim)]"
            style={{
              borderColor: feedback.ok ? "var(--crm-success)" : "var(--crm-danger)",
              background: "var(--crm-panel-2)",
            }}
          >
            {feedback.message}
          </p>
        ) : null}

        {automations.length === 0 ? (
          <EmptyState
            title="Aucun brouillon"
            hint="Créez un premier workflow ci-dessous. Il restera un brouillon."
            icon="⚙"
          />
        ) : (
          <ul className="mb-4 flex flex-col gap-2">
            {automations.map((a) => {
              const status = a.status as DraftAutomationStatus;
              const visual = draftAutomationStatusVisual(status);
              const conditionEntries = Object.entries(a.conditions ?? {});
              return (
                <li
                  key={a.id}
                  className="min-w-0 rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] px-3 py-3"
                  style={
                    { ["--chip-accent" as keyof CSSProperties]: cssVarRef(visual.cssVar) } as CSSProperties
                  }
                >
                  <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="crm-wrap text-sm font-medium text-[var(--crm-text)]">
                        {a.name}{" "}
                        <span className="text-[var(--crm-text-faint)]">v{a.version}</span>
                      </p>
                      <p className="crm-wrap text-[12px] text-[var(--crm-text-faint)]">
                        {eventLabels[a.triggerEvent as CommunicationEvent] ?? a.triggerEvent} →{" "}
                        {a.templateKey}
                        {a.templateVersion ? ` v${a.templateVersion}` : " (version active)"} ·{" "}
                        {channelLabels[a.channel as Channel]} · {formatDelay(a.delayMinutes)}
                      </p>
                    </div>
                    <StatusBadge
                      cssVar={visual.cssVar}
                      icon={visual.icon}
                      label={draftAutomationStatusLabels[status] ?? a.status}
                    />
                  </div>

                  <p className="crm-wrap mt-1 text-[11px] text-[var(--crm-text-faint)]">
                    {draftAutomationStatusHints[status] ??
                      "Ce brouillon ne produit aucun message."}
                  </p>

                  {conditionEntries.length > 0 ? (
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {conditionEntries.map(([key, value]) => (
                        <li key={key}>
                          <Chip>
                            {(conditionDefinition(key)?.label ?? key) + " = " + String(value)}
                          </Chip>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-[11px] text-[var(--crm-text-faint)]">
                      Aucune condition déclarée.
                    </p>
                  )}

                  <div className="mt-2 flex flex-wrap gap-2">
                    {DRAFT_AUTOMATION_STATUSES.filter((s) => s !== a.status).map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="crm-btn crm-btn--ghost crm-btn--sm"
                        disabled={busy}
                        onClick={() =>
                          run(() => setAutomationStatusAction({ automationId: a.id, status: s }))
                        }
                      >
                        {draftAutomationStatusLabels[s]}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="border-t border-[var(--crm-line-soft)] pt-4">
          <h3 className="mb-3 text-sm font-semibold text-[var(--crm-text)]">
            Nouveau brouillon de workflow
          </h3>
          <DraftEditor
            templates={templates}
            busy={busy}
            onSubmit={(draft) =>
              run(() =>
                upsertAutomationAction({
                  automationKey: draft.automationKey,
                  name: draft.name,
                  triggerEvent: draft.triggerEvent,
                  templateKey: draft.templateKey,
                  templateVersion: draft.templateVersion,
                  channel: draft.channel,
                  delayMinutes: draft.delayMinutes,
                  conditions: draft.conditions,
                  notes: draft.notes || null,
                }),
              )
            }
          />
        </div>
      </section>
    </div>
  );
}
