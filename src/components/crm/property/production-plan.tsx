"use client";

import { useState } from "react";
import {
  seedProductionPlanAction,
  setProductionItemAction,
} from "@/modules/properties/factory/actions";
import {
  PRODUCTION_KIND_ORDER,
  productionKindLabels,
  productionStatusLabels,
  productionStatusVisual,
} from "@/modules/properties/factory/labels";
import type {
  PropertyProductionItemRow,
  PropertyProductionStatus,
} from "@/lib/supabase/types";
import type { AssignableMember } from "@/modules/properties/factory/queries";
import { formatDate } from "@/modules/crm/format";
import { cssVarRef } from "@/modules/crm/status-visuals";
import type { CSSProperties } from "react";
import { FieldError, useAction } from "./shared";

const STATUSES: PropertyProductionStatus[] = [
  "a_faire",
  "en_cours",
  "en_revue",
  "termine",
  "valide",
  "bloque",
];

export function ProductionPlan({
  propertyId,
  items,
  members,
  canEdit,
  canDecide,
}: {
  propertyId: string;
  items: PropertyProductionItemRow[];
  members: AssignableMember[];
  canEdit: boolean;
  canDecide: boolean;
}) {
  const { pending, error, run } = useAction();

  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-[var(--crm-text-dim)]">
          Le plan de production n’est pas encore initialisé pour ce bien.
        </p>
        {canEdit ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="crm-btn crm-btn--gold crm-btn--sm"
              disabled={pending}
              onClick={() => run(() => seedProductionPlanAction({ propertyId }))}
            >
              {pending ? "Initialisation…" : "Initialiser le plan de production"}
            </button>
            <FieldError error={error} />
          </div>
        ) : (
          <p className="text-xs text-[var(--crm-text-faint)]">
            Un opérateur ou l’agent affecté peut initialiser le plan.
          </p>
        )}
      </div>
    );
  }

  const byKind = new Map(items.map((it) => [it.kind, it]));
  const ordered = [
    ...PRODUCTION_KIND_ORDER.map((k) => byKind.get(k)).filter(Boolean),
    ...items.filter((it) => !PRODUCTION_KIND_ORDER.includes(it.kind)),
  ] as PropertyProductionItemRow[];

  return (
    <div className="flex flex-col gap-2">
      {ordered.map((item) => (
        <ProductionItem
          key={item.id}
          propertyId={propertyId}
          item={item}
          members={members}
          canEdit={canEdit}
          canDecide={canDecide}
        />
      ))}
      <p className="mt-1 text-[11px] text-[var(--crm-text-faint)]">
        V1 : pilotage des livrables uniquement. La génération automatique (brochure, site,
        publicités Meta) n’est pas incluse. Seul un administrateur ou un manager peut « valider » un
        livrable.
      </p>
    </div>
  );
}

function ProductionItem({
  propertyId,
  item,
  members,
  canEdit,
  canDecide,
}: {
  propertyId: string;
  item: PropertyProductionItemRow;
  members: AssignableMember[];
  canEdit: boolean;
  canDecide: boolean;
}) {
  const { pending, error, run } = useAction();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<PropertyProductionStatus>(item.status);
  const [assignee, setAssignee] = useState(item.assignee_user_id ?? "");
  const [dueAt, setDueAt] = useState(item.due_at ? item.due_at.slice(0, 10) : "");
  const [notes, setNotes] = useState(item.notes ?? "");
  const [deliverable, setDeliverable] = useState(item.deliverable_url ?? "");
  const [blocker, setBlocker] = useState(item.blocker ?? "");

  const visual = productionStatusVisual[item.status];
  const assigneeName = item.assignee_user_id
    ? members.find((m) => m.userId === item.assignee_user_id)?.name ?? "Responsable"
    : null;

  const save = () => {
    run(
      () =>
        setProductionItemAction({
          propertyId,
          itemId: item.id,
          status,
          assigneeUserId: assignee || null,
          dueAt: dueAt ? new Date(`${dueAt}T09:00:00`).toISOString() : null,
          notes: notes || null,
          deliverableUrl: deliverable || null,
          blocker: status === "bloque" ? blocker || null : null,
        }),
      () => setOpen(false),
    );
  };

  return (
    <div className="rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className="text-sm"
            style={{ color: cssVarRef(visual.cssVar) } as CSSProperties}
          >
            {visual.icon}
          </span>
          <span className="text-sm font-medium text-[var(--crm-text)]">
            {productionKindLabels[item.kind] ?? item.kind}
          </span>
          <span
            className="crm-chip crm-chip--accent"
            style={{ ["--chip-accent" as keyof CSSProperties]: cssVarRef(visual.cssVar) } as CSSProperties}
          >
            {productionStatusLabels[item.status]}
          </span>
        </div>
        {canEdit ? (
          <button type="button" className="crm-btn crm-btn--sm crm-btn--ghost" onClick={() => setOpen((v) => !v)}>
            {open ? "Fermer" : "Modifier"}
          </button>
        ) : null}
      </div>

      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--crm-text-faint)]">
        {assigneeName ? <span>Responsable : {assigneeName}</span> : null}
        {item.due_at ? <span>Échéance : {formatDate(item.due_at)}</span> : null}
        {item.deliverable_url ? (
          <a href={item.deliverable_url} target="_blank" rel="noopener noreferrer" className="text-[var(--crm-gold)] underline">
            Livrable
          </a>
        ) : null}
        {item.status === "bloque" && item.blocker ? (
          <span className="text-[var(--crm-danger)]">Blocage : {item.blocker}</span>
        ) : null}
      </div>
      {item.notes ? <p className="crm-wrap mt-1 text-xs text-[var(--crm-text-dim)]">{item.notes}</p> : null}

      {open ? (
        <div className="mt-3 flex flex-col gap-3 border-t border-[var(--crm-line-soft)] pt-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span className="crm-label">Statut</span>
              <select className="crm-select" value={status} onChange={(e) => setStatus(e.target.value as PropertyProductionStatus)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s} disabled={s === "valide" && !canDecide}>
                    {productionStatusLabels[s]}
                    {s === "valide" && !canDecide ? " (admin/manager)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="crm-label">Responsable</span>
              <select className="crm-select" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                <option value="">Non assigné</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="crm-label">Échéance</span>
              <input type="date" className="crm-input" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="crm-label">Lien du livrable (facultatif)</span>
            <input className="crm-input" value={deliverable} onChange={(e) => setDeliverable(e.target.value)} placeholder="https://…" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="crm-label">Notes</span>
            <textarea className="crm-textarea" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          {status === "bloque" ? (
            <label className="flex flex-col gap-1">
              <span className="crm-label">Motif du blocage</span>
              <input className="crm-input" value={blocker} onChange={(e) => setBlocker(e.target.value)} placeholder="Ce qui bloque…" />
            </label>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="crm-btn crm-btn--sm" disabled={pending} onClick={save}>
              {pending ? "Enregistrement…" : "Enregistrer"}
            </button>
            <FieldError error={error} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
