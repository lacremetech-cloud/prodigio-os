import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/config";
import type { Database } from "./types";

/**
 * Client Supabase **navigateur**. N'utilise que l'URL publique et la clé
 * PUBLIABLE (anon) — jamais de secret serveur. Protégé par les politiques RLS :
 * le public ne peut que déposer une demande via la fonction contrôlée.
 *
 * À n'appeler que dans du code client (`"use client"`).
 */
export function createSupabaseBrowserClient() {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase non configuré (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).",
    );
  }

  return createBrowserClient<Database>(url, key);
}
