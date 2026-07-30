import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, isSupabaseAdminConfigured } from "@/config";
import type { Database } from "./types";

/**
 * Client Supabase **ADMIN** — réservé aux opérations d'administration Supabase
 * Auth (invitations `inviteUserByEmail`). Il utilise la clé SECRÈTE serveur
 * (`SUPABASE_SECRET_KEY`) et contourne la RLS : il ne doit **jamais** être
 * importé, exposé ou instancié côté navigateur.
 *
 * Garde-fous :
 *  - `import "server-only"` : toute inclusion dans un bundle client échoue au build.
 *  - `getSupabaseAdminClient()` **lève** si le secret est absent → aucun appel
 *    Admin n'est jamais tenté « à vide » (l'appelant vérifie d'abord
 *    `isSupabaseAdminConfigured()` et affiche une erreur de configuration dédiée).
 *  - `persistSession: false`, `autoRefreshToken: false` : aucun cookie, aucune
 *    session persistée (client sans état, dédié aux appels ponctuels).
 *
 * Le secret n'est jamais journalisé ni renvoyé au client par ce module.
 */
export function getSupabaseAdminClient(): SupabaseClient<Database> {
  if (!isSupabaseAdminConfigured()) {
    throw new Error(
      "Supabase Admin non configuré (SUPABASE_SECRET_KEY absente). " +
        "Aucune opération d'administration Auth ne peut être effectuée.",
    );
  }

  // Non-null : garanti par isSupabaseAdminConfigured().
  const url = env.NEXT_PUBLIC_SUPABASE_URL as string;
  const secret = env.SUPABASE_SECRET_KEY as string;

  return createClient<Database>(url, secret, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
