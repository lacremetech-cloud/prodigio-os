"use client";

import { useState } from "react";
import {
  assignBuyerAction,
  createBuyerTaskAction,
  logBuyerActivityAction,
  qualifyBuyerAction,
  recordBuyerOfferAction,
  recordBuyerOutcomeAction,
  reopenBuyerAction,
  selfAssignBuyerAction,
  setBuyerStageAction,
  setBuyerTaskStatusAction,
  unassignBuyerAction,
  upsertBuyerCriteriaAction,
} from "@/modules/buyers/crm/actions";
import {
  buyerQualificationLabels,
  buyerResponsibilityLabels,
  buyerStageLabels,
} from "@/modules/buyers/crm/labels";
import { movableBuyerStages } from "@/modules/buyers/crm/pipeline";
import { centsToEuros, parseList } from "@/modules/buyers/crm/criteria";
import { activityOutcomeLabels, activityTypeLabels } from "@/modules/crm/labels";
import { FieldError, Saved, parseNumber, useAction } from "@/components/crm/property/shared";
import type {
  BuyerQualificationStatus,
  BuyerSearchCriteriaRow,
  TaskRow,
} from "@/lib/supabase/types";

/**
 * Actions client de la fiche acquéreur. Chacune délègue à une action serveur qui
 * délègue elle-même à une fonction SQL SECURITY DEFINER : **la base fait
 * autorité** (rôle, règles métier, audit). Ici on ne fait que collecter la
 * saisie, exiger une confirmation pour les actions sensibles, et afficher un
 * message neutre en cas de refus.
 */

// ------------------------------------------------------------ Qualification
export function BuyerQualificationForm({
  buyerProfileId,
  status,
  reason,
}: {
  buyerProfileId: string;
  status: string;
  reason: string | null;
}) {
  const { pending, error, done, run } = useAction();
  const [next, setNext] = useState(status);
  const [why, setWhy] = useState(reason ?? "");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="crm-label">Qualification (décision humaine)</span>
          <select
            className="crm-select"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            aria-label="Statut de qualification"
          >
            {(Object.keys(buyerQualificationLabels) as BuyerQualificationStatus[]).map((k) => (
              <option key={k} value={k}>
                {buyerQualificationLabels[k]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="crm-btn crm-btn--sm crm-btn--gold"
          disabled={pending}
          onClick={() =>
            run(() =>
              qualifyBuyerAction({ buyerProfileId, status: next, reason: why.trim() || null }),
            )
          }
        >
          {pending ? "…" : "Enregistrer"}
        </button>
        <Saved show={done} />
      </div>
      <label className="flex flex-col gap-1">
        <span className="crm-label">
          Motif {next === "ecarte" ? "(obligatoire pour écarter)" : "(facultatif)"}
        </span>
        <textarea
          className="crm-textarea"
          rows={2}
          value={why}
          onChange={(e) => setWhy(e.target.value)}
          placeholder="Ce qui justifie cette décision…"
        />
      </label>
      <p className="text-[11px] text-[var(--crm-text-faint)]">
        La qualification est une décision humaine : elle ne se déduit jamais du score automatique
        ni de la recommandation opérationnelle.
      </p>
      <FieldError error={error} />
    </div>
  );
}

// -------------------------------------------------------------------- Étape
export function BuyerStageForm({
  buyerProfileId,
  stage,
}: {
  buyerProfileId: string;
  stage: string;
}) {
  const { pending, error, done, run } = useAction();
  const targets = movableBuyerStages(stage);

  if (targets.length === 0) {
    return (
      <p className="text-xs text-[var(--crm-text-dim)]">
        Ce dossier est clos. Sa réouverture est une décision tracée (voir ci-dessous).
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-0 items-center gap-1.5">
          <span className="crm-label shrink-0">Étape</span>
          <select
            className="crm-select"
            value=""
            disabled={pending}
            onChange={(e) => {
              const v = e.target.value;
              e.currentTarget.selectedIndex = 0;
              if (v) run(() => setBuyerStageAction({ buyerProfileId, stage: v }));
            }}
            aria-label="Déplacer vers une étape"
          >
            <option value="">Déplacer vers…</option>
            {targets.map((s) => (
              <option key={s} value={s}>
                {buyerStageLabels[s]}
              </option>
            ))}
          </select>
        </label>
        <Saved show={done} />
      </div>
      <p className="text-[11px] text-[var(--crm-text-faint)]">
        « Offre en cours », « Acquéreur gagné » et « Perdu » passent par leurs actions dédiées.
      </p>
      <FieldError error={error} />
    </div>
  );
}

// -------------------------------------------------------------- Affectation
export function BuyerAssignmentForm({
  buyerProfileId,
  assignees,
  members,
  canAssign,
}: {
  buyerProfileId: string;
  assignees: { userId: string; name: string; responsibility: string }[];
  members: { userId: string; name: string }[];
  canAssign: boolean;
}) {
  const { pending, error, done, run } = useAction();
  const [userId, setUserId] = useState("");
  const [responsibility, setResponsibility] = useState("setter");

  return (
    <div className="flex flex-col gap-2">
      {assignees.length === 0 ? (
        <p className="text-xs text-[var(--crm-text-dim)]">Aucun responsable affecté.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {assignees.map((a) => (
            <li key={a.userId} className="crm-chip">
              {a.name} · {buyerResponsibilityLabels[a.responsibility] ?? a.responsibility}
              {canAssign ? (
                <button
                  type="button"
                  className="ml-1.5 text-[var(--crm-danger)]"
                  aria-label={`Retirer ${a.name}`}
                  disabled={pending}
                  onClick={() => run(() => unassignBuyerAction({ buyerProfileId, userId: a.userId }))}
                >
                  ✕
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canAssign ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-0 flex-col gap-1">
            <span className="crm-label">Affecter à</span>
            <select
              className="crm-select"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              aria-label="Membre à affecter"
            >
              <option value="">Choisir un membre…</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1">
            <span className="crm-label">Responsabilité</span>
            <select
              className="crm-select"
              value={responsibility}
              onChange={(e) => setResponsibility(e.target.value)}
              aria-label="Responsabilité"
            >
              {Object.entries(buyerResponsibilityLabels).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="crm-btn crm-btn--sm"
            disabled={pending || !userId}
            onClick={() => run(() => assignBuyerAction({ buyerProfileId, userId, responsibility }))}
          >
            Affecter
          </button>
          <button
            type="button"
            className="crm-btn crm-btn--sm crm-btn--ghost"
            disabled={pending}
            onClick={() => run(() => selfAssignBuyerAction({ buyerProfileId }))}
          >
            M’affecter
          </button>
          <Saved show={done} />
        </div>
      ) : null}
      <FieldError error={error} />
    </div>
  );
}

// ----------------------------------------------------------------- Critères
export function BuyerCriteriaForm({
  buyerProfileId,
  criteria,
}: {
  buyerProfileId: string;
  criteria: BuyerSearchCriteriaRow | null;
}) {
  const { pending, error, done, run } = useAction();
  const [types, setTypes] = useState((criteria?.property_types ?? []).join(", "));
  const [locations, setLocations] = useState((criteria?.locations ?? []).join(", "));
  const [min, setMin] = useState(String(centsToEuros(criteria?.budget_min_cents) ?? ""));
  const [max, setMax] = useState(String(centsToEuros(criteria?.budget_max_cents) ?? ""));
  const [notes, setNotes] = useState(criteria?.notes ?? "");
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = () => {
    const minValue = parseNumber(min);
    const maxValue = parseNumber(max);
    if (minValue === undefined || maxValue === undefined) {
      setLocalError("Budget invalide : saisissez un montant en euros.");
      return;
    }
    setLocalError(null);
    run(() =>
      upsertBuyerCriteriaAction({
        buyerProfileId,
        propertyTypes: parseList(types),
        locations: parseList(locations, true),
        budgetMinEuros: minValue,
        budgetMaxEuros: maxValue,
        purchaseHorizon: criteria?.purchase_horizon ?? null,
        financing: criteria?.financing ?? null,
        projectNature: criteria?.project_nature ?? null,
        decisionMode: criteria?.decision_mode ?? null,
        notes: notes.trim() || null,
      }),
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="crm-label">Types de biens recherchés</span>
          <input
            className="crm-input"
            value={types}
            onChange={(e) => setTypes(e.target.value)}
            placeholder="villa_architecte, chalet…"
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="crm-label">Localisations souhaitées</span>
          <input
            className="crm-input"
            value={locations}
            onChange={(e) => setLocations(e.target.value)}
            placeholder="megève, courchevel…"
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="crm-label">Budget minimal (€)</span>
          <input
            className="crm-input"
            inputMode="decimal"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            placeholder="Non renseigné"
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="crm-label">Budget maximal (€)</span>
          <input
            className="crm-input"
            inputMode="decimal"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            placeholder="Non renseigné"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="crm-label">Notes internes sur la recherche</span>
        <textarea
          className="crm-textarea"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="crm-btn crm-btn--sm" disabled={pending} onClick={submit}>
          {pending ? "…" : "Enregistrer les critères"}
        </button>
        <Saved show={done} />
      </div>
      <p className="text-[11px] text-[var(--crm-text-faint)]">
        {criteria?.source === "humain"
          ? "Ces critères ont été affinés par l’équipe : ils ne seront plus écrasés par un nouvel intérêt."
          : "Ces critères sont amorcés depuis le funnel. Dès votre première modification, ils sont verrouillés et ne seront plus écrasés automatiquement."}
      </p>
      <FieldError error={localError ?? error} />
    </div>
  );
}

// ----------------------------------------------------- Offre / résultat / réouverture
export function BuyerOfferForm({ buyerProfileId, properties }: {
  buyerProfileId: string;
  properties: { id: string; label: string }[];
}) {
  const { pending, error, done, run } = useAction();
  const [propertyId, setPropertyId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = () => {
    const value = parseNumber(amount);
    if (value === undefined) {
      setLocalError("Montant invalide.");
      return;
    }
    setLocalError(null);
    setConfirming(false);
    run(() =>
      recordBuyerOfferAction({
        buyerProfileId,
        propertyId: propertyId || null,
        amountEuros: value,
        note: note.trim() || null,
      }),
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="crm-label">Bien concerné</span>
          <select
            className="crm-select"
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            aria-label="Bien concerné par l’offre"
          >
            <option value="">Non précisé</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="crm-label">Montant de l’offre (€)</span>
          <input
            className="crm-input"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Facultatif"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="crm-label">Commentaire</span>
        <textarea
          className="crm-textarea"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2 rounded-[8px] border border-[var(--crm-line)] bg-[var(--crm-panel-2)] p-2">
          <p className="crm-wrap text-xs text-[var(--crm-text-dim)]">
            Confirmer le passage du dossier en « Offre en cours » ? L’action est tracée dans le
            journal d’audit.
          </p>
          <button type="button" className="crm-btn crm-btn--sm crm-btn--gold" disabled={pending} onClick={submit}>
            Confirmer
          </button>
          <button
            type="button"
            className="crm-btn crm-btn--sm crm-btn--ghost"
            onClick={() => setConfirming(false)}
          >
            Annuler
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="crm-btn crm-btn--sm"
            disabled={pending}
            onClick={() => setConfirming(true)}
          >
            Enregistrer une offre
          </button>
          <Saved show={done} />
        </div>
      )}
      <FieldError error={localError ?? error} />
    </div>
  );
}

export function BuyerOutcomeForm({ buyerProfileId }: { buyerProfileId: string }) {
  const { pending, error, done, run } = useAction();
  const [outcome, setOutcome] = useState<"gagne" | "perdu">("gagne");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = () => {
    if (outcome === "perdu" && !reason.trim()) {
      setLocalError("Un motif de perte est obligatoire.");
      setConfirming(false);
      return;
    }
    setLocalError(null);
    setConfirming(false);
    run(() => recordBuyerOutcomeAction({ buyerProfileId, outcome, reason: reason.trim() || null }));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="crm-label">Résultat commercial</span>
          <select
            className="crm-select"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value as "gagne" | "perdu")}
            aria-label="Résultat commercial"
          >
            <option value="gagne">Acquéreur gagné</option>
            <option value="perdu">Perdu</option>
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="crm-label">
          Motif {outcome === "perdu" ? "(obligatoire)" : "(facultatif)"}
        </span>
        <textarea
          className="crm-textarea"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={outcome === "perdu" ? "Pourquoi ce dossier est-il perdu ?" : ""}
        />
      </label>
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2 rounded-[8px] border border-[var(--crm-line)] bg-[var(--crm-panel-2)] p-2">
          <p className="crm-wrap text-xs text-[var(--crm-text-dim)]">
            Confirmer la clôture du dossier en « {outcome === "gagne" ? "gagné" : "perdu"} » ?
            L’action est tracée dans le journal d’audit.
          </p>
          <button type="button" className="crm-btn crm-btn--sm crm-btn--gold" disabled={pending} onClick={submit}>
            Confirmer
          </button>
          <button type="button" className="crm-btn crm-btn--sm crm-btn--ghost" onClick={() => setConfirming(false)}>
            Annuler
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button type="button" className="crm-btn crm-btn--sm" disabled={pending} onClick={() => setConfirming(true)}>
            Clore le dossier
          </button>
          <Saved show={done} />
        </div>
      )}
      <FieldError error={localError ?? error} />
    </div>
  );
}

export function BuyerReopenForm({ buyerProfileId }: { buyerProfileId: string }) {
  const { pending, error, done, run } = useAction();
  const [reason, setReason] = useState("");
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className="crm-label">Motif de réouverture (obligatoire)</span>
        <textarea
          className="crm-textarea"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="crm-btn crm-btn--sm"
          disabled={pending || !reason.trim()}
          onClick={() => run(() => reopenBuyerAction({ buyerProfileId, reason: reason.trim() }))}
        >
          Rouvrir le dossier
        </button>
        <Saved show={done} />
      </div>
      <FieldError error={error} />
    </div>
  );
}

// --------------------------------------------------- Activités, notes, tâches
export function BuyerActivityForm({ buyerProfileId }: { buyerProfileId: string }) {
  const { pending, error, done, run } = useAction();
  const [type, setType] = useState("appel");
  const [outcome, setOutcome] = useState("");
  const [body, setBody] = useState("");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="crm-label">Type</span>
          <select
            className="crm-select"
            value={type}
            onChange={(e) => setType(e.target.value)}
            aria-label="Type d’activité"
          >
            {Object.entries(activityTypeLabels).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="crm-label">Résultat de l’échange</span>
          <select
            className="crm-select"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            aria-label="Résultat de l’échange"
          >
            <option value="">Non précisé</option>
            {Object.entries(activityOutcomeLabels).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="crm-label">Note interne</span>
        <textarea
          className="crm-textarea"
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Ce qui s’est dit, ce qu’il faut retenir…"
        />
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="crm-btn crm-btn--sm"
          disabled={pending}
          onClick={() =>
            run(
              () =>
                logBuyerActivityAction({
                  buyerProfileId,
                  type,
                  outcome: outcome || null,
                  body: body.trim() || null,
                }),
              // Le champ est vidé seulement si l'enregistrement a réussi.
              () => setBody(""),
            )
          }
        >
          {pending ? "…" : "Enregistrer l’activité"}
        </button>
        <Saved show={done} />
      </div>
      <FieldError error={error} />
    </div>
  );
}

export function BuyerTaskForm({
  buyerProfileId,
  tasks,
}: {
  buyerProfileId: string;
  tasks: TaskRow[];
}) {
  const { pending, error, done, run } = useAction();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("rappel");
  const [dueAt, setDueAt] = useState("");

  return (
    <div className="flex flex-col gap-3">
      {tasks.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {tasks.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between gap-2 rounded-[8px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] px-2.5 py-2"
            >
              <span className="crm-wrap text-xs text-[var(--crm-text)]">
                {t.title}
                {t.due_at ? (
                  <span className="text-[var(--crm-text-faint)]">
                    {" "}
                    · {new Date(t.due_at).toLocaleString("fr-FR")}
                  </span>
                ) : null}
                {t.status !== "a_faire" ? (
                  <span className="text-[var(--crm-text-faint)]"> · {t.status}</span>
                ) : null}
              </span>
              {t.status === "a_faire" ? (
                <button
                  type="button"
                  className="crm-btn crm-btn--sm crm-btn--ghost shrink-0"
                  disabled={pending}
                  onClick={() =>
                    run(() =>
                      setBuyerTaskStatusAction({ buyerProfileId, taskId: t.id, status: "fait" }),
                    )
                  }
                >
                  Terminer
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-[var(--crm-text-dim)]">Aucune tâche. Programmez la prochaine action.</p>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="crm-label">Prochaine action</span>
          <input
            className="crm-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Rappeler pour organiser la visite"
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="crm-label">Type</span>
          <select className="crm-select" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Type de tâche">
            <option value="rappel">Rappel</option>
            <option value="tache">Tâche</option>
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="crm-label">Échéance</span>
          <input
            className="crm-input"
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="crm-btn crm-btn--sm"
          disabled={pending || !title.trim()}
          onClick={() =>
            run(() =>
              createBuyerTaskAction({
                buyerProfileId,
                title: title.trim(),
                kind,
                dueAt: dueAt ? new Date(dueAt).toISOString() : null,
              }),
            )
          }
        >
          Ajouter
        </button>
        <Saved show={done} />
      </div>
      <FieldError error={error} />
    </div>
  );
}
