import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMembersMap, memberDisplayName, type MemberInfo } from "@/modules/crm/data/queries";
import type {
  BuyerInterestRow,
  PropertyPublicConfigRow,
  PropertyPublicMediaRow,
  PropertyPublicSnapshotRow,
} from "@/lib/supabase/types";
import type { PublicPropertyContent } from "./snapshot";

/**
 * Couche de LECTURE de l'expérience publique & des intérêts acquéreurs. Toutes
 * les requêtes passent par le client serveur (JWT) : la RLS applique les
 * permissions (opérateur = tout ; agent = ses biens affectés). La readiness de
 * publication et la prévisualisation sont TOUJOURS calculées en base (jamais
 * réimplémentées ici).
 */

export interface PublicReadiness {
  ready: boolean;
  total: number;
  done: number;
  percent: number;
  checks: Record<string, boolean>;
}

function toPublicReadiness(data: unknown): PublicReadiness | null {
  if (!data || typeof data !== "object") return null;
  const r = data as Record<string, unknown>;
  if (typeof r.ready !== "boolean") return null;
  return data as PublicReadiness;
}

export interface PublicExperience {
  config: PropertyPublicConfigRow | null;
  media: PropertyPublicMediaRow[];
  readiness: PublicReadiness | null;
  preview: PublicPropertyContent | null;
  lastSnapshot: PropertyPublicSnapshotRow | null;
}

export async function getPublicExperience(propertyId: string): Promise<PublicExperience> {
  const supabase = await createSupabaseServerClient();
  const [{ data: config }, { data: media }, { data: readiness }, { data: preview }, { data: snap }] =
    await Promise.all([
      supabase.from("property_public_config").select("*").eq("property_id", propertyId).maybeSingle(),
      supabase
        .from("property_public_media")
        .select("*")
        .eq("property_id", propertyId)
        .eq("status", "actif")
        .order("sort_order", { ascending: true }),
      supabase.rpc("crm_property_public_readiness", { p_property_id: propertyId }),
      supabase.rpc("crm_property_public_preview", { p_property_id: propertyId }),
      supabase
        .from("property_public_snapshots")
        .select("*")
        .eq("property_id", propertyId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  return {
    config: (config as PropertyPublicConfigRow | null) ?? null,
    media: Array.isArray(media) ? (media as PropertyPublicMediaRow[]) : [],
    readiness: toPublicReadiness(readiness),
    preview: (preview as PublicPropertyContent | null) ?? null,
    lastSnapshot: (snap as PropertyPublicSnapshotRow | null) ?? null,
  };
}

// --- Intérêts acquéreurs (réception opérationnelle minimale) -----------------
export interface BuyerInterestView {
  interest: BuyerInterestRow;
  contactName: string;
  reviewerName: string | null;
}

export interface BuyerInterestsSummary {
  items: BuyerInterestView[];
  total: number;
  nouveaux: number;
  prioritaires: number;
}

function buyerName(row: BuyerInterestRow): string {
  const parts = [row.contact_first_name, row.contact_last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : "Acquéreur";
}

export async function listBuyerInterests(propertyId: string): Promise<BuyerInterestsSummary> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("buyer_interests")
    .select("*")
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false });
  const rows = Array.isArray(data) ? (data as BuyerInterestRow[]) : [];

  let members: Map<string, MemberInfo> = new Map();
  if (rows.some((r) => r.reviewed_by)) {
    members = await getMembersMap();
  }

  const items: BuyerInterestView[] = rows.map((interest) => ({
    interest,
    contactName: buyerName(interest),
    reviewerName: interest.reviewed_by
      ? memberDisplayName(interest.reviewed_by, members)
      : null,
  }));

  return {
    items,
    total: rows.length,
    nouveaux: rows.filter((r) => r.review_status === "nouveau").length,
    prioritaires: rows.filter((r) => r.priority === "prioritaire").length,
  };
}
