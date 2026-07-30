import { describe, expect, it } from "vitest";
import type { InvitationListRow, TeamMemberRow } from "@/lib/supabase/types";
import {
  buildTeamEntries,
  computeCounters,
  hasActiveInvitation,
  invitationDisplayName,
  invitationStatus,
  memberStatus,
  normalizeEmail,
} from "./status";

function member(overrides: Partial<TeamMemberRow>): TeamMemberRow {
  return {
    user_id: "u-1",
    email: "membre@prodigio.fr",
    role: "setter",
    status: "actif",
    organization_id: "org-1",
    member_since: "2026-07-01T10:00:00Z",
    last_sign_in_at: null,
    ...overrides,
  };
}

function invitation(overrides: Partial<InvitationListRow>): InvitationListRow {
  return {
    id: "i-1",
    email: "invite@prodigio.fr",
    first_name: null,
    last_name: null,
    role: "setter",
    status: "en_attente",
    organization_id: "org-1",
    created_at: "2026-07-10T10:00:00Z",
    expires_at: "2026-07-24T10:00:00Z",
    sent_at: "2026-07-10T10:00:05Z",
    accepted_at: null,
    revoked_at: null,
    invited_by: "u-1",
    ...overrides,
  };
}

const fmt = (iso: string | null | undefined) => iso ?? "—";

describe("normalizeEmail", () => {
  it("met en minuscule et retire les espaces", () => {
    expect(normalizeEmail("  Alice@Prodigio.FR ")).toBe("alice@prodigio.fr");
    expect(normalizeEmail(null)).toBe("");
  });
});

describe("statuts", () => {
  it("statut d'un membre (actif / désactivé)", () => {
    expect(memberStatus(member({ status: "actif" }))).toBe("actif");
    expect(memberStatus(member({ status: "suspendu" }))).toBe("acces_desactive");
  });

  it("statut d'une invitation (envoyée / à envoyer / expirée / révoquée)", () => {
    expect(invitationStatus(invitation({ status: "en_attente", sent_at: "x" }))).toBe(
      "invitation_envoyee",
    );
    expect(invitationStatus(invitation({ status: "en_attente", sent_at: null }))).toBe(
      "invitation_a_envoyer",
    );
    expect(invitationStatus(invitation({ status: "expiree" }))).toBe("invitation_expiree");
    expect(invitationStatus(invitation({ status: "revoquee" }))).toBe("invitation_revoquee");
    expect(invitationStatus(invitation({ status: "acceptee" }))).toBe("actif");
  });
});

describe("compteurs d'en-tête", () => {
  it("compte membres actifs, désactivés et invitations en attente", () => {
    const members = [
      member({ user_id: "a", status: "actif" }),
      member({ user_id: "b", status: "actif" }),
      member({ user_id: "c", status: "suspendu" }),
    ];
    const invitations = [
      invitation({ id: "i1", status: "en_attente" }),
      invitation({ id: "i2", status: "expiree" }), // toujours « en attente » d'action
      invitation({ id: "i3", status: "revoquee" }),
      invitation({ id: "i4", status: "acceptee" }),
    ];
    expect(computeCounters(members, invitations)).toEqual({
      activeMembers: 2,
      disabledMembers: 1,
      pendingInvitations: 2,
    });
  });
});

describe("hasActiveInvitation", () => {
  it("détecte une invitation active pour un e-mail (insensible à la casse)", () => {
    const invitations = [invitation({ email: "Deja@prodigio.fr", status: "en_attente" })];
    expect(hasActiveInvitation("deja@prodigio.fr", invitations)).toBe(true);
    expect(hasActiveInvitation("autre@prodigio.fr", invitations)).toBe(false);
  });
});

describe("invitationDisplayName", () => {
  it("prénom + nom, sinon partie locale de l'e-mail", () => {
    expect(
      invitationDisplayName(invitation({ first_name: "Alice", last_name: "Martin" })),
    ).toBe("Alice Martin");
    expect(
      invitationDisplayName(invitation({ first_name: null, last_name: null, email: "bob@x.fr" })),
    ).toBe("bob");
  });
});

describe("buildTeamEntries", () => {
  it("fusionne membres + invitations, exclut les acceptées, trie", () => {
    const members = [
      member({ user_id: "admin", role: "administrateur", status: "actif" }),
      member({ user_id: "off", role: "setter", status: "suspendu" }),
    ];
    const invitations = [
      invitation({ id: "pending", status: "en_attente", sent_at: "x" }),
      invitation({ id: "revoked", status: "revoquee" }),
      invitation({ id: "accepted", status: "acceptee" }),
    ];

    const entries = buildTeamEntries(members, invitations, "admin", fmt);
    const ids = entries.map((e) => (e.kind === "member" ? e.userId : e.id));

    // L'invitation acceptée n'apparaît pas (elle est déjà un membre).
    expect(ids).not.toContain("accepted");
    // Ordre : membre actif, invitation en attente, invitation révoquée, membre désactivé.
    expect(ids).toEqual(["admin", "pending", "revoked", "off"]);

    const self = entries.find((e) => e.kind === "member" && e.userId === "admin");
    expect(self && self.kind === "member" && self.isSelf).toBe(true);
  });
});
