-- Pipeline acquéreur : onze colonnes ramenées à huit.
--
-- Quatre d'entre elles — à contacter, contact en cours, qualifié, bien à
-- proposer — décrivaient un seul moment réel : on lui parle. Au-delà de sept ou
-- huit colonnes, chacun invente sa propre règle de rangement et le tableau
-- cesse de dire la vérité.
--
-- « Visite » couvre à planifier, planifiée et le suivi d'après-visite : c'est la
-- date portée par la carte qui les distingue, pas trois colonnes. Et
-- « bien à proposer » n'avait plus de sens du tout : une demande arrive par le
-- tunnel d'un bien, le bien est déjà connu.
--
-- « Vivier » répond à un besoin que rien ne couvrait : la personne qui
-- n'achètera pas CE bien mais qu'on rappellera au suivant. Elle finissait en
-- « Perdu », qui l'enterrait.

alter table public.buyer_profiles drop constraint if exists buyer_profiles_pipeline_stage_check;

update public.buyer_profiles set pipeline_stage = case pipeline_stage
  when 'a_contacter'        then 'a_rappeler'
  when 'contact_en_cours'   then 'en_discussion'
  when 'qualifie'           then 'en_discussion'
  when 'bien_a_proposer'    then 'en_discussion'
  when 'visite_a_planifier' then 'visite'
  when 'visite_planifiee'   then 'visite'
  when 'suivi_apres_visite' then 'visite'
  when 'offre_en_cours'     then 'offre'
  when 'acquereur_gagne'    then 'gagne'
  else pipeline_stage end
where pipeline_stage is not null;

alter table public.buyer_profiles
  add constraint buyer_profiles_pipeline_stage_check
  check (pipeline_stage = any (array[
    'nouveau','a_rappeler','en_discussion','visite','offre','vivier','gagne','perdu'
  ]));

-- Offre et résultat engagent : ils passent par une action dédiée, avec motif et
-- audit. Un simple déplacement de carte ne les atteint pas. « Vivier » n'en
-- fait pas partie : ranger quelqu'un pour plus tard n'engage rien.
create or replace function public.crm_buyer_set_stage(p_buyer_profile_id uuid, p_stage text)
returns jsonb language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $function$
declare v_uid uuid := auth.uid(); v_old text;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.crm_buyer_can_operate(p_buyer_profile_id) then
    raise exception 'droits insuffisants sur ce dossier acquéreur' using errcode = '42501';
  end if;
  if p_stage in ('offre', 'gagne', 'perdu') then
    raise exception 'cette étape passe par une action métier dédiée (offre / résultat)'
      using errcode = '22023';
  end if;
  if p_stage not in ('nouveau','a_rappeler','en_discussion','visite','vivier') then
    raise exception 'étape inconnue' using errcode = '22023';
  end if;

  select pipeline_stage into v_old from public.buyer_profiles where id = p_buyer_profile_id;
  if v_old is null then raise exception 'dossier introuvable' using errcode = '22023'; end if;
  if v_old in ('gagne', 'perdu') then
    raise exception 'ce dossier est clos : rouvrez-le depuis une action métier dédiée'
      using errcode = '22023';
  end if;

  update public.buyer_profiles set pipeline_stage = p_stage where id = p_buyer_profile_id;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, old_value, new_value)
  values (v_uid, 'buyer_profile', p_buyer_profile_id, 'acquereur_stade',
          jsonb_build_object('stage', v_old), jsonb_build_object('stage', p_stage));

  return jsonb_build_object('ok', true, 'stage', p_stage);
end;
$function$;

-- Les trois fonctions qui écrivent un stade sensible suivent le nouveau
-- vocabulaire. On réécrit leurs seuls littéraux, le reste de leur corps étant
-- inchangé.
do $maj$
declare r record; src text;
begin
  for r in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('crm_buyer_record_offer','crm_buyer_record_outcome','crm_buyer_reopen')
  loop
    src := pg_get_functiondef(r.oid);
    src := replace(src, '''offre_en_cours''',     '''offre''');
    src := replace(src, '''acquereur_gagne''',    '''gagne''');
    src := replace(src, '''suivi_apres_visite''', '''visite''');
    execute src;
  end loop;
end
$maj$;
