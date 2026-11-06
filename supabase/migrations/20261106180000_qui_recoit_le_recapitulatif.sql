-- QUI REÇOIT LE RÉCAPITULATIF D'UN BIEN.
--
-- Le récapitulatif de 8 h 30, 13 h et 17 h 30 était UN seul e-mail, tous biens
-- confondus, vers une liste écrite en dur dans Make. Deux défauts :
--
--   1. Édouard ROWLANDSON (Cimalpes) n'y était pas : il ne voyait aucun des
--      leads des 2 Alpes qu'il est censé traiter.
--   2. Nicolas, qui ne suit que Cassis, y lisait les leads des 2 Alpes.
--      L'isolation tenait dans le CRM et pas dans cet e-mail.
--
-- La liste ne doit donc plus vivre dans Make. Elle se DÉDUIT de qui suit le
-- bien — la même source que `crm_property_access` : `property_assignments`,
-- plus les administrateurs et managers, qui voient tout de toute façon.
-- Conséquence voulue : confier un bien à quelqu'un suffit, il reçoit le
-- récapitulatif sans qu'on ouvre Make.
--
-- `status = 'actif'` écarte les membres suspendus. C'est ce qui garde le
-- compte de recette `recette.claude@prodigio.fr` hors de ces envois : il est
-- encore affecté à Verdun et Jean Jaurès, mais il est neutralisé.
--
-- UNE LIGNE `property_id = null` POUR LES ORPHELINS. `buyer_interests
-- .property_id` est nullable : un lead sans bien ne serait rattaché à aucun
-- récapitulatif et disparaîtrait sans bruit. Il n'en existe aucun aujourd'hui
-- (0 sur 251), mais un défaut silencieux coûte plus cher qu'une ligne de SQL.
-- Ces orphelins partent donc aux administrateurs et managers.
--
-- RÉSERVÉE À `service_role`. La fonction rend des adresses e-mail de toute
-- l'organisation, pour tous les biens : un authentifié n'a aucune raison de
-- l'appeler, et `crm_list_members_v2` existe pour l'écran d'équipe. Elle est
-- donc retirée à `authenticated` comme à `anon`.

create or replace function public.crm_recap_recipients()
returns table(property_id uuid, project_name text, email text)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select p.id, p.project_name, u.email::text
  from public.properties p
  join public.organization_memberships m
    on m.organization_id = p.organization_id
   and m.status = 'actif'
  join auth.users u on u.id = m.user_id
  where u.email is not null
    and (
      m.role in ('administrateur', 'manager')
      or exists (
        select 1 from public.property_assignments pa
        where pa.property_id = p.id and pa.user_id = m.user_id
      )
    )

  union all

  -- Les orphelins : aucun bien, donc les administrateurs et managers.
  select null::uuid, null::text, u.email::text
  from public.organization_memberships m
  join auth.users u on u.id = m.user_id
  where m.status = 'actif'
    and m.role in ('administrateur', 'manager')
    and u.email is not null;
$function$;

revoke all on function public.crm_recap_recipients() from public, anon, authenticated;
grant execute on function public.crm_recap_recipients() to service_role;
