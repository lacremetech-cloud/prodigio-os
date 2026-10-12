-- =============================================================================
-- Deux choses : une faille refermee, et l'espace de travail Drive.
-- =============================================================================

-- --- 1. La faille -------------------------------------------------------------
-- En ouvrant `crm_property_access` au role `commercial` (migration
-- 20261012120000), on a ouvert du meme coup TOUTES les ecritures qui s'y
-- adossaient. Un commercial pouvait renommer un bien, en changer le
-- positionnement et les prix, remplacer ses medias.
--
-- Lire un bien et le modifier ne sont pas le meme droit. On separe donc les
-- deux : `crm_property_access` reste la porte de LECTURE (commercial compris,
-- c'est tout l'objet du role), et `crm_property_write_access` devient la porte
-- d'ECRITURE — exactement l'ancienne regle, sans la branche commerciale.
--
-- Note : `crm_is_operator()` ne couvre PAS `agent_immobilier`. La regle est
-- donc recopiee telle quelle plutot que remplacee par un appel a l'operateur,
-- qui aurait retire a l'agent immobilier des droits qu'il avait deja.

create or replace function public.crm_property_write_access(p_property_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $fn$
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
      )
  );
$fn$;

comment on function public.crm_property_write_access(uuid) is
  'Porte d''ECRITURE sur un bien. Volontairement fermee au role commercial : il traite les demandes acquereur, il ne modifie pas le bien.';

revoke all on function public.crm_property_write_access(uuid) from public, anon;
grant execute on function public.crm_property_write_access(uuid) to authenticated;

-- Les quatorze fonctions d'ecriture basculent sur la nouvelle porte. Celles qui
-- exigeaient deja `crm_can_decide` ne sont pas concernees : un commercial ne
-- les atteignait pas. Les deux apercus publics restent en lecture.
do $outer$
declare r record;
begin
  for r in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'crm_property_can_edit', 'crm_property_media_to_publish',
        'crm_property_register_media', 'crm_property_register_public_media',
        'crm_property_seed_production_plan', 'crm_property_set_primary_media',
        'crm_property_set_public_media_role', 'crm_property_update_identity',
        'crm_property_update_media', 'crm_property_update_public_media',
        'crm_property_upsert_positioning', 'crm_property_upsert_public_config',
        'crm_property_delete_media', 'crm_property_delete_public_media'
      )
  loop
    execute replace(pg_get_functiondef(r.oid), 'crm_property_access(', 'crm_property_write_access(');
  end loop;
end
$outer$;

-- --- 2. L'espace de travail ---------------------------------------------------
-- Les documents, photos et livrables vivent dans Drive. Le cockpit n'a donc pas
-- a les heberger : il lui suffit de porter le lien de l'espace, a un endroit ou
-- on le retrouve.

alter table public.properties add column if not exists workspace_url text;

comment on column public.properties.workspace_url is
  'Lien de l''espace de travail du bien (Drive). Le CRM ne stocke pas les documents : il mene a eux.';

create or replace function public.crm_property_set_workspace(p_property_id uuid, p_url text)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $fn$
declare
  v_uid uuid := auth.uid();
  v_url text := nullif(btrim(coalesce(p_url, '')), '');
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.crm_property_write_access(p_property_id) then
    raise exception 'droits insuffisants sur ce bien' using errcode = '42501';
  end if;
  -- Un lien d'espace de travail est toujours en https : une adresse en clair
  -- serait soit une erreur de saisie, soit un lien qu'on ne veut pas suivre.
  if v_url is not null and v_url !~* '^https://' then
    raise exception 'le lien doit commencer par https://' using errcode = '22023';
  end if;

  update public.properties set workspace_url = v_url, updated_at = now()
  where id = p_property_id;

  -- L'audit retient qu'un lien a ete pose ou retire, jamais le lien lui-meme.
  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'property', p_property_id, 'bien_espace_travail',
          jsonb_build_object('defini', v_url is not null));

  return jsonb_build_object('ok', true);
end;
$fn$;

revoke all on function public.crm_property_set_workspace(uuid, text) from public, anon;
grant execute on function public.crm_property_set_workspace(uuid, text) to authenticated;
