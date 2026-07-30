/**
 * Logique **pure** de l'écran « Équipe & accès » (aucune dépendance serveur, donc
 * testable). Statuts lisibles, compteurs, normalisation d'e-mail et règles
 * d'action sur les invitations. Les décisions de sécurité restent prises **en
 * base** (fonctions SECURITY DEFINER) ; ici uniquement la présentation.
 */

import type {
  CrmRoleToken,
  InvitationListRow,
  TeamMemberRow,
} from "@/lib/supabase/types";

/** Normalise un e-mail comme la base (minuscule + trim). */
export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

/** Statut visuel unifié d'une entrée d'équipe. */
export type TeamStatus =
  | "actif"
  | "invitation_envoyee"
  | "invitation_a_envoyer"
  | "invitation_expiree"
  | "invitation_revoquee"
  | "acces_desactive";

export const teamStatusLabels: Record<TeamStatus, string> = {
  actif: "Actif",
  invitation_envoyee: "Invitation envoyée",
  invitation_a_envoyer: "Invitation à envoyer",
  invitation_expiree: "Invitation expirée",
  invitation_revoquee: "Invitation révoquée",
  acces_desactive: "Accès désactivé",
};

export type StatusVariant = "ok" | "gold" | "neutral" | "danger";

export const teamStatusVariant: Record<TeamStatus, StatusVariant> = {
  actif: "ok",
  invitation_envoyee: "gold",
  invitation_a_envoyer: "neutral",
  invitation_expiree: "neutral",
  invitation_revoquee: "danger",
  acces_desactive: "danger",
};

/** Statut d'une membership (membre déjà présent en base). */
export function memberStatus(row: Pick<TeamMemberRow, "status">): TeamStatus {
  return row.status === "actif" ? "actif" : "acces_desactive";
}

/**
 * Statut d'une invitation. `crm_list_invitations` renvoie déjà le statut effectif
 * (`expiree` dérivé). Une invitation `en_attente` non encore envoyée (secret Admin
 * absent) est distinguée pour ne jamais prétendre qu'un e-mail a été expédié.
 */
export function invitationStatus(
  row: Pick<InvitationListRow, "status" | "sent_at">,
): TeamStatus {
  switch (row.status) {
    case "revoquee":
      return "invitation_revoquee";
    case "expiree":
      return "invitation_expiree";
    case "acceptee":
      return "actif";
    case "en_attente":
    default:
      return row.sent_at ? "invitation_envoyee" : "invitation_a_envoyer";
  }
}

/** Une invitation est « active » (renvoyable / révocable) tant qu'en attente. */
export function isPendingInvitation(
  row: Pick<InvitationListRow, "status">,
): boolean {
  return row.status === "en_attente" || row.status === "expiree";
}

export interface TeamCounters {
  activeMembers: number;
  pendingInvitations: number;
  disabledMembers: number;
}

/** Compteurs d'en-tête à partir des lignes brutes (membres + invitations). */
export function computeCounters(
  members: Pick<TeamMemberRow, "status">[],
  invitations: Pick<InvitationListRow, "status">[],
): TeamCounters {
  return {
    activeMembers: members.filter((m) => m.status === "actif").length,
    disabledMembers: members.filter((m) => m.status === "suspendu").length,
    pendingInvitations: invitations.filter(isPendingInvitation).length,
  };
}

/** Nom affichable d'un membre (e-mail → partie locale) ou repli court. */
export function memberDisplayName(email: string | null, userId: string): string {
  if (email) return email.split("@")[0] || email;
  return `Membre ${userId.slice(0, 6)}`;
}

/** Nom affichable d'une invitation (prénom + nom, sinon partie locale). */
export function invitationDisplayName(
  row: Pick<InvitationListRow, "first_name" | "last_name" | "email">,
): string {
  const full = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
  if (full.length > 0) return full;
  return row.email.split("@")[0] || row.email;
}

/**
 * Un e-mail correspond-il à une invitation active ? Utilisé pour éviter de
 * proposer une invitation en double côté UI (la base reste la garde de vérité).
 */
export function hasActiveInvitation(
  email: string,
  invitations: Pick<InvitationListRow, "email" | "status">[],
): boolean {
  const target = normalizeEmail(email);
  return invitations.some(
    (i) => normalizeEmail(i.email) === target && i.status === "en_attente",
  );
}

/** Ordre d'affichage des rôles. */
export const ROLE_SORT_ORDER: CrmRoleToken[] = [
  "administrateur",
  "manager",
  "setter",
  "agent_immobilier",
  "partenaire_lecture",
];

// --- Vues (partagées serveur ↔ client, sérialisables) ------------------------

export interface MemberView {
  kind: "member";
  userId: string;
  name: string;
  email: string;
  roleToken: CrmRoleToken;
  status: TeamStatus;
  rawStatus: "actif" | "suspendu";
  dateLabel: string;
  isSelf: boolean;
}

export interface InvitationView {
  kind: "invitation";
  id: string;
  name: string;
  email: string;
  roleToken: CrmRoleToken;
  status: TeamStatus;
  dateLabel: string;
  pending: boolean;
}

export type TeamEntry = MemberView | InvitationView;

/**
 * Construit les lignes d'affichage (membres + invitations non acceptées),
 * triées : membres actifs, puis invitations en attente, puis expirées/révoquées,
 * puis accès désactivés. `formatDate` est injecté pour rester pur/testable.
 */
export function buildTeamEntries(
  members: TeamMemberRow[],
  invitations: InvitationListRow[],
  currentUserId: string,
  formatDate: (iso: string | null | undefined) => string,
): TeamEntry[] {
  const memberViews: MemberView[] = members.map((m) => ({
    kind: "member",
    userId: m.user_id,
    name: memberDisplayName(m.email, m.user_id),
    email: m.email ?? "—",
    roleToken: m.role,
    status: memberStatus(m),
    rawStatus: m.status,
    dateLabel: formatDate(m.member_since),
    isSelf: m.user_id === currentUserId,
  }));

  // Les invitations ACCEPTÉES apparaissent déjà comme membres → on les exclut.
  const invitationViews: InvitationView[] = invitations
    .filter((i) => i.status !== "acceptee")
    .map((i) => ({
      kind: "invitation",
      id: i.id,
      name: invitationDisplayName(i),
      email: i.email,
      roleToken: i.role,
      status: invitationStatus(i),
      dateLabel: formatDate(i.created_at),
      pending: isPendingInvitation(i),
    }));

  const rank = (e: TeamEntry): number => {
    if (e.kind === "member") return e.rawStatus === "actif" ? 0 : 4;
    if (e.status === "invitation_envoyee" || e.status === "invitation_a_envoyer") return 1;
    if (e.status === "invitation_expiree") return 2;
    return 3; // révoquée
  };

  return [...memberViews, ...invitationViews].sort((a, b) => rank(a) - rank(b));
}
