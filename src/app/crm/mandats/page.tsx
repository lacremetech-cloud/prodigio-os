import type { Metadata } from "next";
import Link from "next/link";
import { requireCrmSession } from "@/modules/crm/auth/session";
import { canViewContactDetails } from "@/modules/crm/auth/roles";
import { loadLeadBundle } from "@/modules/crm/data/queries";
import {
  applyLeadFilters,
  isDueToday,
  isHighPotential,
  isNew,
  isOverdue,
  isUnassigned,
  sortLeads,
  type Lead,
  type LeadSort,
  type QuickFilter,
} from "@/modules/crm/leads";
import { FilterBar } from "@/components/crm/filter-bar";
import { LeadRow } from "@/components/crm/lead-row";
import { EmptyState } from "@/components/crm/ui";

export const metadata: Metadata = { title: "Leads Mandats" };

const PAGE_SIZE = 20;

function countBy(leads: Lead[]): Record<QuickFilter, number> {
  return {
    tous: leads.length,
    nouveau: leads.filter(isNew).length,
    non_affecte: leads.filter(isUnassigned).length,
    fort_potentiel: leads.filter(isHighPotential).length,
    a_rappeler: leads.filter((l) => isDueToday(l)).length,
    en_retard: leads.filter((l) => isOverdue(l)).length,
  };
}

export default async function LeadsInboxPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    filter?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  const session = await requireCrmSession("/crm/mandats");
  const canView = canViewContactDetails(session.roles);
  const params = await searchParams;

  const quick = ([
    "tous",
    "nouveau",
    "non_affecte",
    "fort_potentiel",
    "a_rappeler",
    "en_retard",
  ].includes(params.filter ?? "")
    ? params.filter
    : "tous") as QuickFilter;
  const sort = ([
    "recent",
    "ancien",
    "priorite",
    "compatibilite",
    "maturite",
  ].includes(params.sort ?? "")
    ? params.sort
    : "recent") as LeadSort;
  const search = typeof params.q === "string" ? params.q : "";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const { leads } = await loadLeadBundle();
  const counts = countBy(leads);
  const filtered = sortLeads(
    applyLeadFilters(leads, { quick, search, stage: null }),
    sort,
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const start = (current - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  const pageHref = (p: number) => {
    const sp = new URLSearchParams();
    if (search) sp.set("q", search);
    if (quick !== "tous") sp.set("filter", quick);
    if (sort !== "recent") sp.set("sort", sort);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return `/crm/mandats${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <header>
        <p className="crm-eyebrow">Boîte de réception</p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--crm-text)]">Leads Mandats</h1>
        <p className="mt-1 text-sm text-[var(--crm-text-dim)]">
          {leads.length} propriétaire{leads.length > 1 ? "s" : ""} entré
          {leads.length > 1 ? "s" : ""} par le funnel.
          {!canView ? " Coordonnées masquées pour votre rôle." : ""}
        </p>
      </header>

      <FilterBar quick={quick} sort={sort} search={search} counts={counts} />

      {visible.length === 0 ? (
        <EmptyState
          title={
            search || quick !== "tous"
              ? "Aucun lead ne correspond à ces critères."
              : "Aucun lead pour l’instant."
          }
          hint={
            search || quick !== "tous"
              ? "Ajustez la recherche ou les filtres rapides."
              : "Les nouvelles demandes du funnel apparaîtront ici après actualisation."
          }
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {visible.map((lead) => (
            <LeadRow key={lead.opportunityId} lead={lead} canViewDetails={canView} />
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <nav className="flex items-center justify-center gap-2" aria-label="Pagination">
          {current > 1 ? (
            <Link href={pageHref(current - 1)} className="crm-btn crm-btn--sm">
              ← Précédent
            </Link>
          ) : null}
          <span className="text-xs text-[var(--crm-text-faint)]">
            Page {current} / {totalPages}
          </span>
          {current < totalPages ? (
            <Link href={pageHref(current + 1)} className="crm-btn crm-btn--sm">
              Suivant →
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
