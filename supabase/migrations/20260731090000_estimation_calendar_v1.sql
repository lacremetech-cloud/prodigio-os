-- =============================================================================
-- Prodigio OS — Migration 20260731090000_estimation_calendar_v1
--
-- « Planification des estimations & Google Calendar — V1 ».
--
-- ADDITIVE au-dessus du CRM interne + gestion des utilisateurs. Ne modifie
-- AUCUNE migration historique, NI la fonction publique `submit_mandate_funnel`,
-- NI la RLS du funnel, NI les données réelles. Ajoute :
--
--   1. Table `calendar_connections` (métadonnées NON sensibles de la connexion
--      Google d'un utilisateur : compte, calendrier sélectionné, statut). Lue
--      sous RLS (propriétaire + rôles opérateur).
--   2. Table `calendar_credentials` (jetons Google CHIFFRÉS au repos). AUCUN
--      privilège `anon`/`authenticated` : seul le rôle de service (client admin
--      serveur) y accède. Les jetons ne transitent JAMAIS par le navigateur, les
--      logs, Git, les réponses publiques ni les audit_events.
--   3. Table `estimation_appointments` (rendez-vous d'estimation physique). Lue
--      sous RLS ; toute écriture via fonctions SECURITY DEFINER. Clé
--      d'idempotence unique (un double-clic ne crée jamais deux rendez-vous).
--   4. Extension ADDITIVE des contraintes CHECK de `audit_events`.
--   5. Fonctions SECURITY DEFINER (connexion / sélection de calendrier /
--      déconnexion ; réservation / confirmation / compensation ; annulation /
--      report ; résultat) — chacune re-vérifie le rôle et écrit un AuditEvent.
--
-- Principes (CLAUDE.md, docs/06, docs/12) appliqués :
--   - Permissions décidées côté serveur / base. `anon` : aucun privilège.
--   - `authenticated` : SELECT sous RLS uniquement ; écritures via SECURITY
--     DEFINER qui re-vérifient le rôle.
--   - `search_path` figé sur toutes les fonctions ; EXECUTE retiré à anon/public.
--   - Aucun secret, aucun jeton, aucun paramètre économique codé en dur.
--   - Idempotence : réservation « insert … on conflict do nothing » ; seule
--     l'insertion réelle déclenche la création de l'événement Google.
--
-- Application : voir docs/13-CALENDAR-ESTIMATIONS.md. Appliquer UNE seule fois,
-- après audit du schéma distant.
-- =============================================================================

begin;

-- =============================================================================
-- 1. AUDIT — extension ADDITIVE des contraintes CHECK (nouvelles entités /
--    événements liés au calendrier et aux rendez-vous d'estimation).
-- =============================================================================
alter table public.audit_events
  drop constraint if exists audit_events_entity_type_check,
  add constraint audit_events_entity_type_check check (
    entity_type in (
      'opportunity', 'contact', 'membership', 'organization', 'invitation',
      -- Nouveaux (V1 planification des estimations) :
      'calendar_connection', 'estimation_appointment'));

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
      -- Nouveaux (V1 planification des estimations) :
      'calendrier_connecte', 'calendrier_deconnecte',
      'estimation_planifiee', 'estimation_replanifiee',
      'estimation_annulee', 'estimation_resultat'));

-- =============================================================================
-- 2. CALENDAR_CONNECTIONS — métadonnées NON sensibles de la connexion Google.
--    Une connexion par (utilisateur, fournisseur). Aucun jeton ici.
-- =============================================================================
create table if not exists public.calendar_connections (
  id                       uuid primary key default gen_random_uuid(),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  organization_id          uuid not null references public.organizations (id) on delete cascade,
  user_id                  uuid not null references auth.users (id) on delete cascade,
  provider                 text not null default 'google'
                             check (provider in ('google')),
  google_account_email     text,     -- compte connecté (affichage), non sensible
  google_calendar_id       text,     -- calendrier sélectionné pour les estimations
  google_calendar_summary  text,     -- libellé du calendrier (affichage)
  scope                    text,     -- scopes accordés (non sensible)
  status                   text not null default 'connecte'
                             check (status in ('connecte', 'deconnecte', 'erreur', 'revoque')),
  last_error               text,     -- code / message non sensible (ex. « token_expire »)
  connected_at             timestamptz,
  last_synced_at           timestamptz,
  metadata                 jsonb,
  constraint calendar_connections_user_provider_unique unique (user_id, provider)
);

comment on table public.calendar_connections is
  'Connexion Google Calendar d''un utilisateur (métadonnées NON sensibles). Les jetons vivent dans calendar_credentials, jamais ici.';

create index if not exists calendar_connections_org_idx
  on public.calendar_connections (organization_id);

drop trigger if exists calendar_connections_set_updated_at on public.calendar_connections;
create trigger calendar_connections_set_updated_at
  before update on public.calendar_connections
  for each row execute function public.set_updated_at();

alter table public.calendar_connections enable row level security;
grant select on public.calendar_connections to authenticated;

-- Lecture : sa propre connexion, ou toutes celles de l'organisation pour un
-- rôle opérateur (nécessaire pour choisir un agent lors de la planification).
drop policy if exists calendar_connections_read on public.calendar_connections;
create policy calendar_connections_read on public.calendar_connections
  for select to authenticated
  using (user_id = auth.uid() or public.crm_is_operator());

-- =============================================================================
-- 3. CALENDAR_CREDENTIALS — jetons Google CHIFFRÉS au repos.
--    SENSIBLE : aucun privilège anon/authenticated. Seul le rôle de service
--    (client admin serveur, hors RLS) lit / écrit cette table. Les colonnes ne
--    contiennent QUE du texte chiffré (AES-256-GCM applicatif) : jamais de jeton
--    en clair, même en base.
-- =============================================================================
create table if not exists public.calendar_credentials (
  connection_id             uuid primary key
                              references public.calendar_connections (id) on delete cascade,
  updated_at                timestamptz not null default now(),
  access_token_encrypted    text,     -- chiffré (AES-256-GCM) — jamais en clair
  refresh_token_encrypted   text,     -- chiffré (AES-256-GCM) — jamais en clair
  token_type                text,
  scope                     text,
  access_token_expires_at   timestamptz
);

comment on table public.calendar_credentials is
  'Jetons Google CHIFFRÉS au repos (access + refresh). Aucun privilège anon/authenticated : accès réservé au rôle de service (serveur). Jamais de jeton en clair.';

drop trigger if exists calendar_credentials_set_updated_at on public.calendar_credentials;
create trigger calendar_credentials_set_updated_at
  before update on public.calendar_credentials
  for each row execute function public.set_updated_at();

-- Verrouillage total pour anon / authenticated (défense en profondeur : même si
-- des privilèges par défaut existaient, on les retire explicitement). Le rôle de
-- service contourne la RLS et ne dépend pas de ces GRANT.
alter table public.calendar_credentials enable row level security;
revoke all on public.calendar_credentials from anon, authenticated;

-- =============================================================================
-- 4. ESTIMATION_APPOINTMENTS — rendez-vous physique d'estimation.
--    Lu sous RLS ; écrit uniquement via les fonctions §7. Idempotence forte.
-- =============================================================================
create table if not exists public.estimation_appointments (
  id                   uuid primary key default gen_random_uuid(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  organization_id      uuid not null references public.organizations (id) on delete cascade,
  opportunity_id       uuid not null references public.opportunities (id) on delete cascade,
  agent_user_id        uuid not null references auth.users (id) on delete restrict,
  created_by_user_id   uuid references auth.users (id) on delete set null,
  starts_at            timestamptz not null,
  ends_at              timestamptz not null,
  timezone             text not null default 'Europe/Paris',
  address              text,
  owner_contact_id     uuid references public.contacts (id) on delete set null,
  owner_email          text,     -- snapshot de l'e-mail invité (au moment du RDV)
  owner_name           text,     -- snapshot du nom affiché
  status               text not null default 'planifie'
                         check (status in ('planifie', 'confirme', 'realise',
                                           'annule', 'absent', 'a_replanifier')),
  google_calendar_id   text,
  google_event_id      text,
  google_html_link     text,
  idempotency_key      text not null,
  cancelled_at         timestamptz,
  cancel_reason        text,
  internal_notes       text,
  metadata             jsonb,
  constraint estimation_appointments_time_order check (ends_at > starts_at)
);

comment on table public.estimation_appointments is
  'Rendez-vous physique d''estimation. Écrit via fonctions SECURITY DEFINER. idempotency_key unique : un double-clic ne crée jamais deux rendez-vous ni deux événements Google.';

-- Idempotence forte : une seule ligne par clé de réservation.
create unique index if not exists estimation_appointments_idempotency_key
  on public.estimation_appointments (idempotency_key);

create index if not exists estimation_appointments_opportunity_idx
  on public.estimation_appointments (opportunity_id, starts_at desc);
create index if not exists estimation_appointments_agent_idx
  on public.estimation_appointments (agent_user_id, starts_at);
create index if not exists estimation_appointments_org_status_idx
  on public.estimation_appointments (organization_id, status, starts_at);

drop trigger if exists estimation_appointments_set_updated_at on public.estimation_appointments;
create trigger estimation_appointments_set_updated_at
  before update on public.estimation_appointments
  for each row execute function public.set_updated_at();

alter table public.estimation_appointments enable row level security;
grant select on public.estimation_appointments to authenticated;

-- Lecture : opérateur = tout ; agent = ses propres rendez-vous ou dossiers affectés.
drop policy if exists estimation_appointments_read on public.estimation_appointments;
create policy estimation_appointments_read on public.estimation_appointments
  for select to authenticated
  using (
    public.crm_is_operator()
    or (
      public.crm_has_role('agent_immobilier')
      and (
        agent_user_id = auth.uid()
        or opportunity_id in (select public.crm_assigned_opportunity_ids())
      )
    )
  );

-- =============================================================================
-- 5. HELPERS DE DROITS — planification / connexion.
-- =============================================================================

-- Peut planifier / gérer un rendez-vous d'estimation (opérateur).
create or replace function public.calendar_can_plan()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.crm_has_role('administrateur', 'manager', 'setter');
$$;

comment on function public.calendar_can_plan() is
  'Vrai si l''utilisateur courant peut planifier un rendez-vous d''estimation (administrateur / manager / setter).';

-- Peut connecter un calendrier Google (administrateur / manager / agent).
create or replace function public.calendar_can_connect()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.crm_has_role('administrateur', 'manager', 'agent_immobilier');
$$;

comment on function public.calendar_can_connect() is
  'Vrai si l''utilisateur courant peut connecter son propre calendrier Google (administrateur / manager / agent_immobilier). Le setter n''a pas besoin de connecter le sien.';

-- Peut modifier / annuler / reporter un rendez-vous (administrateur / manager).
create or replace function public.calendar_can_manage()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.crm_has_role('administrateur', 'manager');
$$;

comment on function public.calendar_can_manage() is
  'Vrai si l''utilisateur courant peut modifier, reporter ou annuler un rendez-vous d''estimation (administrateur / manager).';

-- Organisation opérateur active de l'utilisateur courant (V1 : « prodigio »).
create or replace function public.crm_current_operator_org()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.organization_id
  from public.organization_memberships m
  where m.user_id = auth.uid()
    and m.status = 'actif'
    and m.role in ('administrateur', 'manager', 'setter', 'agent_immobilier')
  order by (m.role = 'administrateur') desc, (m.role = 'manager') desc
  limit 1;
$$;

comment on function public.crm_current_operator_org() is
  'Organisation opérateur active de l''utilisateur courant. Sert à rattacher connexions et rendez-vous à la bonne organisation.';

revoke all on function public.calendar_can_plan() from public;
revoke all on function public.calendar_can_connect() from public;
revoke all on function public.calendar_can_manage() from public;
revoke all on function public.crm_current_operator_org() from public;
grant execute on function public.calendar_can_plan() to authenticated;
grant execute on function public.calendar_can_connect() to authenticated;
grant execute on function public.calendar_can_manage() to authenticated;
grant execute on function public.crm_current_operator_org() to authenticated;

-- =============================================================================
-- 6. FONCTIONS — CONNEXION DE CALENDRIER (métadonnées uniquement, jamais de
--    jeton : les jetons sont écrits séparément par le serveur dans
--    calendar_credentials via le rôle de service).
-- =============================================================================

-- --- Créer / rafraîchir SA connexion (après OAuth réussi) --------------------
create or replace function public.calendar_upsert_connection(
  p_account_email text,
  p_scope text default null,
  p_calendar_id text default null,
  p_calendar_summary text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'authentification requise' using errcode = '28000';
  end if;
  if not public.calendar_can_connect() then
    raise exception 'droits insuffisants pour connecter un calendrier' using errcode = '42501';
  end if;

  v_org := public.crm_current_operator_org();
  if v_org is null then
    raise exception 'organisation introuvable' using errcode = '22023';
  end if;

  insert into public.calendar_connections
    (organization_id, user_id, provider, google_account_email, scope,
     google_calendar_id, google_calendar_summary, status, connected_at, last_error)
  values
    (v_org, v_uid, 'google', nullif(btrim(p_account_email), ''), p_scope,
     nullif(btrim(p_calendar_id), ''), nullif(btrim(p_calendar_summary), ''),
     'connecte', now(), null)
  on conflict (user_id, provider) do update set
    organization_id = excluded.organization_id,
    google_account_email = excluded.google_account_email,
    scope = excluded.scope,
    -- ne réécrase pas un calendrier déjà choisi si la reconnexion n'en fournit pas
    google_calendar_id = coalesce(excluded.google_calendar_id, public.calendar_connections.google_calendar_id),
    google_calendar_summary = coalesce(excluded.google_calendar_summary, public.calendar_connections.google_calendar_summary),
    status = 'connecte',
    connected_at = now(),
    last_error = null
  returning id into v_id;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'calendar_connection', v_id, 'calendrier_connecte',
          jsonb_build_object('provider', 'google'));

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- --- Choisir le calendrier utilisé pour les estimations ----------------------
create or replace function public.calendar_select_estimation_calendar(
  p_calendar_id text,
  p_calendar_summary text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'authentification requise' using errcode = '28000';
  end if;
  if not public.calendar_can_connect() then
    raise exception 'droits insuffisants' using errcode = '42501';
  end if;
  if nullif(btrim(p_calendar_id), '') is null then
    raise exception 'calendrier invalide' using errcode = '22023';
  end if;

  update public.calendar_connections
  set google_calendar_id = btrim(p_calendar_id),
      google_calendar_summary = nullif(btrim(p_calendar_summary), '')
  where user_id = v_uid and provider = 'google'
  returning id into v_id;

  if v_id is null then
    raise exception 'aucune connexion à mettre à jour' using errcode = '22023';
  end if;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- --- Marquer un état de connexion (erreur / jeton expiré / révoqué) ----------
-- Utilisé par le serveur lorsqu'un appel Google échoue (token révoqué, etc.).
create or replace function public.calendar_mark_connection_state(
  p_user_id uuid,
  p_status text,
  p_error text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  -- Réservé aux opérateurs (le serveur agit pour le compte d'un agent) ou à soi.
  if not (public.calendar_can_plan() or p_user_id = auth.uid()) then
    raise exception 'droits insuffisants' using errcode = '42501';
  end if;
  if p_status not in ('connecte', 'deconnecte', 'erreur', 'revoque') then
    raise exception 'statut invalide' using errcode = '22023';
  end if;

  update public.calendar_connections
  set status = p_status,
      last_error = nullif(btrim(coalesce(p_error, '')), '')
  where user_id = p_user_id and provider = 'google'
  returning id into v_id;

  if v_id is null then
    raise exception 'connexion introuvable' using errcode = '22023';
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- --- Déconnecter SON calendrier (les jetons sont supprimés côté serveur) ------
create or replace function public.calendar_disconnect()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'authentification requise' using errcode = '28000';
  end if;
  if not public.calendar_can_connect() then
    raise exception 'droits insuffisants' using errcode = '42501';
  end if;

  update public.calendar_connections
  set status = 'deconnecte', last_synced_at = now()
  where user_id = v_uid and provider = 'google'
  returning id into v_id;

  if v_id is null then
    raise exception 'aucune connexion à déconnecter' using errcode = '22023';
  end if;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'calendar_connection', v_id, 'calendrier_deconnecte',
          jsonb_build_object('provider', 'google'));

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- --- Agents « réservables » (calendrier connecté) — pour choisir l'agent ------
create or replace function public.calendar_list_bookable_agents()
returns table (
  user_id uuid, email text, role text,
  calendar_id text, calendar_summary text, status text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.user_id, u.email::text, m.role,
         c.google_calendar_id, c.google_calendar_summary, c.status
  from public.calendar_connections c
  join public.organization_memberships m
    on m.user_id = c.user_id and m.status = 'actif'
   and m.role in ('administrateur', 'manager', 'agent_immobilier')
  join auth.users u on u.id = c.user_id
  where public.calendar_can_plan()
    and c.provider = 'google'
    and c.status = 'connecte'
    and c.organization_id = public.crm_current_operator_org()
  order by u.email;
$$;

-- =============================================================================
-- 7. FONCTIONS — RENDEZ-VOUS D'ESTIMATION.
--    Réservation idempotente → (serveur crée l'événement Google) → confirmation.
--    Seule l'INSERTION réelle (created=true) déclenche la création Google.
-- =============================================================================

-- --- Réserver (idempotent) : claim atomique de la clé -------------------------
create or replace function public.crm_reserve_estimation_appointment(
  p_idempotency_key text,
  p_opportunity_id uuid,
  p_agent_user_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_timezone text default 'Europe/Paris',
  p_address text default null,
  p_owner_contact_id uuid default null,
  p_owner_email text default null,
  p_owner_name text default null,
  p_calendar_id text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_id uuid;
  v_created boolean := false;
  v_row public.estimation_appointments;
begin
  if v_uid is null then
    raise exception 'authentification requise' using errcode = '28000';
  end if;
  if not public.calendar_can_plan() then
    raise exception 'droits insuffisants pour planifier une estimation' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_idempotency_key, '')), '') is null then
    raise exception 'clé d''idempotence requise' using errcode = '22023';
  end if;
  if p_ends_at <= p_starts_at then
    raise exception 'créneau invalide (fin <= début)' using errcode = '22023';
  end if;
  if not exists (select 1 from public.opportunities where id = p_opportunity_id) then
    raise exception 'opportunité introuvable' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.organization_memberships
    where user_id = p_agent_user_id and status = 'actif'
  ) then
    raise exception 'agent cible non membre actif' using errcode = '22023';
  end if;

  v_org := public.crm_current_operator_org();
  if v_org is null then
    raise exception 'organisation introuvable' using errcode = '22023';
  end if;

  -- Claim atomique de la clé : seule la véritable insertion renvoie l'id.
  insert into public.estimation_appointments
    (organization_id, opportunity_id, agent_user_id, created_by_user_id,
     starts_at, ends_at, timezone, address, owner_contact_id, owner_email,
     owner_name, status, google_calendar_id, idempotency_key, internal_notes)
  values
    (v_org, p_opportunity_id, p_agent_user_id, v_uid,
     p_starts_at, p_ends_at, coalesce(nullif(btrim(p_timezone), ''), 'Europe/Paris'),
     nullif(btrim(p_address), ''), p_owner_contact_id, nullif(btrim(p_owner_email), ''),
     nullif(btrim(p_owner_name), ''), 'planifie', nullif(btrim(p_calendar_id), ''),
     btrim(p_idempotency_key), nullif(left(coalesce(p_notes, ''), 4000), ''))
  on conflict (idempotency_key) do nothing
  returning id into v_id;

  if v_id is not null then
    v_created := true;
  else
    select id into v_id from public.estimation_appointments
    where idempotency_key = btrim(p_idempotency_key);
  end if;

  select * into v_row from public.estimation_appointments where id = v_id;

  return jsonb_build_object(
    'ok', true,
    'id', v_id,
    'created', v_created,
    'google_event_id', v_row.google_event_id,
    'status', v_row.status
  );
end;
$$;

-- --- Confirmer : attacher l'événement Google + avancer le dossier ------------
create or replace function public.crm_confirm_estimation_appointment(
  p_id uuid,
  p_google_event_id text,
  p_google_calendar_id text default null,
  p_html_link text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_appt public.estimation_appointments;
  v_stage text;
  v_stage_rank int;
  v_target_rank int;
  v_stages text[] := array[
    'nouveau','prise_de_contact_en_cours','contact_etabli','qualification_en_cours',
    'rendez_vous_planifie','rendez_vous_realise','estimation_etude_dossier',
    'proposition_de_mandat','en_attente_de_signature','mandat_signe'];
begin
  if v_uid is null then
    raise exception 'authentification requise' using errcode = '28000';
  end if;
  if not public.calendar_can_plan() then
    raise exception 'droits insuffisants' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_google_event_id, '')), '') is null then
    raise exception 'identifiant d''événement Google requis' using errcode = '22023';
  end if;

  update public.estimation_appointments
  set google_event_id = btrim(p_google_event_id),
      google_calendar_id = coalesce(nullif(btrim(p_google_calendar_id), ''), google_calendar_id),
      google_html_link = nullif(btrim(p_html_link), '')
  where id = p_id
  returning * into v_appt;

  if v_appt.id is null then
    raise exception 'rendez-vous introuvable' using errcode = '22023';
  end if;

  -- Avance le stade vers « rendez_vous_planifie » SANS jamais rétrograder un
  -- stade déjà plus avancé.
  select pipeline_stage into v_stage from public.opportunities where id = v_appt.opportunity_id;
  v_stage_rank := coalesce(array_position(v_stages, v_stage), -1);
  v_target_rank := array_position(v_stages, 'rendez_vous_planifie');
  if v_stage_rank >= 0 and v_stage_rank < v_target_rank then
    update public.opportunities set pipeline_stage = 'rendez_vous_planifie'
    where id = v_appt.opportunity_id;
    insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, old_value, new_value)
    values (v_uid, 'opportunity', v_appt.opportunity_id, 'changement_stade',
            jsonb_build_object('pipeline_stage', v_stage),
            jsonb_build_object('pipeline_stage', 'rendez_vous_planifie'));
  end if;

  -- Activité métier (RDV) — distincte de l'AuditEvent.
  insert into public.activities (opportunity_id, contact_id, author_user_id, type, body, occurred_at)
  values (v_appt.opportunity_id, v_appt.owner_contact_id, v_uid, 'rendez_vous',
          'Rendez-vous d''estimation planifié', now());

  -- AuditEvent (technique).
  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'estimation_appointment', v_appt.id, 'estimation_planifiee',
          jsonb_build_object('agent_user_id', v_appt.agent_user_id,
                             'starts_at', v_appt.starts_at));

  return jsonb_build_object('ok', true, 'id', v_appt.id);
end;
$$;

-- --- Compensation : abandonner une réservation SANS événement Google ---------
-- Utilisé quand la création Google échoue : libère la clé d'idempotence.
create or replace function public.crm_discard_pending_appointment(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_deleted int;
begin
  if v_uid is null then
    raise exception 'authentification requise' using errcode = '28000';
  end if;
  if not public.calendar_can_plan() then
    raise exception 'droits insuffisants' using errcode = '42501';
  end if;

  -- Ne supprime QUE des réservations sans effet externe (aucun événement Google),
  -- créées par l'utilisateur courant.
  delete from public.estimation_appointments
  where id = p_id
    and google_event_id is null
    and created_by_user_id = v_uid;
  get diagnostics v_deleted = row_count;

  return jsonb_build_object('ok', true, 'deleted', v_deleted);
end;
$$;

-- --- Reporter : nouveaux horaires (l'événement Google est modifié côté serveur)
create or replace function public.crm_reschedule_estimation_appointment(
  p_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_appt public.estimation_appointments;
  v_old_start timestamptz;
begin
  if v_uid is null then
    raise exception 'authentification requise' using errcode = '28000';
  end if;
  if not public.calendar_can_manage() then
    raise exception 'droits insuffisants pour reporter' using errcode = '42501';
  end if;
  if p_ends_at <= p_starts_at then
    raise exception 'créneau invalide (fin <= début)' using errcode = '22023';
  end if;

  select * into v_appt from public.estimation_appointments where id = p_id;
  if v_appt.id is null then
    raise exception 'rendez-vous introuvable' using errcode = '22023';
  end if;
  v_old_start := v_appt.starts_at;

  update public.estimation_appointments
  set starts_at = p_starts_at, ends_at = p_ends_at,
      status = case when status in ('annule') then 'planifie' else status end
  where id = p_id;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, old_value, new_value)
  values (v_uid, 'estimation_appointment', p_id, 'estimation_replanifiee',
          jsonb_build_object('starts_at', v_old_start),
          jsonb_build_object('starts_at', p_starts_at));

  return jsonb_build_object('ok', true, 'id', p_id);
end;
$$;

-- --- Annuler : marque annulé (l'événement Google est supprimé côté serveur) ---
create or replace function public.crm_cancel_estimation_appointment(
  p_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_appt public.estimation_appointments;
begin
  if v_uid is null then
    raise exception 'authentification requise' using errcode = '28000';
  end if;
  if not public.calendar_can_manage() then
    raise exception 'droits insuffisants pour annuler' using errcode = '42501';
  end if;

  update public.estimation_appointments
  set status = 'annule', cancelled_at = now(),
      cancel_reason = nullif(left(coalesce(p_reason, ''), 500), '')
  where id = p_id
  returning * into v_appt;

  if v_appt.id is null then
    raise exception 'rendez-vous introuvable' using errcode = '22023';
  end if;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'estimation_appointment', p_id, 'estimation_annulee',
          jsonb_build_object('reason', nullif(left(coalesce(p_reason, ''), 500), '')));

  return jsonb_build_object('ok', true, 'id', p_id);
end;
$$;

-- --- Résultat du rendez-vous (réalisé / absent / à replanifier / confirmé) ----
-- Ouvert aux opérateurs gestionnaires ET à l'agent pour SES propres RDV.
create or replace function public.crm_set_appointment_result(
  p_id uuid,
  p_status text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_appt public.estimation_appointments;
  v_old text;
begin
  if v_uid is null then
    raise exception 'authentification requise' using errcode = '28000';
  end if;
  if p_status not in ('planifie', 'confirme', 'realise', 'absent', 'a_replanifier') then
    raise exception 'statut de résultat invalide' using errcode = '22023';
  end if;

  select * into v_appt from public.estimation_appointments where id = p_id;
  if v_appt.id is null then
    raise exception 'rendez-vous introuvable' using errcode = '22023';
  end if;

  -- Autorisation : gestionnaire (admin/manager) OU l'agent du rendez-vous.
  if not (public.calendar_can_manage()
          or (public.crm_has_role('agent_immobilier') and v_appt.agent_user_id = v_uid)) then
    raise exception 'droits insuffisants pour mettre à jour ce rendez-vous' using errcode = '42501';
  end if;

  v_old := v_appt.status;
  update public.estimation_appointments
  set status = p_status,
      internal_notes = coalesce(nullif(left(coalesce(p_notes, ''), 4000), ''), internal_notes)
  where id = p_id;

  -- Si réalisé, avance le stade vers « rendez_vous_realise » sans rétrograder.
  if p_status = 'realise' then
    update public.opportunities o
    set pipeline_stage = 'rendez_vous_realise'
    where o.id = v_appt.opportunity_id
      and array_position(array[
        'nouveau','prise_de_contact_en_cours','contact_etabli','qualification_en_cours',
        'rendez_vous_planifie','rendez_vous_realise','estimation_etude_dossier',
        'proposition_de_mandat','en_attente_de_signature','mandat_signe'], o.pipeline_stage)
          < array_position(array[
        'nouveau','prise_de_contact_en_cours','contact_etabli','qualification_en_cours',
        'rendez_vous_planifie','rendez_vous_realise','estimation_etude_dossier',
        'proposition_de_mandat','en_attente_de_signature','mandat_signe'], 'rendez_vous_realise');
  end if;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, old_value, new_value)
  values (v_uid, 'estimation_appointment', p_id, 'estimation_resultat',
          jsonb_build_object('status', v_old), jsonb_build_object('status', p_status));

  return jsonb_build_object('ok', true, 'id', p_id, 'status', p_status);
end;
$$;

-- =============================================================================
-- 8. GRANTS — EXECUTE aux seuls `authenticated` (chaque fonction re-vérifie le
--    rôle). Jamais anon ni PUBLIC.
-- =============================================================================
revoke all on function public.calendar_upsert_connection(text, text, text, text) from public;
revoke all on function public.calendar_select_estimation_calendar(text, text) from public;
revoke all on function public.calendar_mark_connection_state(uuid, text, text) from public;
revoke all on function public.calendar_disconnect() from public;
revoke all on function public.calendar_list_bookable_agents() from public;
revoke all on function public.crm_reserve_estimation_appointment(text, uuid, uuid, timestamptz, timestamptz, text, text, uuid, text, text, text, text) from public;
revoke all on function public.crm_confirm_estimation_appointment(uuid, text, text, text) from public;
revoke all on function public.crm_discard_pending_appointment(uuid) from public;
revoke all on function public.crm_reschedule_estimation_appointment(uuid, timestamptz, timestamptz) from public;
revoke all on function public.crm_cancel_estimation_appointment(uuid, text) from public;
revoke all on function public.crm_set_appointment_result(uuid, text, text) from public;

grant execute on function public.calendar_upsert_connection(text, text, text, text) to authenticated;
grant execute on function public.calendar_select_estimation_calendar(text, text) to authenticated;
grant execute on function public.calendar_mark_connection_state(uuid, text, text) to authenticated;
grant execute on function public.calendar_disconnect() to authenticated;
grant execute on function public.calendar_list_bookable_agents() to authenticated;
grant execute on function public.crm_reserve_estimation_appointment(text, uuid, uuid, timestamptz, timestamptz, text, text, uuid, text, text, text, text) to authenticated;
grant execute on function public.crm_confirm_estimation_appointment(uuid, text, text, text) to authenticated;
grant execute on function public.crm_discard_pending_appointment(uuid) to authenticated;
grant execute on function public.crm_reschedule_estimation_appointment(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.crm_cancel_estimation_appointment(uuid, text) to authenticated;
grant execute on function public.crm_set_appointment_result(uuid, text, text) to authenticated;

-- Durcissement : les *default privileges* Supabase accordent EXECUTE à `anon`
-- (et public) sur les fonctions du schéma public ; `grant … to authenticated`
-- ne le retire pas. On RETIRE explicitement EXECUTE à anon/public (chaque
-- fonction se défend déjà en exigeant auth.uid() / un rôle, mais laisser anon
-- exécutable viole le moindre privilège — §10 de la mission).
revoke execute on function public.calendar_can_plan() from anon, public;
revoke execute on function public.calendar_can_connect() from anon, public;
revoke execute on function public.calendar_can_manage() from anon, public;
revoke execute on function public.crm_current_operator_org() from anon, public;
revoke execute on function public.calendar_upsert_connection(text, text, text, text) from anon, public;
revoke execute on function public.calendar_select_estimation_calendar(text, text) from anon, public;
revoke execute on function public.calendar_mark_connection_state(uuid, text, text) from anon, public;
revoke execute on function public.calendar_disconnect() from anon, public;
revoke execute on function public.calendar_list_bookable_agents() from anon, public;
revoke execute on function public.crm_reserve_estimation_appointment(text, uuid, uuid, timestamptz, timestamptz, text, text, uuid, text, text, text, text) from anon, public;
revoke execute on function public.crm_confirm_estimation_appointment(uuid, text, text, text) from anon, public;
revoke execute on function public.crm_discard_pending_appointment(uuid) from anon, public;
revoke execute on function public.crm_reschedule_estimation_appointment(uuid, timestamptz, timestamptz) from anon, public;
revoke execute on function public.crm_cancel_estimation_appointment(uuid, text) from anon, public;
revoke execute on function public.crm_set_appointment_result(uuid, text, text) from anon, public;

commit;
