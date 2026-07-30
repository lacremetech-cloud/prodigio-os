"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/config";

/**
 * Actions serveur d'authentification interne (Supabase Auth, e-mail + mot de
 * passe). Aucune clé service_role : la session repose sur le JWT utilisateur,
 * et les permissions réelles restent appliquées par la RLS PostgreSQL.
 */

const signInSchema = z.object({
  email: z.string().trim().email("Adresse e-mail invalide.").max(320),
  password: z.string().min(1, "Mot de passe requis.").max(200),
  redirectTo: z.string().max(512).optional(),
});

export interface SignInState {
  ok: boolean;
  error?: string;
}

/** Chemin de redirection sûr : uniquement interne au CRM. */
function safeRedirect(target: string | undefined): string {
  if (target && target.startsWith("/crm")) return target;
  return "/crm";
}

export async function signInAction(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    redirectTo: formData.get("redirectTo") ?? undefined,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }

  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      error: "Authentification indisponible sur cet environnement.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Message NEUTRE : ne révèle pas si l'e-mail existe (pas d'oracle).
    return { ok: false, error: "Identifiants incorrects ou accès non autorisé." };
  }

  redirect(safeRedirect(parsed.data.redirectTo));
}

export async function signOutAction(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  redirect("/connexion");
}
