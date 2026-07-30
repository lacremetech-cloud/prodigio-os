-- =============================================================================
-- Prodigio OS — Migration 20260730190000_users_and_access_v1
--
-- « Gestion des utilisateurs, invitations, rôles et accès — V1 ».
--
-- ADDITIVE au-dessus du CRM interne (20260730120000_crm_internal_v1 +
-- durcissements). Ne modifie AUCUNE migration historique, ne touche NI la
-- fonction publique `submit_mandate_funnel`, NI la RLS du funnel, NI les données
-- réelles. Ajoute :
--
--   1. Table `organization_invitations` (invitations natives Supabase Auth :
--      aucun token brut stocké — on s'appuie sur `inviteUserByEmail`).
--   2. Extension ADDITIVE des contraintes CHECK de `audit_events` (nouveaux
--      types d'entité / d'événement liés aux invitations et aux membres).
--   3. Fonctions SECURITY DEFINER d'administration des membres et invitations
--      (créer / renvoyer / révoquer / accepter une invitation ; changer un rôle ;
--      activer / désactiver un accès ; lister l'équipe et les invitations).
--   4. Isolation RLS fine du rôle `agent_immobilier` (visibilité limitée aux
--      dossiers explicitement AFFECTÉS) — la matrice des droits devient vraie
--      EN BASE, pas seulement masquée dans l'interface.
--
-- Principes (CLAUDE.md, docs/06) appliqués :
--   - Permissions décidées côté serveur / base. `anon` : aucun privilège.
--   - `authenticated` : SELECT sous RLS uniquement ; toute écriture passe par une
--     fonction SECURITY DEFINER qui re-vérifie le rôle et écrit un AuditEvent.
--   - `search_path` figé sur toutes les fonctions ; EXECUTE retiré à anon/public.
--   - Aucun secret, aucun paramètre économique, aucun rôle codé en dur dans l'UI.
--   - Protection du DERNIER administrateur actif ; pas d'auto-élévation ; l'e-mail
--     authentifié doit correspondre à l'invitation ; acceptation unique/idempotente.
--   - `partenaire_lecture` : isolation fine NON terminée en V1 → non attribuable
--     (bloqué par les fonctions ET l'UI) jusqu'à sécurisation (docs/11).
--
-- Application : voir docs/07-SUPABASE-SETUP.md §11 et docs/11-USERS-AND-ACCESS.md.
-- Appliquer UNE seule fois, après audit du schéma distant.
-- =============================================================================

begin;

-- =============================================================================
-- 1. AUDIT — extension ADDITIVE des contraintes CHECK.
--    On conserve les valeurs existantes et on ajoute celles nécessaires à la
--    gestion des utilisateurs (invitations + statut des membres).
-- =============================================================================
alter table public.audit_events
  drop constraint if exists audit_events_entity_type_check,
  add constraint audit_events_entity_type_check check (
    entity_type in ('opportunity', 'contact', 'membership', 'organization', 'invitation'));

alter table public.audit_events
  drop constraint if exists audit_events_event_type_check,
  add constraint audit_events_event_type_check check (
    event_type in (
      'creation', 'changement_stade', 'changement_segment',
      'changement_affectation', 'changement_permission',
      'resolution_doublon', 'resultat_commercial',
      -- Nouveaux (V1 utilisateurs & accès) :
      'invitation_creee', 'invitation_renvoyee', 'invitation_revoquee',
      'invitation_acceptee', 'changement_role',
      'activation_membre', 'desactivation_membre'));

-- =============================================================================
-- 2. TABLE organization_invitations.
--    Une invitation = une intention d'attribuer un rôle à un e-mail, matérialisée
--    par une invitation native Supabase Auth. Le compte auth peut préexister ou
--    être créé par `inviteUserByEmail` ; l'acceptation crée la membership.
--
--    Aucun token brut n'est stocké : la preuve de possession du lien est gérée
--    par Supabase Auth (verify / PKCE). `auth_user_id` mémorise le compte
--    provisionné pour rapprochement, jamais un secret.
-- =============================================================================
create table if not exists public.organization_invitations (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  email             text not null,           -- normalisé (lower/trim) par la fonction
  first_name        text,
  last_name         text,
  role              text not null
                      check (role in ('administrateur', 'manager', 'setter',
                                      'agent_immobilier', 'partenaire_lecture')),
  status            text not null default 'en_attente'
                      check (status in ('en_attente', 'acceptee', 'revoquee')),
  invited_by        uuid references auth.users (id) on delete set null,
  expires_at        timestamptz not null,
  sent_at           timestamptz,             -- horodatage réel de l'envoi Auth (null si secret absent)
  accepted_at       timestamptz,
  accepted_by       uuid references auth.users (id) on delete set null,
  revoked_at        timestamptz,
  revoked_by        uuid references auth.users (id) on delete set null,
  auth_user_id      uuid references auth.users (id) on delete set null,
  metadata          jsonb,
  constraint organization_invitations_email_not_blank check (length(btrim(email)) > 0)
);

comment on table public.organization_invitations is
  'Invitations d''accès (natives Supabase Auth). Une seule invitation ACTIVE (en_attente) par organisation et e-mail. Aucun token brut stocké. Statut expiré dérivé de expires_at.';

-- Une seule invitation ACTIVE par (organisation, e-mail).
create unique index if not exists organization_invitations_active_unique
  on public.organization_invitations (organization_id, email)
  where status = 'en_attente';

create index if not exists organization_invitations_org_idx
  on public.organization_invitations (organization_id, status);
create index if not exists organization_invitations_email_idx
  on public.organization_invitations (email);

drop trigger if exists organization_invitations_set_updated_at on public.organization_invitations;
create trigger organization_invitations_set_updated_at
  before update on public.organization_invitations
  for each row execute function public.set_updated_at();

-- RLS : lecture réservée aux administrateurs (l'annuaire des invitations est
-- sensible). Aucune écriture directe : tout passe par les fonctions §4.
alter table public.organization_invitations enable row level security;

grant select on public.organization_invitations to authenticated;

drop policy if exists organization_invitations_admin_read on public.organization_invitations;
create policy organization_invitations_admin_read on public.organization_invitations
  for select to authenticated
  using (public.crm_has_role('administrateur'));

-- =============================================================================
-- 3. HELPERS D'ISOLATION — rôle opérateur vs agent affecté.
-- =============================================================================

-- Rôles « opérateur Prodigio » à visibilité complète des dossiers de l'org.
create or replace function public.crm_is_operator()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.crm_has_role('administrateur', 'manager', 'setter');
$$;

comment on function public.crm_is_operator() is
  'Vrai si l''utilisateur courant a un rôle opérateur (administrateur / manager / setter) — visibilité complète des dossiers de l''organisation opérateur.';

-- Opportunités explicitement AFFECTÉES à l'utilisateur courant (base de
-- l'isolation `agent_immobilier` : accès aux seuls dossiers affectés).
create or replace function public.crm_assigned_opportunity_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select opportunity_id
  from public.opportunity_assignments
  where user_id = auth.uid();
$$;

comment on function public.crm_assigned_opportunity_ids() is
  'Identifiants des opportunités affectées à l''utilisateur courant. Sert l''isolation RLS du rôle agent_immobilier (dossiers affectés uniquement).';

revoke all on function public.crm_is_operator() from public;
revoke all on function public.crm_assigned_opportunity_ids() from public;
grant execute on function public.crm_is_operator() to authenticated;
grant execute on function public.crm_assigned_opportunity_ids() to authenticated;

-- =============================================================================
-- 4. RLS — ISOLATION agent_immobilier (dossiers affectés) + neutralisation
--    partenaire_lecture (aucun dossier tant que le partage n'est pas sécurisé).
--
--    Les rôles OPÉRATEUR (admin/manager/setter) conservent EXACTEMENT la même
--    visibilité qu'avant (aucune régression : `crm_is_operator()` est vrai pour
--    eux). Seuls les rôles NON-opérateur voient leur visibilité restreinte.
-- =============================================================================

-- Opportunités : opérateur = tout ; agent = dossiers affectés.
drop policy if exists opportunities_crm_read on public.opportunities;
create policy opportunities_crm_read on public.opportunities
  for select to authenticated
  using (
    public.crm_is_operator()
    or (
      public.crm_has_role('agent_immobilier')
      and id in (select public.crm_assigned_opportunity_ids())
    )
  );

-- Contacts : opérateur = tout ; agent = contacts liés à un dossier affecté.
drop policy if exists contacts_crm_read on public.contacts;
create policy contacts_crm_read on public.contacts
  for select to authenticated
  using (
    public.crm_is_operator()
    or (
      public.crm_has_role('agent_immobilier')
      and id in (
        select oc.contact_id
        from public.opportunity_contacts oc
        where oc.opportunity_id in (select public.crm_assigned_opportunity_ids())
      )
    )
  );

-- Soumissions du funnel : opérateur = tout ; agent = dossier affecté.
drop policy if exists funnel_submissions_crm_read on public.funnel_submissions;
create policy funnel_submissions_crm_read on public.funnel_submissions
  for select to authenticated
  using (
    public.crm_is_operator()
    or (
      public.crm_has_role('agent_immobilier')
      and opportunity_id in (select public.crm_assigned_opportunity_ids())
    )
  );

-- Liaisons opportunité ↔ contact : opérateur = tout ; agent = dossier affecté.
drop policy if exists opportunity_contacts_crm_read on public.opportunity_contacts;
create policy opportunity_contacts_crm_read on public.opportunity_contacts
  for select to authenticated
  using (
    public.crm_is_operator()
    or (
      public.crm_has_role('agent_immobilier')
      and opportunity_id in (select public.crm_assigned_opportunity_ids())
    )
  );

-- Preuves RGPD : réservées aux rôles opérateur (l'agent n'en a pas besoin).
drop policy if exists privacy_records_crm_read on public.privacy_records;
create policy privacy_records_crm_read on public.privacy_records
  for select to authenticated
  using (public.crm_is_operator());

-- Participations d'organisations : opérateur = tout ; agent = dossier affecté.
drop policy if exists opportunity_organizations_crm_read on public.opportunity_organizations;
create policy opportunity_organizations_crm_read on public.opportunity_organizations
  for select to authenticated
  using (
    public.crm_is_operator()
    or (
      public.crm_has_role('agent_immobilier')
      and opportunity_id in (select public.crm_assigned_opportunity_ids())
    )
  );

-- Affectations : opérateur = tout ; agent = ses propres affectations.
drop policy if exists opportunity_assignments_crm_read on public.opportunity_assignments;
create policy opportunity_assignments_crm_read on public.opportunity_assignments
  for select to authenticated
  using (
    public.crm_is_operator()
    or (
      public.crm_has_role('agent_immobilier')
      and (user_id = auth.uid()
           or opportunity_id in (select public.crm_assigned_opportunity_ids()))
    )
  );

-- Activités : opérateur = tout ; agent = dossier affecté.
drop policy if exists activities_crm_read on public.activities;
create policy activities_crm_read on public.activities
  for select to authenticated
  using (
    public.crm_is_operator()
    or (
      public.crm_has_role('agent_immobilier')
      and opportunity_id in (select public.crm_assigned_opportunity_ids())
    )
  );

-- Tâches : opérateur = tout ; agent = dossier affecté.
drop policy if exists tasks_crm_read on public.tasks;
create policy tasks_crm_read on public.tasks
  for select to authenticated
  using (
    public.crm_is_operator()
    or (
      public.crm_has_role('agent_immobilier')
      and opportunity_id in (select public.crm_assigned_opportunity_ids())
    )
  );

-- Annuaire des memberships : opérateur = tout ; sinon, uniquement SES propres
-- memberships (un agent / partenaire ne voit pas l'annuaire interne complet).
drop policy if exists memberships_crm_read on public.organization_memberships;
create policy memberships_crm_read on public.organization_memberships
  for select to authenticated
  using (user_id = auth.uid() or public.crm_is_operator());

-- Les politiques `organizations_crm_read` (crm_has_access) et
-- `audit_events_crm_read` (admin/manager) restent INCHANGÉES.

-- =============================================================================
-- 5. FONCTIONS D'ADMINISTRATION — INVITATIONS.
--    Toutes : SECURITY DEFINER, search_path figé, re-vérifient le rôle, écrivent
--    un AuditEvent, idempotentes, ne stockent aucun token brut.
-- =============================================================================

-- Rôles réellement attribuables via l'interface en V1. `partenaire_lecture` en
-- est exclu (isolation fine non terminée — docs/11). Défini en base pour que la
-- règle soit vraie côté serveur, pas seulement dans l'UI.
create or replace function public.crm_role_is_assignable(p_role text)
returns boolean
language sql
immutable
set search_path = pg_catalog, pg_temp
as $$
  select p_role in ('administrateur', 'manager', 'setter', 'agent_immobilier');
$$;

comment on function public.crm_role_is_assignable(text) is
  'Rôles attribuables via l''interface en V1. partenaire_lecture exclu tant que son isolation n''est pas sécurisée (docs/11).';

-- --- Créer (ou rafraîchir de façon idempotente) une invitation ---------------
create or replace function public.crm_create_invitation(
  p_email text,
  p_first_name text,
  p_last_name text,
  p_role text,
  p_organization_slug text default 'prodigio',
  p_ttl_days integer default 14
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_org uuid;
  v_ttl integer := greatest(1, least(coalesce(p_ttl_days, 14), 30));
  v_id uuid;
  v_expires timestamptz;
begin
  perform public.crm_require_role('administrateur');

  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'adresse e-mail invalide' using errcode = '22023';
  end if;
  if not public.crm_role_is_assignable(p_role) then
    raise exception 'rôle non attribuable depuis l''interface en V1' using errcode = '22023';
  end if;

  select id into v_org from public.organizations
  where slug = coalesce(p_organization_slug, 'prodigio') limit 1;
  if v_org is null then
    raise exception 'organisation introuvable' using errcode = '22023';
  end if;

  -- Déjà membre ACTIF de cette organisation ? (rapprochement par e-mail auth).
  if exists (
    select 1
    from public.organization_memberships m
    join auth.users u on u.id = m.user_id
    where m.organization_id = v_org
      and m.status = 'actif'
      and lower(u.email) = v_email
  ) then
    raise exception 'cette personne est déjà un membre actif' using errcode = '22023';
  end if;

  v_expires := now() + make_interval(days => v_ttl);

  -- Idempotence : rafraîchit l'invitation ACTIVE existante plutôt que d'en créer
  -- une seconde (respecte l'unicité partielle en_attente).
  update public.organization_invitations
  set first_name = nullif(btrim(p_first_name), ''),
      last_name  = nullif(btrim(p_last_name), ''),
      role       = p_role,
      invited_by = auth.uid(),
      expires_at = v_expires,
      revoked_at = null,
      revoked_by = null
  where organization_id = v_org and email = v_email and status = 'en_attente'
  returning id into v_id;

  if v_id is null then
    insert into public.organization_invitations
      (organization_id, email, first_name, last_name, role, invited_by, expires_at)
    values
      (v_org, v_email, nullif(btrim(p_first_name), ''), nullif(btrim(p_last_name), ''),
       p_role, auth.uid(), v_expires)
    returning id into v_id;
  end if;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (auth.uid(), 'invitation', v_id, 'invitation_creee',
          jsonb_build_object('role', p_role, 'organization_id', v_org));

  return jsonb_build_object('ok', true, 'id', v_id, 'email', v_email,
                            'role', p_role, 'expires_at', v_expires);
end;
$$;

-- --- Renvoyer une invitation (prolonge l'échéance) ---------------------------
create or replace function public.crm_resend_invitation(p_invitation_id uuid, p_ttl_days integer default 14)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ttl integer := greatest(1, least(coalesce(p_ttl_days, 14), 30));
  v_row public.organization_invitations;
begin
  perform public.crm_require_role('administrateur');

  update public.organization_invitations
  set expires_at = now() + make_interval(days => v_ttl)
  where id = p_invitation_id and status = 'en_attente'
  returning * into v_row;

  if v_row.id is null then
    raise exception 'invitation introuvable ou non renvoyable' using errcode = '22023';
  end if;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (auth.uid(), 'invitation', v_row.id, 'invitation_renvoyee',
          jsonb_build_object('expires_at', v_row.expires_at));

  return jsonb_build_object('ok', true, 'id', v_row.id, 'email', v_row.email,
                            'role', v_row.role, 'expires_at', v_row.expires_at);
end;
$$;

-- --- Marquer une invitation comme réellement envoyée (après appel Admin Auth) -
create or replace function public.crm_mark_invitation_sent(
  p_invitation_id uuid,
  p_auth_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.organization_invitations;
begin
  perform public.crm_require_role('administrateur');

  update public.organization_invitations
  set sent_at = now(),
      auth_user_id = coalesce(p_auth_user_id, auth_user_id)
  where id = p_invitation_id and status = 'en_attente'
  returning * into v_row;

  if v_row.id is null then
    raise exception 'invitation introuvable' using errcode = '22023';
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- --- Révoquer une invitation non acceptée ------------------------------------
create or replace function public.crm_revoke_invitation(p_invitation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.organization_invitations;
begin
  perform public.crm_require_role('administrateur');

  update public.organization_invitations
  set status = 'revoquee', revoked_at = now(), revoked_by = auth.uid()
  where id = p_invitation_id and status = 'en_attente'
  returning * into v_row;

  if v_row.id is null then
    raise exception 'invitation introuvable ou déjà traitée' using errcode = '22023';
  end if;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (auth.uid(), 'invitation', v_row.id, 'invitation_revoquee',
          jsonb_build_object('email', v_row.email));

  return jsonb_build_object('ok', true);
end;
$$;

-- --- Accepter l'invitation (par la personne invitée, connectée) --------------
-- Ne prend AUCUN rôle en paramètre : le rôle provient de l'invitation (posée par
-- un administrateur) → auto-attribution / auto-élévation impossibles. L'e-mail
-- authentifié DOIT correspondre à l'invitation. Idempotente (rejeu sûr).
create or replace function public.crm_accept_invitation()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_inv public.organization_invitations;
begin
  if v_uid is null then
    raise exception 'authentification requise' using errcode = '28000';
  end if;

  select lower(email) into v_email from auth.users where id = v_uid;
  if v_email is null then
    raise exception 'compte sans e-mail' using errcode = '22023';
  end if;

  -- Invitation la plus pertinente pour cet e-mail (acceptée par soi = idempotent).
  select * into v_inv
  from public.organization_invitations
  where email = v_email
    and (status = 'en_attente' or (status = 'acceptee' and accepted_by = v_uid))
  order by (status = 'en_attente') desc, created_at desc
  limit 1;

  if v_inv.id is null then
    -- Distingue « révoquée / expirée » d'« aucune invitation » pour un message clair.
    if exists (
      select 1 from public.organization_invitations
      where email = v_email and status in ('revoquee')
    ) then
      raise exception 'invitation révoquée' using errcode = '22023';
    end if;
    if exists (
      select 1 from public.organization_invitations
      where email = v_email and status = 'en_attente' and expires_at <= now()
    ) then
      raise exception 'invitation expirée' using errcode = '22023';
    end if;
    raise exception 'aucune invitation valide pour ce compte' using errcode = '22023';
  end if;

  -- Rejeu idempotent : déjà acceptée par soi → garantit la membership et sort.
  if v_inv.status = 'acceptee' then
    insert into public.organization_memberships (user_id, organization_id, role, status)
    values (v_uid, v_inv.organization_id, v_inv.role, 'actif')
    on conflict (user_id, organization_id) do nothing;
    return jsonb_build_object('ok', true, 'already', true,
                              'organization_id', v_inv.organization_id, 'role', v_inv.role);
  end if;

  -- En attente : refuse si expirée.
  if v_inv.expires_at <= now() then
    raise exception 'invitation expirée' using errcode = '22023';
  end if;

  -- Crée EXACTEMENT une membership (idempotent si elle existe déjà).
  insert into public.organization_memberships (user_id, organization_id, role, status)
  values (v_uid, v_inv.organization_id, v_inv.role, 'actif')
  on conflict (user_id, organization_id) do nothing;

  update public.organization_invitations
  set status = 'acceptee', accepted_at = now(), accepted_by = v_uid,
      auth_user_id = coalesce(auth_user_id, v_uid)
  where id = v_inv.id;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'membership', v_uid, 'invitation_acceptee',
          jsonb_build_object('role', v_inv.role, 'organization_id', v_inv.organization_id,
                             'invitation_id', v_inv.id));

  return jsonb_build_object('ok', true, 'organization_id', v_inv.organization_id, 'role', v_inv.role);
end;
$$;

-- --- Invitation en attente du compte courant (pour l'écran d'acceptation) ----
create or replace function public.crm_my_pending_invitation()
returns table (
  id uuid, email text, first_name text, last_name text, role text,
  organization_name text, expires_at timestamptz, status text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select i.id, i.email, i.first_name, i.last_name, i.role,
         o.name as organization_name, i.expires_at,
         case when i.status = 'en_attente' and i.expires_at <= now() then 'expiree' else i.status end as status
  from public.organization_invitations i
  join public.organizations o on o.id = i.organization_id
  where i.email = (select lower(email) from auth.users where id = auth.uid())
  order by (i.status = 'en_attente') desc, i.created_at desc
  limit 1;
$$;

-- =============================================================================
-- 6. FONCTIONS D'ADMINISTRATION — MEMBRES (rôle / activation).
--    Invariants : pas d'auto-modification, protection du dernier admin actif.
-- =============================================================================

-- --- Changer le rôle d'un membre ---------------------------------------------
create or replace function public.crm_change_member_role(
  p_user_id uuid,
  p_role text,
  p_organization_slug text default 'prodigio'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid;
  v_old text;
  v_active_admins integer;
begin
  perform public.crm_require_role('administrateur');

  if p_user_id = auth.uid() then
    raise exception 'vous ne pouvez pas modifier votre propre rôle' using errcode = '42501';
  end if;
  if not public.crm_role_is_assignable(p_role) then
    raise exception 'rôle non attribuable depuis l''interface en V1' using errcode = '22023';
  end if;

  select id into v_org from public.organizations
  where slug = coalesce(p_organization_slug, 'prodigio') limit 1;
  if v_org is null then
    raise exception 'organisation introuvable' using errcode = '22023';
  end if;

  select role into v_old from public.organization_memberships
  where user_id = p_user_id and organization_id = v_org;
  if v_old is null then
    raise exception 'membre introuvable' using errcode = '22023';
  end if;

  -- Protection du dernier administrateur actif (rétrogradation interdite).
  if v_old = 'administrateur' and p_role <> 'administrateur' then
    select count(*) into v_active_admins from public.organization_memberships
    where organization_id = v_org and role = 'administrateur' and status = 'actif';
    if v_active_admins <= 1 then
      raise exception 'impossible de rétrograder le dernier administrateur actif' using errcode = '42501';
    end if;
  end if;

  if v_old is distinct from p_role then
    update public.organization_memberships
    set role = p_role
    where user_id = p_user_id and organization_id = v_org;

    insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, old_value, new_value)
    values (auth.uid(), 'membership', p_user_id, 'changement_role',
            jsonb_build_object('role', v_old), jsonb_build_object('role', p_role));
  end if;

  return jsonb_build_object('ok', true, 'role', p_role);
end;
$$;

-- --- Activer / désactiver l'accès d'un membre --------------------------------
create or replace function public.crm_set_member_status(
  p_user_id uuid,
  p_status text,
  p_organization_slug text default 'prodigio'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid;
  v_role text;
  v_old text;
  v_active_admins integer;
begin
  perform public.crm_require_role('administrateur');

  if p_status not in ('actif', 'suspendu') then
    raise exception 'statut invalide' using errcode = '22023';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'vous ne pouvez pas modifier votre propre accès' using errcode = '42501';
  end if;

  select id into v_org from public.organizations
  where slug = coalesce(p_organization_slug, 'prodigio') limit 1;
  if v_org is null then
    raise exception 'organisation introuvable' using errcode = '22023';
  end if;

  select role, status into v_role, v_old from public.organization_memberships
  where user_id = p_user_id and organization_id = v_org;
  if v_role is null then
    raise exception 'membre introuvable' using errcode = '22023';
  end if;

  -- Protection du dernier administrateur actif (désactivation interdite).
  if p_status = 'suspendu' and v_role = 'administrateur' and v_old = 'actif' then
    select count(*) into v_active_admins from public.organization_memberships
    where organization_id = v_org and role = 'administrateur' and status = 'actif';
    if v_active_admins <= 1 then
      raise exception 'impossible de désactiver le dernier administrateur actif' using errcode = '42501';
    end if;
  end if;

  if v_old is distinct from p_status then
    update public.organization_memberships
    set status = p_status
    where user_id = p_user_id and organization_id = v_org;

    insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, old_value, new_value)
    values (auth.uid(), 'membership', p_user_id,
            case when p_status = 'actif' then 'activation_membre' else 'desactivation_membre' end,
            jsonb_build_object('status', v_old), jsonb_build_object('status', p_status));
  end if;

  return jsonb_build_object('ok', true, 'status', p_status);
end;
$$;

-- =============================================================================
-- 7. LECTURES ENRICHIES (annuaire équipe + invitations) — SECURITY DEFINER.
--    Réservées aux administrateurs (l'écran équipe est admin-only).
-- =============================================================================

-- Équipe : memberships enrichies (e-mail, date d'ajout, dernière connexion).
create or replace function public.crm_list_team()
returns table (
  user_id uuid, email text, role text, status text,
  organization_id uuid, member_since timestamptz, last_sign_in_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.user_id, u.email::text, m.role, m.status, m.organization_id,
         m.created_at as member_since, u.last_sign_in_at
  from public.organization_memberships m
  join auth.users u on u.id = m.user_id
  where public.crm_has_role('administrateur')
    and m.organization_id in (
      select organization_id from public.organization_memberships
      where user_id = auth.uid() and status = 'actif' and role = 'administrateur'
    );
$$;

-- Invitations de l'organisation (statut effectif dérivé de expires_at).
create or replace function public.crm_list_invitations()
returns table (
  id uuid, email text, first_name text, last_name text, role text,
  status text, organization_id uuid, created_at timestamptz, expires_at timestamptz,
  sent_at timestamptz, accepted_at timestamptz, revoked_at timestamptz, invited_by uuid
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select i.id, i.email, i.first_name, i.last_name, i.role,
         case when i.status = 'en_attente' and i.expires_at <= now() then 'expiree' else i.status end as status,
         i.organization_id, i.created_at, i.expires_at, i.sent_at, i.accepted_at,
         i.revoked_at, i.invited_by
  from public.organization_invitations i
  where public.crm_has_role('administrateur')
    and i.organization_id in (
      select organization_id from public.organization_memberships
      where user_id = auth.uid() and status = 'actif' and role = 'administrateur'
    )
  order by i.created_at desc;
$$;

-- =============================================================================
-- 8. GRANTS — EXECUTE aux seuls `authenticated` (chaque fonction re-vérifie le
--    rôle en interne). Jamais anon ni PUBLIC.
-- =============================================================================
revoke all on function public.crm_role_is_assignable(text) from public;
revoke all on function public.crm_create_invitation(text, text, text, text, text, integer) from public;
revoke all on function public.crm_resend_invitation(uuid, integer) from public;
revoke all on function public.crm_mark_invitation_sent(uuid, uuid) from public;
revoke all on function public.crm_revoke_invitation(uuid) from public;
revoke all on function public.crm_accept_invitation() from public;
revoke all on function public.crm_my_pending_invitation() from public;
revoke all on function public.crm_change_member_role(uuid, text, text) from public;
revoke all on function public.crm_set_member_status(uuid, text, text) from public;
revoke all on function public.crm_list_team() from public;
revoke all on function public.crm_list_invitations() from public;

grant execute on function public.crm_role_is_assignable(text) to authenticated;
grant execute on function public.crm_create_invitation(text, text, text, text, text, integer) to authenticated;
grant execute on function public.crm_resend_invitation(uuid, integer) to authenticated;
grant execute on function public.crm_mark_invitation_sent(uuid, uuid) to authenticated;
grant execute on function public.crm_revoke_invitation(uuid) to authenticated;
grant execute on function public.crm_accept_invitation() to authenticated;
grant execute on function public.crm_my_pending_invitation() to authenticated;
grant execute on function public.crm_change_member_role(uuid, text, text) to authenticated;
grant execute on function public.crm_set_member_status(uuid, text, text) to authenticated;
grant execute on function public.crm_list_team() to authenticated;
grant execute on function public.crm_list_invitations() to authenticated;

commit;
