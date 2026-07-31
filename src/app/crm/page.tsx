import type { Metadata } from "next";
import Link from "next/link";
import { requireCrmSession } from "@/modules/crm/auth/session";
import { canViewContactDetails } from "@/modules/crm/auth/roles";
import { loadLeadBundle } from "@/modules/crm/data/queries";
import {
  computeOverviewMetrics,
  isDueToday,
  isHighPotential,
  isOverdue,
  isUnassigned,
  type Lead,
} from "@/modules/crm/leads";
import { contactName, timeSince } from "@/modules/crm/format";
import { maskContactValue } from "@/modules/crm/auth/roles";
import { propertyLabel, valueBandLabel } from "@/modules/crm/labels";
import { EmptyState, StageBadge } from "@/components/crm/ui";

export const metadata: Metadata = { title: "Vue d’ensemble" };

interface Kpi {
  label: string;
  value: number | string;
  hint?: string;
  accent: string; // variable CSS d'accent (thème-adaptative)
  icon: string;
  critical?: boolean; // met en avant un état critique (>0)
  soon?: boolean;
}

function KpiCard({ kpi }: { kpi: Kpi }) {
  const accent = kpi.critical ? "var(--crm-danger)" : `var(${kpi.accent})`;
  return (
    <div
      className="crm-panel crm-kpi flex flex-col gap-1 p-4 crm-fade-in"
      style={{ ["--kpi-accent" as keyof React.CSSProperties]: accent } as React.CSSProperties}
    >
      <span className="flex items-center gap-2 text-xs text-[var(--crm-text-dim)]">
        <span className="crm-kpi__icon text-sm" aria-hidden>{kpi.icon}</span>
        <span className="crm-wrap">{kpi.label}</span>
      </span>
      {kpi.soon ? (
        <span className="mt-1 text-sm text-[var(--crm-text-faint)]">Bientôt disponible</span>
      ) : (
        <span
          className="text-2xl font-semibold tabular-nums"
          style={{ color: kpi.critical && Number(kpi.value) > 0 ? "var(--crm-danger)" : "var(--crm-text)" }}
        >
          {kpi.value}
        </span>
      )}
      {kpi.hint ? <span className="text-[11px] text-[var(--crm-text-faint)]">{kpi.hint}</span> : null}
    </div>
  );
}

function PriorityItem({ lead, canView, meta }: { lead: Lead; canView: boolean; meta?: string }) {
  const name = contactName(lead.contactFirstName, lead.contactLastName);
  const phone = maskContactValue(lead.contactPhone, canView);
  return (
    <Link
      href={`/crm/mandats/${lead.opportunityId}`}
      className="flex items-center justify-between gap-3 rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] px-3 py-2.5 transition-colors hover:border-[#34353c]"
    >
      <div className="min-w-0">
        <p className="crm-ellipsis text-sm font-medium text-[var(--crm-text)]" title={name}>{name}</p>
        <p className="crm-ellipsis text-xs text-[var(--crm-text-faint)]">
          {propertyLabel(lead.propertyType) ?? "Type inconnu"}
          {lead.city ? ` · ${lead.city}` : ""}
          {valueBandLabel(lead.valueBand) ? ` · ${valueBandLabel(lead.valueBand)}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {meta ? <span className="text-[11px] text-[var(--crm-text-dim)]">{meta}</span> : null}
        {phone && canView ? (
          <span className="hidden text-[11px] text-[var(--crm-text-dim)] sm:inline">{phone}</span>
        ) : null}
        <StageBadge stage={lead.stage} />
      </div>
    </Link>
  );
}

function PrioritySection({
  title,
  hint,
  leads,
  canView,
  metaFor,
  emptyHint,
}: {
  title: string;
  hint?: string;
  leads: Lead[];
  canView: boolean;
  metaFor?: (l: Lead) => string | undefined;
  emptyHint: string;
}) {
  return (
    <section className="crm-panel flex flex-col gap-3 p-4">
      <div>
        <h3 className="text-sm font-semibold text-[var(--crm-text)]">{title}</h3>
        {hint ? <p className="text-xs text-[var(--crm-text-faint)]">{hint}</p> : null}
      </div>
      {leads.length === 0 ? (
        <p className="rounded-[10px] border border-dashed border-[var(--crm-line)] px-3 py-6 text-center text-xs text-[var(--crm-text-faint)]">
          {emptyHint}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {leads.slice(0, 6).map((l) => (
            <PriorityItem key={l.opportunityId} lead={l} canView={canView} meta={metaFor?.(l)} />
          ))}
        </div>
      )}
    </section>
  );
}

export default async function OverviewPage() {
  const session = await requireCrmSession();
  const canView = canViewContactDetails(session.roles);
  const { leads, contactedOpportunityIds } = await loadLeadBundle();
  const m = computeOverviewMetrics(leads, contactedOpportunityIds);

  const kpis: Kpi[] = [
    { label: "Nouveaux aujourd’hui", value: m.newToday, accent: "--crm-st-nouveau", icon: "✦" },
    { label: "Nouveaux (7 jours)", value: m.newLast7Days, accent: "--crm-info", icon: "▤" },
    { label: "Non affectés", value: m.unassigned, accent: "--crm-warning", icon: "⚠", critical: m.unassigned > 0 },
    { label: "À rappeler aujourd’hui", value: m.toRecallToday, accent: "--crm-warning", icon: "☎" },
    { label: "Tâches en retard", value: m.overdueTasks, accent: "--crm-danger", icon: "!", critical: m.overdueTasks > 0 },
    { label: "Fort potentiel", value: m.highPotential, accent: "--crm-success", icon: "★" },
    {
      label: "Taux de contact",
      value: m.contactRate == null ? "—" : `${m.contactRate}%`,
      accent: "--crm-st-contact",
      icon: "◗",
      hint: "Dossiers avec contact établi",
    },
    { label: "Rendez-vous planifiés", value: m.appointmentsPlanned, accent: "--crm-st-rdv_planifie", icon: "◷" },
    {
      label: "En attente d’éligibilité",
      value: m.awaitingEligibility,
      accent: "--crm-st-eligibilite",
      icon: "⚖",
      hint: "Estimation réalisée, décision à valider",
    },
    { label: "Mandats proposés", value: m.mandatesProposed, accent: "--crm-st-proposition", icon: "✎" },
    { label: "Mandats signés", value: m.mandatesSigned, accent: "--crm-st-signe", icon: "✔" },
  ];

  const newUntreated = leads.filter((l) => l.stage === "nouveau" && isUnassigned(l));
  const recalls = leads.filter((l) => isDueToday(l) || isOverdue(l));
  const overdue = leads.filter((l) => isOverdue(l));
  const highNoAction = leads.filter((l) => isHighPotential(l) && !l.nextTask);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header>
        <p className="crm-eyebrow">Tableau de bord</p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--crm-text)]">Vue d’ensemble</h1>
        <p className="mt-1 text-sm text-[var(--crm-text-dim)]">
          Funnel Mandats — indicateurs dérivés des données réelles.
        </p>
      </header>

      {leads.length === 0 ? (
        <EmptyState
          title="Aucune donnée pour l’instant."
          hint="Les indicateurs et priorités s’afficheront dès qu’un lead sera entré par le funnel."
        />
      ) : null}

      <section aria-label="Indicateurs">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {kpis.map((kpi) => (
            <KpiCard key={kpi.label} kpi={kpi} />
          ))}
        </div>
        <p className="mt-2 text-[11px] text-[var(--crm-text-faint)]">
          Les indicateurs non encore alimentés par le modèle affichent « — » ou « bientôt
          disponible » plutôt qu’une valeur fabriquée.
        </p>
      </section>

      <section>
        <div className="mb-3">
          <p className="crm-eyebrow">Priorités du jour</p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--crm-text)]">À traiter en priorité</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <PrioritySection
            title="Nouveaux leads non traités"
            hint="Stade « nouveau » et sans responsable"
            leads={newUntreated}
            canView={canView}
            emptyHint="Aucun nouveau lead non affecté. 👏"
          />
          <PrioritySection
            title="Rappels arrivés à échéance"
            hint="Prochaines actions dues aujourd’hui ou en retard"
            leads={recalls}
            canView={canView}
            metaFor={(l) => (l.nextTask?.dueAt ? timeSince(l.nextTask.dueAt) : undefined)}
            emptyHint="Aucun rappel en attente."
          />
          <PrioritySection
            title="Tâches en retard"
            hint="Échéance dépassée"
            leads={overdue}
            canView={canView}
            emptyHint="Aucune tâche en retard."
          />
          <PrioritySection
            title="Fort potentiel sans prochaine action"
            hint="Dossiers à ne pas laisser refroidir"
            leads={highNoAction}
            canView={canView}
            emptyHint="Tous les dossiers à fort potentiel ont une prochaine action."
          />
        </div>
      </section>
    </div>
  );
}
