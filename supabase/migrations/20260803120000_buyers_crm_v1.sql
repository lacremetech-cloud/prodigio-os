-- =============================================================================
-- Prodigio OS — Migration 20260803120000_buyers_crm_v1
--
-- « CRM Acquéreurs V1 » : transforme les `buyer_interests` déjà capturés par le
-- Funnel Acquéreur en véritables DOSSIERS ACQUÉREURS exploitables par l'équipe.
--
-- STRICTEMENT ADDITIVE. Ne supprime aucune table, aucune colonne, aucune donnée.
-- Réutilise l'existant sans le dupliquer : contacts (la personne), buyer_interests
-- (l'intérêt ponctuel), tasks / activities (suivi opérationnel), audit_events
-- (journal immuable), organizations / organization_memberships (rôles), helpers
-- crm_is_operator / crm_has_role / crm_can_decide / crm_require_role /
-- crm_assigned_opportunity_ids / crm_property_access / crm_current_operator_org.
--
-- SÉPARATION DES CONCEPTS (constitution §2) :
--   1. La PERSONNE            → public.contacts            (existant, réutilisé)
--   2. Le PROFIL ACQUÉREUR    → public.buyer_profiles      (nouveau, 1-1 contact)
--   3. Les CRITÈRES           → public.buyer_search_criteria (nouveau, 1-1 profil)
--   4. Les INTÉRÊTS par bien  → public.buyer_interests     (existant, rattaché)
--   5. La QUALIFICATION       → colonnes de qualification humaine du profil
--   6. L'AFFECTATION          → public.buyer_assignments   (nouveau, N-N)
--   7. Le SUIVI OPÉRATIONNEL  → public.tasks / public.activities (ÉLARGIES)
--
-- Un vendeur peut devenir acquéreur : le contact est RÉUTILISÉ, jamais dupliqué,
-- et ses données issues du parcours vendeur ne sont JAMAIS écrasées.
--
-- Quatre notions distinctes, jamais confondues :
--   • score automatique        → buyer_interests.overall_score (calculé en base)
--   • recommandation opér.     → buyer_profiles.recommended_priority (dérivée)
--   • qualification humaine    → buyer_profiles.qualification_status (décidée)
--   • étape commerciale        → buyer_profiles.pipeline_stage (pipeline)
--
-- Sécurité : RLS active partout, aucun grant `anon`, aucune fonction CRM
-- Acquéreurs exécutable par `anon`/`PUBLIC`, écritures via SECURITY DEFINER
-- auditées, `search_path` figé, audit immuable. Aucun paramètre économique codé
-- en dur (les bornes de tranches restent celles, déjà versionnées, du funnel).
--
-- Application : voir docs/07-SUPABASE-SETUP.md. NE PAS exécuter automatiquement.
-- =============================================================================

begin;

-- =============================================================================
-- 1. AUDIT — extension ADDITIVE (sur-ensemble strict des valeurs existantes).
-- =============================================================================
alter table public.audit_events
  drop constraint if exists audit_events_entity_type_check,
  add constraint audit_events_entity_type_check check (
    entity_type in (
      'opportunity', 'contact', 'membership', 'organization', 'invitation',
      'calendar_connection', 'estimation_appointment',
      'estimation_report', 'mandate', 'economic_rule', 'document', 'property',
      'buyer_interest',
      -- Nouveau (CRM Acquéreurs) :
      'buyer_profile'));

alter table public.audit_events
  drop constraint if exists audit_events_event_type_check,
  add constraint audit_events_event_type_check check (
    event_type in (
      'creation', 'changement_stade', 'changement_segment',
      'changement_affectation', 'changement_permission',
      'resolution_doublon', 'resultat_commercial',
      'invitation_creee', 'invitation_renvoyee', 'invitation_revoquee',
      'invitation_acceptee', 'changement_role',
      'activation_membre', 'desactivation_membre',
      'calendrier_connecte', 'calendrier_deconnecte',
      'estimation_planifiee', 'estimation_replanifiee',
      'estimation_annulee', 'estimation_resultat',
      'estimation_realisee', 'decision_eligibilite',
      'regle_economique_maj',
      'mandat_brouillon', 'mandat_propose', 'mandat_signe',
      'mandat_refuse', 'mandat_expire', 'mandat_annule',
      'document_ajoute', 'document_remplace', 'document_supprime',
      'bien_cree',
      'bien_identite', 'bien_positionnement', 'bien_statut', 'bien_responsable',
      'bien_media_ajoute', 'bien_media_supprime', 'bien_media_principal',
      'bien_document_ajoute', 'bien_document_supprime',
      'bien_production_maj', 'bien_pret',
      'bien_public_config', 'bien_public_media_ajoute', 'bien_public_media_supprime',
      'bien_public_hero', 'bien_public_valide', 'bien_public_statut',
      'bien_publie', 'bien_depublie',
      'acquereur_interet_statut',
      -- Nouveaux (CRM Acquéreurs) :
      'acquereur_profil_cree',        -- dossier acquéreur ouvert
      'acquereur_interet_rattache',   -- nouvel intérêt rattaché au dossier
      'acquereur_stade',              -- changement d'étape du pipeline
      'acquereur_qualification',      -- qualification HUMAINE (≠ score)
      'acquereur_affectation',        -- responsable du dossier
      'acquereur_criteres',           -- critères de recherche mis à jour
      'acquereur_offre',              -- offre en cours (action métier dédiée)
      'acquereur_resultat'));         -- gagné / perdu (action métier dédiée)

-- =============================================================================
-- 2. BUYER_PROFILES — le DOSSIER ACQUÉREUR consolidé (≠ contact, ≠ intérêt).
--    Un seul dossier par personne (unicité sur contact_id) : un acquéreur qui
--    manifeste plusieurs intérêts sur plusieurs biens conserve UN dossier.
-- =============================================================================
create table if not exists public.buyer_profiles (
  id                      uuid primary key default gen_random_uuid(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  organization_id         uuid not null references public.organizations (id) on delete cascade,
  -- La PERSONNE. Réutilisée telle quelle : jamais dupliquée, jamais écrasée.
  contact_id              uuid not null references public.contacts (id) on delete cascade,

  -- Étape COMMERCIALE du pipeline acquéreur (distincte du pipeline Mandats).
  pipeline_stage          text not null default 'nouveau'
                            check (pipeline_stage in (
                              'nouveau',
                              'a_contacter',
                              'contact_en_cours',
                              'qualifie',
                              'bien_a_proposer',
                              'visite_a_planifier',
                              'visite_planifiee',
                              'suivi_apres_visite',
                              'offre_en_cours',
                              'acquereur_gagne',
                              'perdu')),

  -- QUALIFICATION HUMAINE : décision d'une personne, jamais un score.
  qualification_status    text not null default 'non_qualifie'
                            check (qualification_status in (
                              'non_qualifie', 'en_cours', 'qualifie', 'ecarte')),
  qualification_reason    text,
  qualified_by            uuid references auth.users (id) on delete set null,
  qualified_at            timestamptz,

  -- RECOMMANDATION OPÉRATIONNELLE dérivée des intérêts (≠ qualification humaine).
  -- Recalculée en base à chaque nouvel intérêt : jamais saisie par le navigateur.
  recommended_priority    text
                            check (recommended_priority is null or recommended_priority in (
                              'prioritaire', 'a_qualifier', 'a_suivre')),
  best_overall_score      integer check (best_overall_score is null
                            or (best_overall_score >= 0 and best_overall_score <= 100)),

  -- Agrégats d'intérêts (dénormalisés pour le tri / les compteurs).
  interest_count          integer not null default 0 check (interest_count >= 0),
  first_interest_at       timestamptz,
  last_interest_at        timestamptz,
  last_activity_at        timestamptz,

  -- ORIGINE & ATTRIBUTION MARKETING (photographie du PREMIER intérêt : l'historique
  -- complet reste porté par chaque buyer_interests, jamais écrasé).
  origin_funnel_key       text,
  first_touch             jsonb,
  last_touch              jsonb,
  utm_source              text,
  utm_medium              text,
  utm_campaign            text,
  utm_term                text,
  utm_content             text,

  -- RÉSULTAT COMMERCIAL du dossier (≠ étape du pipeline).
  outcome                 text
                            check (outcome is null or outcome in ('gagne', 'perdu')),
  outcome_reason          text,             -- motif de perte (obligatoire si perdu)
  outcome_recorded_by     uuid references auth.users (id) on delete set null,
  outcome_recorded_at     timestamptz,

  -- Offre en cours (action métier dédiée ; montant facultatif, en centimes).
  offer_amount_cents      bigint check (offer_amount_cents is null or offer_amount_cents >= 0),
  offer_property_id       uuid references public.properties (id) on delete set null,
  offer_recorded_by       uuid references auth.users (id) on delete set null,
  offer_recorded_at       timestamptz,

  created_by              uuid references auth.users (id) on delete set null,

  -- Un seul dossier acquéreur par personne : garantit l'absence de doublon.
  constraint buyer_profiles_contact_unique unique (contact_id)
);

comment on table public.buyer_profiles is
  'Dossier acquéreur consolidé d''une personne (1-1 avec contacts). Distinct du contact (la personne), de l''intérêt ponctuel (buyer_interests) et du résultat commercial. Sépare explicitement : score automatique (intérêts), recommandation opérationnelle (recommended_priority), qualification HUMAINE (qualification_status) et étape commerciale (pipeline_stage). Un acquéreur peut porter plusieurs intérêts sur plusieurs biens sans jamais dupliquer le contact.';

comment on column public.buyer_profiles.recommended_priority is
  'Recommandation opérationnelle DÉRIVÉE des scores d''intérêt (calculée en base). N''est ni un score brut, ni la qualification humaine, ni une étape du pipeline.';
comment on column public.buyer_profiles.qualification_status is
  'Qualification validée par un HUMAIN. Ne doit jamais être déduite d''un score.';

create index if not exists buyer_profiles_stage_idx
  on public.buyer_profiles (pipeline_stage, last_interest_at desc);
create index if not exists buyer_profiles_org_idx on public.buyer_profiles (organization_id);
create index if not exists buyer_profiles_priority_idx
  on public.buyer_profiles (recommended_priority, best_overall_score desc);
create index if not exists buyer_profiles_last_interest_idx
  on public.buyer_profiles (last_interest_at desc);

drop trigger if exists buyer_profiles_set_updated_at on public.buyer_profiles;
create trigger buyer_profiles_set_updated_at
  before update on public.buyer_profiles
  for each row execute function public.set_updated_at();

alter table public.buyer_profiles enable row level security;
grant select on public.buyer_profiles to authenticated;

-- =============================================================================
-- 3. BUYER_SEARCH_CRITERIA — critères de recherche du dossier (1-1).
--    Amorcés depuis les réponses du funnel, puis AFFINABLES par un humain.
--    `source` distingue l'amorce automatique de la saisie humaine : une saisie
--    humaine n'est JAMAIS écrasée par un nouvel intérêt.
-- =============================================================================
create table if not exists public.buyer_search_criteria (
  buyer_profile_id   uuid primary key references public.buyer_profiles (id) on delete cascade,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  -- Type(s) de biens recherchés (tokens alignés sur properties.property_type).
  property_types     text[] not null default '{}',
  -- Localisation(s) souhaitée(s) — texte libre normalisé en minuscules.
  locations          text[] not null default '{}',

  -- Budget en CENTIMES (aucune valeur économique codée en dur : ces bornes sont
  -- amorcées depuis la tranche déclarée au funnel, puis affinables).
  budget_min_cents   bigint check (budget_min_cents is null or budget_min_cents >= 0),
  budget_max_cents   bigint check (budget_max_cents is null or budget_max_cents >= 0),

  purchase_horizon   text,
  financing          text,
  project_nature     text,
  decision_mode      text,

  notes              text,

  -- 'funnel' = amorcé automatiquement ; 'humain' = affiné par l'équipe (verrou).
  source             text not null default 'funnel'
                       check (source in ('funnel', 'humain')),
  updated_by         uuid references auth.users (id) on delete set null,

  constraint buyer_search_criteria_budget_order check (
    budget_min_cents is null or budget_max_cents is null
    or budget_max_cents >= budget_min_cents)
);

comment on table public.buyer_search_criteria is
  'Critères de recherche du dossier acquéreur (1-1 avec buyer_profiles). Amorcés depuis les réponses du funnel (source = funnel) puis affinables par l''équipe (source = humain). Une saisie humaine n''est jamais écrasée par un nouvel intérêt.';

drop trigger if exists buyer_search_criteria_set_updated_at on public.buyer_search_criteria;
create trigger buyer_search_criteria_set_updated_at
  before update on public.buyer_search_criteria
  for each row execute function public.set_updated_at();

alter table public.buyer_search_criteria enable row level security;
grant select on public.buyer_search_criteria to authenticated;

-- =============================================================================
-- 4. BUYER_ASSIGNMENTS — Dossier acquéreur ↔ Utilisateur, avec responsabilité.
--    Miroir de opportunity_assignments : aucun dossier ne reste sans suite.
-- =============================================================================
create table if not exists public.buyer_assignments (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  buyer_profile_id  uuid not null references public.buyer_profiles (id) on delete cascade,
  user_id           uuid not null references auth.users (id) on delete cascade,
  responsibility    text not null default 'setter'
                      check (responsibility in ('setter', 'manager', 'agent_immobilier',
                                                'responsable_marketing')),
  assigned_by       uuid references auth.users (id) on delete set null,
  constraint buyer_assignments_unique unique (buyer_profile_id, user_id)
);

comment on table public.buyer_assignments is
  'Relation N-N Dossier acquéreur ↔ Utilisateur avec responsabilité. Un dossier sans affectation apparaît dans la file « Non affectés ».';

create index if not exists buyer_assignments_user_idx on public.buyer_assignments (user_id);
create index if not exists buyer_assignments_profile_idx
  on public.buyer_assignments (buyer_profile_id);

alter table public.buyer_assignments enable row level security;
grant select on public.buyer_assignments to authenticated;

-- =============================================================================
-- 5. BUYER_INTERESTS — rattachement au dossier (ADDITIF).
--    La soumission d'origine reste conservée telle quelle : on ajoute uniquement
--    le lien vers le dossier consolidé.
-- =============================================================================
alter table public.buyer_interests
  add column if not exists buyer_profile_id uuid references public.buyer_profiles (id) on delete set null;

create index if not exists buyer_interests_profile_idx
  on public.buyer_interests (buyer_profile_id, created_at desc);

-- =============================================================================
-- 6. TASKS & ACTIVITIES — ÉLARGIES au dossier acquéreur (aucune table en double).
--    `opportunity_id` devient NULLABLE et cohabite avec `buyer_profile_id` :
--    exactement UN des deux rattachements est renseigné. Toutes les lignes
--    existantes portent `opportunity_id` → aucune donnée invalidée.
-- =============================================================================
alter table public.tasks
  add column if not exists buyer_profile_id uuid references public.buyer_profiles (id) on delete cascade;
alter table public.tasks alter column opportunity_id drop not null;
alter table public.tasks
  drop constraint if exists tasks_owner_exactly_one,
  add constraint tasks_owner_exactly_one check (
    (opportunity_id is not null and buyer_profile_id is null)
    or (opportunity_id is null and buyer_profile_id is not null));

create index if not exists tasks_buyer_profile_idx on public.tasks (buyer_profile_id);

alter table public.activities
  add column if not exists buyer_profile_id uuid references public.buyer_profiles (id) on delete cascade;
alter table public.activities alter column opportunity_id drop not null;
alter table public.activities
  drop constraint if exists activities_owner_exactly_one,
  add constraint activities_owner_exactly_one check (
    (opportunity_id is not null and buyer_profile_id is null)
    or (opportunity_id is null and buyer_profile_id is not null));

create index if not exists activities_buyer_profile_idx
  on public.activities (buyer_profile_id, occurred_at desc);

comment on column public.tasks.buyer_profile_id is
  'Rattachement au dossier acquéreur. Exactement un rattachement (opportunité OU dossier acquéreur) est renseigné.';
comment on column public.activities.buyer_profile_id is
  'Rattachement au dossier acquéreur. Exactement un rattachement (opportunité OU dossier acquéreur) est renseigné.';

-- =============================================================================
-- 7. HELPER D'ACCÈS — autorité serveur pour les dossiers acquéreurs.
--    • opérateur Prodigio (administrateur / manager / setter) : tous les dossiers
--    • agent immobilier : uniquement les dossiers qui lui sont AFFECTÉS, ou liés
--      à un bien auquel il a accès (via ses opportunités affectées)
--    • partenaire_lecture : AUCUN accès en V1 — aucun mécanisme de partage de
--      dossier acquéreur n'existe encore (docs/06). Rôle non attribuable en V1.
-- =============================================================================
create or replace function public.crm_buyer_profile_access(p_buyer_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.buyer_profiles bp
    where bp.id = p_buyer_profile_id
      and (
        public.crm_is_operator()
        or (
          public.crm_has_role('agent_immobilier')
          and (
            exists (
              select 1 from public.buyer_assignments ba
              where ba.buyer_profile_id = bp.id and ba.user_id = auth.uid()
            )
            or exists (
              select 1
              from public.buyer_interests bi
              join public.properties p on p.id = bi.property_id
              where bi.buyer_profile_id = bp.id
                and p.opportunity_id in (select public.crm_assigned_opportunity_ids())
            )
          )
        )
      )
  );
$$;

comment on function public.crm_buyer_profile_access(uuid) is
  'Autorité d''accès à un dossier acquéreur : opérateur Prodigio (admin/manager/setter) partout ; agent immobilier uniquement sur ses dossiers affectés ou liés aux biens auxquels il a accès ; partenaire_lecture exclu en V1 (aucun partage de dossier acquéreur).';

revoke all on function public.crm_buyer_profile_access(uuid) from public, anon;
grant execute on function public.crm_buyer_profile_access(uuid) to authenticated;

-- Peut traiter un dossier acquéreur (qualifier, affecter, changer d'étape) :
-- opérateur Prodigio, ou agent immobilier sur ses propres dossiers.
create or replace function public.crm_buyer_can_operate(p_buyer_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.crm_is_operator() or public.crm_buyer_profile_access(p_buyer_profile_id);
$$;

revoke all on function public.crm_buyer_can_operate(uuid) from public, anon;
grant execute on function public.crm_buyer_can_operate(uuid) to authenticated;

-- =============================================================================
-- 8. RLS — lecture seule côté table ; toute écriture passe par les fonctions §10.
--    Aucun grant `anon`, aucune politique `anon` : refus total pour le public.
-- =============================================================================
drop policy if exists buyer_profiles_read on public.buyer_profiles;
create policy buyer_profiles_read on public.buyer_profiles
  for select to authenticated using (public.crm_buyer_profile_access(id));

drop policy if exists buyer_search_criteria_read on public.buyer_search_criteria;
create policy buyer_search_criteria_read on public.buyer_search_criteria
  for select to authenticated using (public.crm_buyer_profile_access(buyer_profile_id));

drop policy if exists buyer_assignments_read on public.buyer_assignments;
create policy buyer_assignments_read on public.buyer_assignments
  for select to authenticated using (public.crm_buyer_profile_access(buyer_profile_id));

-- Les intérêts restent lisibles depuis le bien (politique existante conservée) ;
-- on AJOUTE la lecture depuis le dossier acquéreur (politiques permissives = OU).
drop policy if exists buyer_interests_profile_read on public.buyer_interests;
create policy buyer_interests_profile_read on public.buyer_interests
  for select to authenticated
  using (buyer_profile_id is not null and public.crm_buyer_profile_access(buyer_profile_id));

-- Tâches & activités : le comportement Mandats est STRICTEMENT INCHANGÉ.
-- ⚠️ La branche `opportunity_id` reproduit MOT POUR MOT la politique en vigueur,
-- posée par 20260730190000_users_and_access_v1 (isolation role-aware), et NON la
-- version initiale plus permissive de 20260730120000_crm_internal_v1
-- (`crm_has_access()`), que cette migration-là avait déjà remplacée. Toute
-- simplification ici rouvrirait l'accès aux agents non affectés et à
-- `partenaire_lecture` : régression de sécurité.
drop policy if exists tasks_crm_read on public.tasks;
create policy tasks_crm_read on public.tasks
  for select to authenticated
  using (
    case
      when buyer_profile_id is not null then public.crm_buyer_profile_access(buyer_profile_id)
      else (
        public.crm_is_operator()
        or (
          public.crm_has_role('agent_immobilier')
          and opportunity_id in (select public.crm_assigned_opportunity_ids())
        )
      )
    end
  );

drop policy if exists activities_crm_read on public.activities;
create policy activities_crm_read on public.activities
  for select to authenticated
  using (
    case
      when buyer_profile_id is not null then public.crm_buyer_profile_access(buyer_profile_id)
      else (
        public.crm_is_operator()
        or (
          public.crm_has_role('agent_immobilier')
          and opportunity_id in (select public.crm_assigned_opportunity_ids())
        )
      )
    end
  );

-- Défense en profondeur : jamais d'accès direct anon/public.
revoke all on public.buyer_profiles, public.buyer_search_criteria,
  public.buyer_assignments from anon, public;

-- =============================================================================
-- 9. BORNES DE BUDGET — amorçage des critères depuis la tranche du funnel.
--    Miroir SQL de src/modules/buyers/crm/criteria.ts. Les bornes reprennent
--    EXACTEMENT celles déjà utilisées par compute_buyer_scores (aucune nouvelle
--    valeur économique introduite ici).
-- =============================================================================
create or replace function public.buyer_band_bounds(p_budget_band text)
returns jsonb
language sql
immutable
set search_path = pg_catalog, pg_temp
as $$
  select jsonb_build_object(
    'min', case p_budget_band
      when 'moins_800k' then 0 when '800k_1_2m' then 80000000
      when '1_2m_2m' then 120000000 when '2m_3m' then 200000000
      when 'plus_3m' then 300000000 else null end,
    'max', case p_budget_band
      when 'moins_800k' then 80000000 when '800k_1_2m' then 120000000
      when '1_2m_2m' then 200000000 when '2m_3m' then 300000000
      when 'plus_3m' then null else null end
  );
$$;

comment on function public.buyer_band_bounds(text) is
  'Bornes indicatives (centimes) d''une tranche de budget acquéreur. Reprend les bornes déjà utilisées par compute_buyer_scores. Miroir de src/modules/buyers/crm/criteria.ts.';

revoke all on function public.buyer_band_bounds(text) from public, anon;
grant execute on function public.buyer_band_bounds(text) to authenticated;

-- --- Résolution / mise à jour du dossier depuis un intérêt --------------------
-- Cœur du rattachement : réutilise le contact SANS jamais l'écraser, crée le
-- dossier s'il n'existe pas, met à jour les agrégats et amorce les critères
-- UNIQUEMENT s'ils n'ont pas été affinés par un humain.
create or replace function public.buyer_attach_interest(p_interest_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_i public.buyer_interests;
  v_profile_id uuid;
  v_created boolean := false;
  v_org uuid;
  v_bounds jsonb;
  v_criteria_source text;
  v_property_type text;
  v_property_city text;
begin
  select * into v_i from public.buyer_interests where id = p_interest_id;
  if v_i.id is null then
    raise exception 'intérêt introuvable' using errcode = '22023';
  end if;
  if v_i.contact_id is null then
    -- Sans personne résolue, aucun dossier consolidé n'est possible.
    return null;
  end if;

  v_org := coalesce(v_i.organization_id, public.crm_current_operator_org());

  -- 1) Dossier de la PERSONNE : réutilisé s'il existe (jamais de doublon).
  select id into v_profile_id from public.buyer_profiles where contact_id = v_i.contact_id;

  if v_profile_id is null then
    insert into public.buyer_profiles (
      organization_id, contact_id, origin_funnel_key,
      first_touch, last_touch,
      utm_source, utm_medium, utm_campaign, utm_term, utm_content,
      created_by)
    values (
      v_org, v_i.contact_id, v_i.funnel_key,
      v_i.first_touch, v_i.last_touch,
      v_i.utm_source, v_i.utm_medium, v_i.utm_campaign, v_i.utm_term, v_i.utm_content,
      auth.uid())
    on conflict (contact_id) do nothing
    returning id into v_profile_id;

    if v_profile_id is null then
      -- Course : un autre dépôt vient de créer le dossier. On le réutilise.
      select id into v_profile_id from public.buyer_profiles where contact_id = v_i.contact_id;
    else
      v_created := true;
    end if;
  end if;

  if v_profile_id is null then return null; end if;

  -- 2) Rattachement de l'intérêt au dossier.
  update public.buyer_interests set buyer_profile_id = v_profile_id where id = p_interest_id;

  -- 3) Agrégats recalculés depuis la SOURCE (les intérêts), jamais depuis le client.
  --    L'attribution du DERNIER contact est rafraîchie ; celle du premier contact
  --    (posée à la création) n'est jamais écrasée.
  update public.buyer_profiles bp set
    interest_count = (
      select count(*) from public.buyer_interests bi where bi.buyer_profile_id = v_profile_id),
    first_interest_at = (
      select min(bi.created_at) from public.buyer_interests bi where bi.buyer_profile_id = v_profile_id),
    last_interest_at = (
      select max(bi.created_at) from public.buyer_interests bi where bi.buyer_profile_id = v_profile_id),
    best_overall_score = (
      select max(bi.overall_score) from public.buyer_interests bi where bi.buyer_profile_id = v_profile_id),
    recommended_priority = (
      -- Recommandation = meilleure priorité observée sur les intérêts du dossier.
      select case
        when bool_or(bi.priority = 'prioritaire') then 'prioritaire'
        when bool_or(bi.priority = 'a_qualifier') then 'a_qualifier'
        when bool_or(bi.priority = 'a_suivre') then 'a_suivre'
        else null end
      from public.buyer_interests bi where bi.buyer_profile_id = v_profile_id),
    last_touch = coalesce(v_i.last_touch, bp.last_touch)
  where bp.id = v_profile_id;

  -- 4) Critères : amorçage depuis le funnel UNIQUEMENT si aucune saisie humaine.
  select source into v_criteria_source
    from public.buyer_search_criteria where buyer_profile_id = v_profile_id;

  if v_criteria_source is null or v_criteria_source = 'funnel' then
    v_bounds := public.buyer_band_bounds(v_i.budget_band);
    -- Le type ET la localisation sont amorcés depuis le BIEN qui a suscité
    -- l'intérêt : c'est le seul signal fiable de ce que la personne recherche.
    -- (`residence_area` indique où elle HABITE, jamais où elle veut acheter.)
    select p.property_type, lower(btrim(coalesce(p.location_city, '')))
      into v_property_type, v_property_city
      from public.properties p where p.id = v_i.property_id;
    v_property_city := nullif(v_property_city, '');

    insert into public.buyer_search_criteria as c (
      buyer_profile_id, property_types, locations,
      budget_min_cents, budget_max_cents,
      purchase_horizon, financing, project_nature, decision_mode, source)
    values (
      v_profile_id,
      case when v_property_type is null then '{}'::text[] else array[v_property_type] end,
      case when v_property_city is null then '{}'::text[] else array[v_property_city] end,
      (v_bounds->>'min')::bigint, (v_bounds->>'max')::bigint,
      v_i.purchase_horizon, v_i.financing, v_i.project_nature, v_i.decision_mode,
      'funnel')
    on conflict (buyer_profile_id) do update set
      -- Union des types de biens ayant suscité un intérêt (sans doublon).
      property_types = (
        select coalesce(array_agg(distinct t), '{}'::text[])
        from unnest(c.property_types || case when v_property_type is null
                    then '{}'::text[] else array[v_property_type] end) as t
        where t is not null and t <> ''),
      -- Union des localisations des biens ayant suscité un intérêt.
      locations = (
        select coalesce(array_agg(distinct l), '{}'::text[])
        from unnest(c.locations || case when v_property_city is null
                    then '{}'::text[] else array[v_property_city] end) as l
        where l is not null and l <> ''),
      -- Le budget s'ÉLARGIT au fil des intérêts (jamais de fausse précision).
      -- Une borne absente signifie « non bornée » : elle le RESTE (least/greatest
      -- ignorent les NULL, ce qui resserrerait la fourchette à tort).
      budget_min_cents = case
        when c.budget_min_cents is null or (v_bounds->>'min')::bigint is null then null
        else least(c.budget_min_cents, (v_bounds->>'min')::bigint) end,
      budget_max_cents = case
        when c.budget_max_cents is null or (v_bounds->>'max')::bigint is null then null
        else greatest(c.budget_max_cents, (v_bounds->>'max')::bigint) end,
      purchase_horizon = coalesce(v_i.purchase_horizon, c.purchase_horizon),
      financing = coalesce(v_i.financing, c.financing),
      project_nature = coalesce(v_i.project_nature, c.project_nature),
      decision_mode = coalesce(v_i.decision_mode, c.decision_mode);
  end if;

  -- 5) Audit (journal immuable, distinct de l'activité métier).
  if v_created then
    insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
    values (auth.uid(), 'buyer_profile', v_profile_id, 'acquereur_profil_cree',
            jsonb_build_object('contact_id', v_i.contact_id, 'property_id', v_i.property_id));
  else
    insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
    values (auth.uid(), 'buyer_profile', v_profile_id, 'acquereur_interet_rattache',
            jsonb_build_object('interest_id', p_interest_id, 'property_id', v_i.property_id));
  end if;

  return v_profile_id;
end;
$$;

comment on function public.buyer_attach_interest(uuid) is
  'Rattache un intérêt acquéreur au dossier consolidé de la personne : réutilise le contact SANS jamais l''écraser, crée le dossier si nécessaire (unicité par contact), recalcule les agrégats depuis les intérêts (jamais depuis le client) et amorce les critères tant qu''aucune saisie humaine n''a eu lieu. Audité.';

revoke all on function public.buyer_attach_interest(uuid) from public, anon;

-- =============================================================================
-- 10. FONCTIONS D'ÉCRITURE — SECURITY DEFINER, rôle re-vérifié, audit, search_path
--     figé. Seul chemin d'écriture du CRM Acquéreurs.
-- =============================================================================

-- --- Changement d'étape du pipeline -------------------------------------------
-- Les étapes « offre en cours », « gagné » et « perdu » NE PASSENT PAS par ici :
-- elles exigent une action métier dédiée (confirmation, motif, audit).
create or replace function public.crm_buyer_set_stage(p_buyer_profile_id uuid, p_stage text)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_old text;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.crm_buyer_can_operate(p_buyer_profile_id) then
    raise exception 'droits insuffisants sur ce dossier acquéreur' using errcode = '42501';
  end if;
  if p_stage in ('offre_en_cours', 'acquereur_gagne', 'perdu') then
    raise exception 'cette étape passe par une action métier dédiée (offre / résultat)'
      using errcode = '22023';
  end if;
  if p_stage not in ('nouveau','a_contacter','contact_en_cours','qualifie','bien_a_proposer',
                     'visite_a_planifier','visite_planifiee','suivi_apres_visite') then
    raise exception 'étape inconnue' using errcode = '22023';
  end if;

  select pipeline_stage into v_old from public.buyer_profiles where id = p_buyer_profile_id;
  if v_old is null then raise exception 'dossier introuvable' using errcode = '22023'; end if;

  -- Un dossier déjà clos (gagné / perdu) n'est pas rouvert par un simple déplacement.
  if v_old in ('acquereur_gagne', 'perdu') then
    raise exception 'ce dossier est clos : rouvrez-le depuis une action métier dédiée'
      using errcode = '22023';
  end if;

  update public.buyer_profiles set pipeline_stage = p_stage where id = p_buyer_profile_id;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, old_value, new_value)
  values (v_uid, 'buyer_profile', p_buyer_profile_id, 'acquereur_stade',
          jsonb_build_object('stage', v_old), jsonb_build_object('stage', p_stage));

  return jsonb_build_object('ok', true, 'stage', p_stage);
end;
$$;

-- --- Qualification HUMAINE (jamais déduite d'un score) ------------------------
create or replace function public.crm_buyer_qualify(
  p_buyer_profile_id uuid, p_status text, p_reason text default null)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_old text;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.crm_buyer_can_operate(p_buyer_profile_id) then
    raise exception 'droits insuffisants sur ce dossier acquéreur' using errcode = '42501';
  end if;
  if p_status not in ('non_qualifie', 'en_cours', 'qualifie', 'ecarte') then
    raise exception 'statut de qualification invalide' using errcode = '22023';
  end if;
  -- Écarter un dossier est une décision motivée.
  if p_status = 'ecarte' and nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'un motif est requis pour écarter un dossier' using errcode = '22023';
  end if;

  select qualification_status into v_old from public.buyer_profiles where id = p_buyer_profile_id;
  if v_old is null then raise exception 'dossier introuvable' using errcode = '22023'; end if;

  update public.buyer_profiles set
    qualification_status = p_status,
    qualification_reason = nullif(btrim(left(coalesce(p_reason, ''), 2000)), ''),
    qualified_by = v_uid,
    qualified_at = now()
  where id = p_buyer_profile_id;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, old_value, new_value)
  values (v_uid, 'buyer_profile', p_buyer_profile_id, 'acquereur_qualification',
          jsonb_build_object('status', v_old), jsonb_build_object('status', p_status));

  return jsonb_build_object('ok', true, 'status', p_status);
end;
$$;

-- --- Affectation du dossier ---------------------------------------------------
create or replace function public.crm_buyer_assign(
  p_buyer_profile_id uuid, p_user_id uuid, p_responsibility text default 'setter')
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_resp text;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  -- Affecter est un acte de pilotage : réservé à l'opérateur Prodigio.
  perform public.crm_require_role('administrateur', 'manager', 'setter');
  if not exists (select 1 from public.buyer_profiles where id = p_buyer_profile_id) then
    raise exception 'dossier introuvable' using errcode = '22023';
  end if;
  if not exists (select 1 from public.organization_memberships
                 where user_id = p_user_id and status = 'actif') then
    raise exception 'utilisateur cible non membre actif' using errcode = '22023';
  end if;

  v_resp := case when p_responsibility = any (array[
    'setter','manager','agent_immobilier','responsable_marketing'])
    then p_responsibility else 'setter' end;

  insert into public.buyer_assignments (buyer_profile_id, user_id, responsibility, assigned_by)
  values (p_buyer_profile_id, p_user_id, v_resp, v_uid)
  on conflict (buyer_profile_id, user_id) do update set responsibility = excluded.responsibility;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'buyer_profile', p_buyer_profile_id, 'acquereur_affectation',
          jsonb_build_object('user_id', p_user_id, 'responsibility', v_resp));

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.crm_buyer_unassign(p_buyer_profile_id uuid, p_user_id uuid)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  perform public.crm_require_role('administrateur', 'manager', 'setter');

  delete from public.buyer_assignments
    where buyer_profile_id = p_buyer_profile_id and user_id = p_user_id;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, old_value)
  values (v_uid, 'buyer_profile', p_buyer_profile_id, 'acquereur_affectation',
          jsonb_build_object('user_id', p_user_id, 'removed', true));

  return jsonb_build_object('ok', true);
end;
$$;

-- --- Critères de recherche (saisie HUMAINE : verrouille l'amorçage funnel) ----
create or replace function public.crm_buyer_upsert_criteria(
  p_buyer_profile_id uuid,
  p_property_types text[] default null,
  p_locations text[] default null,
  p_budget_min_cents bigint default null,
  p_budget_max_cents bigint default null,
  p_purchase_horizon text default null,
  p_financing text default null,
  p_project_nature text default null,
  p_decision_mode text default null,
  p_notes text default null)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_types text[];
  v_locations text[];
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.crm_buyer_can_operate(p_buyer_profile_id) then
    raise exception 'droits insuffisants sur ce dossier acquéreur' using errcode = '42501';
  end if;
  if p_budget_min_cents is not null and p_budget_min_cents < 0 then
    raise exception 'budget minimal invalide' using errcode = '22023';
  end if;
  if p_budget_max_cents is not null and p_budget_max_cents < 0 then
    raise exception 'budget maximal invalide' using errcode = '22023';
  end if;
  if p_budget_min_cents is not null and p_budget_max_cents is not null
     and p_budget_max_cents < p_budget_min_cents then
    raise exception 'le budget maximal doit être supérieur au budget minimal' using errcode = '22023';
  end if;

  -- Normalisation : valeurs non vides, dédoublonnées, localisations en minuscules.
  select coalesce(array_agg(distinct btrim(t)), '{}'::text[]) into v_types
    from unnest(coalesce(p_property_types, '{}'::text[])) as t
    where nullif(btrim(t), '') is not null;
  select coalesce(array_agg(distinct lower(btrim(l))), '{}'::text[]) into v_locations
    from unnest(coalesce(p_locations, '{}'::text[])) as l
    where nullif(btrim(l), '') is not null;

  insert into public.buyer_search_criteria as c (
    buyer_profile_id, property_types, locations, budget_min_cents, budget_max_cents,
    purchase_horizon, financing, project_nature, decision_mode, notes, source, updated_by)
  values (
    p_buyer_profile_id,
    coalesce(v_types, '{}'::text[]), coalesce(v_locations, '{}'::text[]),
    p_budget_min_cents, p_budget_max_cents,
    p_purchase_horizon, p_financing, p_project_nature, p_decision_mode,
    nullif(btrim(left(coalesce(p_notes, ''), 4000)), ''),
    'humain', v_uid)
  on conflict (buyer_profile_id) do update set
    property_types = case when p_property_types is null then c.property_types else coalesce(v_types, '{}'::text[]) end,
    locations = case when p_locations is null then c.locations else coalesce(v_locations, '{}'::text[]) end,
    budget_min_cents = p_budget_min_cents,
    budget_max_cents = p_budget_max_cents,
    purchase_horizon = p_purchase_horizon,
    financing = p_financing,
    project_nature = p_project_nature,
    decision_mode = p_decision_mode,
    notes = nullif(btrim(left(coalesce(p_notes, ''), 4000)), ''),
    -- Verrou : une saisie humaine ne sera plus écrasée par un nouvel intérêt.
    source = 'humain',
    updated_by = v_uid;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'buyer_profile', p_buyer_profile_id, 'acquereur_criteres',
          jsonb_build_object('source', 'humain'));

  return jsonb_build_object('ok', true);
end;
$$;

-- --- Offre en cours (action métier dédiée : confirmation + audit) -------------
create or replace function public.crm_buyer_record_offer(
  p_buyer_profile_id uuid,
  p_property_id uuid default null,
  p_amount_cents bigint default null,
  p_note text default null)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_old text;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.crm_buyer_can_operate(p_buyer_profile_id) then
    raise exception 'droits insuffisants sur ce dossier acquéreur' using errcode = '42501';
  end if;
  if p_amount_cents is not null and p_amount_cents < 0 then
    raise exception 'montant invalide' using errcode = '22023';
  end if;
  if p_property_id is not null
     and not exists (select 1 from public.properties where id = p_property_id) then
    raise exception 'bien introuvable' using errcode = '22023';
  end if;

  select pipeline_stage into v_old from public.buyer_profiles where id = p_buyer_profile_id;
  if v_old is null then raise exception 'dossier introuvable' using errcode = '22023'; end if;

  update public.buyer_profiles set
    pipeline_stage = 'offre_en_cours',
    offer_property_id = p_property_id,
    offer_amount_cents = p_amount_cents,
    offer_recorded_by = v_uid,
    offer_recorded_at = now()
  where id = p_buyer_profile_id;

  -- Trace métier lisible dans la timeline (distincte de l'audit technique).
  insert into public.activities (buyer_profile_id, author_user_id, type, body)
  values (p_buyer_profile_id, v_uid, 'note',
          nullif(btrim(left(coalesce(p_note, ''), 4000)), ''));

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, old_value, new_value)
  values (v_uid, 'buyer_profile', p_buyer_profile_id, 'acquereur_offre',
          jsonb_build_object('stage', v_old),
          jsonb_build_object('property_id', p_property_id, 'amount_cents', p_amount_cents));

  return jsonb_build_object('ok', true, 'stage', 'offre_en_cours');
end;
$$;

-- --- Résultat commercial : gagné / perdu (motif obligatoire si perdu) ---------
create or replace function public.crm_buyer_record_outcome(
  p_buyer_profile_id uuid, p_outcome text, p_reason text default null)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_old text; v_stage text;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  -- Clore un dossier est une décision sensible.
  if not public.crm_can_decide() then
    raise exception 'seul un administrateur ou un manager enregistre le résultat d''un dossier acquéreur'
      using errcode = '42501';
  end if;
  if not public.crm_buyer_profile_access(p_buyer_profile_id) then
    raise exception 'droits insuffisants sur ce dossier acquéreur' using errcode = '42501';
  end if;
  if p_outcome not in ('gagne', 'perdu') then
    raise exception 'résultat invalide' using errcode = '22023';
  end if;
  if p_outcome = 'perdu' and nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'un motif de perte est obligatoire' using errcode = '22023';
  end if;

  select pipeline_stage into v_old from public.buyer_profiles where id = p_buyer_profile_id;
  if v_old is null then raise exception 'dossier introuvable' using errcode = '22023'; end if;

  v_stage := case when p_outcome = 'gagne' then 'acquereur_gagne' else 'perdu' end;

  update public.buyer_profiles set
    outcome = p_outcome,
    outcome_reason = nullif(btrim(left(coalesce(p_reason, ''), 2000)), ''),
    outcome_recorded_by = v_uid,
    outcome_recorded_at = now(),
    pipeline_stage = v_stage
  where id = p_buyer_profile_id;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, old_value, new_value)
  values (v_uid, 'buyer_profile', p_buyer_profile_id, 'acquereur_resultat',
          jsonb_build_object('stage', v_old),
          jsonb_build_object('outcome', p_outcome, 'stage', v_stage));

  return jsonb_build_object('ok', true, 'outcome', p_outcome, 'stage', v_stage);
end;
$$;

-- --- Réouverture d'un dossier clos (décision tracée) --------------------------
create or replace function public.crm_buyer_reopen(p_buyer_profile_id uuid, p_reason text)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_old text;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.crm_can_decide() then
    raise exception 'seul un administrateur ou un manager rouvre un dossier acquéreur'
      using errcode = '42501';
  end if;
  if not public.crm_buyer_profile_access(p_buyer_profile_id) then
    raise exception 'droits insuffisants sur ce dossier acquéreur' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'un motif est requis pour rouvrir un dossier' using errcode = '22023';
  end if;

  select pipeline_stage into v_old from public.buyer_profiles where id = p_buyer_profile_id;
  if v_old is null then raise exception 'dossier introuvable' using errcode = '22023'; end if;

  update public.buyer_profiles set
    pipeline_stage = 'suivi_apres_visite',
    outcome = null, outcome_reason = null,
    outcome_recorded_by = null, outcome_recorded_at = null
  where id = p_buyer_profile_id;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, old_value, new_value)
  values (v_uid, 'buyer_profile', p_buyer_profile_id, 'acquereur_stade',
          jsonb_build_object('stage', v_old),
          jsonb_build_object('stage', 'suivi_apres_visite',
                             'reason', left(btrim(p_reason), 2000), 'reopened', true));

  return jsonb_build_object('ok', true, 'stage', 'suivi_apres_visite');
end;
$$;

-- --- Suivi opérationnel : activités & tâches DU DOSSIER ACQUÉREUR -------------
-- Écrivent dans les tables EXISTANTES (`activities`, `tasks`) : aucune table en
-- double. Seule la garde d'autorisation diffère (dossier acquéreur ≠ opportunité).
create or replace function public.crm_buyer_log_activity(
  p_buyer_profile_id uuid,
  p_type text,
  p_outcome text default null,
  p_body text default null,
  p_occurred_at timestamptz default now())
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_type text; v_outcome text; v_id uuid; v_contact uuid;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.crm_buyer_can_operate(p_buyer_profile_id) then
    raise exception 'droits insuffisants sur ce dossier acquéreur' using errcode = '42501';
  end if;

  v_type := case when p_type = any (array[
    'appel','tentative_appel','email','sms_whatsapp','rendez_vous','note','autre'])
    then p_type else 'autre' end;
  v_outcome := case when p_outcome = any (array[
    'sans_reponse','message_laisse','rappel_demande','contact_etabli','mauvais_numero'])
    then p_outcome end;

  select contact_id into v_contact from public.buyer_profiles where id = p_buyer_profile_id;
  if v_contact is null then raise exception 'dossier introuvable' using errcode = '22023'; end if;

  insert into public.activities
    (buyer_profile_id, contact_id, author_user_id, type, outcome, body, occurred_at)
  values (p_buyer_profile_id, v_contact, v_uid, v_type, v_outcome,
          nullif(left(p_body, 4000), ''), coalesce(p_occurred_at, now()))
  returning id into v_id;

  update public.buyer_profiles set last_activity_at = now() where id = p_buyer_profile_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

create or replace function public.crm_buyer_create_task(
  p_buyer_profile_id uuid,
  p_title text,
  p_kind text default 'rappel',
  p_due_at timestamptz default null,
  p_assignee_user_id uuid default null)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_kind text; v_id uuid;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.crm_buyer_can_operate(p_buyer_profile_id) then
    raise exception 'droits insuffisants sur ce dossier acquéreur' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_title, '')), '') is null then
    raise exception 'intitulé requis' using errcode = '22023';
  end if;
  if not exists (select 1 from public.buyer_profiles where id = p_buyer_profile_id) then
    raise exception 'dossier introuvable' using errcode = '22023';
  end if;

  v_kind := case when p_kind in ('rappel', 'tache') then p_kind else 'rappel' end;

  insert into public.tasks
    (buyer_profile_id, author_user_id, assignee_user_id, title, kind, due_at)
  values (p_buyer_profile_id, v_uid, coalesce(p_assignee_user_id, v_uid),
          left(btrim(p_title), 300), v_kind, p_due_at)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- Changement de statut d'une tâche acquéreur (la fonction Mandats existante
-- `crm_set_task_status` reste réservée aux tâches d'opportunité).
create or replace function public.crm_buyer_set_task_status(p_task_id uuid, p_status text)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_profile uuid;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if p_status not in ('a_faire', 'fait', 'annule') then
    raise exception 'statut invalide' using errcode = '22023';
  end if;

  select buyer_profile_id into v_profile from public.tasks where id = p_task_id;
  if v_profile is null then raise exception 'tâche acquéreur introuvable' using errcode = '22023'; end if;
  if not public.crm_buyer_can_operate(v_profile) then
    raise exception 'droits insuffisants sur ce dossier acquéreur' using errcode = '42501';
  end if;

  update public.tasks set
    status = p_status,
    completed_at = case when p_status = 'fait' then now() else null end
  where id = p_task_id;

  return jsonb_build_object('ok', true);
end;
$$;

-- =============================================================================
-- 11. MATCHING BIENS ↔ ACQUÉREURS — fondation V1 DÉTERMINISTE et EXPLICABLE.
--     Distinct du scoring du funnel (qui qualifie la DEMANDE) : ici on compare
--     des critères EXPLICITES à des biens réels. Versionné « buyer-matching-v1 ».
--     Ce n'est JAMAIS une décision automatique : uniquement une recommandation
--     accompagnée de ses facteurs, incompatibilités et données manquantes.
--     Aucune boîte noire, aucune IA. Miroir de src/modules/buyers/crm/matching.ts.
-- =============================================================================
create or replace function public.crm_buyer_property_matches(
  p_buyer_profile_id uuid, p_limit integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_c public.buyer_search_criteria;
  v_limit int := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_items jsonb;
begin
  if auth.uid() is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.crm_buyer_profile_access(p_buyer_profile_id) then
    raise exception 'droits insuffisants sur ce dossier acquéreur' using errcode = '42501';
  end if;

  select * into v_c from public.buyer_search_criteria where buyer_profile_id = p_buyer_profile_id;

  with candidate as (
    select
      p.id,
      p.project_name,
      p.commercial_title,
      p.property_type,
      p.location_city,
      p.location_postal_code,
      p.status,
      cfg.publication_status,
      cfg.slug,
      cfg.public_location,
      cfg.reference_value_cents
    from public.properties p
    left join public.property_public_config cfg on cfg.property_id = p.id
    -- Cloisonnement : uniquement les biens réellement accessibles à l'utilisateur.
    where public.crm_property_access(p.id)
      and p.status <> 'archive'
  ),
  scored as (
    select
      c.*,
      -- --- Budget (poids 40) : la valeur de référence interne du bien est
      --     comparée à la fourchette de l'acquéreur. Sans donnée : NEUTRE.
      case
        when c.reference_value_cents is null
             or (v_c.budget_min_cents is null and v_c.budget_max_cents is null) then null
        when (v_c.budget_min_cents is null or c.reference_value_cents >= v_c.budget_min_cents)
             and (v_c.budget_max_cents is null or c.reference_value_cents <= v_c.budget_max_cents)
          then true
        else false
      end as budget_ok,
      -- --- Type de bien (poids 25).
      case
        when v_c.property_types is null or cardinality(v_c.property_types) = 0
             or c.property_type is null then null
        when c.property_type = any (v_c.property_types) then true
        else false
      end as type_ok,
      -- --- Localisation (poids 25) : comparaison textuelle explicite.
      case
        when v_c.locations is null or cardinality(v_c.locations) = 0 then null
        when exists (
          select 1 from unnest(v_c.locations) as loc
          where loc <> '' and (
            lower(coalesce(c.location_city, '')) like '%' || loc || '%'
            or lower(coalesce(c.public_location, '')) like '%' || loc || '%'
            or lower(coalesce(c.location_postal_code, '')) like '%' || loc || '%')
        ) then true
        when c.location_city is null and c.public_location is null then null
        else false
      end as location_ok,
      -- --- Disponibilité commerciale (poids 10) : un bien publié est proposable
      --     tout de suite ; un bien en préparation reste une piste, pas un refus.
      case
        when c.publication_status = 'publie' then true
        when c.publication_status in ('pret_a_publier', 'en_preparation') then null
        else false
      end as ready_ok
    from candidate c
  ),
  weighted as (
    select s.*,
      -- Score = points obtenus / points RÉELLEMENT évaluables (les critères sans
      -- donnée sont exclus du dénominateur : aucune fausse précision).
      (case when s.budget_ok then 40 else 0 end
       + case when s.type_ok then 25 else 0 end
       + case when s.location_ok then 25 else 0 end
       + case when s.ready_ok then 10 else 0 end) as points,
      (case when s.budget_ok is null then 0 else 40 end
       + case when s.type_ok is null then 0 else 25 end
       + case when s.location_ok is null then 0 else 25 end
       + case when s.ready_ok is null then 0 else 10 end) as evaluable
    from scored s
  )
  select jsonb_agg(node order by node_score desc, node_name asc)
    into v_items
  from (
    select
      coalesce(w.commercial_title, w.project_name, 'Bien sans nom') as node_name,
      case when w.evaluable = 0 then null
           else round((w.points::numeric / w.evaluable) * 100)::int end as node_score,
      jsonb_build_object(
        'property_id', w.id,
        'name', coalesce(w.commercial_title, w.project_name, 'Bien sans nom'),
        'slug', w.slug,
        'property_type', w.property_type,
        'city', coalesce(w.location_city, w.public_location),
        'publication_status', w.publication_status,
        'score', case when w.evaluable = 0 then null
                      else round((w.points::numeric / w.evaluable) * 100)::int end,
        'evaluable_weight', w.evaluable,
        -- Détail EXPLICABLE : trois listes distinctes, jamais un score opaque.
        'positives',
          (case when w.budget_ok is true then jsonb_build_array('budget') else '[]'::jsonb end
           || case when w.type_ok is true then jsonb_build_array('type_de_bien') else '[]'::jsonb end
           || case when w.location_ok is true then jsonb_build_array('localisation') else '[]'::jsonb end
           || case when w.ready_ok is true then jsonb_build_array('disponibilite') else '[]'::jsonb end),
        'incompatibilities',
          (case when w.budget_ok is false then jsonb_build_array('budget') else '[]'::jsonb end
           || case when w.type_ok is false then jsonb_build_array('type_de_bien') else '[]'::jsonb end
           || case when w.location_ok is false then jsonb_build_array('localisation') else '[]'::jsonb end
           || case when w.ready_ok is false then jsonb_build_array('disponibilite') else '[]'::jsonb end),
        'missing',
          (case when w.budget_ok is null then jsonb_build_array('budget') else '[]'::jsonb end
           || case when w.type_ok is null then jsonb_build_array('type_de_bien') else '[]'::jsonb end
           || case when w.location_ok is null then jsonb_build_array('localisation') else '[]'::jsonb end
           || case when w.ready_ok is null then jsonb_build_array('disponibilite') else '[]'::jsonb end)
      ) as node
    from weighted w
    -- Une incompatibilité de budget ou de localisation reste affichée (elle est
    -- explicable), mais les biens sans AUCUN critère évaluable sont écartés.
    where w.evaluable > 0
    order by node_score desc nulls last, node_name asc
    limit v_limit
  ) ranked;

  return jsonb_build_object(
    'version', 'buyer-matching-v1',
    'criteria_source', coalesce(v_c.source, 'absent'),
    'weights', jsonb_build_object(
      'budget', 40, 'type_de_bien', 25, 'localisation', 25, 'disponibilite', 10),
    'items', coalesce(v_items, '[]'::jsonb));
end;
$$;

comment on function public.crm_buyer_property_matches(uuid, integer) is
  'Matching DÉTERMINISTE et EXPLICABLE entre un dossier acquéreur et les biens accessibles (buyer-matching-v1). Distinct du scoring du funnel. Calculé côté serveur, versionné, sur critères explicites uniquement, avec facteurs positifs / incompatibilités / données manquantes. Recommandation, jamais décision automatique. Miroir de src/modules/buyers/crm/matching.ts.';

-- =============================================================================
-- 12. GRANTS — EXECUTE réservé aux seuls `authenticated`. Aucune fonction du CRM
--     Acquéreurs n'est exécutable par `anon` ou `PUBLIC`.
-- =============================================================================
do $$
declare fn text;
begin
  for fn in
    select unnest(array[
      'public.crm_buyer_set_stage(uuid, text)',
      'public.crm_buyer_qualify(uuid, text, text)',
      'public.crm_buyer_assign(uuid, uuid, text)',
      'public.crm_buyer_unassign(uuid, uuid)',
      'public.crm_buyer_upsert_criteria(uuid, text[], text[], bigint, bigint, text, text, text, text, text)',
      'public.crm_buyer_record_offer(uuid, uuid, bigint, text)',
      'public.crm_buyer_record_outcome(uuid, text, text)',
      'public.crm_buyer_reopen(uuid, text)',
      'public.crm_buyer_log_activity(uuid, text, text, text, timestamptz)',
      'public.crm_buyer_create_task(uuid, text, text, timestamptz, uuid)',
      'public.crm_buyer_set_task_status(uuid, text)',
      'public.crm_buyer_property_matches(uuid, integer)'
    ])
  loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end $$;

-- =============================================================================
-- 13. SUBMIT_BUYER_INTEREST — extension ADDITIVE du point d'entrée public.
--     Comportement inchangé (idempotence, dédoublonnage conservateur par e-mail,
--     scoring recalculé en base, preuve RGPD, réponse NEUTRE). On ajoute
--     uniquement : rattachement au dossier acquéreur + `buyer_profile_id` renvoyé
--     au SERVEUR (jamais au navigateur) pour le deep link de l'alerte Slack.
--
--     Le contact existant est RÉUTILISÉ sans qu'aucune de ses données (issues du
--     parcours vendeur notamment) ne soit modifiée : aucun UPDATE sur contacts.
-- =============================================================================
create or replace function public.submit_buyer_interest(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_idempotency_key   text;
  v_slug              text;
  v_property_id       uuid;
  v_property_name     text;
  v_org               uuid;
  v_pub_status        text;
  v_ref_cents         bigint;
  v_email             text := nullif(lower(trim(payload->>'contact_email')), '');
  v_phone             text := nullif(trim(payload->>'contact_phone'), '');
  v_consent           boolean;
  v_pref              text;
  v_recall            text;
  v_project_nature    text;
  v_budget_band       text;
  v_financing         text;
  v_purchase_horizon  text;
  v_decision_mode     text;
  v_availability      text;
  v_channels          text[];
  v_scores            jsonb;
  v_contact_id        uuid;
  v_interest_id       uuid;
  v_resolution        text;
  v_profile_id        uuid;
begin
  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'payload invalide' using errcode = '22023';
  end if;
  if length(payload::text) > 65536 then
    raise exception 'payload trop volumineux' using errcode = '22001';
  end if;

  v_idempotency_key := left(nullif(payload->>'idempotency_key', ''), 200);
  if v_idempotency_key is null then
    raise exception 'idempotency_key manquant' using errcode = '22023';
  end if;

  v_slug := public.normalize_public_slug(payload->>'slug');
  if v_slug is null then raise exception 'bien inconnu' using errcode = '22023'; end if;
  select c.property_id, c.publication_status, c.reference_value_cents, c.public_name
    into v_property_id, v_pub_status, v_ref_cents, v_property_name
  from public.property_public_config c
  where lower(c.slug) = v_slug limit 1;
  if v_property_id is null or v_pub_status <> 'publie' then
    return jsonb_build_object('accepted', true, 'created', false);
  end if;
  select organization_id into v_org from public.properties where id = v_property_id;

  v_email := left(v_email, 320);
  v_phone := left(v_phone, 64);
  v_consent := lower(coalesce(payload->>'consent_given', '')) in ('true', 't', '1', 'yes', 'on');

  v_project_nature := (case when payload->>'project_nature' = any (array[
    'residence_principale','residence_secondaire','investissement','autre']) then payload->>'project_nature' end);
  v_budget_band := (case when payload->>'budget_band' = any (array[
    'moins_800k','800k_1_2m','1_2m_2m','2m_3m','plus_3m','a_definir']) then payload->>'budget_band' end);
  v_financing := (case when payload->>'financing' = any (array[
    'fonds_propres','accord_bancaire','financement_a_organiser']) then payload->>'financing' end);
  v_purchase_horizon := (case when payload->>'purchase_horizon' = any (array[
    'immediat','trois_mois','six_mois','en_reflexion']) then payload->>'purchase_horizon' end);
  v_decision_mode := (case when payload->>'decision_mode' = any (array[
    'seul','avec_autres']) then payload->>'decision_mode' end);
  v_availability := (case when payload->>'availability' = any (array[
    'disponible_visite','disponible_echange','a_convenir']) then payload->>'availability' end);
  v_pref := (case when payload->>'contact_preference' = any (array[
    'telephone','email','indifferent']) then payload->>'contact_preference' end);
  v_recall := (case when payload->>'contact_recall_preference' = any (array[
    'des_que_possible','matin','apres_midi','debut_soiree']) then payload->>'contact_recall_preference' end);

  v_channels := case
    when v_pref = 'telephone' then array['telephone']
    when v_pref = 'email' then array['email']
    else array['telephone', 'email'] end;

  v_scores := public.compute_buyer_scores(
    v_budget_band, v_financing, v_purchase_horizon, v_project_nature,
    v_decision_mode, v_availability, v_ref_cents);

  -- 1) Intérêt (soumission conservée). Idempotent : gère aussi la course.
  insert into public.buyer_interests (
    organization_id, property_id, funnel_key, funnel_version, idempotency_key,
    raw_answers, normalized_answers,
    project_nature, budget_band, financing, purchase_horizon, decision_mode, availability,
    residence_country, residence_area,
    contact_first_name, contact_last_name, contact_email, contact_email_raw,
    contact_phone, contact_phone_raw, contact_preference, contact_recall_preference,
    consent_given, consent_notice_version,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content,
    fbclid, gclid, origin_url, referrer, first_touch, last_touch, user_agent,
    budget_score, maturity_score, financing_score, availability_score, overall_score,
    priority, score_version, score_breakdown
  ) values (
    v_org, v_property_id, 'buyer_interest', 'v1', v_idempotency_key,
    coalesce(payload->'raw_answers', '{}'::jsonb),
    coalesce(payload->'normalized_answers', '{}'::jsonb),
    v_project_nature, v_budget_band, v_financing, v_purchase_horizon, v_decision_mode, v_availability,
    left(nullif(payload->>'residence_country', ''), 120),
    left(nullif(payload->>'residence_area', ''), 160),
    left(nullif(payload->>'contact_first_name', ''), 120),
    left(nullif(payload->>'contact_last_name', ''), 120),
    v_email, left(nullif(payload->>'contact_email_raw', ''), 320),
    v_phone, left(nullif(payload->>'contact_phone_raw', ''), 64),
    v_pref, v_recall,
    v_consent, left(nullif(payload->>'consent_notice_version', ''), 60),
    left(nullif(payload->>'utm_source', ''), 300), left(nullif(payload->>'utm_medium', ''), 300),
    left(nullif(payload->>'utm_campaign', ''), 300), left(nullif(payload->>'utm_term', ''), 300),
    left(nullif(payload->>'utm_content', ''), 300),
    left(nullif(payload->>'fbclid', ''), 512), left(nullif(payload->>'gclid', ''), 512),
    left(nullif(payload->>'origin_url', ''), 2048), left(nullif(payload->>'referrer', ''), 2048),
    payload->'first_touch', payload->'last_touch',
    left(nullif(payload->>'user_agent', ''), 1024),
    (v_scores->'budget'->>'score')::int, (v_scores->'maturity'->>'score')::int,
    (v_scores->'financing'->>'score')::int, (v_scores->'availability'->>'score')::int,
    (v_scores->>'overall')::int, v_scores->>'priority', v_scores->>'score_version', v_scores
  )
  on conflict (idempotency_key) do nothing
  returning id into v_interest_id;

  -- Rejeu idempotent : accusé NEUTRE, aucune alerte Slack, aucun doublon.
  if v_interest_id is null then
    return jsonb_build_object('accepted', true, 'created', false);
  end if;

  -- 2) Résolution du contact — dédoublonnage CONSERVATEUR par e-mail uniquement.
  --    Un contact existant (vendeur ou acquéreur) est RÉUTILISÉ TEL QUEL :
  --    aucune de ses données n'est modifiée ici.
  if v_email is not null then
    select id into v_contact_id from public.contacts
      where lower(email) = v_email order by created_at asc limit 1;
  end if;
  if v_contact_id is null then
    insert into public.contacts (kind, first_name, last_name, email, phone, preferred_channel, status)
    values ('personne_physique',
      left(nullif(payload->>'contact_first_name', ''), 120),
      left(nullif(payload->>'contact_last_name', ''), 120),
      v_email, v_phone, v_pref, 'nouveau')
    returning id into v_contact_id;
    v_resolution := 'nouveau_contact';
  else
    v_resolution := 'contact_existant';
  end if;

  -- 3) PrivacyRecord (preuve). Rattaché à l'intérêt acquéreur. Base légale À VALIDER.
  insert into public.privacy_records (
    buyer_interest_id, contact_id, purpose, legal_basis, notice_version, notice_text,
    controllers, recipients, authorized_channels, choice, choice_source, proof, do_not_contact
  ) values (
    v_interest_id, v_contact_id,
    'manifestation_interet_acquereur',
    'a_valider_juridiquement',
    left(nullif(payload->>'consent_notice_version', ''), 60),
    left(nullif(payload->>'consent_notice_text', ''), 2000),
    'Prodigio (opérateur du système) — à confirmer contractuellement',
    'Agence immobilière habilitée, partenaire de Prodigio (transmission future, à confirmer)',
    v_channels,
    case when v_consent then 'accorde' else 'refuse' end,
    'funnel_acquereur',
    case when jsonb_typeof(payload->'consent_proof') = 'object' then payload->'consent_proof' else null end,
    false
  );

  -- 4) Rattachement du contact à l'intérêt (la soumission reste la source).
  update public.buyer_interests set contact_id = v_contact_id, resolution = v_resolution
    where id = v_interest_id;

  -- 5) NOUVEAU : rattachement au DOSSIER ACQUÉREUR consolidé (créé si absent).
  --    Ne modifie jamais le contact, ne fusionne jamais deux personnes.
  v_profile_id := public.buyer_attach_interest(v_interest_id);

  -- Accusé NEUTRE + champs SERVEUR (alerte Slack sans doublon), jamais renvoyés
  -- au navigateur par l'action Next.
  return jsonb_build_object(
    'accepted', true, 'created', true,
    'interest_id', v_interest_id, 'property_id', v_property_id,
    'property_name', v_property_name,
    'buyer_profile_id', v_profile_id);
end;
$$;

comment on function public.submit_buyer_interest(jsonb) is
  'Seul point d''entrée public de dépôt d''un intérêt acquéreur. Résout le bien par slug PUBLIÉ, valide structure/tailles/énumérations, recalcule le scoring en base, crée/relie intérêt + contact (dédoublonnage e-mail CONSERVATEUR, aucune donnée du contact existant modifiée) + preuve RGPD, rattache le DOSSIER ACQUÉREUR consolidé, idempotent, et ne renvoie qu''un accusé neutre (+ interest_id/property_id/buyer_profile_id destinés au serveur pour l''alerte Slack).';

revoke all on function public.submit_buyer_interest(jsonb) from public;
grant execute on function public.submit_buyer_interest(jsonb) to anon, authenticated;

-- =============================================================================
-- 14. BACKFILL — dossiers acquéreurs pour les intérêts DÉJÀ enregistrés.
--     Idempotent : ne crée jamais de doublon (unicité par contact).
-- =============================================================================
do $$
declare v_id uuid;
begin
  for v_id in
    select id from public.buyer_interests
    where buyer_profile_id is null and contact_id is not null
    order by created_at asc
  loop
    perform public.buyer_attach_interest(v_id);
  end loop;
end $$;

commit;
