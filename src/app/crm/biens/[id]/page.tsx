import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCrmSession } from "@/modules/crm/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPropertyById } from "@/modules/mandates/lifecycle/queries";
import { propertyStatusLabels } from "@/modules/mandates/lifecycle/labels";
import { propertyLabel } from "@/modules/crm/labels";
import { formatDateTime } from "@/modules/crm/format";
import { Chip } from "@/components/crm/ui";
import type { MandateRow, OpportunityRow, OrganizationRow } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Bien" };

export default async function PropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireCrmSession(`/crm/biens/${id}`);
  const property = await getPropertyById(id);
  if (!property) notFound();

  const supabase = await createSupabaseServerClient();
  const [{ data: opportunity }, { data: mandate }, { data: holder }] = await Promise.all([
    supabase.from("opportunities").select("*").eq("id", property.opportunity_id).maybeSingle(),
    supabase.from("mandates").select("*").eq("id", property.mandate_id).maybeSingle(),
    property.holder_organization_id
      ? supabase.from("organizations").select("*").eq("id", property.holder_organization_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const o = (opportunity as OpportunityRow | null) ?? null;
  const m = (mandate as MandateRow | null) ?? null;
  const h = (holder as OrganizationRow | null) ?? null;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Link
          href={`/crm/mandats/${property.opportunity_id}`}
          className="text-xs text-[var(--crm-text-dim)] hover:text-[var(--crm-text)]"
        >
          ← Retour au dossier
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="crm-eyebrow">Fabrique de biens</p>
            <h1 className="mt-1 text-2xl font-semibold text-[var(--crm-text)]">
              {o ? propertyLabel(o.property_type) ?? "Bien" : "Bien"}
              {o?.location_city ? ` · ${o.location_city}` : ""}
            </h1>
          </div>
          <Chip variant="ok">{propertyStatusLabels[property.status] ?? property.status}</Chip>
        </div>
      </div>

      <section className="crm-panel p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--crm-text-dim)]">
          Bien créé
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Info label="Statut" value={propertyStatusLabels[property.status] ?? property.status} />
          <Info label="Créé le" value={formatDateTime(property.created_at)} />
          <Info label="Organisation porteuse" value={h?.name ?? "—"} />
          <Info label="Type de bien" value={o ? propertyLabel(o.property_type) ?? "—" : "—"} />
          <Info
            label="Localisation"
            value={
              o?.location_city
                ? `${o.location_city}${o.location_postal_code ? ` (${o.location_postal_code})` : ""}`
                : "—"
            }
          />
          <Info label="Numéro de mandat" value={m?.mandate_number ?? "—"} />
        </div>
        <p className="mt-4 crm-wrap text-xs text-[var(--crm-text-faint)]">
          Socle canonique minimal : le bien conserve le lien vers l’opportunité et le mandat
          d’origine. La Fabrique de biens complète (tunnel acquéreurs, page de vente, brochure,
          publicités, portail propriétaire) est hors du périmètre de cette version.
        </p>
      </section>

      <section className="crm-panel flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--crm-text-dim)]">
            Dossier d’origine
          </h2>
          <p className="mt-1 text-sm text-[var(--crm-text-dim)]">
            Le mandat, les documents et l’historique restent rattachés à l’opportunité.
          </p>
        </div>
        <Link href={`/crm/mandats/${property.opportunity_id}`} className="crm-btn shrink-0">
          Ouvrir le dossier
        </Link>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="crm-label">{label}</span>
      <span className="crm-wrap text-sm text-[var(--crm-text)]">{value ?? "—"}</span>
    </div>
  );
}
