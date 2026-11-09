-- Deux étapes de plus, et un ordre de colonnes revu.
--
-- Le pipeline acquéreur en comptait sept. Il lui manquait deux moments que
-- l'équipe distingue à voix haute mais que l'outil confondait :
--
--   • « R1 planifié » — un rendez-vous POSÉ, avec une date. « En discussion »
--     disait qu'un échange avait lieu, jamais qu'un créneau existait : un
--     dossier avec un rendez-vous au calendrier avait exactement l'air d'un
--     dossier sans.
--
--   • « Offre en cours » — une offre déposée, en attente de réponse.
--
-- Sur « Offre en cours », deux choses doivent être sues, parce qu'elles ne se
-- devinent pas en lisant la colonne :
--
--   1. L'étape vit sur le PROFIL, c'est-à-dire sur la personne, pas sur le
--      bien. Quelqu'un qui dépose une offre sur Verdun et regarde Les Airelles
--      apparaîtra « Offre en cours » sur les deux tableaux. C'est précisément
--      le motif pour lequel l'étape avait quitté le pipeline le 14/10/2026.
--   2. `crm_buyer_record_offer(profil, bien, montant, note)` existe déjà et
--      enregistre, elle, l'offre SUR LE BIEN avec son montant. Déplacer une
--      carte ne l'appelle pas : la colonne dit qu'il y a une offre quelque
--      part, la fonction dit laquelle et combien. Les deux peuvent diverger.
--
-- Aucune donnée n'est migrée : on ajoute des valeurs, on n'en retire aucune.
-- Les 322 dossiers existants gardent leur étape.

alter table public.buyer_profiles
  drop constraint if exists buyer_profiles_pipeline_stage_check;

alter table public.buyer_profiles
  add constraint buyer_profiles_pipeline_stage_check
  check (pipeline_stage = any (array[
    'a_contacter',
    'a_rappeler',
    'r1_planifie',
    'en_discussion',
    'visite_planifiee',
    'offre_en_cours',
    'pas_interesse',
    'vivier',
    'mauvais_numero'
  ]));

-- `create or replace` et non `drop` : un `drop` emporterait les droits avec
-- lui, `service_role` compris. Seule la liste blanche change.
create or replace function public.crm_buyer_set_stage(p_buyer_profile_id uuid, p_stage text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare v_uid uuid := auth.uid(); v_old text; v_stage text;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode='28000'; end if;
  if not public.crm_buyer_can_operate(p_buyer_profile_id) then
    raise exception 'droits insuffisants sur ce dossier acquereur' using errcode='42501';
  end if;

  v_stage := public.crm_etape_v2(p_stage);
  if v_stage not in ('a_contacter','a_rappeler','r1_planifie','en_discussion',
                     'visite_planifiee','offre_en_cours','pas_interesse',
                     'vivier','mauvais_numero') then
    raise exception 'etape inconnue' using errcode='22023';
  end if;

  select pipeline_stage into v_old from public.buyer_profiles where id = p_buyer_profile_id;
  if v_old is null then raise exception 'dossier introuvable' using errcode='22023'; end if;

  update public.buyer_profiles set pipeline_stage = v_stage where id = p_buyer_profile_id;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, old_value, new_value)
  values (v_uid, 'buyer_profile', p_buyer_profile_id, 'acquereur_stade',
          jsonb_build_object('stage', v_old), jsonb_build_object('stage', v_stage));

  return jsonb_build_object('ok', true, 'stage', v_stage);
end;
$function$;
