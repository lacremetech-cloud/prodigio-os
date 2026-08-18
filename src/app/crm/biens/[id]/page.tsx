import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { requireCrmSession } from "@/modules/crm/auth/session";
import { canDecideMandate, canOperate, canViewContactDetails } from "@/modules/crm/auth/roles";
import {
  getPropertyCockpit,
  listAssignableMembers,
} from "@/modules/properties/factory/queries";
import { getPublicExperience, listBuyerInterests } from "@/modules/buyers/public/queries";
import { listBuyersForProperty } from "@/modules/buyers/crm/queries";
import {
  PublicConfigForm,
  PublicMediaManager,
  PublicationPanel,
} from "@/components/crm/property/public-experience";
import { BuyerInterestsPanel } from "@/components/crm/property/buyer-interests";
import { PropertyBuyersPanel } from "@/components/crm/buyers/property-buyers";
import { getMessagesForEntity } from "@/modules/communications/queries";
import { EntityCommunications } from "@/components/crm/communications/entity-communications";
import { buildPropertyTimeline } from "@/modules/properties/factory/timeline";
import { propertyStatusLabels, propertyStatusVisual } from "@/modules/properties/factory/labels";
import { createPropertyAssetSignedUrl } from "@/modules/properties/factory/storage";
import { isSupabaseAdminConfigured } from "@/config";
import { memberDisplayName } from "@/modules/crm/data/queries";
import { formatDate } from "@/modules/crm/format";
import { cssVarRef } from "@/modules/crm/status-visuals";
import { Timeline } from "@/components/crm/timeline";
import {
  IdentityForm,
  PositioningForm,
  ResponsibleControl,
  StatusReadinessPanel,
} from "@/components/crm/property/cockpit";
import { MediaManager } from "@/components/crm/property/media-manager";
import { DocumentsManager } from "@/components/crm/property/documents-manager";
import { ProductionPlan } from "@/components/crm/property/production-plan";
import type { PropertyStatus } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Cockpit du bien" };

function displayName(p: {
  project_name: string | null;
  property_type: string | null;
  location_city: string | null;
}): string {
  if (p.project_name?.trim()) return p.project_name;
  const parts = [p.property_type?.trim(), p.location_city?.trim()].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Bien sans nom";
}

export default async function PropertyCockpitPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const highlightInterest = Array.isArray(sp.interet) ? sp.interet[0] : sp.interet ?? null;
  const session = await requireCrmSession(`/crm/biens/${id}`);
  const cockpit = await getPropertyCockpit(id);
  if (!cockpit) notFound();

  const { property: p, positioning, media, documents, production, readiness, audit } = cockpit;

  const isAgent = session.roles.includes("agent_immobilier");
  const canEdit = canOperate(session.roles) || isAgent; // opérateur ou agent affecté (RLS déjà vérifiée)
  const canDecide = canDecideMandate(session.roles); // admin / manager
  const canAddDocuments = canDecide || isAgent;
  const canOperateRole = canOperate(session.roles);
  const canViewContacts = canViewContactDetails(session.roles);

  const [publicExperience, buyerInterests, propertyBuyers, communications] = await Promise.all([
    getPublicExperience(id),
    listBuyerInterests(id),
    // Même donnée, autre vue : les dossiers acquéreurs filtrés sur ce bien.
    listBuyersForProperty(id, canViewContacts),
    // Communications rattachées à ce bien (le rattachement existe : `property_id`).
    getMessagesForEntity("property", id, { canViewDetails: canViewContacts }),
  ]);
  const publicHref =
    publicExperience.config?.publication_status === "publie" && publicExperience.config?.slug
      ? `/bien/${publicExperience.config.slug}`
      : null;

  const members = canDecide || canEdit ? await listAssignableMembers() : [];
  const nameFor = (uid: string | null) => (uid ? memberDisplayName(uid, cockpit.members) : null);
  const timeline = buildPropertyTimeline(audit, nameFor);
  const visual = propertyStatusVisual[p.status as PropertyStatus];

  // Aperçu de l'image principale : URL signée COURTE (jamais stockée). Placeholder sinon.
  let heroUrl: string | null = null;
  if (p.main_media_id && isSupabaseAdminConfigured()) {
    const main = media.find((m) => m.id === p.main_media_id);
    if (main && (main.mime_type.startsWith("image/") || main.mime_type === "application/pdf")) {
      if (main.mime_type.startsWith("image/")) {
        heroUrl = await createPropertyAssetSignedUrl(main.storage_path, 300);
      }
    }
  }

  const location = [p.address_line, p.location_postal_code, p.location_city, p.location_country]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      {/* Fil d'Ariane */}
      <Link href="/crm/biens" className="text-xs text-[var(--crm-text-dim)] hover:text-[var(--crm-text)]">
        ← Portefeuille des biens
      </Link>

      {/* En-tête premium */}
      <header className="crm-panel relative overflow-hidden">
        <div
          aria-hidden
          className="h-32 w-full bg-cover bg-center sm:h-40"
          style={{
            backgroundImage: heroUrl
              ? `linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0.15)), url("${heroUrl}")`
              : "linear-gradient(135deg, var(--crm-panel-2), var(--crm-elevated))",
          }}
        />
        <div className="flex flex-col gap-3 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="crm-eyebrow">Cockpit de production</p>
              <h1 className="crm-wrap mt-1 text-2xl font-semibold text-[var(--crm-text)]">
                {displayName(p)}
              </h1>
              {p.commercial_title ? (
                <p className="crm-wrap text-sm text-[var(--crm-text-dim)]">{p.commercial_title}</p>
              ) : null}
              <p className="crm-wrap mt-1 text-xs text-[var(--crm-text-faint)]">
                {[p.property_type, p.location_city].filter(Boolean).join(" · ") ||
                  "Type et localisation à renseigner"}
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
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-[var(--crm-text-dim)]">
            <span>Responsable : {cockpit.responsibleName ?? "non désigné"}</span>
            <span>Créé le {formatDate(p.created_at)}</span>
            {p.ready_at ? <span className="crm-aging--frais">Prêt depuis le {formatDate(p.ready_at)}</span> : null}
            <span>Préparation : {readiness ? `${readiness.percent}%` : "—"}</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px]">
        {/* Colonne principale */}
        <div className="flex min-w-0 flex-col gap-5">
          <Section title="Identité du bien">
            <IdentityForm property={p} canEdit={canEdit} />
          </Section>

          <Section title="Positionnement & stratégie">
            <PositioningForm
              propertyId={p.id}
              positioning={positioning}
              canEdit={canEdit}
              canDecide={canDecide}
            />
          </Section>

          <Section
            title="Médiathèque privée"
            subtitle="Photos, vidéos, drone, plans et rendus. Accès par lien signé temporaire ; aucun fichier public."
          >
            <MediaManager
              propertyId={p.id}
              media={media}
              mainMediaId={p.main_media_id}
              canEdit={canEdit}
            />
          </Section>

          <Section
            title="Documents"
            subtitle="Mandat, diagnostics, plans, titre, légal, copropriété, autorisations. Stockage privé."
          >
            <DocumentsManager
              propertyId={p.id}
              documents={documents}
              canAdd={canAddDocuments}
              canDelete={canDecide}
            />
          </Section>

          <Section
            title="Plan de production"
            subtitle="Pilotage des livrables (photo, vidéo, rédaction, identité, site, brochure, publicités, funnel…)."
          >
            <ProductionPlan
              propertyId={p.id}
              items={production}
              members={members}
              canEdit={canEdit}
              canDecide={canDecide}
            />
          </Section>

          <Section
            title="Expérience publique"
            subtitle="Configurez la page publique dédiée à ce seul bien (contenus, sections, SEO, confidentialité). L’adresse exacte n’est jamais publique."
          >
            <PublicConfigForm
              config={publicExperience.config}
              propertyId={p.id}
              canEdit={canEdit}
              canDecide={canDecide}
            />
          </Section>

          <Section
            title="Médias publics"
            subtitle="Uniquement les visuels expressément approuvés pour la diffusion. Bucket public dédié, distinct du stockage privé de la Fabrique."
          >
            <PublicMediaManager
              propertyId={p.id}
              media={publicExperience.media}
              config={publicExperience.config}
              canEdit={canEdit}
            />
          </Section>

          <Section
            title="Dossiers acquéreurs"
            subtitle="Les acquéreurs intéressés par ce bien. Ouvrez un dossier pour le suivi complet."
            action={
              <Link href="/crm/acquereurs" className="crm-btn crm-btn--sm crm-btn--ghost">
                Tous les acquéreurs
              </Link>
            }
          >
            <PropertyBuyersPanel rows={propertyBuyers} />
          </Section>

          <Section
            title="Intérêts acquéreurs (soumissions)"
            subtitle="Les soumissions d'origine déposées sur la page publique, conservées telles quelles."
          >
            <BuyerInterestsPanel
              propertyId={p.id}
              summary={buyerInterests}
              canOperate={canOperateRole}
              canViewContacts={canViewContacts}
              highlightId={highlightInterest}
            />
          </Section>

          <Section
            title="Communications"
            subtitle="Messages adressés aux contacts au sujet de ce bien. Distincts des activités commerciales."
          >
            <EntityCommunications
              items={communications}
              emptyHint="Aucun message n'a encore été préparé au sujet de ce bien."
            />
          </Section>

          <Section title="Activité & historique">
            {timeline.length === 0 ? (
              <p className="text-xs text-[var(--crm-text-faint)]">Aucun événement pour le moment.</p>
            ) : (
              <Timeline entries={timeline} />
            )}
          </Section>
        </div>

        {/* Colonne latérale : préparation, statut, responsable, dossier */}
        <aside className="flex min-w-0 flex-col gap-5">
          <Section title="Préparation au lancement">
            <StatusReadinessPanel
              propertyId={p.id}
              status={p.status as PropertyStatus}
              readiness={readiness}
              canDecide={canDecide}
              canEdit={canEdit}
            />
          </Section>

          <Section title="Publication">
            <PublicationPanel
              propertyId={p.id}
              config={publicExperience.config}
              readiness={publicExperience.readiness}
              canDecide={canDecide}
              canEdit={canEdit}
              previewHref={`/apercu-bien/${p.id}`}
              publicHref={publicHref}
            />
          </Section>

          <Section title="Responsable">
            <ResponsibleControl
              propertyId={p.id}
              currentUserId={p.responsible_user_id}
              currentName={cockpit.responsibleName}
              members={members}
              canDecide={canDecide}
            />
          </Section>

          <Section title="Dossier d’origine">
            <div className="flex flex-col gap-2 text-sm text-[var(--crm-text-dim)]">
              {location ? (
                <p className="crm-wrap">
                  <span className="crm-label">Adresse</span>
                  <br />
                  {location}
                </p>
              ) : null}
              {cockpit.holder ? (
                <p>
                  <span className="crm-label">Agence porteuse</span>
                  <br />
                  {cockpit.holder.name}
                </p>
              ) : null}
              {cockpit.mandate?.mandate_number ? (
                <p>
                  <span className="crm-label">N° de mandat</span>
                  <br />
                  {cockpit.mandate.mandate_number}
                  {cockpit.mandate.signed_at ? ` · signé le ${formatDate(cockpit.mandate.signed_at)}` : ""}
                </p>
              ) : null}
              <Link href={`/crm/mandats/${p.opportunity_id}`} className="crm-btn crm-btn--sm mt-1 self-start">
                Ouvrir le dossier (mandat)
              </Link>
            </div>
          </Section>

          <p className="crm-wrap px-1 text-[11px] text-[var(--crm-text-faint)]">
            Hors périmètre V1 : CRM acquéreurs, portail propriétaire, campagnes Meta réelles,
            publication automatique du site et génération complète de brochure. Le cockpit prépare le
            bien jusqu’à sa mise sur le marché.
          </p>
        </aside>
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  /** Action optionnelle alignée à droite du titre (lien, bouton). */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="crm-panel p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--crm-text-dim)]">
            {title}
          </h2>
          {subtitle ? (
            <p className="crm-wrap mt-1 text-xs text-[var(--crm-text-faint)]">{subtitle}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
