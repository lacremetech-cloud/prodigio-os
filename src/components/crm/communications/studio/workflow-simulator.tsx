"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Chip, SectionTitle } from "@/components/crm/ui";
import { cssVarRef } from "@/modules/crm/status-visuals";
import {
  CATEGORIES,
  CHANNELS,
  COMMUNICATION_EVENTS,
  categoryLabels,
  channelLabels,
  eventLabels,
  type Category,
  type Channel,
  type CommunicationEvent,
} from "@/modules/communications";
import {
  CONDITION_DEFINITIONS,
  DEFAULT_SYNTHETIC_RECIPIENT,
  SYNTHETIC_MARKER,
  SYNTHETIC_RECIPIENTS,
  formatDelay,
  simulateWorkflow,
  systemAutomationFor,
  type ConditionKey,
  type ConditionValue,
  type SimulationStep,
  type SimulationTemplate,
} from "@/modules/communications/studio";

/**
 * **Simulateur de workflow.**
 *
 * Entièrement exécuté dans le navigateur, sur une fonction **pure** : il ne
 * déclenche aucune action serveur, n'écrit rien, ne contacte aucun fournisseur
 * et n'utilise que des destinataires fictifs. Il n'existe volontairement aucun
 * bouton « exécuter réellement ».
 */

export interface SimulatorTemplate {
  templateKey: string;
  version: number;
  status: "brouillon" | "actif" | "archive";
  channel: string;
  category: string;
  subject: string | null;
  body: string;
  bodyFormat: "markdown" | "html" | "texte";
  allowedVariables: string[];
}

const OUTCOME_VISUAL: Record<SimulationStep["outcome"], { cssVar: string; icon: string; label: string }> = {
  ok: { cssVar: "--crm-st-signe", icon: "✓", label: "Vérifié" },
  bloquant: { cssVar: "--crm-st-perdu", icon: "⦸", label: "Bloquant" },
  information: { cssVar: "--crm-st-nouveau", icon: "ℹ", label: "Information" },
};

function StepCard({ step, index }: { step: SimulationStep; index: number }) {
  const visual = OUTCOME_VISUAL[step.outcome];
  return (
    <li
      className="crm-panel crm-kpi crm-fade-in min-w-0 rounded-[10px] p-3"
      style={{ ["--kpi-accent" as keyof CSSProperties]: cssVarRef(visual.cssVar) } as CSSProperties}
    >
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
        <p className="crm-wrap text-sm font-medium text-[var(--crm-text)]">
          <span className="text-[var(--crm-text-faint)]">{index + 1}.</span> {step.label}
        </p>
        <span
          className="crm-chip crm-chip--accent"
          style={{ ["--chip-accent" as keyof CSSProperties]: cssVarRef(visual.cssVar) } as CSSProperties}
        >
          <span aria-hidden>{visual.icon}</span>
          {visual.label}
        </span>
      </div>
      <p className="crm-wrap mt-1 text-[13px] text-[var(--crm-text-dim)]">{step.detail}</p>
      {step.items && step.items.length > 0 ? (
        <ul className="mt-1.5 flex list-disc flex-col gap-0.5 pl-5 text-[12px] text-[var(--crm-text-faint)]">
          {step.items.map((item, i) => (
            <li key={`${step.key}-${i}`} className="crm-wrap">
              {item}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function WorkflowSimulator({
  templates,
  dispatchEnabled,
}: {
  templates: SimulatorTemplate[];
  dispatchEnabled: boolean;
}) {
  const [recipientId, setRecipientId] = useState(DEFAULT_SYNTHETIC_RECIPIENT.id);
  const [event, setEvent] = useState<CommunicationEvent>(COMMUNICATION_EVENTS[0]);
  const [channel, setChannel] = useState<Channel>("email");
  const [category, setCategory] = useState<Category>("transactionnel");
  const [delayMinutes, setDelayMinutes] = useState(0);
  const [templateId, setTemplateId] = useState(() => {
    const first = templates[0];
    return first ? `${first.templateKey}:${first.version}` : "";
  });
  const [googleCovers, setGoogleCovers] = useState(false);
  const [conditions, setConditions] = useState<Partial<Record<ConditionKey, ConditionValue>>>({});

  const recipient =
    SYNTHETIC_RECIPIENTS.find((r) => r.id === recipientId) ?? DEFAULT_SYNTHETIC_RECIPIENT;

  const selected = templates.find((t) => `${t.templateKey}:${t.version}` === templateId) ?? null;

  const template: SimulationTemplate | null = useMemo(
    () =>
      selected
        ? {
            templateKey: selected.templateKey,
            version: selected.version,
            status: selected.status,
            channel: selected.channel as Channel,
            category: selected.category as Category,
            subject: selected.subject,
            body: selected.body,
            bodyFormat: selected.bodyFormat,
            allowedVariables: selected.allowedVariables,
          }
        : null,
    [selected],
  );

  const result = useMemo(
    () =>
      simulateWorkflow({
        recipientId: recipient.id,
        event,
        channel,
        category,
        delayMinutes,
        conditions,
        template,
        dispatchEnabled,
        googleCovers,
      }),
    [recipient, event, channel, category, delayMinutes, conditions, template, dispatchEnabled, googleCovers],
  );

  const system = systemAutomationFor(event);

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <section className="min-w-0 rounded-[14px] border border-[var(--crm-line)] bg-[var(--crm-panel)] p-4">
        <SectionTitle eyebrow="Entrées fictives" title="Paramètres de simulation" />
        <p
          className="crm-wrap mb-3 rounded-[10px] border px-3 py-2 text-[12px] text-[var(--crm-text-dim)]"
          style={{ borderColor: "var(--crm-warning)", background: "var(--crm-panel-2)" }}
        >
          Simulation <strong>{SYNTHETIC_MARKER}</strong> : rien n&apos;est écrit dans la file, aucun
          fournisseur n&apos;est contacté, aucune donnée réelle n&apos;est lue. Il n&apos;existe
          aucun bouton d&apos;exécution réelle.
        </p>

        <div className="flex min-w-0 flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="crm-label">Destinataire fictif</span>
            <select
              className="crm-select"
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
            >
              {SYNTHETIC_RECIPIENTS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
            <span className="crm-wrap text-[11px] text-[var(--crm-text-faint)]">
              {recipient.purpose}
            </span>
          </label>

          <label className="flex flex-col gap-1">
            <span className="crm-label">Événement reçu</span>
            <select
              className="crm-select"
              value={event}
              onChange={(e) => setEvent(e.target.value as CommunicationEvent)}
            >
              {COMMUNICATION_EVENTS.map((v) => (
                <option key={v} value={v}>
                  {eventLabels[v]}
                </option>
              ))}
            </select>
            {system ? (
              <span className="crm-wrap text-[11px] text-[var(--crm-text-faint)]">
                Couvert par l&apos;automatisation système « {system.label} ».
              </span>
            ) : null}
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex min-w-0 flex-col gap-1">
              <span className="crm-label">Canal</span>
              <select
                className="crm-select"
                value={channel}
                onChange={(e) => setChannel(e.target.value as Channel)}
              >
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {channelLabels[c]}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex min-w-0 flex-col gap-1">
              <span className="crm-label">Catégorie</span>
              <select
                className="crm-select"
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {categoryLabels[c]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="crm-label">Modèle et version</span>
            <select
              className="crm-select"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              <option value="">Aucun modèle</option>
              {templates.map((t) => (
                <option key={`${t.templateKey}:${t.version}`} value={`${t.templateKey}:${t.version}`}>
                  {t.templateKey} v{t.version} — {t.status}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="crm-label">Délai (minutes)</span>
            <input
              type="number"
              min={0}
              max={525600}
              className="crm-input"
              value={delayMinutes}
              onChange={(e) => setDelayMinutes(Number.parseInt(e.target.value, 10) || 0)}
            />
            <span className="text-[11px] text-[var(--crm-text-faint)]">
              {formatDelay(delayMinutes)}
            </span>
          </label>

          <label className="flex items-center gap-2 text-[13px] text-[var(--crm-text)]">
            <input
              type="checkbox"
              checked={googleCovers}
              onChange={(e) => setGoogleCovers(e.target.checked)}
            />
            <span className="crm-wrap">Google Calendar couvre déjà cet envoi</span>
          </label>

          <fieldset className="min-w-0 rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] p-3">
            <legend className="crm-label px-1">Conditions à évaluer</legend>
            <ul className="flex flex-col gap-2">
              {CONDITION_DEFINITIONS.map((definition) => {
                const enabled = definition.key in conditions;
                const value = conditions[definition.key];
                return (
                  <li key={definition.key} className="flex min-w-0 flex-wrap items-center gap-2">
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
                          setConditions(next);
                        }}
                      />
                      <span className="crm-wrap">{definition.label}</span>
                    </label>
                    {enabled ? (
                      definition.kind === "booleen" ? (
                        <select
                          aria-label={`Valeur attendue — ${definition.label}`}
                          className="crm-select w-auto min-w-[7rem]"
                          value={String(value)}
                          onChange={(e) =>
                            setConditions({
                              ...conditions,
                              [definition.key]: e.target.value === "true",
                            })
                          }
                        >
                          <option value="true">Oui</option>
                          <option value="false">Non</option>
                        </select>
                      ) : definition.kind === "nombre" ? (
                        <input
                          aria-label={`Valeur attendue — ${definition.label}`}
                          type="number"
                          min={0}
                          className="crm-input w-auto min-w-[6rem]"
                          value={Number(value ?? 0)}
                          onChange={(e) =>
                            setConditions({
                              ...conditions,
                              [definition.key]: Number.parseInt(e.target.value, 10) || 0,
                            })
                          }
                        />
                      ) : definition.options ? (
                        <select
                          aria-label={`Valeur attendue — ${definition.label}`}
                          className="crm-select w-auto min-w-[11rem]"
                          value={String(value ?? "")}
                          onChange={(e) =>
                            setConditions({ ...conditions, [definition.key]: e.target.value })
                          }
                        >
                          {definition.options.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          aria-label={`Valeur attendue — ${definition.label}`}
                          className="crm-input w-auto min-w-[11rem]"
                          value={String(value ?? "")}
                          maxLength={120}
                          onChange={(e) =>
                            setConditions({ ...conditions, [definition.key]: e.target.value })
                          }
                        />
                      )
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </fieldset>
        </div>
      </section>

      <section className="min-w-0 rounded-[14px] border border-[var(--crm-line)] bg-[var(--crm-panel)] p-4">
        <SectionTitle eyebrow="Résultat" title="Déroulé de la décision" />

        <div
          role="status"
          className="crm-wrap mb-3 rounded-[10px] border px-3 py-2.5 text-sm"
          style={{
            borderColor:
              result.decision === "prepare" ? "var(--crm-success)" : "var(--crm-danger)",
            background: "var(--crm-panel-2)",
          }}
        >
          <p className="font-medium text-[var(--crm-text)]">
            {result.decision === "prepare"
              ? "Décision : message PRÉPARÉ (simulation)"
              : result.decision === "bloque"
                ? "Décision : message BLOQUÉ"
                : "Simulation refusée"}
          </p>
          <p className="crm-wrap mt-0.5 text-[var(--crm-text-dim)]">
            {result.reason ??
              "Aucun blocage constaté. Rien n'a été écrit et aucun fournisseur n'a été contacté."}
          </p>
        </div>

        <ol className="flex min-w-0 flex-col gap-2">
          {result.steps.map((step, index) => (
            <StepCard key={step.key} step={step} index={index} />
          ))}
        </ol>

        {result.renderedBody ? (
          <div className="mt-4 min-w-0">
            <h3 className="mb-2 text-sm font-semibold text-[var(--crm-text)]">
              Rendu obtenu (valeurs fictives)
            </h3>
            <div className="min-w-0 rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] p-3">
              {result.renderedSubject ? (
                <p className="crm-wrap mb-2 border-b border-[var(--crm-line-soft)] pb-2 text-sm font-semibold text-[var(--crm-text)]">
                  {result.renderedSubject}
                </p>
              ) : null}
              <pre className="crm-wrap whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-[var(--crm-text-dim)]">
                {result.renderedBody}
              </pre>
            </div>
          </div>
        ) : null}

        <p className="mt-3 flex flex-wrap gap-1.5">
          <Chip>Aucune écriture</Chip>
          <Chip>Aucun appel fournisseur</Chip>
          <Chip>Aucune donnée réelle</Chip>
          <Chip>Aucun événement d&apos;audit</Chip>
        </p>
      </section>
    </div>
  );
}
