"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireCrmRole } from "../auth/session";
import { isAssignableRole } from "../auth/roles";
import { canonicalSiteUrl, isSupabaseAdminConfigured } from "@/config";

/**
 * Actions serveur de gestion des utilisateurs (équipe & accès). Réservées aux
 * administrateurs. Le contrôle d'autorisation **fait autorité en base** : chaque
 * fonction `crm_*` (SECURITY DEFINER) re-vérifie le rôle et écrit un AuditEvent.
 * Ici : garde de session (défense en profondeur), validation Zod, orchestration
 * de l'invitation native Supabase Auth (côté serveur uniquement) et invalidation
 * du cache.
 *
 * Le secret Supabase (`SUPABASE_SECRET_KEY`) n'est utilisé que via le client
 * ADMIN server-only : jamais renvoyé au client, jamais journalisé. Quand il est
 * absent, AUCUN appel Admin n'est tenté (l'invitation est enregistrée en base et
 * l'UI signale la configuration manquante — sans prétendre qu'un e-mail est parti).
 */

export interface TeamActionResult {
  ok: boolean;
  error?: string;
  /** Vrai si un e-mail d'invitation Supabase a réellement été envoyé. */
  emailSent?: boolean;
  /** Vrai si le secret serveur est absent (envoi désactivé proprement). */
  configMissing?: boolean;
}

const TEAM_PATH = "/crm/parametres/equipe";

function humanizeError(code: string | undefined, message: string): string {
  switch (code) {
    case "28000":
      return "Session expirée. Reconnectez-vous.";
    case "42501":
      return message || "Droits insuffisants pour cette action.";
    case "22023":
      return message || "Données invalides.";
    default:
      return message || "Une erreur est survenue. Réessayez.";
  }
}

const inviteSchema = z.object({
  email: z.string().trim().email("Adresse e-mail invalide.").max(320),
  firstName: z.string().trim().max(120).optional().default(""),
  lastName: z.string().trim().max(120).optional().default(""),
  role: z.string().refine(isAssignableRole, "Rôle non attribuable."),
});

/**
 * Envoie (best-effort) l'invitation native Supabase Auth pour une invitation déjà
 * enregistrée en base, puis marque l'envoi. Ne révèle jamais l'existence préalable
 * d'un compte : un compte déjà inscrit est traité de façon neutre (la personne
 * pourra accepter en se connectant). Renvoie l'état d'envoi pour l'UI.
 */
async function dispatchInvitationEmail(
  invitationId: string,
  email: string,
): Promise<{ emailSent: boolean; configMissing: boolean; error?: string }> {
  if (!isSupabaseAdminConfigured()) {
    return { emailSent: false, configMissing: true };
  }

  const admin = getSupabaseAdminClient();
  const redirectTo = `${canonicalSiteUrl()}/invitation/callback`;

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
  });

  // Compte déjà existant : neutre. La personne pourra accepter en se connectant.
  const existing =
    error != null &&
    (error.code === "email_exists" ||
      error.status === 422 ||
      /already.*registered|already been/i.test(error.message ?? ""));

  if (error && !existing) {
    // Erreur technique réelle (réservée aux administrateurs, message neutre).
    return {
      emailSent: false,
      configMissing: false,
      error:
        "L'invitation est enregistrée mais l'e-mail n'a pas pu être envoyé (service d'authentification indisponible).",
    };
  }

  // Marque l'envoi (best-effort) — n'échoue pas l'action si le marquage rate.
  const supabase = await createSupabaseServerClient();
  await supabase.rpc("crm_mark_invitation_sent", {
    p_invitation_id: invitationId,
    p_auth_user_id: data?.user?.id ?? null,
  });

  return { emailSent: true, configMissing: false };
}

export async function inviteMemberAction(input: {
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
}): Promise<TeamActionResult> {
  await requireCrmRole(["administrateur"], TEAM_PATH);

  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("crm_create_invitation", {
    p_email: parsed.data.email,
    p_first_name: parsed.data.firstName || null,
    p_last_name: parsed.data.lastName || null,
    p_role: parsed.data.role,
  });

  if (error) {
    return { ok: false, error: humanizeError(error.code, error.message) };
  }

  const invitationId =
    data && typeof data === "object" && "id" in data
      ? String((data as { id: string }).id)
      : null;

  let dispatch: { emailSent: boolean; configMissing: boolean; error?: string } = {
    emailSent: false,
    configMissing: !isSupabaseAdminConfigured(),
  };
  if (invitationId) {
    dispatch = await dispatchInvitationEmail(invitationId, parsed.data.email);
  }

  revalidatePath(TEAM_PATH);
  return {
    ok: true,
    emailSent: dispatch.emailSent,
    configMissing: dispatch.configMissing,
    error: dispatch.error,
  };
}

export async function resendInvitationAction(
  invitationId: string,
): Promise<TeamActionResult> {
  await requireCrmRole(["administrateur"], TEAM_PATH);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("crm_resend_invitation", {
    p_invitation_id: invitationId,
  });
  if (error) {
    return { ok: false, error: humanizeError(error.code, error.message) };
  }

  const email =
    data && typeof data === "object" && "email" in data
      ? String((data as { email: string }).email)
      : null;

  let dispatch: { emailSent: boolean; configMissing: boolean; error?: string } = {
    emailSent: false,
    configMissing: !isSupabaseAdminConfigured(),
  };
  if (email) {
    dispatch = await dispatchInvitationEmail(invitationId, email);
  }

  revalidatePath(TEAM_PATH);
  return {
    ok: true,
    emailSent: dispatch.emailSent,
    configMissing: dispatch.configMissing,
    error: dispatch.error,
  };
}

export async function revokeInvitationAction(
  invitationId: string,
): Promise<TeamActionResult> {
  await requireCrmRole(["administrateur"], TEAM_PATH);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_revoke_invitation", {
    p_invitation_id: invitationId,
  });
  if (error) {
    return { ok: false, error: humanizeError(error.code, error.message) };
  }
  revalidatePath(TEAM_PATH);
  return { ok: true };
}

export async function changeMemberRoleAction(
  userId: string,
  role: string,
): Promise<TeamActionResult> {
  await requireCrmRole(["administrateur"], TEAM_PATH);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_change_member_role", {
    p_user_id: userId,
    p_role: role,
  });
  if (error) {
    return { ok: false, error: humanizeError(error.code, error.message) };
  }
  revalidatePath(TEAM_PATH);
  return { ok: true };
}

export async function setMemberStatusAction(
  userId: string,
  status: string,
): Promise<TeamActionResult> {
  await requireCrmRole(["administrateur"], TEAM_PATH);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_set_member_status", {
    p_user_id: userId,
    p_status: status,
  });
  if (error) {
    return { ok: false, error: humanizeError(error.code, error.message) };
  }
  revalidatePath(TEAM_PATH);
  return { ok: true };
}
