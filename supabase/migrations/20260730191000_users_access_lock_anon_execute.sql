-- =============================================================================
-- Prodigio OS — Migration 20260730191000_users_access_lock_anon_execute
--
-- Durcissement ADDITIF au-dessus de 20260730190000_users_and_access_v1. Même
-- correctif que 20260730160000_crm_lock_anon_execute, appliqué aux NOUVELLES
-- fonctions de gestion des utilisateurs & accès.
--
-- Constat : les *default privileges* Supabase accordent automatiquement
-- `EXECUTE` à `anon` (et `public`) sur les fonctions du schéma `public` ;
-- `grant ... to authenticated` seul ne le retire pas. Les fonctions se
-- défendent déjà (chacune exige `auth.uid()` non nul via `crm_require_role`,
-- ou refuse anon), mais laisser `anon` exécutable est contraire au principe de
-- moindre privilège et à la sécurité attendue (§8 de la mission).
--
-- Cette migration RETIRE `EXECUTE` à `anon` (et `public`) sur ces fonctions, en
-- CONSERVANT `authenticated` là où c'est nécessaire (helpers lus par la RLS,
-- fonctions d'administration, acceptation). Ne touche NI `submit_mandate_funnel`
-- (funnel public inchangé), NI la RLS, NI les tables.
-- =============================================================================

begin;

-- Helpers d'isolation (authenticated conservé : lus par les politiques RLS).
revoke execute on function public.crm_is_operator() from anon, public;
revoke execute on function public.crm_assigned_opportunity_ids() from anon, public;
revoke execute on function public.crm_role_is_assignable(text) from anon, public;

-- Fonctions d'administration des invitations (authenticated conservé ; chacune
-- re-vérifie le rôle administrateur en interne).
revoke execute on function public.crm_create_invitation(text, text, text, text, text, integer) from anon, public;
revoke execute on function public.crm_resend_invitation(uuid, integer) from anon, public;
revoke execute on function public.crm_mark_invitation_sent(uuid, uuid) from anon, public;
revoke execute on function public.crm_revoke_invitation(uuid) from anon, public;
revoke execute on function public.crm_list_invitations() from anon, public;

-- Administration des membres (authenticated conservé).
revoke execute on function public.crm_change_member_role(uuid, text, text) from anon, public;
revoke execute on function public.crm_set_member_status(uuid, text, text) from anon, public;
revoke execute on function public.crm_list_team() from anon, public;

-- Acceptation (authenticated conservé : la personne invitée est authentifiée,
-- mais anon — non connecté — ne doit pas pouvoir l'appeler).
revoke execute on function public.crm_accept_invitation() from anon, public;
revoke execute on function public.crm_my_pending_invitation() from anon, public;

commit;
