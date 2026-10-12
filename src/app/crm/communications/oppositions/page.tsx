import type { Metadata } from "next";
import { requireCrmSession } from "@/modules/crm/auth/session";
import { hasAnyRole } from "@/modules/crm/auth/roles";
import { getSuppressions } from "@/modules/communications/studio/queries";
import {
  SuppressionsView,
  type SuppressionRowView,
} from "@/components/crm/communications/studio/suppressions-view";

export const metadata: Metadata = { title: "Communications — Oppositions" };

/**
 * Registre des oppositions. La lecture suit la RLS existante ; la levée est
 * réservée à l'administrateur — la base la refuse pour tout autre rôle, quel que
 * soit ce que le navigateur envoie.
 */
export default async function SuppressionsPage() {
  const session = await requireCrmSession("/crm/communications/oppositions");
  const canRelease = hasAnyRole(session.roles, ["administrateur"]);

  const items = await getSuppressions({ includeReleased: true, limit: 200 });

  const rows: SuppressionRowView[] = items.map(({ row, contactName }) => ({
    id: row.id,
    contactName,
    channel: row.channel,
    scope: row.scope,
    reason: row.reason,
    source: row.source,
    provider: row.provider,
    notes: row.notes,
    createdAt: row.created_at,
    active: row.active,
    releasedAt: row.released_at,
    releasedReason: row.released_reason,
  }));

  return <SuppressionsView rows={rows} canRelease={canRelease} />;
}
