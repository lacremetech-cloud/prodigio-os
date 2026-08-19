"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Chip, EmptyState, SectionTitle } from "@/components/crm/ui";
import {
  categoryLabels,
  channelLabels,
  templateStatusLabels,
  type Category,
  type Channel,
} from "@/modules/communications";
import {
  PREVIEW_WIDTHS,
  previewTemplate,
  previewViewportLabels,
  compareTemplates,
  DEFAULT_SYNTHETIC_RECIPIENT,
  SYNTHETIC_RECIPIENTS,
  SYNTHETIC_MARKER,
  type PreviewViewport,
} from "@/modules/communications/studio";
import {
  setTemplateStatusAction,
  upsertTemplateAction,
} from "@/modules/communications/actions";

/**
 * **Studio des modèles.**
 *
 * Principes :
 *   • une modification ne remplace jamais une version : elle en crée une
 *     nouvelle, en brouillon (garanti côté base) ;
 *   • la prévisualisation utilise **exclusivement** un destinataire fictif —
 *     aucun contact réel n'est jamais chargé dans cet écran ;
 *   • une variable manquante ou non déclarée produit une erreur explicite, et
 *     jamais un rendu partiel.
 */

export interface TemplateVersionView {
  id: string;
  templateKey: string;
  version: number;
  name: string;
  channel: string;
  category: string;
  status: string;
  subject: string | null;
  body: string;
  bodyFormat: "markdown" | "html" | "texte";
  previewText: string | null;
  allowedVariables: string[];
  notes: string | null;
  updatedAt: string;
}

export interface TemplateFamilyView {
  templateKey: string;
  channel: string;
  category: string;
  activeVersion: number | null;
  versions: TemplateVersionView[];
}

const BODY_FORMAT_LABELS: Record<TemplateVersionView["bodyFormat"], string> = {
  markdown: "Texte enrichi (markdown)",
  texte: "Texte brut",
  html: "HTML",
};

function useAction() {
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const run = (fn: () => Promise<{ ok: boolean; error?: string; info?: string }>) => {
    if (busy) return;
    setBusy(true);
    startTransition(async () => {
      const res = await fn();
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

function Feedback({ feedback }: { feedback: { ok: boolean; message: string } | null }) {
  return (
    <>
      <p aria-live="polite" className="sr-only">
        {feedback?.message ?? ""}
      </p>
      {feedback ? (
        <p
          className="crm-wrap rounded-[10px] border px-3 py-2 text-sm text-[var(--crm-text-dim)]"
          style={{
            borderColor: feedback.ok ? "var(--crm-success)" : "var(--crm-danger)",
            background: "var(--crm-panel-2)",
          }}
        >
          {feedback.message}
        </p>
      ) : null}
    </>
  );
}

// --- Prévisualisation ----------------------------------------------------------
function PreviewPane({ draft }: { draft: TemplateVersionView }) {
  const [viewport, setViewport] = useState<PreviewViewport>("desktop");
  const [recipientId, setRecipientId] = useState(DEFAULT_SYNTHETIC_RECIPIENT.id);

  const recipient =
    SYNTHETIC_RECIPIENTS.find((r) => r.id === recipientId) ?? DEFAULT_SYNTHETIC_RECIPIENT;

  const result = useMemo(
    () =>
      previewTemplate(
        {
          subject: draft.subject,
          body: draft.body,
          bodyFormat: draft.bodyFormat,
          allowedVariables: draft.allowedVariables,
        },
        recipient.variables,
      ),
    [draft, recipient],
  );

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="crm-tabs" role="tablist" aria-label="Format de prévisualisation">
          {(["desktop", "mobile"] as PreviewViewport[]).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={viewport === v}
              className={`crm-tab ${viewport === v ? "crm-tab--active" : ""}`}
              onClick={() => setViewport(v)}
            >
              {previewViewportLabels[v]}
            </button>
          ))}
        </div>
        <label className="flex min-w-0 flex-1 items-center gap-2 text-[12px] text-[var(--crm-text-dim)]">
          <span className="shrink-0">Destinataire fictif</span>
          <select
            className="crm-select min-w-0 flex-1"
            value={recipientId}
            onChange={(e) => setRecipientId(e.target.value)}
          >
            {SYNTHETIC_RECIPIENTS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="crm-wrap text-[12px] text-[var(--crm-text-faint)]">
        Prévisualisation sur données <strong>{SYNTHETIC_MARKER}</strong> uniquement. Aucun contact
        réel n&apos;est chargé dans cet écran.
      </p>

      {/* Contrôle des variables : les trois écarts sont distingués. */}
      <div className="flex flex-wrap gap-1.5">
        {result.check.used.length === 0 ? (
          <Chip>Aucune variable utilisée</Chip>
        ) : (
          result.check.used.map((v) => (
            <Chip
              key={v}
              variant={
                result.check.undeclared.includes(v)
                  ? "danger"
                  : result.check.missing.includes(v)
                    ? "gold"
                    : "ok"
              }
            >
              {`{{${v}}}`}
            </Chip>
          ))
        )}
        {result.check.unused.map((v) => (
          <Chip key={`unused-${v}`}>{`{{${v}}} · déclarée, non utilisée`}</Chip>
        ))}
      </div>

      {!result.ok ? (
        <p
          role="alert"
          className="crm-wrap rounded-[10px] border px-3 py-2.5 text-sm text-[var(--crm-text)]"
          style={{ borderColor: "var(--crm-danger)", background: "var(--crm-panel-2)" }}
        >
          {result.error}
        </p>
      ) : (
        <div className="crm-scroll overflow-x-auto">
          <div
            className="mx-auto min-w-0 rounded-[10px] border border-[var(--crm-line)] bg-[var(--crm-panel-2)] p-4"
            style={{ maxWidth: PREVIEW_WIDTHS[viewport], width: "100%" }}
          >
            {result.subject ? (
              <p className="crm-wrap mb-2 border-b border-[var(--crm-line-soft)] pb-2 text-sm font-semibold text-[var(--crm-text)]">
                {result.subject}
              </p>
            ) : null}
            <pre className="crm-wrap whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-[var(--crm-text-dim)]">
              {result.body}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Comparaison de versions ----------------------------------------------------
function ComparePane({ versions }: { versions: TemplateVersionView[] }) {
  const [leftId, setLeftId] = useState(versions[Math.min(1, versions.length - 1)]?.id ?? "");
  const [rightId, setRightId] = useState(versions[0]?.id ?? "");

  const left = versions.find((v) => v.id === leftId);
  const right = versions.find((v) => v.id === rightId);

  const diffs = useMemo(
    () =>
      left && right
        ? compareTemplates(
            {
              version: left.version,
              name: left.name,
              subject: left.subject,
              body: left.body,
              allowedVariables: left.allowedVariables,
            },
            {
              version: right.version,
              name: right.name,
              subject: right.subject,
              body: right.body,
              allowedVariables: right.allowedVariables,
            },
          )
        : [],
    [left, right],
  );

  if (versions.length < 2) {
    return (
      <p className="text-sm text-[var(--crm-text-faint)]">
        Une seule version existe : la comparaison sera possible dès la deuxième.
      </p>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="crm-label">Version de référence</span>
          <select className="crm-select" value={leftId} onChange={(e) => setLeftId(e.target.value)}>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                v{v.version} — {templateStatusLabels[v.status] ?? v.status}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="crm-label">Version comparée</span>
          <select className="crm-select" value={rightId} onChange={(e) => setRightId(e.target.value)}>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                v{v.version} — {templateStatusLabels[v.status] ?? v.status}
              </option>
            ))}
          </select>
        </label>
      </div>

      {diffs.map((field) => (
        <div key={field.field} className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-medium text-[var(--crm-text)]">{field.label}</h4>
            <Chip variant={field.changed ? "gold" : "neutral"}>
              {field.changed ? "Modifié" : "Identique"}
            </Chip>
          </div>
          {field.changed ? (
            <div className="crm-scroll overflow-x-auto rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)]">
              <ul className="min-w-[320px] font-mono text-[12px]">
                {field.lines.map((line, index) => (
                  <li
                    key={`${field.field}-${index}`}
                    className="crm-wrap flex gap-2 px-3 py-0.5"
                    style={{
                      color:
                        line.kind === "ajout"
                          ? "var(--crm-success)"
                          : line.kind === "suppression"
                            ? "var(--crm-danger)"
                            : "var(--crm-text-dim)",
                    }}
                  >
                    <span aria-hidden className="w-3 shrink-0">
                      {line.kind === "ajout" ? "+" : line.kind === "suppression" ? "−" : " "}
                    </span>
                    <span className="crm-wrap">{line.text || " "}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

// --- Éditeur de nouvelle version --------------------------------------------------
function VersionEditor({
  base,
  onDraftChange,
  busy,
  onSubmit,
}: {
  base: TemplateVersionView;
  onDraftChange: (draft: TemplateVersionView) => void;
  busy: boolean;
  onSubmit: (draft: TemplateVersionView) => void;
}) {
  const update = (patch: Partial<TemplateVersionView>) => onDraftChange({ ...base, ...patch });

  return (
    <form
      className="flex min-w-0 flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(base);
      }}
    >
      <p className="crm-wrap rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] px-3 py-2 text-[12px] text-[var(--crm-text-dim)]">
        Enregistrer crée une <strong>nouvelle version en brouillon</strong>. La version{" "}
        v{base.version} n&apos;est jamais écrasée.
      </p>

      <label className="flex flex-col gap-1">
        <span className="crm-label">Nom de la version</span>
        <input
          className="crm-input"
          value={base.name}
          maxLength={160}
          required
          onChange={(e) => update({ name: e.target.value })}
        />
      </label>

      {base.channel === "email" ? (
        <label className="flex flex-col gap-1">
          <span className="crm-label">Sujet</span>
          <input
            className="crm-input"
            value={base.subject ?? ""}
            maxLength={200}
            required
            onChange={(e) => update({ subject: e.target.value })}
          />
        </label>
      ) : null}

      <label className="flex flex-col gap-1">
        <span className="crm-label">Format du contenu</span>
        <select
          className="crm-select"
          value={base.bodyFormat}
          onChange={(e) =>
            update({ bodyFormat: e.target.value as TemplateVersionView["bodyFormat"] })
          }
        >
          {(Object.keys(BODY_FORMAT_LABELS) as TemplateVersionView["bodyFormat"][]).map((f) => (
            <option key={f} value={f}>
              {BODY_FORMAT_LABELS[f]}
            </option>
          ))}
        </select>
        <span className="crm-wrap text-[11px] text-[var(--crm-text-faint)]">
          Une version porte un seul contenu, dans un seul format. Pour disposer d&apos;une variante
          HTML et d&apos;une variante texte, créez deux versions distinctes.
        </span>
      </label>

      <label className="flex flex-col gap-1">
        <span className="crm-label">Contenu</span>
        <textarea
          className="crm-textarea min-h-[220px] font-mono text-[13px]"
          value={base.body}
          maxLength={20_000}
          required
          onChange={(e) => update({ body: e.target.value })}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="crm-label">Variables déclarées (séparées par des espaces)</span>
        <input
          className="crm-input font-mono text-[13px]"
          value={base.allowedVariables.join(" ")}
          onChange={(e) =>
            update({
              allowedVariables: e.target.value
                .split(/[\s,]+/)
                .map((v) => v.trim().toLowerCase())
                .filter(Boolean),
            })
          }
        />
        <span className="crm-wrap text-[11px] text-[var(--crm-text-faint)]">
          Toute variable employée dans le contenu doit être déclarée ici, sans quoi le rendu est
          refusé.
        </span>
      </label>

      <label className="flex flex-col gap-1">
        <span className="crm-label">Notes internes</span>
        <textarea
          className="crm-textarea"
          value={base.notes ?? ""}
          maxLength={2000}
          onChange={(e) => update({ notes: e.target.value })}
        />
      </label>

      <div>
        <button type="submit" className="crm-btn crm-btn--gold" disabled={busy}>
          Enregistrer une nouvelle version (brouillon)
        </button>
      </div>
    </form>
  );
}

// --- Écran principal ---------------------------------------------------------------
type Pane = "apercu" | "editer" | "comparer";

export function TemplateStudio({ families }: { families: TemplateFamilyView[] }) {
  const { feedback, busy, run } = useAction();
  const [selectedKey, setSelectedKey] = useState(families[0]?.templateKey ?? "");
  const [pane, setPane] = useState<Pane>("apercu");
  const [draft, setDraft] = useState<TemplateVersionView | null>(null);

  const family = families.find((f) => f.templateKey === selectedKey) ?? families[0] ?? null;
  const latest = family?.versions[0] ?? null;
  const current = draft && draft.templateKey === family?.templateKey ? draft : latest;

  if (families.length === 0) {
    return (
      <EmptyState
        title="Aucun modèle"
        hint="Aucun modèle n'est encore enregistré pour cette organisation."
        icon="✎"
      />
    );
  }

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
      <section className="min-w-0 rounded-[14px] border border-[var(--crm-line)] bg-[var(--crm-panel)] p-4">
        <SectionTitle eyebrow="Contenus" title="Modèles" />
        <ul className="flex flex-col gap-2">
          {families.map((f) => {
            const selected = f.templateKey === family?.templateKey;
            return (
              <li key={f.templateKey}>
                <button
                  type="button"
                  aria-current={selected ? "true" : undefined}
                  onClick={() => {
                    setSelectedKey(f.templateKey);
                    setDraft(null);
                    setPane("apercu");
                  }}
                  className={`w-full min-w-0 rounded-[10px] border px-3 py-2.5 text-left transition-colors ${
                    selected
                      ? "border-[var(--crm-gold)] bg-[var(--crm-elevated)]"
                      : "border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] hover:bg-[var(--crm-elevated)]"
                  }`}
                >
                  <span className="crm-ellipsis block text-sm text-[var(--crm-text)]">
                    {f.versions[0]?.name ?? f.templateKey}
                  </span>
                  <span className="crm-wrap block text-[11px] text-[var(--crm-text-faint)]">
                    {f.templateKey} · {channelLabels[f.channel as Channel]} ·{" "}
                    {f.versions.length} version(s)
                    {f.activeVersion ? ` · active v${f.activeVersion}` : " · aucune active"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="min-w-0 rounded-[14px] border border-[var(--crm-line)] bg-[var(--crm-panel)] p-4">
        {family && current ? (
          <>
            <div className="mb-3 flex min-w-0 flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="crm-eyebrow">{family.templateKey}</p>
                <h2 className="crm-wrap mt-1 text-lg font-semibold text-[var(--crm-text)]">
                  {current.name}
                </h2>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Chip>{channelLabels[family.channel as Channel]}</Chip>
                  <Chip variant={family.category === "marketing" ? "gold" : "neutral"}>
                    {categoryLabels[family.category as Category]}
                  </Chip>
                  <Chip variant={current.status === "actif" ? "ok" : "neutral"}>
                    v{current.version} · {templateStatusLabels[current.status] ?? current.status}
                  </Chip>
                </div>
              </div>
            </div>

            <div className="crm-tabs mb-3 flex-wrap" role="tablist" aria-label="Vue du modèle">
              {(
                [
                  ["apercu", "Aperçu"],
                  ["editer", "Nouvelle version"],
                  ["comparer", "Comparer"],
                ] as [Pane, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={pane === value}
                  className={`crm-tab ${pane === value ? "crm-tab--active" : ""}`}
                  onClick={() => {
                    setPane(value);
                    if (value === "editer" && !draft && latest) setDraft({ ...latest });
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <Feedback feedback={feedback} />

            <div className="mt-3 min-w-0">
              {pane === "apercu" ? <PreviewPane draft={current} /> : null}
              {pane === "editer" && draft ? (
                <VersionEditor
                  base={draft}
                  busy={busy}
                  onDraftChange={setDraft}
                  onSubmit={(d) =>
                    run(() =>
                      upsertTemplateAction({
                        templateKey: d.templateKey,
                        channel: d.channel,
                        category: d.category,
                        name: d.name,
                        subject: d.subject,
                        body: d.body,
                        bodyFormat: d.bodyFormat,
                        previewText: d.previewText,
                        allowedVariables: d.allowedVariables,
                        notes: d.notes,
                      }),
                    )
                  }
                />
              ) : null}
              {pane === "comparer" ? <ComparePane versions={family.versions} /> : null}
            </div>

            <div className="crm-scroll mt-4 overflow-x-auto border-t border-[var(--crm-line-soft)] pt-3">
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <caption className="crm-label mb-2 text-left">
                  Versions de {family.templateKey}
                </caption>
                <thead>
                  <tr className="border-b border-[var(--crm-line)] text-left">
                    <th scope="col" className="px-2 py-2 font-medium text-[var(--crm-text-dim)]">
                      Version
                    </th>
                    <th scope="col" className="px-2 py-2 font-medium text-[var(--crm-text-dim)]">
                      Statut
                    </th>
                    <th scope="col" className="px-2 py-2 font-medium text-[var(--crm-text-dim)]">
                      Mise à jour
                    </th>
                    <th scope="col" className="px-2 py-2">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {family.versions.map((v) => (
                    <tr key={v.id} className="border-b border-[var(--crm-line-soft)] last:border-0">
                      <td className="px-2 py-2.5 text-[var(--crm-text)]">v{v.version}</td>
                      <td className="px-2 py-2.5">
                        <Chip variant={v.status === "actif" ? "ok" : "neutral"}>
                          {templateStatusLabels[v.status] ?? v.status}
                        </Chip>
                      </td>
                      <td className="px-2 py-2.5 text-[12px] text-[var(--crm-text-faint)]">
                        {new Intl.DateTimeFormat("fr-FR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        }).format(new Date(v.updatedAt))}
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        {v.status !== "archive" ? (
                          <button
                            type="button"
                            className="crm-btn crm-btn--ghost crm-btn--sm"
                            disabled={busy}
                            onClick={() =>
                              run(() =>
                                setTemplateStatusAction({ templateId: v.id, status: "archive" }),
                              )
                            }
                          >
                            Archiver
                          </button>
                        ) : (
                          <span className="text-[12px] text-[var(--crm-text-faint)]">Archivée</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
