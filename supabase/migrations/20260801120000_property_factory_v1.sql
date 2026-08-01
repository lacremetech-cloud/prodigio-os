-- =============================================================================
-- Prodigio OS — Migration 20260801120000_property_factory_v1
--
-- « Fabrique de biens V1 » : cockpit de production d'un bien après le handoff du
-- mandat signé (identité, positionnement, documents, médiathèque, plan de
-- production, préparation au lancement).
--
-- STRICTEMENT ADDITIVE. Ne modifie ni ne supprime aucune migration historique,
-- aucune donnée réelle. S'appuie sur l'existant : properties (handoff),
-- mandate_documents, tasks, organizations, audit_events immuable, RLS, helpers
-- crm_is_operator / crm_has_role / crm_require_role / crm_assigned_opportunity_ids
-- / crm_current_operator_org / crm_can_decide.
--
-- Ajoute :
--   1. Extension ADDITIVE des CHECK d'audit_events (événements « bien_* »).
--   2. properties : machine d'état (sur-ensemble de « preparation_a_lancer »),
--      colonnes d'identité, responsable, média principal, décision « prêt ».
--   3. property_positioning — stratégie / marque du bien (1-1).
--   4. property_media       — médiathèque privée (bucket Storage privé).
--   5. property_documents   — documents classés (bucket Storage privé).
--   6. property_production_items — plan de production pilotable.
--   7. Helper d'accès crm_property_access + fonctions SECURITY DEFINER (rôle
--      re-vérifié, search_path figé, audit), readiness calculée en base.
--   8. Bucket Storage PRIVÉ « property-assets » (gardé).
--
-- Aucune donnée sensible dans l'audit. Aucun bucket public. Chemins Storage sans
-- PII. La readiness est CALCULÉE et le passage « prêt à lancer » est contrôlé et
-- audité côté serveur.
-- =============================================================================

begin;

-- =============================================================================
-- 1. AUDIT — extension ADDITIVE (sur-ensemble strict).
-- =============================================================================
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
      -- Nouveaux (Fabrique de biens) :
      'bien_identite', 'bien_positionnement', 'bien_statut', 'bien_responsable',
      'bien_media_ajoute', 'bien_media_supprime', 'bien_media_principal',
      'bien_document_ajoute', 'bien_document_supprime',
      'bien_production_maj', 'bien_pret'));

-- =============================================================================
-- 2. PROPERTIES — machine d'état + identité + responsable + média + readiness.
-- =============================================================================
alter table public.properties
  add column if not exists project_name text,
  add column if not exists commercial_title text,
  add column if not exists property_type text,
  add column if not exists address_line text,
  add column if not exists location_city text,
  add column if not exists location_postal_code text,
  add column if not exists location_country text,
  add column if not exists surface_m2 numeric(10,2),
  add column if not exists land_m2 numeric(12,2),
  add column if not exists rooms integer,
  add column if not exists bedrooms integer,
  add column if not exists year_built integer,
  add column if not exists arch_style text,
  add column if not exists description text,
  add column if not exists history text,
  add column if not exists signature_detail text,
  add column if not exists responsible_user_id uuid references auth.users (id) on delete set null,
  add column if not exists main_media_id uuid,
  add column if not exists ready_at timestamptz,
  add column if not exists ready_by uuid references auth.users (id) on delete set null,
  add column if not exists status_reason text;

-- Machine d'état : sur-ensemble INCLUANT « preparation_a_lancer » (valeur initiale
-- posée par le handoff) → aucune donnée existante invalidée.
alter table public.properties
  drop constraint if exists properties_status_check,
  add constraint properties_status_check check (
    status in (
      'preparation_a_lancer',        -- initial (handoff) = « à configurer »
      'collecte_en_cours',
      'strategie_en_cours',
      'production_en_cours',
      'validation_avant_lancement',
      'pret_a_lancer',
      'en_diffusion',
      'suspendu',
      'archive'));

-- =============================================================================
-- 3. PROPERTY_POSITIONING — stratégie & marque (1-1 avec le bien).
-- =============================================================================
create table if not exists public.property_positioning (
  property_id           uuid primary key references public.properties (id) on delete cascade,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  central_promise       text,
  value_pillars         text,
  differentiators       text,
  emotional_details     text,
  ideal_buyer_profile   text,
  buyer_locations       text,
  buyer_motivation      text,
  target_zones          text,
  ad_angles             text,
  do_not_communicate    text,
  brand_name            text,
  validated             boolean not null default false,
  validated_by          uuid references auth.users (id) on delete set null,
  validated_at          timestamptz,
  updated_by            uuid references auth.users (id) on delete set null
);

comment on table public.property_positioning is
  'Positionnement & stratégie du bien (promesse, piliers, différenciants, acheteur idéal, zones, angles, marque). 1-1 avec properties. Validation humaine tracée.';

drop trigger if exists property_positioning_set_updated_at on public.property_positioning;
create trigger property_positioning_set_updated_at
  before update on public.property_positioning
  for each row execute function public.set_updated_at();

alter table public.property_positioning enable row level security;
grant select on public.property_positioning to authenticated;

-- =============================================================================
-- 4. PROPERTY_MEDIA — médiathèque privée (fichiers dans le bucket privé).
-- =============================================================================
create table if not exists public.property_media (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  property_id      uuid not null references public.properties (id) on delete cascade,
  kind             text not null
                     check (kind in ('photo', 'video', 'drone', 'plan', 'rendu', 'couverture', 'autre')),
  storage_path     text not null,
  file_name        text not null,
  mime_type        text not null,
  size_bytes       bigint not null check (size_bytes >= 0),
  title            text,
  rights_status    text not null default 'a_verifier'
                     check (rights_status in ('a_verifier', 'libre', 'sous_licence', 'restreint')),
  status           text not null default 'actif' check (status in ('actif', 'supprime')),
  uploaded_by      uuid references auth.users (id) on delete set null,
  deleted_by       uuid references auth.users (id) on delete set null,
  deleted_at       timestamptz,
  constraint property_media_storage_unique unique (storage_path)
);

comment on table public.property_media is
  'Médiathèque privée du bien (photo/vidéo/drone/plan/rendu/couverture). Fichiers dans un bucket Storage PRIVÉ ; accès par URL signée serveur uniquement. Aucune PII dans storage_path.';

create index if not exists property_media_property_idx on public.property_media (property_id, status);

drop trigger if exists property_media_set_updated_at on public.property_media;
create trigger property_media_set_updated_at
  before update on public.property_media
  for each row execute function public.set_updated_at();

alter table public.property_media enable row level security;
grant select on public.property_media to authenticated;

-- FK du média principal (ajoutée après la table media).
alter table public.properties
  drop constraint if exists properties_main_media_fk,
  add constraint properties_main_media_fk
    foreign key (main_media_id) references public.property_media (id) on delete set null;

-- =============================================================================
-- 5. PROPERTY_DOCUMENTS — documents classés (bucket Storage privé).
-- =============================================================================
create table if not exists public.property_documents (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  property_id      uuid not null references public.properties (id) on delete cascade,
  category         text not null
                     check (category in ('mandat', 'diagnostic', 'plan', 'titre', 'legal',
                                         'copropriete', 'autorisation', 'libre')),
  storage_path     text not null,
  file_name        text not null,
  mime_type        text not null,
  size_bytes       bigint not null check (size_bytes >= 0),
  doc_status       text not null default 'a_valider'
                     check (doc_status in ('a_valider', 'valide', 'obsolete')),
  visibility       text not null default 'interne'
                     check (visibility in ('interne', 'restreint')),
  status           text not null default 'actif' check (status in ('actif', 'supprime')),
  uploaded_by      uuid references auth.users (id) on delete set null,
  deleted_by       uuid references auth.users (id) on delete set null,
  deleted_at       timestamptz,
  constraint property_documents_storage_unique unique (storage_path)
);

comment on table public.property_documents is
  'Documents du bien classés par catégorie (mandat, diagnostics, plans, titre, légal, copropriété, autorisations, libres). Fichiers dans un bucket Storage PRIVÉ ; URL signée serveur uniquement. Aucune PII dans storage_path.';

create index if not exists property_documents_property_idx on public.property_documents (property_id, status);

drop trigger if exists property_documents_set_updated_at on public.property_documents;
create trigger property_documents_set_updated_at
  before update on public.property_documents
  for each row execute function public.set_updated_at();

alter table public.property_documents enable row level security;
grant select on public.property_documents to authenticated;

-- =============================================================================
-- 6. PROPERTY_PRODUCTION_ITEMS — plan de production pilotable.
-- =============================================================================
create table if not exists public.property_production_items (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  property_id      uuid not null references public.properties (id) on delete cascade,
  kind             text not null
                     check (kind in ('photographie', 'video', 'drone', 'redaction', 'positionnement',
                                     'identite_visuelle', 'site_dedie', 'brochure', 'publicites',
                                     'funnel_acquereur', 'validation_finale')),
  status           text not null default 'a_faire'
                     check (status in ('a_faire', 'en_cours', 'en_revue', 'termine', 'valide', 'bloque')),
  assignee_user_id uuid references auth.users (id) on delete set null,
  due_at           timestamptz,
  notes            text,
  deliverable_url  text,
  blocker          text,
  validated_at     timestamptz,
  created_by       uuid references auth.users (id) on delete set null,
  updated_by       uuid references auth.users (id) on delete set null,
  constraint property_production_kind_unique unique (property_id, kind)
);

comment on table public.property_production_items is
  'Plan de production du bien (photographie, vidéo, drone, rédaction, positionnement, identité, site, brochure, publicités, funnel, validation). Un élément par type et par bien. Pilotage des livrables ; aucune génération automatique en V1.';

create index if not exists property_production_property_idx on public.property_production_items (property_id, status);

drop trigger if exists property_production_set_updated_at on public.property_production_items;
create trigger property_production_set_updated_at
  before update on public.property_production_items
  for each row execute function public.set_updated_at();

alter table public.property_production_items enable row level security;
grant select on public.property_production_items to authenticated;

-- =============================================================================
-- 7. HELPER D'ACCÈS — un bien est accessible via son opportunité (jamais global).
-- =============================================================================
create or replace function public.crm_property_access(p_property_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.properties p
    where p.id = p_property_id
      and (
        public.crm_is_operator()
        or (public.crm_has_role('agent_immobilier')
            and p.opportunity_id in (select public.crm_assigned_opportunity_ids()))
      )
  );
$$;

comment on function public.crm_property_access(uuid) is
  'Vrai si l''utilisateur courant peut accéder au bien (opérateur, ou agent affecté au dossier d''origine). Aucun accès global implicite.';

revoke all on function public.crm_property_access(uuid) from public;
grant execute on function public.crm_property_access(uuid) to authenticated;

-- --- RLS des tables enfants (accès dérivé du bien) ----------------------------
drop policy if exists property_positioning_read on public.property_positioning;
create policy property_positioning_read on public.property_positioning
  for select to authenticated using (public.crm_property_access(property_id));

drop policy if exists property_media_read on public.property_media;
create policy property_media_read on public.property_media
  for select to authenticated
  using (status = 'actif' and public.crm_property_access(property_id));

drop policy if exists property_documents_read on public.property_documents;
create policy property_documents_read on public.property_documents
  for select to authenticated
  using (status = 'actif' and public.crm_property_access(property_id));

drop policy if exists property_production_read on public.property_production_items;
create policy property_production_read on public.property_production_items
  for select to authenticated using (public.crm_property_access(property_id));

-- =============================================================================
-- 8. FONCTIONS — helper interne d'org + garde d'écriture.
-- =============================================================================
-- Peut PILOTER un bien en écriture : opérateur (admin/manager/setter) OU agent
-- affecté. Les décisions SENSIBLES (statut, prêt, responsable) exigent en plus
-- crm_can_decide (admin/manager) — contrôlé dans chaque fonction concernée.
create or replace function public.crm_property_can_edit(p_property_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$ select public.crm_property_access(p_property_id); $$;

revoke all on function public.crm_property_can_edit(uuid) from public;
grant execute on function public.crm_property_can_edit(uuid) to authenticated;

-- --- Identité -----------------------------------------------------------------
create or replace function public.crm_property_update_identity(
  p_property_id uuid,
  p_project_name text default null,
  p_commercial_title text default null,
  p_property_type text default null,
  p_address_line text default null,
  p_location_city text default null,
  p_location_postal_code text default null,
  p_location_country text default null,
  p_surface_m2 numeric default null,
  p_land_m2 numeric default null,
  p_rooms integer default null,
  p_bedrooms integer default null,
  p_year_built integer default null,
  p_arch_style text default null,
  p_description text default null,
  p_history text default null,
  p_signature_detail text default null
)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.crm_property_access(p_property_id) then
    raise exception 'droits insuffisants sur ce bien' using errcode = '42501';
  end if;

  update public.properties set
    project_name = coalesce(nullif(btrim(p_project_name), ''), project_name),
    commercial_title = coalesce(p_commercial_title, commercial_title),
    property_type = coalesce(p_property_type, property_type),
    address_line = coalesce(p_address_line, address_line),
    location_city = coalesce(p_location_city, location_city),
    location_postal_code = coalesce(p_location_postal_code, location_postal_code),
    location_country = coalesce(p_location_country, location_country),
    surface_m2 = coalesce(p_surface_m2, surface_m2),
    land_m2 = coalesce(p_land_m2, land_m2),
    rooms = coalesce(p_rooms, rooms),
    bedrooms = coalesce(p_bedrooms, bedrooms),
    year_built = coalesce(p_year_built, year_built),
    arch_style = coalesce(p_arch_style, arch_style),
    description = coalesce(p_description, description),
    history = coalesce(p_history, history),
    signature_detail = coalesce(p_signature_detail, signature_detail)
  where id = p_property_id;
  if not found then raise exception 'bien introuvable' using errcode = '22023'; end if;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'property', p_property_id, 'bien_identite', jsonb_build_object('updated', true));

  return jsonb_build_object('ok', true);
end;
$$;

-- --- Positionnement -----------------------------------------------------------
create or replace function public.crm_property_upsert_positioning(
  p_property_id uuid,
  p_central_promise text default null,
  p_value_pillars text default null,
  p_differentiators text default null,
  p_emotional_details text default null,
  p_ideal_buyer_profile text default null,
  p_buyer_locations text default null,
  p_buyer_motivation text default null,
  p_target_zones text default null,
  p_ad_angles text default null,
  p_do_not_communicate text default null,
  p_brand_name text default null
)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.crm_property_access(p_property_id) then
    raise exception 'droits insuffisants sur ce bien' using errcode = '42501';
  end if;

  insert into public.property_positioning as pp (
    property_id, central_promise, value_pillars, differentiators, emotional_details,
    ideal_buyer_profile, buyer_locations, buyer_motivation, target_zones, ad_angles,
    do_not_communicate, brand_name, updated_by)
  values (
    p_property_id, p_central_promise, p_value_pillars, p_differentiators, p_emotional_details,
    p_ideal_buyer_profile, p_buyer_locations, p_buyer_motivation, p_target_zones, p_ad_angles,
    p_do_not_communicate, p_brand_name, v_uid)
  on conflict (property_id) do update set
    central_promise = coalesce(excluded.central_promise, pp.central_promise),
    value_pillars = coalesce(excluded.value_pillars, pp.value_pillars),
    differentiators = coalesce(excluded.differentiators, pp.differentiators),
    emotional_details = coalesce(excluded.emotional_details, pp.emotional_details),
    ideal_buyer_profile = coalesce(excluded.ideal_buyer_profile, pp.ideal_buyer_profile),
    buyer_locations = coalesce(excluded.buyer_locations, pp.buyer_locations),
    buyer_motivation = coalesce(excluded.buyer_motivation, pp.buyer_motivation),
    target_zones = coalesce(excluded.target_zones, pp.target_zones),
    ad_angles = coalesce(excluded.ad_angles, pp.ad_angles),
    do_not_communicate = coalesce(excluded.do_not_communicate, pp.do_not_communicate),
    brand_name = coalesce(excluded.brand_name, pp.brand_name),
    updated_by = v_uid;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'property', p_property_id, 'bien_positionnement', jsonb_build_object('updated', true));

  return jsonb_build_object('ok', true);
end;
$$;

-- Validation du positionnement (décision : admin/manager).
create or replace function public.crm_property_validate_positioning(
  p_property_id uuid, p_validated boolean default true)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.crm_can_decide() then
    raise exception 'seul un administrateur ou un manager valide le positionnement' using errcode = '42501';
  end if;
  if not public.crm_property_access(p_property_id) then
    raise exception 'droits insuffisants sur ce bien' using errcode = '42501';
  end if;

  insert into public.property_positioning (property_id, validated, validated_by, validated_at, updated_by)
  values (p_property_id, coalesce(p_validated, true), v_uid, now(), v_uid)
  on conflict (property_id) do update set
    validated = coalesce(p_validated, true),
    validated_by = case when coalesce(p_validated, true) then v_uid else null end,
    validated_at = case when coalesce(p_validated, true) then now() else null end,
    updated_by = v_uid;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'property', p_property_id, 'bien_positionnement',
          jsonb_build_object('validated', coalesce(p_validated, true)));

  return jsonb_build_object('ok', true, 'validated', coalesce(p_validated, true));
end;
$$;

-- --- Médias -------------------------------------------------------------------
create or replace function public.crm_property_register_media(
  p_property_id uuid, p_kind text, p_storage_path text, p_file_name text,
  p_mime_type text, p_size_bytes bigint, p_title text default null)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_org uuid; v_id uuid;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.crm_property_access(p_property_id) then
    raise exception 'droits insuffisants sur ce bien' using errcode = '42501';
  end if;
  if p_kind not in ('photo','video','drone','plan','rendu','couverture','autre') then
    raise exception 'type de média invalide' using errcode = '22023';
  end if;
  if p_mime_type not in ('image/jpeg','image/png','image/webp','application/pdf','video/mp4') then
    raise exception 'type de fichier non autorisé' using errcode = '22023';
  end if;
  if p_size_bytes is null or p_size_bytes <= 0 then raise exception 'fichier vide' using errcode = '22023'; end if;

  select organization_id into v_org from public.properties where id = p_property_id;
  if v_org is null then raise exception 'bien introuvable' using errcode = '22023'; end if;

  insert into public.property_media
    (organization_id, property_id, kind, storage_path, file_name, mime_type, size_bytes, title, uploaded_by)
  values (v_org, p_property_id, p_kind, p_storage_path, left(btrim(p_file_name), 300), p_mime_type, p_size_bytes,
          nullif(btrim(p_title), ''), v_uid)
  returning id into v_id;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'property', p_property_id, 'bien_media_ajoute', jsonb_build_object('kind', p_kind));

  return jsonb_build_object('ok', true, 'id', v_id, 'storage_path', p_storage_path);
end;
$$;

create or replace function public.crm_property_update_media(
  p_media_id uuid, p_title text default null, p_kind text default null, p_rights_status text default null)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_prop uuid;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  select property_id into v_prop from public.property_media where id = p_media_id and status = 'actif';
  if v_prop is null then raise exception 'média introuvable' using errcode = '22023'; end if;
  if not public.crm_property_access(v_prop) then raise exception 'droits insuffisants' using errcode = '42501'; end if;
  if p_kind is not null and p_kind not in ('photo','video','drone','plan','rendu','couverture','autre') then
    raise exception 'type de média invalide' using errcode = '22023';
  end if;
  if p_rights_status is not null and p_rights_status not in ('a_verifier','libre','sous_licence','restreint') then
    raise exception 'statut de droits invalide' using errcode = '22023';
  end if;

  update public.property_media set
    title = coalesce(nullif(btrim(p_title), ''), title),
    kind = coalesce(p_kind, kind),
    rights_status = coalesce(p_rights_status, rights_status)
  where id = p_media_id;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.crm_property_set_primary_media(p_property_id uuid, p_media_id uuid)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.crm_property_access(p_property_id) then raise exception 'droits insuffisants' using errcode = '42501'; end if;
  if not exists (select 1 from public.property_media where id = p_media_id and property_id = p_property_id and status = 'actif') then
    raise exception 'média introuvable pour ce bien' using errcode = '22023';
  end if;

  update public.properties set main_media_id = p_media_id where id = p_property_id;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'property', p_property_id, 'bien_media_principal', jsonb_build_object('media_id', p_media_id));

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.crm_property_delete_media(p_media_id uuid)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_m public.property_media;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  select * into v_m from public.property_media where id = p_media_id and status = 'actif';
  if v_m.id is null then raise exception 'média introuvable' using errcode = '22023'; end if;
  if not public.crm_property_access(v_m.property_id) then raise exception 'droits insuffisants' using errcode = '42501'; end if;

  update public.property_media set status = 'supprime', deleted_by = v_uid, deleted_at = now() where id = p_media_id;
  -- Si c'était le média principal, on le détache.
  update public.properties set main_media_id = null where id = v_m.property_id and main_media_id = p_media_id;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'property', v_m.property_id, 'bien_media_supprime', jsonb_build_object('kind', v_m.kind));

  return jsonb_build_object('ok', true, 'storage_path', v_m.storage_path);
end;
$$;

-- --- Documents ----------------------------------------------------------------
create or replace function public.crm_property_register_document(
  p_property_id uuid, p_category text, p_storage_path text, p_file_name text,
  p_mime_type text, p_size_bytes bigint, p_visibility text default 'interne')
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_org uuid; v_id uuid;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.crm_can_decide()
     and not (public.crm_has_role('agent_immobilier') and public.crm_property_access(p_property_id)) then
    raise exception 'droits insuffisants pour gérer les documents' using errcode = '42501';
  end if;
  if p_category not in ('mandat','diagnostic','plan','titre','legal','copropriete','autorisation','libre') then
    raise exception 'catégorie de document invalide' using errcode = '22023';
  end if;
  if p_mime_type not in ('application/pdf','image/jpeg','image/png') then
    raise exception 'type de fichier non autorisé' using errcode = '22023';
  end if;
  if p_size_bytes is null or p_size_bytes <= 0 then raise exception 'fichier vide' using errcode = '22023'; end if;
  if p_visibility not in ('interne','restreint') then raise exception 'visibilité invalide' using errcode = '22023'; end if;

  select organization_id into v_org from public.properties where id = p_property_id;
  if v_org is null then raise exception 'bien introuvable' using errcode = '22023'; end if;

  insert into public.property_documents
    (organization_id, property_id, category, storage_path, file_name, mime_type, size_bytes, visibility, uploaded_by)
  values (v_org, p_property_id, p_category, p_storage_path, left(btrim(p_file_name), 300), p_mime_type, p_size_bytes,
          p_visibility, v_uid)
  returning id into v_id;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'property', p_property_id, 'bien_document_ajoute', jsonb_build_object('category', p_category));

  return jsonb_build_object('ok', true, 'id', v_id, 'storage_path', p_storage_path);
end;
$$;

create or replace function public.crm_property_delete_document(p_document_id uuid)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_d public.property_documents;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  select * into v_d from public.property_documents where id = p_document_id and status = 'actif';
  if v_d.id is null then raise exception 'document introuvable' using errcode = '22023'; end if;
  if not public.crm_can_decide() then raise exception 'droits insuffisants' using errcode = '42501'; end if;

  update public.property_documents set status = 'supprime', deleted_by = v_uid, deleted_at = now() where id = p_document_id;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'property', v_d.property_id, 'bien_document_supprime', jsonb_build_object('category', v_d.category));

  return jsonb_build_object('ok', true, 'storage_path', v_d.storage_path);
end;
$$;

-- --- Production ---------------------------------------------------------------
create or replace function public.crm_property_seed_production_plan(p_property_id uuid)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_org uuid; v_kind text; v_n integer := 0;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.crm_property_access(p_property_id) then raise exception 'droits insuffisants' using errcode = '42501'; end if;
  select organization_id into v_org from public.properties where id = p_property_id;
  if v_org is null then raise exception 'bien introuvable' using errcode = '22023'; end if;

  foreach v_kind in array array[
    'photographie','video','drone','redaction','positionnement','identite_visuelle',
    'site_dedie','brochure','publicites','funnel_acquereur','validation_finale']
  loop
    insert into public.property_production_items (organization_id, property_id, kind, created_by, updated_by)
    values (v_org, p_property_id, v_kind, v_uid, v_uid)
    on conflict (property_id, kind) do nothing;
    if found then v_n := v_n + 1; end if;
  end loop;

  return jsonb_build_object('ok', true, 'created', v_n);
end;
$$;

create or replace function public.crm_property_set_production(
  p_item_id uuid, p_status text default null, p_assignee_user_id uuid default null,
  p_due_at timestamptz default null, p_notes text default null,
  p_deliverable_url text default null, p_blocker text default null)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_prop uuid;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  select property_id into v_prop from public.property_production_items where id = p_item_id;
  if v_prop is null then raise exception 'élément de production introuvable' using errcode = '22023'; end if;
  if not public.crm_property_access(v_prop) then raise exception 'droits insuffisants' using errcode = '42501'; end if;
  if p_status is not null and p_status not in ('a_faire','en_cours','en_revue','termine','valide','bloque') then
    raise exception 'statut de production invalide' using errcode = '22023';
  end if;
  -- La VALIDATION d'un livrable est une décision (admin/manager).
  if p_status = 'valide' and not public.crm_can_decide() then
    raise exception 'seul un administrateur ou un manager valide un livrable' using errcode = '42501';
  end if;

  update public.property_production_items set
    status = coalesce(p_status, status),
    assignee_user_id = coalesce(p_assignee_user_id, assignee_user_id),
    due_at = coalesce(p_due_at, due_at),
    notes = coalesce(p_notes, notes),
    deliverable_url = coalesce(p_deliverable_url, deliverable_url),
    blocker = case when p_status = 'bloque' then coalesce(nullif(btrim(p_blocker), ''), blocker)
                   when p_status is not null then null else blocker end,
    validated_at = case when p_status = 'valide' then now()
                        when p_status is not null then null else validated_at end,
    updated_by = v_uid
  where id = p_item_id;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'property', v_prop, 'bien_production_maj',
          jsonb_build_object('item', p_item_id, 'status', coalesce(p_status, 'inchange')));

  return jsonb_build_object('ok', true);
end;
$$;

-- --- Responsable (décision : admin/manager) -----------------------------------
create or replace function public.crm_property_set_responsible(p_property_id uuid, p_user_id uuid)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.crm_can_decide() then raise exception 'seul un administrateur ou un manager change le responsable' using errcode = '42501'; end if;
  if not public.crm_property_access(p_property_id) then raise exception 'droits insuffisants' using errcode = '42501'; end if;
  if p_user_id is not null and not exists (
      select 1 from public.organization_memberships where user_id = p_user_id and status = 'actif') then
    raise exception 'responsable invalide' using errcode = '22023';
  end if;

  update public.properties set responsible_user_id = p_user_id where id = p_property_id;
  if not found then raise exception 'bien introuvable' using errcode = '22023'; end if;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'property', p_property_id, 'bien_responsable', jsonb_build_object('responsible', p_user_id));

  return jsonb_build_object('ok', true);
end;
$$;

-- =============================================================================
-- 9. READINESS — calculée en base (source de vérité), + passage « prêt ».
-- =============================================================================
create or replace function public.crm_property_readiness(p_property_id uuid)
returns jsonb language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_p public.properties;
  v_pos public.property_positioning;
  v_identity boolean;
  v_positioning boolean;
  v_main_media boolean;
  v_photos boolean;
  v_docs boolean;
  v_deliverables boolean;
  v_responsible boolean;
  v_blocked boolean;
  v_required_kinds text[] := array['photographie','redaction','positionnement','validation_finale'];
  v_done integer; v_total integer := 7; v_ok integer := 0;
begin
  select * into v_p from public.properties where id = p_property_id;
  if v_p.id is null then raise exception 'bien introuvable' using errcode = '22023'; end if;
  select * into v_pos from public.property_positioning where property_id = p_property_id;

  v_identity := nullif(btrim(coalesce(v_p.project_name, '')), '') is not null
                and coalesce(v_p.property_type, '') <> ''
                and (coalesce(v_p.location_city, '') <> '' or coalesce(v_p.address_line, '') <> '')
                and nullif(btrim(coalesce(v_p.description, '')), '') is not null;
  v_positioning := coalesce(v_pos.validated, false);
  v_main_media := v_p.main_media_id is not null
                  and exists (select 1 from public.property_media where id = v_p.main_media_id and status = 'actif');
  v_photos := exists (select 1 from public.property_media where property_id = p_property_id and kind = 'photo' and status = 'actif');
  v_docs := exists (select 1 from public.property_documents where property_id = p_property_id and category = 'mandat' and status = 'actif');
  v_responsible := v_p.responsible_user_id is not null;
  -- Tous les livrables requis existent et sont « validés ».
  select count(*) into v_done from public.property_production_items
    where property_id = p_property_id and kind = any(v_required_kinds) and status = 'valide';
  v_deliverables := v_done >= array_length(v_required_kinds, 1);
  v_blocked := exists (select 1 from public.property_production_items where property_id = p_property_id and status = 'bloque');

  v_ok := (v_identity)::int + (v_positioning)::int + (v_main_media)::int + (v_photos)::int
          + (v_docs)::int + (v_deliverables)::int + (v_responsible)::int;

  return jsonb_build_object(
    'ready', (v_ok = v_total and not v_blocked),
    'total', v_total,
    'done', v_ok,
    'percent', round((v_ok::numeric / v_total) * 100),
    'blocked', v_blocked,
    'checks', jsonb_build_object(
      'identity', v_identity,
      'positioning_validated', v_positioning,
      'main_media', v_main_media,
      'photos', v_photos,
      'mandate_document', v_docs,
      'deliverables', v_deliverables,
      'responsible', v_responsible
    )
  );
end;
$$;

comment on function public.crm_property_readiness(uuid) is
  'Readiness CALCULÉE du bien (identité, positionnement validé, média principal, photos, document de mandat, livrables requis validés, responsable) + blocages. Source de vérité pour le passage « prêt à lancer ».';

-- Transition de statut contrôlée (décisions sensibles : admin/manager).
create or replace function public.crm_property_transition_status(
  p_property_id uuid, p_status text, p_reason text default null)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_old text; v_ready jsonb;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.crm_property_access(p_property_id) then raise exception 'droits insuffisants' using errcode = '42501'; end if;
  if p_status not in ('preparation_a_lancer','collecte_en_cours','strategie_en_cours','production_en_cours',
                      'validation_avant_lancement','pret_a_lancer','en_diffusion','suspendu','archive') then
    raise exception 'statut invalide' using errcode = '22023';
  end if;
  -- Décisions sensibles réservées à admin/manager.
  if p_status in ('pret_a_lancer','en_diffusion','archive','suspendu') and not public.crm_can_decide() then
    raise exception 'seul un administrateur ou un manager effectue cette transition' using errcode = '42501';
  end if;
  -- « prêt à lancer » impossible si la readiness n'est pas satisfaite.
  if p_status = 'pret_a_lancer' then
    v_ready := public.crm_property_readiness(p_property_id);
    if not (v_ready->>'ready')::boolean then
      raise exception 'préparation incomplète : le bien ne peut pas être déclaré prêt' using errcode = '22023';
    end if;
  end if;

  select status into v_old from public.properties where id = p_property_id;
  update public.properties set
    status = p_status,
    status_reason = nullif(btrim(p_reason), ''),
    ready_at = case when p_status = 'pret_a_lancer' then now() else ready_at end,
    ready_by = case when p_status = 'pret_a_lancer' then v_uid else ready_by end
  where id = p_property_id;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, old_value, new_value)
  values (v_uid, 'property', p_property_id,
          case when p_status = 'pret_a_lancer' then 'bien_pret' else 'bien_statut' end,
          jsonb_build_object('status', v_old), jsonb_build_object('status', p_status));

  return jsonb_build_object('ok', true, 'status', p_status);
end;
$$;

-- =============================================================================
-- 10. GRANTS — EXECUTE aux seuls `authenticated`, jamais anon/public.
-- =============================================================================
do $$
declare fn text;
begin
  for fn in
    select unnest(array[
      'public.crm_property_access(uuid)',
      'public.crm_property_can_edit(uuid)',
      'public.crm_property_update_identity(uuid, text, text, text, text, text, text, text, numeric, numeric, integer, integer, integer, text, text, text, text)',
      'public.crm_property_upsert_positioning(uuid, text, text, text, text, text, text, text, text, text, text, text)',
      'public.crm_property_validate_positioning(uuid, boolean)',
      'public.crm_property_register_media(uuid, text, text, text, text, bigint, text)',
      'public.crm_property_update_media(uuid, text, text, text)',
      'public.crm_property_set_primary_media(uuid, uuid)',
      'public.crm_property_delete_media(uuid)',
      'public.crm_property_register_document(uuid, text, text, text, text, bigint, text)',
      'public.crm_property_delete_document(uuid)',
      'public.crm_property_seed_production_plan(uuid)',
      'public.crm_property_set_production(uuid, text, uuid, timestamptz, text, text, text)',
      'public.crm_property_set_responsible(uuid, uuid)',
      'public.crm_property_readiness(uuid)',
      'public.crm_property_transition_status(uuid, text, text)'
    ])
  loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end $$;

-- =============================================================================
-- 11. STORAGE — bucket PRIVÉ des assets de bien (gardé).
-- =============================================================================
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public)
    values ('property-assets', 'property-assets', false)
    on conflict (id) do update set public = false;
  end if;
end $$;

commit;
