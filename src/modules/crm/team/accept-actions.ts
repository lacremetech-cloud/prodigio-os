"use server";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/config";

/**
 * Actions serveur du parcours d'ACCEPTATION d'invitation. Contrairement aux
 * actions d'administration, elles n'exigent PAS de membership existante : la
 * personne invitée est authentifiée (session Supabase issue du lien d'invitation)
 * mais n'a pas encore rejoint l'organisation. Le rôle n'est JAMAIS transmis par
 * le client : `crm_accept_invitation` le lit sur l'invitation posée par un
 * administrateur (auto-attribution / auto-élévation impossibles). L'e-mail
 * authentifié doit correspondre à l'invitation (vérifié en base).
 */

export interface AcceptResult {
  ok: boolean;
  error?: string;
  /** Code métier pour un rendu d'écran adapté (expiree / revoquee / aucune…). */
  reason?: string;
}

function mapAcceptError(code: string | undefined, message: string): AcceptResult {
  if (code === "28000") {
    return { ok: false, error: "Session expirée. Rouvrez le lien d'invitation.", reason: "session" };
  }
  if (code === "22023") {
    const m = message.toLowerCase();
    const reason = m.includes("expir")
      ? "expiree"
      : m.includes("révoqu") || m.includes("revoqu")
        ? "revoquee"
        : "aucune";
    return { ok: false, error: message, reason };
  }
  return { ok: false, error: message || "Une erreur est survenue.", reason: "erreur" };
}

export async function acceptInvitationAction(): Promise<AcceptResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Authentification indisponible sur cet environnement.", reason: "config" };
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Session expirée. Rouvrez le lien d'invitation.", reason: "session" };
  }

  const { error } = await supabase.rpc("crm_accept_invitation");
  if (error) {
    return mapAcceptError(error.code, error.message);
  }
  return { ok: true };
}

const passwordSchema = z
  .string()
  .min(8, "Le mot de passe doit contenir au moins 8 caractères.")
  .max(200, "Mot de passe trop long.");

export async function setInvitationPasswordAction(
  password: string,
): Promise<AcceptResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Authentification indisponible sur cet environnement.", reason: "config" };
  }
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Mot de passe invalide." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Session expirée. Rouvrez le lien d'invitation.", reason: "session" };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) {
    return { ok: false, error: "Impossible de définir le mot de passe. Réessayez." };
  }
  return { ok: true };
}
