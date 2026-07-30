import type { Metadata } from "next";
import Link from "next/link";
import { requireCrmRole } from "@/modules/crm/auth/session";
import { getTeamData } from "@/modules/crm/team/queries";
import { buildTeamEntries, computeCounters } from "@/modules/crm/team/status";
import { formatDate } from "@/modules/crm/format";
import { isSupabaseAdminConfigured } from "@/config";
import { TeamManager } from "@/components/crm/team/team-manager";

export const metadata: Metadata = { title: "Équipe & accès" };

/**
 * Écran de gestion des utilisateurs (`/crm/parametres/equipe`). Réservé aux
 * **administrateurs** : `requireCrmRole` redirige tout autre rôle vers `/crm`.
 * La lecture (memberships + invitations) passe par des fonctions SECURITY
 * DEFINER qui re-vérifient le rôle en base (défense en profondeur).
 */
export default async function TeamPage() {
  const session = await requireCrmRole(["administrateur"], "/crm/parametres/equipe");
  const { members, invitations } = await getTeamData();

  const entries = buildTeamEntries(members, invitations, session.userId, formatDate);
  const counters = computeCounters(members, invitations);
  const adminConfigured = isSupabaseAdminConfigured();

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4">
        <Link
          href="/crm/parametres"
          className="text-sm text-[var(--crm-text-dim)] underline-offset-4 hover:text-[var(--crm-text)] hover:underline"
        >
          ← Paramètres
        </Link>
      </div>
      <TeamManager entries={entries} counters={counters} adminConfigured={adminConfigured} />
    </div>
  );
}
