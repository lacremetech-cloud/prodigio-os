import "server-only";

/**
 * Couche de LECTURE de la Fabrique de biens. Toutes les requêtes passent par le
 * client serveur (JWT utilisateur) : la RLS applique les permissions (opérateur =
 * tout ; agent = ses biens affectés via l'opportunité d'origine). Aucune donnée
 * confidentielle n'est exposée au-delà de ce que la RLS autorise. La readiness
 * est TOUJOURS calculée en base (`crm_property_readiness`), jamais réimplémentée
 * ici.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMembersMap, memberDisplayName, type MemberInfo } from "@/modules/crm/data/queries";
import type {
  AuditEventRow,
  MandateRow,
  OpportunityRow,
  OrganizationRow,
  PropertyDocumentRow,
  PropertyMediaRow,
  PropertyPositioningRow,
  PropertyProductionItemRow,
  PropertyReadiness,
  PropertyRow,
} from "@/lib/supabase/types";

/** Vue « portfolio » d'un bien : bien + repères d'avancement + prochaine action. */
export interface PropertyPortfolioItem {
  property: PropertyRow;
  mainMedia: PropertyMediaRow | null;
  readiness: PropertyReadiness | null;
  responsibleName: string | null;
  nextAction: { kind: string; dueAt: string | null } | null;
  blockedCount: number;
}

function toReadiness(data: unknown): PropertyReadiness | null {
  if (!data || typeof data !== "object") return null;
  const r = data as Record<string, unknown>;
  if (typeof r.ready !== "boolean") return null;
  return data as PropertyReadiness;
}

/** Liste des biens accessibles (portfolio). Volumétrie faible en V1. */
export async function listProperties(): Promise<PropertyPortfolioItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("properties")
    .select("*")
    .order("created_at", { ascending: false });
  const properties = Array.isArray(data) ? (data as PropertyRow[]) : [];
  if (properties.length === 0) return [];

  const members = await getMembersMap();
  const mediaIds = properties.map((p) => p.main_media_id).filter(Boolean) as string[];
  const propertyIds = properties.map((p) => p.id);

  const [{ data: mediaRows }, { data: productionRows }] = await Promise.all([
    mediaIds.length
      ? supabase.from("property_media").select("*").in("id", mediaIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from("property_production_items")
      .select("*")
      .in("property_id", propertyIds)
      .order("due_at", { ascending: true }),
  ]);
  const mediaById = new Map(
    (Array.isArray(mediaRows) ? (mediaRows as PropertyMediaRow[]) : []).map((m) => [m.id, m]),
  );
  const production = Array.isArray(productionRows)
    ? (productionRows as PropertyProductionItemRow[])
    : [];

  // Readiness calculée en base, par bien (RPC). Faible volume : appels parallèles.
  const readinessList = await Promise.all(
    properties.map((p) =>
      supabase
        .rpc("crm_property_readiness", { p_property_id: p.id })
        .then(({ data: r }) => toReadiness(r)),
    ),
  );

  return properties.map((property, i) => {
    const items = production.filter((it) => it.property_id === property.id);
    const blockedCount = items.filter((it) => it.status === "bloque").length;
    // Prochaine action = 1er élément non terminé avec la due la plus proche.
    const pending = items
      .filter((it) => it.status !== "valide" && it.status !== "termine")
      .sort((a, b) => (a.due_at ?? "9999").localeCompare(b.due_at ?? "9999"));
    const next = pending[0] ?? null;
    return {
      property,
      mainMedia: property.main_media_id ? mediaById.get(property.main_media_id) ?? null : null,
      readiness: readinessList[i] ?? null,
      responsibleName: property.responsible_user_id
        ? memberDisplayName(property.responsible_user_id, members)
        : null,
      nextAction: next ? { kind: next.kind, dueAt: next.due_at } : null,
      blockedCount,
    };
  });
}

/** Agrégat complet du cockpit d'un bien. */
export interface PropertyCockpit {
  property: PropertyRow;
  positioning: PropertyPositioningRow | null;
  media: PropertyMediaRow[];
  documents: PropertyDocumentRow[];
  production: PropertyProductionItemRow[];
  readiness: PropertyReadiness | null;
  audit: AuditEventRow[];
  opportunity: OpportunityRow | null;
  mandate: MandateRow | null;
  holder: OrganizationRow | null;
  members: Map<string, MemberInfo>;
  responsibleName: string | null;
}

export async function getPropertyCockpit(id: string): Promise<PropertyCockpit | null> {
  const supabase = await createSupabaseServerClient();
  const { data: propertyData } = await supabase
    .from("properties")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  const property = (propertyData as PropertyRow | null) ?? null;
  if (!property) return null;

  const [
    { data: positioning },
    { data: media },
    { data: documents },
    { data: production },
    { data: readiness },
    { data: audit },
    { data: opportunity },
    { data: mandate },
    { data: holder },
    members,
  ] = await Promise.all([
    supabase.from("property_positioning").select("*").eq("property_id", id).maybeSingle(),
    supabase
      .from("property_media")
      .select("*")
      .eq("property_id", id)
      .eq("status", "actif")
      .order("created_at", { ascending: false }),
    supabase
      .from("property_documents")
      .select("*")
      .eq("property_id", id)
      .eq("status", "actif")
      .order("created_at", { ascending: false }),
    supabase
      .from("property_production_items")
      .select("*")
      .eq("property_id", id)
      .order("created_at", { ascending: true }),
    supabase.rpc("crm_property_readiness", { p_property_id: id }),
    supabase
      .from("audit_events")
      .select("*")
      .eq("entity_type", "property")
      .eq("entity_id", id)
      .order("created_at", { ascending: false })
      .limit(60),
    supabase.from("opportunities").select("*").eq("id", property.opportunity_id).maybeSingle(),
    supabase.from("mandates").select("*").eq("id", property.mandate_id).maybeSingle(),
    property.holder_organization_id
      ? supabase
          .from("organizations")
          .select("*")
          .eq("id", property.holder_organization_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    getMembersMap(),
  ]);

  return {
    property,
    positioning: (positioning as PropertyPositioningRow | null) ?? null,
    media: Array.isArray(media) ? (media as PropertyMediaRow[]) : [],
    documents: Array.isArray(documents) ? (documents as PropertyDocumentRow[]) : [],
    production: Array.isArray(production)
      ? (production as PropertyProductionItemRow[])
      : [],
    readiness: toReadiness(readiness),
    audit: Array.isArray(audit) ? (audit as AuditEventRow[]) : [],
    opportunity: (opportunity as OpportunityRow | null) ?? null,
    mandate: (mandate as MandateRow | null) ?? null,
    holder: (holder as OrganizationRow | null) ?? null,
    members,
    responsibleName: property.responsible_user_id
      ? memberDisplayName(property.responsible_user_id, members)
      : null,
  };
}

/** Membres opérateurs assignables comme responsable (pour le sélecteur). */
export interface AssignableMember {
  userId: string;
  name: string;
  role: string;
}
export async function listAssignableMembers(): Promise<AssignableMember[]> {
  const members = await getMembersMap();
  const out: AssignableMember[] = [];
  for (const [userId, info] of members) {
    out.push({
      userId,
      name: info.email ? info.email.split("@")[0] || info.email : `Membre ${userId.slice(0, 6)}`,
      role: info.role,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
