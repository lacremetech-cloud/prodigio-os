import Link from "next/link";
import type { Lead } from "@/modules/crm/leads";
import { isOverdue, isDueToday, isHighPotential } from "@/modules/crm/leads";
import { contactName } from "@/modules/crm/format";
import { maskContactValue } from "@/modules/crm/auth/roles";
import {
  label,
  propertyLabel,
  recallPreferenceLabels,
  saleHorizonLabel,
  valueBandLabel,
} from "@/modules/crm/labels";
import {
  AgingDot,
  AppreciationBadge,
  Avatar,
  Chip,
  PriorityBadge,
  StageBadge,
} from "./ui";

/**
 * Ligne / carte d’un lead dans la boîte de réception. Les coordonnées sensibles
 * (e-mail, téléphone) ne sont affichées que si le rôle l’autorise (`canViewDetails`).
 */
export function LeadRow({
  lead,
  canViewDetails,
}: {
  lead: Lead;
  canViewDetails: boolean;
}) {
  const name = contactName(lead.contactFirstName, lead.contactLastName);
  const email = maskContactValue(lead.contactEmail, canViewDetails);
  const phone = maskContactValue(lead.contactPhone, canViewDetails);
  const overdue = isOverdue(lead);
  const dueToday = isDueToday(lead);

  return (
    <Link
      href={`/crm/mandats/${lead.opportunityId}`}
      className="group flex flex-col gap-3 rounded-[12px] border border-[var(--crm-line)] bg-[var(--crm-panel)] p-4 transition-colors hover:border-[#3a3b42] hover:bg-[var(--crm-panel-2)] sm:flex-row sm:items-center sm:gap-4"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Avatar name={name} size={30} />
          <span className="truncate text-sm font-semibold text-[var(--crm-text)]">{name}</span>
          {isHighPotential(lead) ? <Chip variant="gold">Fort potentiel</Chip> : null}
          {lead.assignees.length === 0 ? <Chip variant="danger">Non affecté</Chip> : null}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--crm-text-dim)]">
          {phone ? <span>{phone}</span> : null}
          {email ? <span className="truncate">{email}</span> : null}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--crm-text-faint)]">
          <span className="text-[var(--crm-text-dim)]">{propertyLabel(lead.propertyType) ?? "Type inconnu"}</span>
          {lead.city ? <span>· {lead.city}{lead.postalCode ? ` (${lead.postalCode})` : ""}</span> : null}
          {valueBandLabel(lead.valueBand) ? <span>· {valueBandLabel(lead.valueBand)}</span> : null}
          {saleHorizonLabel(lead.saleHorizon) ? <span>· {saleHorizonLabel(lead.saleHorizon)}</span> : null}
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-start gap-2 sm:w-[280px] sm:items-end">
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <StageBadge stage={lead.stage} />
          <AppreciationBadge value={lead.publicAppreciation} />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--crm-text-dim)] sm:justify-end">
          <span className="tabular-nums">
            C <b className="text-[var(--crm-text)]">{lead.compatibilityScore ?? "—"}</b>
          </span>
          <span className="tabular-nums">
            M <b className="text-[var(--crm-text)]">{lead.maturityScore ?? "—"}</b>
          </span>
          <PriorityBadge priority={lead.recommendedPriority} />
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <AgingDot createdAt={lead.createdAt} />
          {lead.recallPreference ? (
            <span className="text-[11px] text-[var(--crm-text-faint)]">
              Rappel : {label(recallPreferenceLabels, lead.recallPreference)}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {lead.assignees.length > 0 ? (
            <span className="text-[11px] text-[var(--crm-text-dim)]">
              {lead.assignees.map((a) => a.name).join(", ")}
            </span>
          ) : null}
          {lead.nextTask ? (
            <Chip variant={overdue ? "danger" : dueToday ? "gold" : "neutral"}>
              {overdue ? "En retard" : dueToday ? "Aujourd’hui" : "Prochaine action"}
            </Chip>
          ) : (
            <Chip variant="neutral">Aucune action</Chip>
          )}
        </div>
      </div>
    </Link>
  );
}
