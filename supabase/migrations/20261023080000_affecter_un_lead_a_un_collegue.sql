-- ---------------------------------------------------------------------------
-- AFFECTER UN LEAD A UN COLLEGUE NE MARCHAIT PLUS DEPUIS LE 14 OCTOBRE.
-- ---------------------------------------------------------------------------
-- Antoine : « there is no unique or exclusion constraint matching the ON
-- CONFLICT specification » des qu'il choisissait quelqu'un d'autre que lui.
-- C'est l'erreur Postgres 42P10, et elle etait meritee.
--
-- L'enchainement :
--   • 03/08 — la table portait `unique (buyer_profile_id, user_id)` ;
--   • 14/10 — cette contrainte a ete REMPLACEE par un index unique PARTIEL,
--     `buyer_assignments_actif_uniq ... where released_at is null`, pour qu'on
--     puisse reprendre un dossier qu'on avait rendu ;
--   • `crm_buyer_assign` a garde `on conflict (buyer_profile_id, user_id)`.
--     Un ON CONFLICT ne peut viser un index partiel que si la clause porte le
--     MEME predicat. Sans lui, plus aucun index ne correspond : echec.
--
-- `crm_buyer_claim` n'etait pas touche parce qu'il n'utilise pas ON CONFLICT :
-- il fait un UPDATE, puis un INSERT si rien n'a bouge. S'attribuer un lead
-- marchait donc, le confier a un collegue non — et c'est exactement ce que la
-- capture d'ecran montrait.
--
-- On aligne donc `crm_buyer_assign` sur la meme mecanique, et on profite de la
-- reecriture pour corriger deux defauts du meme bloc :
--
--   1. UN DOSSIER N'A QU'UN RESPONSABLE. L'ancien upsert, s'il avait
--      fonctionne, aurait ajoute une SECONDE affectation active a cote de
--      celle en place : la fiche affiche un responsable au singulier, deux
--      lignes actives ne veulent donc rien dire. Confier un dossier releve
--      desormais le precedent responsable, et l'evenement d'audit porte son
--      nom pour que la passation reste lisible.
--
--   2. LA RESPONSABILITE ENREGISTREE. `crm_buyer_claim` inscrit « commercial »
--      quand la personne en est un ; `crm_buyer_assign` inscrivait « setter »
--      quel que soit le role de la cible. La meme personne portait donc deux
--      etiquettes differentes selon qui avait fait le geste. On lit le role de
--      la CIBLE, comme le claim lit celui de l'appelant.
--
-- Ce qui ne bouge pas : la porte d'acces (`crm_buyer_can_operate`), le
-- controle que la cible est un membre actif, et la trace d'audit.
-- ---------------------------------------------------------------------------

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
declare
  v_uid         uuid := auth.uid();
  v_resp        text;
  v_role_cible  text;
  v_precedent   uuid;
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

  select m.role into v_role_cible
    from public.organization_memberships m
   where m.user_id = p_user_id and m.status = 'actif'
   limit 1;

  if v_role_cible is null then
    raise exception 'utilisateur cible non membre actif' using errcode = '22023';
  end if;

  -- Un commercial reste un commercial, qu'il prenne le dossier ou qu'on le lui
  -- confie : sans cela la meme personne apparaissait « setter » ici et
  -- « commercial » la.
  v_resp := case
    when v_role_cible = 'commercial' then 'commercial'
    when p_responsibility = any (array['setter','manager','agent_immobilier',
                                       'responsable_marketing','commercial'])
      then p_responsibility
    else 'setter'
  end;

  -- Le responsable sortant, lu AVANT de le relever, pour le nommer dans l'audit.
  select a.user_id into v_precedent
    from public.buyer_assignments a
   where a.buyer_profile_id = p_buyer_profile_id
     and a.released_at is null
     and a.user_id <> p_user_id
   order by a.created_at desc
   limit 1;

  update public.buyer_assignments
     set released_at = now()
   where buyer_profile_id = p_buyer_profile_id
     and released_at is null
     and user_id <> p_user_id;

  /* Pas d'ON CONFLICT : l'unicite est partielle depuis le 14 octobre. On
     reactive UNE SEULE ligne — l'index partiel autorise plusieurs lignes
     rendues pour le meme couple, et les reactiver toutes le violerait.
     `nulls first` fait tomber sur la ligne deja active s'il y en a une, ce qui
     rend l'operation idempotente. */
  update public.buyer_assignments
     set released_at = null,
         created_at  = now(),
         assigned_by = v_uid,
         responsibility = v_resp
   where id = (
     select a.id
       from public.buyer_assignments a
      where a.buyer_profile_id = p_buyer_profile_id
        and a.user_id = p_user_id
      order by a.released_at desc nulls first, a.created_at desc
      limit 1
   );

  if not found then
    insert into public.buyer_assignments
      (buyer_profile_id, user_id, responsibility, assigned_by)
    values (p_buyer_profile_id, p_user_id, v_resp, v_uid);
  end if;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'buyer_profile', p_buyer_profile_id, 'acquereur_affectation',
          jsonb_build_object('user_id', p_user_id,
                             'responsibility', v_resp,
                             'responsable_precedent', v_precedent));

  return jsonb_build_object('ok', true, 'responsable_precedent', v_precedent);
end;
$function$;

comment on function public.crm_buyer_assign(uuid, uuid, text) is
  'Confie un dossier acquereur a un membre actif. Releve le responsable '
  'precedent : un dossier n''a qu''un responsable. N''utilise PAS ON CONFLICT, '
  'l''unicite de buyer_assignments etant partielle (released_at is null).';
