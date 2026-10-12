-- =============================================================================
-- Rôle « commercial » — accès cloisonné par bien
-- =============================================================================
-- Un commercial vend un bien, pas un portefeuille. Jusqu'ici aucun rôle ne
-- savait exprimer cela : `setter` voit tous les dossiers, mandats et honoraires
-- compris, et `agent_immobilier` ne voit que des dossiers qui lui sont affectés
-- par opportunité — logique de mandat, pas de commercialisation.
--
-- Ce rôle-ci est défini par la liste des biens qu'on lui confie. Il traite les
-- demandes acquéreur de ces biens-là : appeler, annoter, qualifier, déplacer
-- dans le pipeline. Il ne voit ni les mandats, ni les opportunités, ni les
-- règles économiques, ni les autres biens.
--
-- Tout est ADDITIF. Aucun rôle existant ne change de périmètre.
-- =============================================================================

-- --- 1. Le rôle entre au vocabulaire ----------------------------------------
alter table public.organization_memberships
  drop constraint if exists organization_memberships_role_check;
alter table public.organization_memberships
  add constraint organization_memberships_role_check
  check (role = any (array[
    'administrateur', 'manager', 'setter',
    'agent_immobilier', 'commercial', 'partenaire_lecture'
  ]));

create or replace function public.crm_role_is_assignable(p_role text)
returns boolean language sql immutable
set search_path = pg_catalog, pg_temp
as $$
  select p_role in ('administrateur', 'manager', 'setter', 'agent_immobilier', 'commercial');
$$;

-- `crm_is_operator` n'est VOLONTAIREMENT pas touchée : un commercial n'est pas
-- un opérateur, c'est tout l'objet de ce rôle. Son périmètre vient des biens
-- qui lui sont affectés, jamais de son rôle seul.

-- --- 2. L'affectation à un bien ----------------------------------------------
create table if not exists public.property_assignments (
  property_id     uuid        not null references public.properties(id) on delete cascade,
  user_id         uuid        not null references auth.users(id)        on delete cascade,
  responsibility  text        not null default 'commercial',
  assigned_by     uuid        references auth.users(id),
  created_at      timestamptz not null default now(),
  primary key (property_id, user_id)
);

comment on table public.property_assignments is
  'Qui commercialise quel bien. Donne son périmètre au rôle commercial : il ne voit que les demandes acquéreur des biens qui y figurent.';

create index if not exists property_assignments_user_idx
  on public.property_assignments (user_id);

alter table public.property_assignments enable row level security;

-- Chacun voit ses propres affectations ; les décisionnaires voient tout.
drop policy if exists property_assignments_read on public.property_assignments;
create policy property_assignments_read on public.property_assignments
  for select using (user_id = auth.uid() or public.crm_can_decide());

-- --- 3. Les biens d'un utilisateur -------------------------------------------
create or replace function public.crm_assigned_property_ids()
returns setof uuid language sql stable security definer
set search_path = public, pg_temp
as $$
  select pa.property_id from public.property_assignments pa
  where pa.user_id = auth.uid();
$$;

revoke all on function public.crm_assigned_property_ids() from public, anon;
grant execute on function public.crm_assigned_property_ids() to authenticated;

-- --- 4. Les deux portes d'accès ----------------------------------------------
-- Tout le CRM acquéreur passe par ces deux fonctions : les politiques de ligne
-- s'y adossent. Les étendre ici suffit, et évite de disperser la règle.
--
-- Un commercial peut être EXTÉRIEUR à l'agence — le constructeur d'un bien qui
-- en assure lui-même la vente, par exemple. Raison de plus pour que son
-- périmètre soit la liste de ses biens, et rien d'autre.

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
        or (public.crm_has_role('agent_immobilier')
            and p.holder_organization_id is not null
            and exists (
              select 1 from public.organization_memberships m
              where m.organization_id = p.holder_organization_id
                and m.user_id = auth.uid()
            ))
        -- Le commercial : ses biens, et eux seuls.
        or (public.crm_has_role('commercial')
            and p.id in (select public.crm_assigned_property_ids()))
      )
  );
$$;

create or replace function public.crm_buyer_profile_access(p_buyer_profile_id uuid)
returns boolean language sql stable security definer
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
        -- Un acquéreur entre dans le périmètre du commercial dès qu'il a
        -- manifesté son intérêt pour l'un de ses biens.
        or (
          public.crm_has_role('commercial')
          and exists (
            select 1 from public.buyer_interests bi
            where bi.buyer_profile_id = bp.id
              and bi.property_id in (select public.crm_assigned_property_ids())
          )
        )
      )
  );
$$;

-- --- 5. Les politiques qui dupliquaient la règle -----------------------------
-- `properties_read` recopiait la logique de `crm_property_access` au lieu de
-- l'appeler : les deux pouvaient diverger, et viennent de le faire. On la fait
-- pointer sur la fonction, source unique de la règle.
drop policy if exists properties_read on public.properties;
create policy properties_read on public.properties
  for select using (public.crm_property_access(id));

-- Rappeler un acquéreur suppose de lire son nom et son numéro. Le commercial
-- accède donc aux contacts de ses seuls acquéreurs.
drop policy if exists contacts_crm_read on public.contacts;
create policy contacts_crm_read on public.contacts
  for select using (
    public.crm_is_operator()
    or (public.crm_has_role('agent_immobilier')
        and id in (
          select oc.contact_id from public.opportunity_contacts oc
          where oc.opportunity_id in (select public.crm_assigned_opportunity_ids())
        ))
    or (public.crm_has_role('commercial')
        and id in (
          select bi.contact_id from public.buyer_interests bi
          where bi.contact_id is not null
            and bi.property_id in (select public.crm_assigned_property_ids())
        ))
  );

create or replace function public.crm_can_view_contact_details()
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.crm_has_role('administrateur', 'manager', 'setter',
                             'agent_immobilier', 'commercial');
$$;

-- --- 6. Confier un bien, le retirer ------------------------------------------
-- ETAT EN BASE (12/10/2026) : `crm_property_assign` est posee et fonctionne.
-- `crm_property_unassign` ne l'est PAS : l'outil d'administration utilise ici
-- se bloque sur toute creation de fonction dont le corps contient un `delete`
-- (reproduit, le meme corps sans le `delete` passe instantanement). La base
-- porte en attendant une version qui LEVE UNE EXCEPTION, pour qu'un retrait
-- echoue visiblement plutot que de laisser croire qu'un acces a ete retire.
-- La version ci-dessous est la bonne : elle s'installera au prochain passage
-- des migrations.
-- Réservé aux décisionnaires : ouvrir un bien à quelqu'un d'extérieur engage
-- l'organisation, au même titre qu'activer un formulaire de collecte.
create or replace function public.crm_property_assign(
  p_property_id uuid,
  p_user_id uuid,
  p_responsibility text default 'commercial'
)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.crm_can_decide() then
    raise exception 'seul un administrateur ou un manager confie un bien' using errcode = '42501';
  end if;
  if not exists (select 1 from public.properties where id = p_property_id) then
    raise exception 'bien inconnu' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.organization_memberships m
    where m.user_id = p_user_id and m.status = 'actif'
  ) then
    raise exception 'destinataire sans adhesion active' using errcode = '22023';
  end if;

  insert into public.property_assignments (property_id, user_id, responsibility, assigned_by)
  values (p_property_id, p_user_id, coalesce(nullif(btrim(p_responsibility), ''), 'commercial'), v_uid)
  on conflict (property_id, user_id)
    do update set responsibility = excluded.responsibility, assigned_by = excluded.assigned_by;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'property', p_property_id, 'bien_responsable',
          jsonb_build_object('user_id', p_user_id, 'responsabilite', p_responsibility));

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.crm_property_unassign(
  p_property_id uuid,
  p_user_id uuid
)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.crm_can_decide() then
    raise exception 'seul un administrateur ou un manager retire un bien' using errcode = '42501';
  end if;

  delete from public.property_assignments
  where property_id = p_property_id and user_id = p_user_id;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'property', p_property_id, 'bien_responsable',
          jsonb_build_object('user_id', p_user_id, 'retire', true));

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.crm_property_assign(uuid, uuid, text)   from public, anon;
revoke all on function public.crm_property_unassign(uuid, uuid)       from public, anon;
grant execute on function public.crm_property_assign(uuid, uuid, text) to authenticated;
grant execute on function public.crm_property_unassign(uuid, uuid)     to authenticated;
