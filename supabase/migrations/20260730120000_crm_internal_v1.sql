-- =============================================================================
-- Prodigio OS — Migration 20260730120000_crm_internal_v1
--
-- Tranche verticale « CRM interne Mandats V1 ».
--
-- Rend exploitable, derrière une authentification interne, les données déjà
-- créées par le funnel (contacts, opportunities, funnel_submissions,
-- opportunity_contacts, privacy_records) SANS les dupliquer, et ajoute le
-- strict nécessaire à l'exploitation opérationnelle :
--
--   - organizations            (Organisation interne — opérateur Prodigio / agence)
--   - organization_memberships (Utilisateur ↔ Organisation, avec rôle)
--   - opportunity_organizations(Opportunité ↔ Organisation, avec fonction)
--   - opportunity_assignments  (Opportunité ↔ Utilisateur, avec responsabilité)
--   - activities               (Activité métier : appel, note, RDV… ≠ AuditEvent)
--   - tasks                    (Tâche / prochaine action, échéance, responsable)
--   - audit_events             (Journal d'audit NON modifiable ≠ Activité)
--   + colonnes ADDITIVES sur opportunities (résultat commercial, décision de
--     segment tracée).
--
-- Principes appliqués (docs/03, docs/06, CLAUDE.md) :
--   - ADDITIVE : ne modifie AUCUNE des 3 migrations déjà déployées. La fonction
--     publique `submit_mandate_funnel` et la RLS du funnel restent INTACTES.
--   - La base reste l'unique source de vérité. Aucun accès public direct.
--   - Sécurité : RLS activée partout. Les rôles publics (anon) n'obtiennent
--     AUCUN privilège. Les utilisateurs `authenticated` n'ont que des politiques
--     de LECTURE, restreintes par appartenance/rôle (helpers SECURITY DEFINER).
--     TOUTE écriture passe par des fonctions SECURITY DEFINER qui vérifient le
--     rôle du·de la caller·euse et écrivent un AuditEvent quand c'est pertinent.
--   - Stade ≠ Segment ; Activité ≠ AuditEvent ; recommandation ≠ décision humaine.
--   - Aucun rôle codé en dur dans l'UI : les rôles vivent en base (memberships).
--   - Aucun paramètre économique (seuil, partages, HT/TTC) codé ici.
--
-- Application : voir docs/07-SUPABASE-SETUP.md §9. Appliquer UNE seule fois,
-- après audit du schéma distant. NE PAS réappliquer les migrations antérieures.
-- =============================================================================

begin;

-- =============================================================================
-- 1. ORGANISATIONS — entité interne (opérateur Prodigio, agence partenaire).
--    ≠ Contact (externe), ≠ Utilisateur (compte authentifié).
-- =============================================================================
create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  slug        text not null unique,
  name        text not null,
  kind        text not null default 'operateur_prodigio'
                check (kind in ('operateur_prodigio', 'agence_partenaire')),
  status      text not null default 'actif'
                check (status in ('actif', 'suspendu'))
);

comment on table public.organizations is
  'Organisation interne (opérateur Prodigio / agence partenaire). Frontière de cloisonnement. Distincte d''un Contact externe et d''un Utilisateur.';

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- =============================================================================
-- 2. ORGANIZATION_MEMBERSHIPS — Utilisateur ↔ Organisation, porteur d'un rôle.
--    Cardinalité : N-N (un·e utilisateur·rice peut appartenir à plusieurs orgs ;
--    une org compte plusieurs membres). Au MVP, une appartenance active suffit.
-- =============================================================================
create table if not exists public.organization_memberships (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  role             text not null
                     check (role in ('administrateur', 'manager', 'setter',
                                     'agent_immobilier', 'partenaire_lecture')),
  status           text not null default 'actif'
                     check (status in ('actif', 'suspendu')),
  constraint organization_memberships_unique unique (user_id, organization_id)
);

comment on table public.organization_memberships is
  'Relation N-N Utilisateur ↔ Organisation avec rôle (administrateur / manager / setter / agent_immobilier / partenaire_lecture). Le rôle n''est jamais codé en dur dans l''UI.';

create index if not exists organization_memberships_user_idx
  on public.organization_memberships (user_id) where status = 'actif';
create index if not exists organization_memberships_org_idx
  on public.organization_memberships (organization_id);

drop trigger if exists organization_memberships_set_updated_at on public.organization_memberships;
create trigger organization_memberships_set_updated_at
  before update on public.organization_memberships
  for each row execute function public.set_updated_at();

-- =============================================================================
-- 3. OPPORTUNITY_ORGANIZATIONS — Opportunité ↔ Organisation, avec fonction.
--    Prépare l'isolation partenaire (docs/06). Au MVP : seule l'org opérateur
--    Prodigio participe, attachée automatiquement (trigger) à chaque opportunité.
-- =============================================================================
create table if not exists public.opportunity_organizations (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  opportunity_id   uuid not null references public.opportunities (id) on delete cascade,
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  function         text not null default 'operateur_prodigio'
                     check (function in ('operateur_prodigio', 'agence_porteuse_mandat',
                                         'partenaire_commercial')),
  constraint opportunity_organizations_unique unique (opportunity_id, organization_id)
);

comment on table public.opportunity_organizations is
  'Relation N-N Opportunité ↔ Organisation avec fonction. Fondement de l''isolation partenaire (docs/06). Une opportunité peut réunir plusieurs organisations.';

create index if not exists opportunity_organizations_org_idx
  on public.opportunity_organizations (organization_id);

-- =============================================================================
-- 4. OPPORTUNITY_ASSIGNMENTS — Opportunité ↔ Utilisateur, avec responsabilité.
--    Aucun lead ne reste silencieusement sans suite : sans assignment, il
--    apparaît dans la file « Non affectés » (processing_status = non_affecte).
-- =============================================================================
create table if not exists public.opportunity_assignments (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  opportunity_id  uuid not null references public.opportunities (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  responsibility  text not null default 'setter'
                    check (responsibility in ('setter', 'manager', 'agent_immobilier',
                                              'responsable_marketing')),
  assigned_by     uuid references auth.users (id) on delete set null,
  constraint opportunity_assignments_unique unique (opportunity_id, user_id)
);

comment on table public.opportunity_assignments is
  'Relation N-N Opportunité ↔ Utilisateur avec responsabilité (setter / manager / agent_immobilier / responsable_marketing).';

create index if not exists opportunity_assignments_user_idx
  on public.opportunity_assignments (user_id);
create index if not exists opportunity_assignments_opportunity_idx
  on public.opportunity_assignments (opportunity_id);

-- =============================================================================
-- 5. ACTIVITIES — Activité métier horodatée (appel, tentative, note, RDV…).
--    N'EST PAS le journal d'audit (voir audit_events). Le nombre de tentatives
--    d'appel se CALCULE d'ici, ce n'est jamais un stade.
-- =============================================================================
create table if not exists public.activities (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  occurred_at     timestamptz not null default now(),
  opportunity_id  uuid not null references public.opportunities (id) on delete cascade,
  contact_id      uuid references public.contacts (id) on delete set null,
  author_user_id  uuid references auth.users (id) on delete set null,
  type            text not null
                    check (type in ('appel', 'tentative_appel', 'email', 'sms_whatsapp',
                                    'rendez_vous', 'note', 'autre')),
  -- Résultat d'un contact téléphonique (facultatif ; pertinent surtout pour
  -- appel / tentative_appel). ≠ résultat commercial de l'opportunité.
  outcome         text
                    check (outcome is null or outcome in ('sans_reponse', 'message_laisse',
                                    'rappel_demande', 'contact_etabli', 'mauvais_numero')),
  body            text,
  metadata        jsonb
);

comment on table public.activities is
  'Activité métier (interaction commerciale horodatée). Distincte de l''AuditEvent. Le nombre de tentatives se calcule ici, ce n''est pas un stade.';

create index if not exists activities_opportunity_idx
  on public.activities (opportunity_id, occurred_at desc);

-- =============================================================================
-- 6. TASKS — Tâche / prochaine action (échéance, responsable, statut).
--    Sert « à rappeler aujourd'hui » et l'alerte des tâches en retard.
-- =============================================================================
create table if not exists public.tasks (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  opportunity_id     uuid not null references public.opportunities (id) on delete cascade,
  author_user_id     uuid references auth.users (id) on delete set null,
  assignee_user_id   uuid references auth.users (id) on delete set null,
  title              text not null,
  kind               text not null default 'rappel'
                       check (kind in ('rappel', 'tache')),
  status             text not null default 'a_faire'
                       check (status in ('a_faire', 'fait', 'annule')),
  due_at             timestamptz,
  completed_at       timestamptz
);

comment on table public.tasks is
  'Tâche / prochaine action rattachée à une opportunité (échéance, responsable, statut). Alimente « à rappeler » et « en retard ».';

create index if not exists tasks_opportunity_idx on public.tasks (opportunity_id);
create index if not exists tasks_due_open_idx
  on public.tasks (due_at) where status = 'a_faire';
create index if not exists tasks_assignee_idx on public.tasks (assignee_user_id);

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- =============================================================================
-- 7. AUDIT_EVENTS — Journal d'audit technique NON modifiable par les
--    utilisateurs ordinaires. Distinct de l'Activité métier.
-- =============================================================================
create table if not exists public.audit_events (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  actor_user_id uuid references auth.users (id) on delete set null,
  entity_type  text not null
                 check (entity_type in ('opportunity', 'contact', 'membership', 'organization')),
  entity_id    uuid not null,
  event_type   text not null
                 check (event_type in ('creation', 'changement_stade', 'changement_segment',
                                       'changement_affectation', 'changement_permission',
                                       'resolution_doublon', 'resultat_commercial')),
  old_value    jsonb,
  new_value    jsonb,
  metadata     jsonb
);

comment on table public.audit_events is
  'AuditEvent : journal technique NON modifiable (création, changement de stade / segment / affectation / permission, résultat commercial). Distinct de l''Activité métier.';

create index if not exists audit_events_entity_idx
  on public.audit_events (entity_type, entity_id, created_at desc);

-- Immuabilité : aucun UPDATE / DELETE, même pour le propriétaire de la table.
create or replace function public.audit_events_block_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $$
begin
  raise exception 'audit_events est immuable (ni UPDATE ni DELETE)' using errcode = '0A000';
end;
$$;

drop trigger if exists audit_events_immutable on public.audit_events;
create trigger audit_events_immutable
  before update or delete on public.audit_events
  for each row execute function public.audit_events_block_mutation();

-- =============================================================================
-- 8. COLONNES ADDITIVES sur opportunities — résultat commercial + décision de
--    segment tracée (recommandation ≠ décision humaine).
-- =============================================================================
alter table public.opportunities
  add column if not exists outcome text,
  add column if not exists outcome_reason text,
  add column if not exists outcome_recorded_by uuid references auth.users (id) on delete set null,
  add column if not exists outcome_recorded_at timestamptz,
  add column if not exists segment_decided_by uuid references auth.users (id) on delete set null,
  add column if not exists segment_decided_at timestamptz,
  add column if not exists segment_decision_reason text,
  add column if not exists segment_is_derogation boolean not null default false;

alter table public.opportunities
  drop constraint if exists opportunities_outcome_check,
  add constraint opportunities_outcome_check check (
    outcome is null or outcome in (
      'signe_gagne', 'refuse_apres_proposition', 'perdu_avant_signature'));

-- =============================================================================
-- 9. HELPERS D'ACCÈS — SECURITY DEFINER, lisent les memberships SANS déclencher
--    la RLS de leur propre table (évite toute récursion de politique).
-- =============================================================================
create or replace function public.crm_active_roles()
returns setof text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.role
  from public.organization_memberships m
  where m.user_id = auth.uid()
    and m.status = 'actif';
$$;

comment on function public.crm_active_roles() is
  'Rôles actifs de l''utilisateur courant (auth.uid()) à travers ses memberships. SECURITY DEFINER pour éviter la récursion RLS.';

create or replace function public.crm_has_access()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.organization_memberships m
    where m.user_id = auth.uid() and m.status = 'actif'
  );
$$;

comment on function public.crm_has_access() is
  'Vrai si l''utilisateur courant a au moins un membership actif (accès CRM en lecture selon son rôle).';

create or replace function public.crm_has_role(variadic p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.organization_memberships m
    where m.user_id = auth.uid() and m.status = 'actif'
      and m.role = any (p_roles)
  );
$$;

comment on function public.crm_has_role(text[]) is
  'Vrai si l''utilisateur courant possède (dans un membership actif) l''un des rôles fournis.';

-- Droit de voir les coordonnées sensibles (téléphone/e-mail). partenaire_lecture
-- exclu (données masquées côté application pour ce rôle).
create or replace function public.crm_can_view_contact_details()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.crm_has_role('administrateur', 'manager', 'setter', 'agent_immobilier');
$$;

-- Les helpers sont sûrs à exposer aux utilisateurs authentifiés (ils ne
-- renvoient qu'un booléen / la liste de SES propres rôles). Retirés de PUBLIC/anon.
revoke all on function public.crm_active_roles() from public;
revoke all on function public.crm_has_access() from public;
revoke all on function public.crm_has_role(text[]) from public;
revoke all on function public.crm_can_view_contact_details() from public;
grant execute on function public.crm_active_roles() to authenticated;
grant execute on function public.crm_has_access() to authenticated;
grant execute on function public.crm_has_role(text[]) to authenticated;
grant execute on function public.crm_can_view_contact_details() to authenticated;

-- =============================================================================
-- 10. RLS — LECTURE uniquement pour `authenticated` disposant d'un accès CRM.
--     Aucune écriture directe : toute mutation passe par les fonctions §12.
--     anon : aucun grant, aucune politique → refus total (funnel inchangé).
-- =============================================================================
alter table public.organizations             enable row level security;
alter table public.organization_memberships  enable row level security;
alter table public.opportunity_organizations enable row level security;
alter table public.opportunity_assignments   enable row level security;
alter table public.activities                 enable row level security;
alter table public.tasks                      enable row level security;
alter table public.audit_events               enable row level security;

-- Lecture des tables EXISTANTES du funnel par le back-office authentifié.
-- (La migration de capture avait révoqué tout privilège direct ; on RÉ-accorde
--  ici le seul SELECT à `authenticated`, sous contrôle d'une politique RLS.)
grant select on public.contacts             to authenticated;
grant select on public.opportunities        to authenticated;
grant select on public.funnel_submissions   to authenticated;
grant select on public.opportunity_contacts to authenticated;
grant select on public.privacy_records      to authenticated;

-- Lecture des tables CRM.
grant select on public.organizations             to authenticated;
grant select on public.organization_memberships  to authenticated;
grant select on public.opportunity_organizations to authenticated;
grant select on public.opportunity_assignments   to authenticated;
grant select on public.activities                 to authenticated;
grant select on public.tasks                      to authenticated;
grant select on public.audit_events               to authenticated;

-- Politiques de LECTURE. V1 : tout membre actif (opérateur Prodigio) voit les
-- dossiers Prodigio. L'isolation fine par partenaire (opportunity_organizations)
-- est PRÉPARÉE (table + trigger) et sera restreinte quand un partenaire réel
-- sera intégré (docs/06 — décisions ouvertes).
drop policy if exists contacts_crm_read on public.contacts;
create policy contacts_crm_read on public.contacts
  for select to authenticated using (public.crm_has_access());

drop policy if exists opportunities_crm_read on public.opportunities;
create policy opportunities_crm_read on public.opportunities
  for select to authenticated using (public.crm_has_access());

drop policy if exists funnel_submissions_crm_read on public.funnel_submissions;
create policy funnel_submissions_crm_read on public.funnel_submissions
  for select to authenticated using (public.crm_has_access());

drop policy if exists opportunity_contacts_crm_read on public.opportunity_contacts;
create policy opportunity_contacts_crm_read on public.opportunity_contacts
  for select to authenticated using (public.crm_has_access());

drop policy if exists privacy_records_crm_read on public.privacy_records;
create policy privacy_records_crm_read on public.privacy_records
  for select to authenticated using (public.crm_has_access());

drop policy if exists organizations_crm_read on public.organizations;
create policy organizations_crm_read on public.organizations
  for select to authenticated using (public.crm_has_access());

-- Un·e utilisateur·rice voit toujours SES propres memberships ; les membres
-- actifs voient l'annuaire interne (nécessaire pour affecter un·e responsable).
drop policy if exists memberships_crm_read on public.organization_memberships;
create policy memberships_crm_read on public.organization_memberships
  for select to authenticated
  using (user_id = auth.uid() or public.crm_has_access());

drop policy if exists opportunity_organizations_crm_read on public.opportunity_organizations;
create policy opportunity_organizations_crm_read on public.opportunity_organizations
  for select to authenticated using (public.crm_has_access());

drop policy if exists opportunity_assignments_crm_read on public.opportunity_assignments;
create policy opportunity_assignments_crm_read on public.opportunity_assignments
  for select to authenticated using (public.crm_has_access());

drop policy if exists activities_crm_read on public.activities;
create policy activities_crm_read on public.activities
  for select to authenticated using (public.crm_has_access());

drop policy if exists tasks_crm_read on public.tasks;
create policy tasks_crm_read on public.tasks
  for select to authenticated using (public.crm_has_access());

-- Journal d'audit : consultation réservée admin / manager (docs/06).
drop policy if exists audit_events_crm_read on public.audit_events;
create policy audit_events_crm_read on public.audit_events
  for select to authenticated
  using (public.crm_has_role('administrateur', 'manager'));

-- =============================================================================
-- 11. ORGANISATION OPÉRATEUR + RATTACHEMENT AUTOMATIQUE + BACKFILL.
--     N'altère PAS submit_mandate_funnel : un trigger AFTER INSERT rattache
--     l'org opérateur à chaque nouvelle opportunité (foundation d'accès).
-- =============================================================================
insert into public.organizations (slug, name, kind, status)
values ('prodigio', 'Prodigio', 'operateur_prodigio', 'actif')
on conflict (slug) do nothing;

create or replace function public.attach_operator_org()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid;
begin
  select id into v_org from public.organizations
  where slug = 'prodigio' and kind = 'operateur_prodigio' limit 1;
  if v_org is not null then
    insert into public.opportunity_organizations (opportunity_id, organization_id, function)
    values (new.id, v_org, 'operateur_prodigio')
    on conflict (opportunity_id, organization_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists opportunities_attach_operator_org on public.opportunities;
create trigger opportunities_attach_operator_org
  after insert on public.opportunities
  for each row execute function public.attach_operator_org();

-- Backfill : rattache l'org opérateur aux opportunités DÉJÀ présentes (dont la
-- soumission réelle). Ne touche à aucune donnée personnelle.
insert into public.opportunity_organizations (opportunity_id, organization_id, function)
select o.id, org.id, 'operateur_prodigio'
from public.opportunities o
cross join (select id from public.organizations where slug = 'prodigio' limit 1) org
on conflict (opportunity_id, organization_id) do nothing;

-- =============================================================================
-- 12. FONCTIONS DE MUTATION — SECURITY DEFINER. Seul chemin d'écriture du CRM.
--     Chacune : vérifie auth.uid(), vérifie le rôle, écrit (+ AuditEvent si
--     pertinent), renvoie un minimum. Idempotence sur les relations (on conflict).
-- =============================================================================

-- Garde commune : lève une exception si le rôle requis manque.
create or replace function public.crm_require_role(variadic p_roles text[])
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'authentification requise' using errcode = '28000';
  end if;
  if not public.crm_has_role(variadic p_roles) then
    raise exception 'droits insuffisants' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.crm_require_role(text[]) from public;

-- --- Affecter un·e responsable -----------------------------------------------
create or replace function public.crm_assign_opportunity(
  p_opportunity_id uuid,
  p_user_id uuid,
  p_responsibility text default 'setter'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_resp text;
begin
  perform public.crm_require_role('administrateur', 'manager', 'setter');

  v_resp := case when p_responsibility = any (array[
    'setter','manager','agent_immobilier','responsable_marketing'])
    then p_responsibility else 'setter' end;

  if not exists (select 1 from public.opportunities where id = p_opportunity_id) then
    raise exception 'opportunité introuvable' using errcode = '22023';
  end if;
  if not exists (select 1 from public.organization_memberships
                 where user_id = p_user_id and status = 'actif') then
    raise exception 'utilisateur cible non membre actif' using errcode = '22023';
  end if;

  insert into public.opportunity_assignments (opportunity_id, user_id, responsibility, assigned_by)
  values (p_opportunity_id, p_user_id, v_resp, auth.uid())
  on conflict (opportunity_id, user_id)
    do update set responsibility = excluded.responsibility;

  update public.opportunities
  set processing_status = 'affecte'
  where id = p_opportunity_id and processing_status = 'non_affecte';

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (auth.uid(), 'opportunity', p_opportunity_id, 'changement_affectation',
          jsonb_build_object('user_id', p_user_id, 'responsibility', v_resp));

  return jsonb_build_object('ok', true);
end;
$$;

-- --- S'affecter soi-même ------------------------------------------------------
create or replace function public.crm_self_assign(
  p_opportunity_id uuid,
  p_responsibility text default 'setter'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.crm_require_role('administrateur', 'manager', 'setter');
  return public.crm_assign_opportunity(p_opportunity_id, auth.uid(), p_responsibility);
end;
$$;

-- --- Changer le stade du pipeline --------------------------------------------
create or replace function public.crm_change_stage(
  p_opportunity_id uuid,
  p_stage text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old text;
begin
  perform public.crm_require_role('administrateur', 'manager', 'setter');

  if p_stage <> all (array[
    'nouveau','prise_de_contact_en_cours','contact_etabli','qualification_en_cours',
    'rendez_vous_planifie','rendez_vous_realise','estimation_etude_dossier',
    'proposition_de_mandat','en_attente_de_signature','mandat_signe','perdu']) then
    raise exception 'stade invalide' using errcode = '22023';
  end if;

  select pipeline_stage into v_old from public.opportunities where id = p_opportunity_id;
  if v_old is null then
    raise exception 'opportunité introuvable' using errcode = '22023';
  end if;

  if v_old is distinct from p_stage then
    update public.opportunities set pipeline_stage = p_stage where id = p_opportunity_id;
    insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, old_value, new_value, metadata)
    values (auth.uid(), 'opportunity', p_opportunity_id, 'changement_stade',
            jsonb_build_object('pipeline_stage', v_old),
            jsonb_build_object('pipeline_stage', p_stage),
            case when p_note is not null then jsonb_build_object('note', left(p_note, 500)) end);
  end if;

  return jsonb_build_object('ok', true, 'stage', p_stage);
end;
$$;

-- --- Journaliser une activité (appel, tentative, note, RDV…) ------------------
create or replace function public.crm_log_activity(
  p_opportunity_id uuid,
  p_type text,
  p_outcome text default null,
  p_body text default null,
  p_contact_id uuid default null,
  p_occurred_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_type text;
  v_outcome text;
  v_id uuid;
begin
  perform public.crm_require_role('administrateur', 'manager', 'setter');

  v_type := case when p_type = any (array[
    'appel','tentative_appel','email','sms_whatsapp','rendez_vous','note','autre'])
    then p_type else 'autre' end;
  v_outcome := case when p_outcome = any (array[
    'sans_reponse','message_laisse','rappel_demande','contact_etabli','mauvais_numero'])
    then p_outcome end;

  if not exists (select 1 from public.opportunities where id = p_opportunity_id) then
    raise exception 'opportunité introuvable' using errcode = '22023';
  end if;

  insert into public.activities (opportunity_id, contact_id, author_user_id, type, outcome, body, occurred_at)
  values (p_opportunity_id, p_contact_id, auth.uid(), v_type, v_outcome,
          nullif(left(p_body, 4000), ''), coalesce(p_occurred_at, now()))
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- --- Créer une prochaine action / tâche --------------------------------------
create or replace function public.crm_create_task(
  p_opportunity_id uuid,
  p_title text,
  p_kind text default 'rappel',
  p_due_at timestamptz default null,
  p_assignee_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_kind text;
  v_id uuid;
begin
  perform public.crm_require_role('administrateur', 'manager', 'setter');

  v_kind := case when p_kind in ('rappel', 'tache') then p_kind else 'rappel' end;
  if nullif(trim(p_title), '') is null then
    raise exception 'intitulé requis' using errcode = '22023';
  end if;
  if not exists (select 1 from public.opportunities where id = p_opportunity_id) then
    raise exception 'opportunité introuvable' using errcode = '22023';
  end if;

  insert into public.tasks (opportunity_id, author_user_id, assignee_user_id, title, kind, due_at)
  values (p_opportunity_id, auth.uid(), coalesce(p_assignee_user_id, auth.uid()),
          left(p_title, 300), v_kind, p_due_at)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- --- Terminer / annuler une tâche --------------------------------------------
create or replace function public.crm_set_task_status(
  p_task_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.crm_require_role('administrateur', 'manager', 'setter');
  if p_status not in ('a_faire', 'fait', 'annule') then
    raise exception 'statut invalide' using errcode = '22023';
  end if;

  update public.tasks
  set status = p_status,
      completed_at = case when p_status = 'fait' then now() else null end
  where id = p_task_id;

  if not found then
    raise exception 'tâche introuvable' using errcode = '22023';
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- --- Décision de segment (VALIDÉE humaine ≠ recommandation) -------------------
create or replace function public.crm_decide_segment(
  p_opportunity_id uuid,
  p_segment text,
  p_reason text default null,
  p_is_derogation boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old text;
begin
  -- Le segment VALIDÉ est une décision managériale (docs/06 : setter = ∂).
  perform public.crm_require_role('administrateur', 'manager');

  if p_segment <> all (array[
    'non_determine','cible_prodigio_premium','agence_partenaire_classique',
    'hors_perimetre','a_reevaluer']) then
    raise exception 'segment invalide' using errcode = '22023';
  end if;
  if p_is_derogation and nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'justification obligatoire en cas de dérogation' using errcode = '22023';
  end if;

  select segment into v_old from public.opportunities where id = p_opportunity_id;
  if v_old is null then
    raise exception 'opportunité introuvable' using errcode = '22023';
  end if;

  update public.opportunities
  set segment = p_segment,
      segment_decided_by = auth.uid(),
      segment_decided_at = now(),
      segment_decision_reason = nullif(left(p_reason, 1000), ''),
      segment_is_derogation = coalesce(p_is_derogation, false)
  where id = p_opportunity_id;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, old_value, new_value, metadata)
  values (auth.uid(), 'opportunity', p_opportunity_id, 'changement_segment',
          jsonb_build_object('segment', v_old),
          jsonb_build_object('segment', p_segment),
          jsonb_build_object('reason', left(coalesce(p_reason, ''), 1000),
                             'derogation', coalesce(p_is_derogation, false)));

  return jsonb_build_object('ok', true, 'segment', p_segment);
end;
$$;

-- --- Résultat commercial de l'opportunité (≠ Mandat) -------------------------
create or replace function public.crm_record_outcome(
  p_opportunity_id uuid,
  p_outcome text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old text;
begin
  perform public.crm_require_role('administrateur', 'manager', 'setter');

  if p_outcome <> all (array[
    'signe_gagne','refuse_apres_proposition','perdu_avant_signature']) then
    raise exception 'résultat invalide' using errcode = '22023';
  end if;
  -- Une perte / disqualification exige un motif (docs/03 — raisons de perte).
  if p_outcome <> 'signe_gagne' and nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'motif requis pour une perte ou une disqualification' using errcode = '22023';
  end if;

  select outcome into v_old from public.opportunities where id = p_opportunity_id;
  if not exists (select 1 from public.opportunities where id = p_opportunity_id) then
    raise exception 'opportunité introuvable' using errcode = '22023';
  end if;

  update public.opportunities
  set outcome = p_outcome,
      outcome_reason = nullif(left(p_reason, 1000), ''),
      loss_reason = case when p_outcome <> 'signe_gagne'
                         then nullif(left(p_reason, 1000), '') else loss_reason end,
      outcome_recorded_by = auth.uid(),
      outcome_recorded_at = now(),
      -- Aligne le stade terminal (le stade reste distinct du résultat).
      pipeline_stage = case
        when p_outcome = 'signe_gagne' then 'mandat_signe'
        when p_outcome = 'perdu_avant_signature' then 'perdu'
        else pipeline_stage end,
      processing_status = 'clos'
  where id = p_opportunity_id;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, old_value, new_value)
  values (auth.uid(), 'opportunity', p_opportunity_id, 'resultat_commercial',
          jsonb_build_object('outcome', v_old),
          jsonb_build_object('outcome', p_outcome, 'reason', left(coalesce(p_reason, ''), 1000)));

  return jsonb_build_object('ok', true);
end;
$$;

-- Exposition : uniquement aux utilisateurs authentifiés (chaque fonction
-- re-vérifie le rôle en interne). Jamais à anon ni PUBLIC.
revoke all on function public.crm_assign_opportunity(uuid, uuid, text) from public;
revoke all on function public.crm_self_assign(uuid, text) from public;
revoke all on function public.crm_change_stage(uuid, text, text) from public;
revoke all on function public.crm_log_activity(uuid, text, text, text, uuid, timestamptz) from public;
revoke all on function public.crm_create_task(uuid, text, text, timestamptz, uuid) from public;
revoke all on function public.crm_set_task_status(uuid, text) from public;
revoke all on function public.crm_decide_segment(uuid, text, text, boolean) from public;
revoke all on function public.crm_record_outcome(uuid, text, text) from public;

grant execute on function public.crm_assign_opportunity(uuid, uuid, text) to authenticated;
grant execute on function public.crm_self_assign(uuid, text) to authenticated;
grant execute on function public.crm_change_stage(uuid, text, text) to authenticated;
grant execute on function public.crm_log_activity(uuid, text, text, text, uuid, timestamptz) to authenticated;
grant execute on function public.crm_create_task(uuid, text, text, timestamptz, uuid) to authenticated;
grant execute on function public.crm_set_task_status(uuid, text) to authenticated;
grant execute on function public.crm_decide_segment(uuid, text, text, boolean) to authenticated;
grant execute on function public.crm_record_outcome(uuid, text, text) to authenticated;

-- =============================================================================
-- 13. BOOTSTRAP DU PREMIER ADMINISTRATEUR + INVITATION DE MEMBRES.
--     La CRÉATION du compte d'authentification (auth.users) se fait via Supabase
--     Auth (invitation / inscription contrôlée). Ces fonctions n'attribuent que
--     le RÔLE une fois le compte existant — jamais de mot de passe ici.
-- =============================================================================

-- Premier admin : n'agit QUE s'il n'existe encore AUCUN administrateur actif,
-- et seulement pour SOI-MÊME (auth.uid() = compte ciblé par l'e-mail). Empêche
-- toute escalade ultérieure (une fois un admin présent, la fonction refuse).
create or replace function public.crm_bootstrap_first_admin(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_target uuid;
  v_org uuid;
begin
  if v_uid is null then
    raise exception 'authentification requise' using errcode = '28000';
  end if;
  if exists (
    select 1 from public.organization_memberships
    where role = 'administrateur' and status = 'actif'
  ) then
    raise exception 'un administrateur existe déjà — utilisez crm_invite_member' using errcode = '42501';
  end if;

  select id into v_target from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if v_target is null then
    raise exception 'aucun compte d''authentification pour cet e-mail' using errcode = '22023';
  end if;
  if v_target <> v_uid then
    raise exception 'le bootstrap ne peut cibler que votre propre compte' using errcode = '42501';
  end if;

  select id into v_org from public.organizations where slug = 'prodigio' limit 1;
  if v_org is null then
    insert into public.organizations (slug, name, kind, status)
    values ('prodigio', 'Prodigio', 'operateur_prodigio', 'actif')
    returning id into v_org;
  end if;

  insert into public.organization_memberships (user_id, organization_id, role, status)
  values (v_target, v_org, 'administrateur', 'actif')
  on conflict (user_id, organization_id)
    do update set role = 'administrateur', status = 'actif';

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'membership', v_target, 'changement_permission',
          jsonb_build_object('role', 'administrateur', 'bootstrap', true));

  return jsonb_build_object('ok', true, 'organization_id', v_org);
end;
$$;

-- Invitation : attribue un rôle à un compte d'authentification EXISTANT. Réservé
-- aux administrateurs. Le compte doit préexister (Supabase Auth) — sinon on
-- lève une erreur explicite invitant à créer d'abord l'accès.
create or replace function public.crm_invite_member(
  p_email text,
  p_role text,
  p_organization_slug text default 'prodigio'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_target uuid;
  v_org uuid;
begin
  perform public.crm_require_role('administrateur');

  if p_role <> all (array[
    'administrateur','manager','setter','agent_immobilier','partenaire_lecture']) then
    raise exception 'rôle invalide' using errcode = '22023';
  end if;

  select id into v_target from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if v_target is null then
    raise exception 'compte inexistant : créez d''abord l''accès dans Supabase Auth (invitation)' using errcode = '22023';
  end if;
  select id into v_org from public.organizations where slug = coalesce(p_organization_slug, 'prodigio') limit 1;
  if v_org is null then
    raise exception 'organisation introuvable' using errcode = '22023';
  end if;

  insert into public.organization_memberships (user_id, organization_id, role, status)
  values (v_target, v_org, p_role, 'actif')
  on conflict (user_id, organization_id)
    do update set role = excluded.role, status = 'actif';

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (auth.uid(), 'membership', v_target, 'changement_permission',
          jsonb_build_object('role', p_role, 'organization_id', v_org));

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.crm_bootstrap_first_admin(text) from public;
revoke all on function public.crm_invite_member(text, text, text) from public;
grant execute on function public.crm_bootstrap_first_admin(text) to authenticated;
grant execute on function public.crm_invite_member(text, text, text) to authenticated;

-- Annuaire interne : liste les membres (id, e-mail, rôle) des organisations de
-- l'utilisateur courant. SECURITY DEFINER pour lire auth.users (non exposé). Sert
-- l'affichage des responsables et le sélecteur d'affectation. Réservé aux membres.
create or replace function public.crm_list_members()
returns table (user_id uuid, email text, role text, organization_id uuid, status text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.user_id, u.email::text, m.role, m.organization_id, m.status
  from public.organization_memberships m
  join auth.users u on u.id = m.user_id
  where public.crm_has_access()
    and m.organization_id in (
      select organization_id from public.organization_memberships
      where user_id = auth.uid() and status = 'actif'
    );
$$;

revoke all on function public.crm_list_members() from public;
grant execute on function public.crm_list_members() to authenticated;

-- Neutralise les privilèges par défaut pour anon sur les futures tables (défense
-- en profondeur, comme la migration de capture). authenticated conserve ce que
-- les GRANT explicites ci-dessus lui donnent (SELECT sous RLS uniquement).
alter default privileges in schema public revoke all on tables from anon;

commit;
