-- =============================================================================
-- Prodigio OS — Migration 20260817120000_buyers_crm_restrict_internal_execute
--
-- « Durcissement de la surface EXECUTE du CRM Acquéreurs ».
--
-- STRICTEMENT ADDITIVE et LIMITÉE AUX PRIVILÈGES. Ne crée, ne modifie et ne
-- supprime AUCUNE table, colonne, contrainte, politique, fonction ni donnée.
-- Ne modifie pas 20260803120000_buyers_crm_v1.sql ni aucune migration historique.
--
-- MOTIF
-- Trois fonctions du CRM Acquéreurs sont des **helpers internes** : elles ne
-- sont appelées que depuis d'autres fonctions `SECURITY DEFINER`, jamais par
-- l'application ni par une politique RLS. Elles restaient pourtant exécutables
-- par `authenticated` :
--   • `buyer_attach_interest` — via les `ALTER DEFAULT PRIVILEGES` de Supabase,
--     qui accordent EXECUTE aux rôles du schéma `public` ; la migration
--     d'origine ne révoquait que sur `public, anon` ;
--   • `buyer_band_bounds` et `crm_buyer_can_operate` — via un `grant execute
--     … to authenticated` explicite, en réalité inutile.
--
-- `buyer_attach_interest` a des EFFETS DE BORD (création/rattachement d'un
-- dossier, recalcul d'agrégats, amorçage de critères, écriture d'audit). Qu'elle
-- ne renvoie aucune donnée personnelle ne suffit pas : un helper interne ne doit
-- pas être appelable directement, hors de la fonction publique contrôlée
-- `submit_buyer_interest`.
--
-- PREUVES (mesurées sur un PostgreSQL vierge rejouant les 14 migrations)
--   1. Appel direct sous un rôle `authenticated` → refusé par défaut de
--      privilège (« permission denied for function buyer_attach_interest »),
--      AVANT toute mutation.
--   2. Lectures RLS inchangées : l'administrateur voit toujours ses dossiers et
--      critères.
--   3. Les actions CRM authentifiées passent toujours (`crm_buyer_qualify`,
--      `crm_buyer_set_stage`, `crm_buyer_create_task`, `crm_buyer_log_activity`,
--      `crm_buyer_upsert_criteria`) : elles sont `SECURITY DEFINER` et appellent
--      les helpers avec les privilèges du propriétaire.
--   4. Le parcours public `submit_buyer_interest` fonctionne toujours
--      (`created = true`, dossier rattaché).
--
-- ⚠️ `crm_buyer_profile_access(uuid)` N'EST PAS DURCIE : c'est le **seul**
-- helper invoqué DIRECTEMENT par les politiques RLS (`buyer_profiles_read`,
-- `buyer_search_criteria_read`, `buyer_assignments_read`,
-- `buyer_interests_profile_read`, `tasks_crm_read`, `activities_crm_read`).
-- L'expression d'une politique est évaluée avec les privilèges du rôle
-- appelant : lui retirer EXECUTE CASSE la lecture autorisée. Vérifié par un
-- test contrefactuel — « permission denied for function
-- crm_buyer_profile_access » dès la première lecture d'un administrateur.
--
-- `service_role` conserve EXECUTE : c'est le rôle serveur de confiance.
--
-- CONVENTION POUR LES MIGRATIONS FUTURES (voir docs/20 § surface EXECUTE)
--   1. `REVOKE ALL` sur chaque nouvelle fonction (`public`, `anon`,
--      `authenticated`) — ne jamais se reposer sur les privilèges par défaut ;
--   2. `GRANT EXECUTE` explicite aux seuls rôles réellement nécessaires.
-- Les `ALTER DEFAULT PRIVILEGES` du projet ne sont volontairement PAS modifiés
-- ici : cela affecterait d'autres modules hors périmètre de cette mission.
--
-- Application : voir docs/07-SUPABASE-SETUP.md. NE PAS exécuter automatiquement.
-- =============================================================================

begin;

-- --- Helper interne : rattachement d'un intérêt au dossier consolidé ---------
-- Appelant unique : public.submit_buyer_interest (SECURITY DEFINER).
revoke all on function public.buyer_attach_interest(uuid)
  from public, anon, authenticated;

-- --- Helper interne : bornes de tranche de budget ----------------------------
-- Appelant unique : public.buyer_attach_interest (SECURITY DEFINER).
revoke all on function public.buyer_band_bounds(text)
  from public, anon, authenticated;

-- --- Helper interne : garde d'écriture d'un dossier acquéreur ----------------
-- Appelants : crm_buyer_create_task, crm_buyer_log_activity, crm_buyer_qualify,
-- crm_buyer_record_offer, crm_buyer_set_stage, crm_buyer_set_task_status,
-- crm_buyer_upsert_criteria (toutes SECURITY DEFINER).
revoke all on function public.crm_buyer_can_operate(uuid)
  from public, anon, authenticated;

comment on function public.buyer_attach_interest(uuid) is
  'HELPER INTERNE — non exécutable par public/anon/authenticated. Rattache un intérêt acquéreur au dossier consolidé de la personne : réutilise le contact SANS jamais l''écraser, crée le dossier si nécessaire (unicité par contact), recalcule les agrégats depuis les intérêts (jamais depuis le client) et amorce les critères tant qu''aucune saisie humaine n''a eu lieu. Audité. Appelé uniquement par submit_buyer_interest (SECURITY DEFINER).';

comment on function public.buyer_band_bounds(text) is
  'HELPER INTERNE — non exécutable par public/anon/authenticated. Bornes indicatives (centimes) d''une tranche de budget acquéreur. Reprend les bornes déjà utilisées par compute_buyer_scores. Miroir de src/modules/buyers/crm/criteria.ts. Appelé uniquement par buyer_attach_interest (SECURITY DEFINER).';

comment on function public.crm_buyer_can_operate(uuid) is
  'HELPER INTERNE — non exécutable par public/anon/authenticated. Vrai si l''utilisateur courant peut traiter ce dossier acquéreur (opérateur Prodigio, ou agent immobilier sur ses propres dossiers). Appelé uniquement par les fonctions d''écriture SECURITY DEFINER du CRM Acquéreurs.';

commit;
