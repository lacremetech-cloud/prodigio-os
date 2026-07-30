"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  assignOpportunity,
  changeStage,
  createTask,
  decideSegment,
  logActivity,
  recordOutcome,
  selfAssign,
  setTaskStatus,
  type ActionResult,
} from "@/modules/crm/data/mutations";
import {
  activityOutcomeLabels,
  activityTypeLabels,
  outcomeLabels,
  responsibilityLabels,
  segmentLabels,
  stageLabels,
} from "@/modules/crm/labels";
import { PIPELINE_STAGES } from "@/modules/crm/labels";

export interface MemberOption {
  userId: string;
  name: string;
  role: string;
}

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const run = (fn: () => Promise<ActionResult>, onOk?: () => void) => {
    setError(null);
    setDone(false);
    start(async () => {
      const res = await fn();
      if (res.ok) {
        setDone(true);
        onOk?.();
        router.refresh();
      } else {
        setError(res.error ?? "Erreur");
      }
    });
  };

  return { pending, error, done, run };
}

function FieldError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="text-xs text-[var(--color-danger-on-dark)]">
      {error}
    </p>
  );
}

// --------------------------------------------------------------- StageControl
export function StageControl({
  opportunityId,
  stage,
}: {
  opportunityId: string;
  stage: string;
}) {
  const { pending, error, run } = useAction();
  return (
    <div className="flex flex-col gap-1">
      <select
        aria-label="Changer le stade"
        className="crm-select"
        value={stage}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          if (next !== stage) run(() => changeStage(opportunityId, next));
        }}
      >
        {PIPELINE_STAGES.map((s) => (
          <option key={s} value={s}>
            {stageLabels[s]}
          </option>
        ))}
      </select>
      <FieldError error={error} />
    </div>
  );
}

// --------------------------------------------------------------- AssignControl
export function AssignControl({
  opportunityId,
  members,
  assignedUserIds,
}: {
  opportunityId: string;
  members: MemberOption[];
  assignedUserIds: string[];
}) {
  const { pending, error, run } = useAction();
  const [value, setValue] = useState("");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="crm-btn crm-btn--sm"
          disabled={pending}
          onClick={() => run(() => selfAssign(opportunityId))}
        >
          M’affecter ce lead
        </button>
        <select
          aria-label="Affecter à un membre"
          className="crm-select max-w-[220px] text-xs"
          value={value}
          disabled={pending || members.length === 0}
          onChange={(e) => {
            const uid = e.target.value;
            setValue("");
            if (uid) run(() => assignOpportunity(opportunityId, uid, "setter"));
          }}
        >
          <option value="">Affecter à…</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId} disabled={assignedUserIds.includes(m.userId)}>
              {m.name}
              {assignedUserIds.includes(m.userId) ? " (déjà affecté)" : ""}
            </option>
          ))}
        </select>
      </div>
      <FieldError error={error} />
    </div>
  );
}

// ---------------------------------------------------------------- ActivityForm
const OUTCOME_TYPES = new Set(["appel", "tentative_appel"]);

export function ActivityForm({ opportunityId }: { opportunityId: string }) {
  const { pending, error, run } = useAction();
  const [type, setType] = useState("appel");
  const [outcome, setOutcome] = useState("");
  const [body, setBody] = useState("");

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () =>
            logActivity({
              opportunityId,
              type,
              outcome: OUTCOME_TYPES.has(type) && outcome ? outcome : null,
              body: body || null,
            }),
          () => {
            setBody("");
            setOutcome("");
          },
        );
      }}
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="crm-label">Type</span>
          <select
            className="crm-select"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {Object.entries(activityTypeLabels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        {OUTCOME_TYPES.has(type) ? (
          <label className="flex flex-col gap-1">
            <span className="crm-label">Résultat</span>
            <select
              className="crm-select"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
            >
              <option value="">—</option>
              {Object.entries(activityOutcomeLabels).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <label className="flex flex-col gap-1">
        <span className="crm-label">Note / détail</span>
        <textarea
          className="crm-textarea"
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Compte rendu de l’échange, contexte, éléments de qualification…"
        />
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" className="crm-btn crm-btn--gold crm-btn--sm" disabled={pending}>
          {pending ? "Enregistrement…" : "Ajouter l’activité"}
        </button>
        <FieldError error={error} />
      </div>
    </form>
  );
}

// -------------------------------------------------------------------- TaskForm
export function TaskForm({
  opportunityId,
  members,
}: {
  opportunityId: string;
  members: MemberOption[];
}) {
  const { pending, error, run } = useAction();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("rappel");
  const [due, setDue] = useState("");
  const [assignee, setAssignee] = useState("");

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        run(
          () =>
            createTask({
              opportunityId,
              title: title.trim(),
              kind,
              dueAt: due ? new Date(due).toISOString() : null,
              assigneeUserId: assignee || null,
            }),
          () => {
            setTitle("");
            setDue("");
          },
        );
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="crm-label">Prochaine action</span>
        <input
          className="crm-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Rappeler le propriétaire, préparer l’estimation…"
          required
        />
      </label>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="crm-label">Type</span>
          <select className="crm-select" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="rappel">Rappel</option>
            <option value="tache">Tâche</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="crm-label">Échéance</span>
          <input
            type="datetime-local"
            className="crm-input"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="crm-label">Responsable</span>
          <select
            className="crm-select"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
          >
            <option value="">Moi</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" className="crm-btn crm-btn--sm" disabled={pending}>
          {pending ? "Enregistrement…" : "Programmer"}
        </button>
        <FieldError error={error} />
      </div>
    </form>
  );
}

// ------------------------------------------------------------------ TaskToggle
export function TaskToggle({
  taskId,
  status,
  opportunityId,
}: {
  taskId: string;
  status: string;
  opportunityId?: string;
}) {
  const { pending, run } = useAction();
  const done = status === "fait";
  return (
    <button
      type="button"
      disabled={pending || done}
      onClick={() => run(() => setTaskStatus(taskId, "fait", opportunityId))}
      className={`crm-btn crm-btn--sm ${done ? "crm-btn--ghost" : ""}`}
      aria-label={done ? "Tâche terminée" : "Marquer comme terminée"}
    >
      {done ? "✓ Terminée" : pending ? "…" : "Marquer terminée"}
    </button>
  );
}

// -------------------------------------------------------- SegmentDecisionForm
export function SegmentDecisionForm({
  opportunityId,
  segment,
}: {
  opportunityId: string;
  segment: string;
}) {
  const { pending, error, done, run } = useAction();
  const [value, setValue] = useState(segment);
  const [reason, setReason] = useState("");
  const [derogation, setDerogation] = useState(false);

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() =>
          decideSegment({
            opportunityId,
            segment: value,
            reason: reason || null,
            isDerogation: derogation,
          }),
        );
      }}
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="crm-label">Segment validé (décision humaine)</span>
          <select className="crm-select" value={value} onChange={(e) => setValue(e.target.value)}>
            {Object.entries(segmentLabels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-6 flex items-center gap-2 text-sm text-[var(--crm-text-dim)]">
          <input
            type="checkbox"
            checked={derogation}
            onChange={(e) => setDerogation(e.target.checked)}
          />
          Dérogation à la recommandation
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="crm-label">
          Justification {derogation ? "(obligatoire)" : "(recommandée)"}
        </span>
        <textarea
          className="crm-textarea"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Motif de la décision de segment…"
        />
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" className="crm-btn crm-btn--sm" disabled={pending}>
          {pending ? "Validation…" : "Valider le segment"}
        </button>
        {done ? <span className="text-xs crm-aging--frais">Enregistré</span> : null}
        <FieldError error={error} />
      </div>
    </form>
  );
}

// -------------------------------------------------------------- OutcomeForm
export function OutcomeForm({ opportunityId }: { opportunityId: string }) {
  const { pending, error, done, run } = useAction();
  const [outcome, setOutcome] = useState("signe_gagne");
  const [reason, setReason] = useState("");
  const needsReason = outcome !== "signe_gagne";

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() =>
          recordOutcome({ opportunityId, outcome, reason: reason || null }),
        );
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="crm-label">Résultat commercial</span>
        <select className="crm-select" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
          {Object.entries(outcomeLabels).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="crm-label">
          Motif {needsReason ? "(obligatoire en cas de perte / disqualification)" : "(facultatif)"}
        </span>
        <textarea
          className="crm-textarea"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Raison de perte, disqualification…"
        />
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" className="crm-btn crm-btn--sm" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer le résultat"}
        </button>
        {done ? <span className="text-xs crm-aging--frais">Enregistré</span> : null}
        <FieldError error={error} />
      </div>
    </form>
  );
}

// Réexport pour lisibilité des responsabilités si besoin ailleurs.
export { responsibilityLabels };
