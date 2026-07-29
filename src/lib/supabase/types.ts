/**
 * Types Supabase (écrits à la main, alignés sur la migration
 * `supabase/migrations/20260729120000_mandate_funnel_capture.sql`).
 *
 * Volontairement focalisés sur la tranche « capture » : le public n'interagit
 * qu'avec la fonction contrôlée `submit_mandate_funnel`. Les tables ne sont pas
 * lisibles publiquement (RLS) ; leurs types servent la lisibilité et une future
 * génération automatique pourra les remplacer.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/**
 * Résultat renvoyé par la fonction SQL `submit_mandate_funnel`.
 *
 * Volontairement NEUTRE : un simple accusé de réception. Aucune donnée
 * personnelle, aucun identifiant réutilisable, et aucune information révélant si
 * le contact existait déjà (pas d'oracle d'énumération via la clé publiable).
 */
export interface SubmitMandateFunnelResult {
  accepted: boolean;
}

export interface Database {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: {
      submit_mandate_funnel: {
        Args: { payload: Json };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
