import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { requireCrmSession } from "@/modules/crm/auth/session";
import { listProperties, type PropertyPortfolioItem } from "@/modules/properties/factory/queries";
import {
  productionKindLabels,
  propertyStatusLabels,
  propertyStatusVisual,
} from "@/modules/properties/factory/labels";
import { formatDate } from "@/modules/crm/format";
import { cssVarRef } from "@/modules/crm/status-visuals";
import { EmptyState, SectionTitle } from "@/components/crm/ui";
import type { PropertyStatus } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Fabrique de biens" };

/** Nom d'affichage d'un bien : nom de projet sinon type + ville. */
function propertyDisplayName(p: PropertyPortfolioItem["property"]): string {
  if (p.project_name && p.project_name.trim()) return p.project_name;
  const type = p.property_type?.trim();
  const city = p.location_city?.trim();
  if (type || city) return [type, city].filter(Boolean).join(" · ");
  return "Bien sans nom";
}

interface Filters {
  q: string;
  status: string;
  avancement: string;
  responsable: string;
}

function matches(item: PropertyPortfolioItem, f: Filters): boolean {
  const p = item.property;
  if (f.status && p.status !== f.status) return false;
  if (f.responsable === "sans" && p.responsible_user_id) return false;
  if (f.responsable && f.responsable !== "sans" && item.responsibleName !== f.responsable) {
    return false;
  }
  if (f.avancement === "bloque" && item.blockedCount === 0) return false;
  if (f.avancement === "pret" && !item.readiness?.ready) return false;
  if (f.avancement === "en_cours" && (item.readiness?.ready || item.readiness?.percent === 0)) {
    return false;
  }
  if (f.q) {
    const hay = [
      p.project_name,
      p.commercial_title,
      p.property_type,
      p.location_city,
      p.location_postal_code,
      item.responsibleName,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!hay.includes(f.q.toLowerCase())) return false;
  }
  return true;
}

export default async function PropertiesPortfolioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireCrmSession("/crm/biens");
  const sp = await searchParams;
  const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] ?? "" : v ?? "");
  const filters: Filters = {
    q: str(sp.q).trim(),
    status: str(sp.status),
    avancement: str(sp.avancement),
    responsable: str(sp.responsable),
  };

  const all = await listProperties();
  const items = all.filter((it) => matches(it, filters));

  const responsables = Array.from(
    new Set(all.map((it) => it.responsibleName).filter(Boolean) as string[]),
  ).sort();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <SectionTitle eyebrow="Fabrique de biens" title="Portefeuille des biens" />

      {all.length === 0 ? (
        <EmptyState
          icon="◆"
          title="Aucun bien pour le moment"
          hint="Les biens apparaissent ici automatiquement dès qu’un mandat signé est transformé en bien depuis son dossier."
        />
      ) : (
        <>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="crm-label">Rechercher</span>
              <input
                name="q"
                type="search"
                defaultValue={filters.q}
                placeholder="Nom, type, ville, responsable…"
                className="crm-input"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="crm-label">Statut</span>
              <select name="status" defaultValue={filters.status} className="crm-select">
                <option value="">Tous</option>
                {Object.entries(propertyStatusLabels).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="crm-label">Avancement</span>
              <select name="avancement" defaultValue={filters.avancement} className="crm-select">
                <option value="">Tous</option>
                <option value="en_cours">En préparation</option>
                <option value="pret">Prêt à lancer</option>
                <option value="bloque">Avec blocage</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="crm-label">Responsable</span>
              <select name="responsable" defaultValue={filters.responsable} className="crm-select">
                <option value="">Tous</option>
                <option value="sans">Sans responsable</option>
                {responsables.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="crm-btn crm-btn--sm">
              Filtrer
            </button>
            <Link href="/crm/biens" className="crm-btn crm-btn--sm crm-btn--ghost">
              Réinitialiser
            </Link>
          </form>

          <p className="text-xs text-[var(--crm-text-dim)]">
            {items.length} bien{items.length > 1 ? "s" : ""} sur {all.length}.
          </p>

          {items.length === 0 ? (
            <EmptyState
              icon="◇"
              title="Aucun bien ne correspond"
              hint="Ajustez la recherche ou les filtres."
            />
          ) : (
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <PropertyCard key={item.property.id} item={item} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function PropertyCard({ item }: { item: PropertyPortfolioItem }) {
  const { property: p, readiness } = item;
  const visual = propertyStatusVisual[p.status as PropertyStatus];
  const percent = readiness?.percent ?? 0;

  return (
    <li className="crm-panel flex min-w-0 flex-col gap-3 p-4 crm-fade-in">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/crm/biens/${p.id}`}
            className="crm-wrap text-base font-semibold text-[var(--crm-text)] hover:text-[var(--crm-gold)]"
          >
            {propertyDisplayName(p)}
          </Link>
          <p className="crm-wrap text-xs text-[var(--crm-text-faint)]">
            {[p.property_type, p.location_city].filter(Boolean).join(" · ") || "Type et lieu à renseigner"}
          </p>
        </div>
        <span
          className="crm-chip crm-chip--accent shrink-0"
          style={{ ["--chip-accent" as keyof CSSProperties]: cssVarRef(visual.cssVar) } as CSSProperties}
        >
          <span aria-hidden>{visual.icon}</span>
          {propertyStatusLabels[p.status as PropertyStatus]}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-[var(--crm-text-dim)]">Préparation</span>
          <span className="tabular-nums font-medium text-[var(--crm-text)]">
            {readiness ? `${readiness.done}/${readiness.total}` : "—"} · {percent}%
          </span>
        </div>
        <div className="crm-meter" role="meter" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${percent}%` }} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--crm-text-faint)]">
        <span>Responsable : {item.responsibleName ?? "non désigné"}</span>
      </div>

      {item.blockedCount > 0 ? (
        <p className="text-[11px] text-[var(--crm-danger)]">
          ⚠ {item.blockedCount} blocage{item.blockedCount > 1 ? "s" : ""} en production
        </p>
      ) : item.nextAction ? (
        <p className="crm-wrap text-[11px] text-[var(--crm-text-dim)]">
          Prochaine action : {productionKindLabels[item.nextAction.kind as never] ?? item.nextAction.kind}
          {item.nextAction.dueAt ? ` · ${formatDate(item.nextAction.dueAt)}` : ""}
        </p>
      ) : readiness?.ready ? (
        <p className="text-[11px] crm-aging--frais">✔ Prêt à lancer</p>
      ) : null}

      <Link href={`/crm/biens/${p.id}`} className="crm-btn crm-btn--sm crm-btn--ghost mt-auto self-start">
        Ouvrir le cockpit
      </Link>
    </li>
  );
}
