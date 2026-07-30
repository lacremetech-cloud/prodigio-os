-- =============================================================================
-- Prodigio OS — Migration 20260730170000_harden_set_updated_at
--
-- Durcissement additif : fixe un `search_path` immuable sur la fonction
-- utilitaire `public.set_updated_at()` (déclencheur `updated_at`), créée par la
-- migration de capture SANS `search_path` fixe. L'advisor Supabase
-- (`function_search_path_mutable`) la signalait.
--
-- ADDITIF : ne modifie AUCUNE migration antérieure ; ne change pas la logique de
-- la fonction (elle se contente de `new.updated_at = now()`), seulement la
-- résolution de noms. Aucun impact sur le funnel ni le CRM.
-- =============================================================================

begin;

alter function public.set_updated_at() set search_path = pg_catalog, pg_temp;

commit;
