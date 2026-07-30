import { redirect } from "next/navigation";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasCrmAccess, type CrmRole } from "./roles";

/**
 * Session CRM résolue **côté serveur**. Contient l'utilisateur authentifié et
 * ses rôles actifs (lus en base via `crm_active_roles`, jamais depuis le client).
 */
export interface CrmSession {
  userId: string;
  email: string | null;
  roles: string[];
}

/**
 * Récupère la session courante, ou `null` si non authentifié. `getUser()`
 * revalide le jeton auprès du serveur Auth (ne fait pas confiance au cookie
 * seul). `cache()` évite les allers-retours multiples dans un même rendu.
 */
export const getCrmSession = cache(async (): Promise<CrmSession | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Rôles actifs de l'utilisateur (fonction SECURITY DEFINER, sûre).
  const { data } = await supabase.rpc("crm_active_roles");
  const roles = Array.isArray(data) ? (data as string[]) : [];

  return { userId: user.id, email: user.email ?? null, roles };
});

/**
 * Exige une session CRM autorisée (utilisateur authentifié **et** disposant d'un
 * membership actif). Redirige sinon :
 *  - non authentifié → `/connexion` ;
 *  - authentifié mais sans rôle/organisation → `/connexion?error=acces`.
 *
 * L'autorisation est donc vérifiée côté serveur à chaque rendu de page CRM.
 */
export async function requireCrmSession(
  redirectTo = "/crm",
): Promise<CrmSession> {
  const session = await getCrmSession();
  if (!session) {
    redirect(`/connexion?redirect=${encodeURIComponent(redirectTo)}`);
  }
  if (!hasCrmAccess(session.roles)) {
    redirect("/connexion?error=acces");
  }
  return session;
}

/** Exige un rôle précis (sinon redirige vers le tableau de bord). */
export async function requireCrmRole(
  required: readonly CrmRole[],
  redirectTo = "/crm",
): Promise<CrmSession> {
  const session = await requireCrmSession(redirectTo);
  const ok = session.roles.some((r) =>
    (required as readonly string[]).includes(r),
  );
  if (!ok) redirect("/crm");
  return session;
}
