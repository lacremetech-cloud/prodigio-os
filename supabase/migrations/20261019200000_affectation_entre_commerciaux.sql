-- LES COMMERCIAUX TRAVAILLENT ENSEMBLE.
--
-- `crm_buyer_assign` exigeait administrateur, manager ou setter. La regle
-- venait d'une crainte — « deux associes se reprendraient leurs dossiers sans
-- que l'autre le sache » — qui ne correspond pas a cette agence : les
-- commerciaux voient tous les leads de leurs biens, se les attribuent et se
-- les confient entre eux. Leur refuser de confier un dossier les obligeait a
-- passer par quelqu'un d'autre pour un geste quotidien.
--
-- La porte devient `crm_buyer_can_operate`, EXACTEMENT celle que franchissent
-- deja le changement d'etape (`crm_buyer_set_interest_stage`) et
-- l'enregistrement d'un echange (`crm_buyer_enregistrer`). Consequences :
--
--   • administrateur / manager / setter : rien ne change. `crm_is_operator()`
--     les laisse passer sur TOUT dossier, comme avant — l'ancienne porte etait
--     un sous-ensemble strict de la nouvelle, personne ne perd d'acces.
--   • commercial : peut confier un dossier qu'il peut deja traiter, et
--     uniquement celui-la. Ce sont les leads des biens qui lui sont confies —
--     ni plus, ni moins. On n'ouvre pas l'affectation a des dossiers qu'il ne
--     voit meme pas.
--
-- Ce qui ne bouge pas : la cible doit etre un membre actif, et chaque
-- affectation reste tracee avec son auteur (`assigned_by`, et un evenement
-- « acquereur_affectation »). Travailler ensemble suppose de voir qui a
-- confie quoi.

create or replace function public.crm_buyer_assign(
  p_buyer_profile_id uuid,
  p_user_id uuid,
  p_responsibility text default 'setter'::text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare v_uid uuid := auth.uid(); v_resp text;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not exists (select 1 from public.buyer_profiles where id = p_buyer_profile_id) then
    raise exception 'dossier introuvable' using errcode = '22023';
  end if;
  -- La MEME porte que le changement d'etape et l'enregistrement d'un echange :
  -- qui peut traiter un dossier peut le confier.
  if not public.crm_buyer_can_operate(p_buyer_profile_id) then
    raise exception 'droits insuffisants sur ce dossier acquereur' using errcode = '42501';
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
$function$;
