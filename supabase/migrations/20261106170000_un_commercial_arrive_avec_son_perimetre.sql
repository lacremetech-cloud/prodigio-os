-- UN COMMERCIAL INVITÉ ARRIVAIT DANS UN CRM VIDE.
--
-- `crm_accept_invitation` crée la membership et s'arrête là. Or un commercial
-- ne voit QUE les biens de `property_assignments` :
--
--   crm_property_access() : ... or (crm_has_role('commercial')
--                                   and p.id in (select crm_assigned_property_ids()))
--
-- Zéro affectation, donc zéro bien, donc zéro lead. À l'écran, un CRM vide se
-- confond exactement avec un refus d'accès. C'est le piège qui attendait
-- Édouard ROWLANDSON (Cimalpes) : même une fois son compte créé, il se serait
-- connecté sur du vide, et on aurait cherché le défaut du côté de
-- l'authentification.
--
-- LE PÉRIMÈTRE APPARTIENT À L'INVITATION. C'est l'administrateur qui décide
-- « lui, c'est les 2 Alpes, pas Cassis », et il le décide au moment où il
-- invite, pas trois jours plus tard quand la personne se plaint. On l'écrit
-- donc sur l'invitation (colonne `metadata`, déjà là pour ça) et l'acceptation
-- l'applique.
--
-- DEUX CHOIX DE PRUDENCE :
--
-- 1. Pas de nouvelle fonction qui prenne un `user_id` en paramètre. Une
--    fonction SECURITY DEFINER « affecte ce bien à cet utilisateur » appelable
--    par un authentifié, c'est une élévation de privilège : il suffirait de
--    passer son propre identifiant. La pose est donc écrite DANS
--    `crm_accept_invitation`, qui ne peut agir que sur `auth.uid()`.
--
-- 2. Aucun nouveau type d'événement d'audit. `changement_affectation` existe
--    déjà et dit exactement ça. On évite de toucher
--    `audit_events_event_type_check`, où une valeur recopiée de travers
--    casserait les quatre-vingts autres (la leçon du 28 octobre).
--
-- `on conflict do nothing` rend l'acceptation rejouable : si un bien était
-- déjà affecté à la main, rien ne bouge.

-- --------------------------------------------------------------------------
-- 1. L'administrateur fixe le périmètre d'une invitation.
-- --------------------------------------------------------------------------
create or replace function public.crm_invitation_set_scope(
  p_invitation_id uuid,
  p_property_ids uuid[]
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid       uuid := auth.uid();
  v_inv       public.organization_invitations;
  v_ids       uuid[];
  v_etrangers integer;
begin
  perform public.crm_require_role('administrateur');

  select * into v_inv
  from public.organization_invitations
  where id = p_invitation_id;

  if v_inv.id is null then
    raise exception 'invitation introuvable' using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct x), '{}'::uuid[]) into v_ids
  from unnest(coalesce(p_property_ids, '{}'::uuid[])) as t(x)
  where x is not null;

  -- Un bien d'une autre organisation donnerait un accès hors périmètre, et
  -- sans que personne le voie. On refuse plutôt que d'ignorer.
  select count(*) into v_etrangers
  from unnest(v_ids) as t(x)
  where not exists (
    select 1 from public.properties p
    where p.id = t.x and p.organization_id = v_inv.organization_id
  );
  if v_etrangers > 0 then
    raise exception 'bien hors de l''organisation de l''invitation' using errcode = '22023';
  end if;

  update public.organization_invitations
  set metadata = coalesce(metadata, '{}'::jsonb)
                 || jsonb_build_object('property_ids', to_jsonb(v_ids))
  where id = p_invitation_id;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'invitation', p_invitation_id, 'changement_affectation',
          jsonb_build_object('source', 'invitation',
                             'property_ids', to_jsonb(v_ids),
                             'biens', coalesce(array_length(v_ids, 1), 0)));

  return jsonb_build_object('ok', true, 'id', p_invitation_id,
                            'biens', coalesce(array_length(v_ids, 1), 0));
end;
$function$;

revoke all on function public.crm_invitation_set_scope(uuid, uuid[]) from public, anon;
grant execute on function public.crm_invitation_set_scope(uuid, uuid[])
  to authenticated, service_role;

-- --------------------------------------------------------------------------
-- 2. L'acceptation applique ce périmètre.
--
-- `create or replace` et non `drop` : un `drop` emporterait les droits, y
-- compris celui d'`authenticated` — c'est le piège du 29 octobre.
-- --------------------------------------------------------------------------
create or replace function public.crm_accept_invitation()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_inv   public.organization_invitations;
  v_ids   uuid[];
  v_poses integer := 0;
  v_deja  boolean := false;
begin
  if v_uid is null then
    raise exception 'authentification requise' using errcode = '28000';
  end if;

  select lower(email) into v_email from auth.users where id = v_uid;
  if v_email is null then
    raise exception 'compte sans e-mail' using errcode = '22023';
  end if;

  select * into v_inv
  from public.organization_invitations
  where email = v_email
    and (status = 'en_attente' or (status = 'acceptee' and accepted_by = v_uid))
  order by (status = 'en_attente') desc, created_at desc
  limit 1;

  if v_inv.id is null then
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

  if v_inv.status = 'acceptee' then
    v_deja := true;
  elsif v_inv.expires_at <= now() then
    raise exception 'invitation expirée' using errcode = '22023';
  end if;

  insert into public.organization_memberships (user_id, organization_id, role, status)
  values (v_uid, v_inv.organization_id, v_inv.role, 'actif')
  on conflict (user_id, organization_id) do nothing;

  if not v_deja then
    update public.organization_invitations
    set status = 'acceptee', accepted_at = now(), accepted_by = v_uid,
        auth_user_id = coalesce(auth_user_id, v_uid)
    where id = v_inv.id;

    insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
    values (v_uid, 'membership', v_uid, 'invitation_acceptee',
            jsonb_build_object('role', v_inv.role,
                               'organization_id', v_inv.organization_id,
                               'invitation_id', v_inv.id));
  end if;

  -- LE PÉRIMÈTRE. Rejouable : une deuxième acceptation ne double rien, et
  -- répare une affectation qui manquerait.
  select coalesce(array_agg(x::uuid), '{}'::uuid[]) into v_ids
  from jsonb_array_elements_text(
         coalesce(v_inv.metadata -> 'property_ids', '[]'::jsonb)) as t(x);

  if coalesce(array_length(v_ids, 1), 0) > 0 then
    with pose as (
      insert into public.property_assignments
        (property_id, user_id, responsibility, assigned_by)
      select p.id, v_uid, 'commercial', coalesce(v_inv.invited_by, v_uid)
      from public.properties p
      where p.id = any (v_ids)
        and p.organization_id = v_inv.organization_id
      on conflict (property_id, user_id) do nothing
      returning 1
    )
    select count(*) into v_poses from pose;

    if v_poses > 0 then
      insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
      values (coalesce(v_inv.invited_by, v_uid), 'membership', v_uid,
              'changement_affectation',
              jsonb_build_object('source', 'invitation',
                                 'invitation_id', v_inv.id,
                                 'biens', v_poses));
    end if;
  end if;

  return jsonb_build_object('ok', true, 'already', v_deja,
                            'organization_id', v_inv.organization_id,
                            'role', v_inv.role, 'biens', v_poses);
end;
$function$;
