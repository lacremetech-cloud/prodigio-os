-- =============================================================================
-- Prodigio OS — Migration 20260730160000_crm_lock_anon_execute
--
-- Durcissement de sécurité — ADDITIF au-dessus de 20260730120000_crm_internal_v1.
-- Même correctif que 20260729170000_restrict_compute_mandate_scores, appliqué aux
-- fonctions du CRM.
--
-- Constat : les *default privileges* Supabase sur les fonctions du schéma
-- `public` accordent automatiquement `EXECUTE` à `anon` (et `authenticated`).
-- `revoke ... from public` ne retire pas ces grants explicites. Les fonctions
-- `crm_*` se défendaient déjà (chaque écriture appelle `crm_require_role`, qui
-- exige `auth.uid()` non nul), mais laisser `anon` exécutable est contraire à
-- l'intention (fonctions internes / authentifiées) et au principe de moindre
-- privilège.
--
-- Cette migration RETIRE `EXECUTE` à `anon` (et `public`) sur les fonctions du
-- CRM, en CONSERVANT l'accès `authenticated` là où il est nécessaire (helpers
-- lus par la RLS, fonctions de mutation, annuaire). Les fonctions de déclencheur
-- (`attach_operator_org`, `audit_events_block_mutation`) et la garde interne
-- `crm_require_role` sont retirées aussi à `authenticated` (jamais appelées
-- directement ; elles s'exécutent via le propriétaire des objets définisseurs).
--
-- Elle NE touche PAS `submit_mandate_funnel` (seul point d'entrée public du
-- funnel, `anon` conservé), ni `compute_mandate_scores` (déjà verrouillée), ni la
-- RLS, ni les tables. Fonctionnement du CRM et du funnel inchangés.
-- =============================================================================

begin;

-- Helpers lus par la RLS et l'application (authenticated conservé).
revoke execute on function public.crm_active_roles() from anon, public;
revoke execute on function public.crm_has_access() from anon, public;
revoke execute on function public.crm_has_role(text[]) from anon, public;
revoke execute on function public.crm_can_view_contact_details() from anon, public;
revoke execute on function public.crm_list_members() from anon, public;

-- Fonctions de mutation (authenticated conservé ; chacune re-vérifie le rôle).
revoke execute on function public.crm_assign_opportunity(uuid, uuid, text) from anon, public;
revoke execute on function public.crm_self_assign(uuid, text) from anon, public;
revoke execute on function public.crm_change_stage(uuid, text, text) from anon, public;
revoke execute on function public.crm_log_activity(uuid, text, text, text, uuid, timestamptz) from anon, public;
revoke execute on function public.crm_create_task(uuid, text, text, timestamptz, uuid) from anon, public;
revoke execute on function public.crm_set_task_status(uuid, text) from anon, public;
revoke execute on function public.crm_decide_segment(uuid, text, text, boolean) from anon, public;
revoke execute on function public.crm_record_outcome(uuid, text, text) from anon, public;

-- Bootstrap / invitation (authenticated conservé ; garde interne stricte).
revoke execute on function public.crm_bootstrap_first_admin(text) from anon, public;
revoke execute on function public.crm_invite_member(text, text, text) from anon, public;

-- Fonctions internes / de déclencheur : retirées à anon ET authenticated
-- (jamais appelées directement par un client ; exécutées via le définisseur).
revoke execute on function public.crm_require_role(text[]) from anon, authenticated, public;
revoke execute on function public.attach_operator_org() from anon, authenticated, public;
revoke execute on function public.audit_events_block_mutation() from anon, authenticated, public;

commit;
