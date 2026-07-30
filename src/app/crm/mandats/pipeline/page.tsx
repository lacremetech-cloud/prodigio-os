import type { Metadata } from "next";
import Link from "next/link";
import { requireCrmSession } from "@/modules/crm/auth/session";
import { canOperate, canViewContactDetails, maskContactValue } from "@/modules/crm/auth/roles";
import { loadLeadBundle } from "@/modules/crm/data/queries";
import type { Lead } from "@/modules/crm/leads";
import { isHighPotential, isOverdue } from "@/modules/crm/leads";
import { contactName } from "@/modules/crm/format";
import { KANBAN_COLUMNS, propertyLabel, stageLabels, valueBandLabel } from "@/modules/crm/labels";
import { StageControl } from "@/components/crm/lead-actions";
import { Chip } from "@/components/crm/ui";

export const metadata: Metadata = { title: "Pipeline" };

function KanbanCard({
  lead,
  canView,
  canMove,
}: {
  lead: Lead;
  canView: boolean;
  canMove: boolean;
}) {
  const name = contactName(lead.contactFirstName, lead.contactLastName);
  return (
    <div className="crm-panel-2 flex flex-col gap-2 p-3">
      <Link href={`/crm/mandats/${lead.opportunityId}`} className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-[var(--crm-text)]">{name}</span>
          {isHighPotential(lead) ? <Chip variant="gold">★</Chip> : null}
        </div>
        <p className="mt-1 truncate text-xs text-[var(--crm-text-faint)]">
          {propertyLabel(lead.propertyType) ?? "Type inconnu"}
          {lead.city ? ` · ${lead.city}` : ""}
        </p>
        <p className="mt-0.5 truncate text-xs text-[var(--crm-text-faint)]">
          {valueBandLabel(lead.valueBand) ?? "Valeur à estimer"}
        </p>
      </Link>
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--crm-text-dim)]">
        <span className="tabular-nums">C {lead.compatibilityScore ?? "—"}</span>
        <span className="tabular-nums">M {lead.maturityScore ?? "—"}</span>
        {lead.assignees.length === 0 ? <Chip variant="danger">Non affecté</Chip> : null}
        {isOverdue(lead) ? <Chip variant="danger">En retard</Chip> : null}
      </div>
      {canView && lead.contactPhone ? (
        <p className="text-[11px] text-[var(--crm-text-faint)]">
          {maskContactValue(lead.contactPhone, canView)}
        </p>
      ) : null}
      {canMove ? (
        <StageControl opportunityId={lead.opportunityId} stage={lead.stage} />
      ) : null}
    </div>
  );
}

export default async function PipelinePage() {
  const session = await requireCrmSession("/crm/mandats/pipeline");
  const canView = canViewContactDetails(session.roles);
  const canMove = canOperate(session.roles);
  const { leads } = await loadLeadBundle();

  const byStage = new Map<string, Lead[]>();
  for (const col of KANBAN_COLUMNS) byStage.set(col, []);
  // Les stades non affichés en colonne (ex. rendez_vous_realise) sont rattachés
  // à la colonne la plus proche pour rester lisibles sans perdre le lead.
  const fallback: Record<string, string> = {
    rendez_vous_realise: "rendez_vous_planifie",
    en_attente_de_signature: "proposition_de_mandat",
  };
  for (const lead of leads) {
    const col = byStage.has(lead.stage) ? lead.stage : fallback[lead.stage] ?? "nouveau";
    byStage.get(col)?.push(lead);
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="crm-eyebrow">Pipeline</p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--crm-text)]">Pipeline visuel</h1>
        <p className="mt-1 text-sm text-[var(--crm-text-dim)]">
          Le stade du pipeline est distinct du segment du bien.{" "}
          {canMove
            ? "Changez le stade d’un lead directement dans sa carte."
            : "Votre rôle est en lecture pour cette vue."}
        </p>
      </header>

      <div className="crm-kanban crm-scroll">
        {KANBAN_COLUMNS.map((col) => {
          const items = byStage.get(col) ?? [];
          return (
            <div key={col} className="crm-kanban-col flex flex-col">
              <div className="mb-2 flex items-center justify-between px-1">
                <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--crm-text-dim)]">
                  {stageLabels[col]}
                </h2>
                <span className="crm-chip tabular-nums">{items.length}</span>
              </div>
              <div className="flex min-h-[120px] flex-col gap-2 rounded-[12px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel)] p-2">
                {items.length === 0 ? (
                  <p className="px-2 py-6 text-center text-[11px] text-[var(--crm-text-faint)]">
                    Vide
                  </p>
                ) : (
                  items.map((lead) => (
                    <KanbanCard
                      key={lead.opportunityId}
                      lead={lead}
                      canView={canView}
                      canMove={canMove}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
