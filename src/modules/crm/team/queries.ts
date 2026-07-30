import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { InvitationListRow, TeamMemberRow } from "@/lib/supabase/types";

/**
 * Lecture des données de l'écran « Équipe & accès ». Réservé aux administrateurs :
 * les fonctions `crm_list_team` / `crm_list_invitations` (SECURITY DEFINER)
 * renvoient un ensemble **vide** si l'appelant n'est pas administrateur — la
 * page vérifie de son côté le rôle avant tout rendu (défense en profondeur).
 */
export interface TeamData {
  members: TeamMemberRow[];
  invitations: InvitationListRow[];
}

export async function getTeamData(): Promise<TeamData> {
  const supabase = await createSupabaseServerClient();
  const [{ data: members }, { data: invitations }] = await Promise.all([
    supabase.rpc("crm_list_team"),
    supabase.rpc("crm_list_invitations"),
  ]);

  return {
    members: (Array.isArray(members) ? members : []) as TeamMemberRow[],
    invitations: (Array.isArray(invitations)
      ? invitations
      : []) as InvitationListRow[],
  };
}
