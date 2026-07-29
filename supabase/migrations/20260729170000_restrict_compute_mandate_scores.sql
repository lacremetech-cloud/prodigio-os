-- =============================================================================
-- Prodigio OS — Migration 20260729170000_restrict_compute_mandate_scores
--
-- Durcissement de sécurité — ADDITIF au-dessus de 20260729160000_mandate_scoring.
--
-- `compute_mandate_scores(...)` est une fonction INTERNE : elle n'est appelée que
-- par `submit_mandate_funnel` (SECURITY DEFINER). La migration de scoring l'avait
-- révoquée de `PUBLIC`, mais les *default privileges* de Supabase sur les
-- fonctions du schéma `public` accordent automatiquement `EXECUTE` à `anon` et
-- `authenticated` — grants explicites que `revoke ... from public` ne retire pas.
-- Résultat mesuré : la fonction restait exécutable directement par le public
-- (divulgation du barème de scoring, sans lecture ni falsification de données).
--
-- Cette migration RETIRE l'EXECUTE de `PUBLIC`, `anon` et `authenticated` sur la
-- SEULE fonction `compute_mandate_scores`, afin d'aligner l'ACL sur l'intention
-- « interne ». `submit_mandate_funnel` n'est PAS touchée (elle reste exécutable
-- par `anon`/`authenticated`, seul point d'entrée public). `service_role`
-- (back-office / clé serveur) conserve son accès.
--
-- Elle NE modifie NI la RLS, NI les tables, NI la logique de scoring, NI aucune
-- migration antérieure. Réponse publique et fonctionnement du funnel inchangés.
--
-- Signature ciblée (vérifiée dans pg_proc) :
--   public.compute_mandate_scores(text, text, text, text)
--   = (p_property_type, p_value_band, p_sale_horizon, p_mandate_situation)
-- =============================================================================

begin;

revoke execute on function public.compute_mandate_scores(text, text, text, text) from public;
revoke execute on function public.compute_mandate_scores(text, text, text, text) from anon;
revoke execute on function public.compute_mandate_scores(text, text, text, text) from authenticated;

commit;
