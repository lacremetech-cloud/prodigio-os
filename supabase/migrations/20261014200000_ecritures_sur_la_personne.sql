-- Les écritures visent la personne, et quatre règles de traitement
--
-- LA BOGUE QUI RENDAIT LA REPRISE DANGEREUSE. `crm_buyer_sync_profile_stage`
-- recopiait l'étape d'une manifestation — en ANCIEN vocabulaire — vers le
-- profil, qui n'accepte plus que le nouveau. Toute sauvegarde du panneau
-- aurait échoué sur une violation de contrainte, et Antoine aurait perdu sa
-- saisie. Aucun test ne pouvait l'attraper : la fonction est en base.
--
-- Les trois fonctions d'écriture visent désormais la PERSONNE. Les colonnes
-- des manifestations ne sont plus jamais écrites : elles sont l'historique,
-- pas une seconde source modifiable qui redeviendrait concurrente.
--
-- L'ANCIEN VOCABULAIRE RESTE ACCEPTÉ en entrée, et traduit. Un écran non
-- encore repris continue de l'envoyer : refuser la saisie d'un commercial
-- parce que notre chantier n'est pas fini serait le punir à notre place.

create or replace function public.crm_etape_v2(p text)
returns text language sql immutable
set search_path to 'public','pg_temp'
as $function$
  select case p
    when 'nouveau' then 'a_contacter'
    when 'visite'  then 'visite_planifiee'
    when 'perdu'   then 'pas_interesse'
    when 'gagne'   then 'en_discussion'
    when 'offre'   then 'en_discussion'
    else p end;
$function$;

create or replace function public.crm_qualification_v2(p text)
returns text language sql immutable
set search_path to 'public','pg_temp'
as $function$
  -- « en_reflexion » n'existe plus : tranché en « qualifie » par l'agence.
  select case p when 'en_reflexion' then 'qualifie' else p end;
$function$;

-- Neutralisée, pas supprimée : la laisser active ferait écraser une étape
-- fraîche par la valeur figée d'une manifestation.
create or replace function public.crm_buyer_sync_profile_stage(p_buyer_profile_id uuid)
returns void language plpgsql security definer
set search_path to 'public','pg_temp'
as $function$
begin
  return;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Les quatre règles de traitement, vérifiées en production
-- ---------------------------------------------------------------------------
--
--  1. MAUVAIS NUMÉRO change l'étape et SEULEMENT l'étape. Un numéro faux dit
--     que le numéro est faux, pas que la personne ne vaut rien : la
--     qualification reste celle qu'un humain a posée.
--
--  2. UN APPEL SANS RÉPONSE NE RESSUSCITE PERSONNE. Composer un numéro ne
--     défait pas un refus ni un jugement. Un dossier sorti de la file y reste,
--     et seul un geste explicite l'en fait revenir.
--
--  3. DEUX RAPPELS DISTINCTS NE FUSIONNENT PAS. Deux « Rappeler » identiques
--     posés à une minute d'intervalle sont un double clic — c'est arrivé sur
--     Gilles Teboul. Mais « Rappeler avant son déplacement à Nîmes » et
--     « Rappeler dans 10j pour la visite » sont deux rappels légitimes, et les
--     fondre perdrait ce que le commercial avait noté. On ne reprend donc une
--     tâche que si l'intitulé est le MÊME, ou qu'aucun n'est donné.
--
--  4. UN RAPPEL PROGRAMMÉ place en « à rappeler », sauf sur un dossier
--     volontairement sorti de la file : on ne réveille personne par surprise.
--

create or replace function public.crm_buyer_record_treatment(
  p_interest_id uuid, p_call_outcome text, p_qualification text,
  p_qualification_reason text, p_note text, p_stage text,
  p_next_action_kind text, p_next_action_at timestamptz,
  p_next_action_title text, p_complete_task_id uuid)
returns jsonb
language plpgsql security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_profile uuid; v_contact uuid;
  v_old_qualif text; v_old_stage text;
  v_qualif text; v_stage text; v_titre text;
  v_activity uuid; v_task uuid;
begin
  if v_uid is null then
    raise exception 'authentification requise' using errcode = '28000';
  end if;

  select i.buyer_profile_id, i.contact_id into v_profile, v_contact
    from public.buyer_interests i where i.id = p_interest_id;
  if v_profile is null then
    raise exception 'manifestation introuvable' using errcode = '22023';
  end if;
  if not public.crm_buyer_can_operate(v_profile) then
    raise exception 'droits insuffisants sur ce dossier acquereur' using errcode = '42501';
  end if;

  select p.qualification, p.pipeline_stage into v_old_qualif, v_old_stage
    from public.buyer_profiles p where p.id = v_profile;

  if p_call_outcome is not null then
    if p_call_outcome not in ('contact_etabli','sans_reponse','message_laisse','mauvais_numero') then
      raise exception 'resultat d''appel inconnu' using errcode = '22023';
    end if;
    insert into public.activities
      (occurred_at, contact_id, buyer_profile_id, interest_id, author_user_id, type, outcome, body)
    values (now(), v_contact, v_profile, p_interest_id, v_uid, 'appel', p_call_outcome,
            nullif(btrim(coalesce(p_note,'')),''))
    returning id into v_activity;
    if p_call_outcome = 'mauvais_numero' then
      update public.contacts set phone_status = 'invalide' where id = v_contact;
    end if;
  elsif nullif(btrim(coalesce(p_note,'')),'') is not null then
    insert into public.activities
      (occurred_at, contact_id, buyer_profile_id, interest_id, author_user_id, type, body)
    values (now(), v_contact, v_profile, p_interest_id, v_uid, 'note', btrim(p_note))
    returning id into v_activity;
  end if;

  if p_qualification is not null then
    v_qualif := public.crm_qualification_v2(p_qualification);
    if v_qualif not in ('a_qualifier','qualifie','gros_potentiel','non_qualifie') then
      raise exception 'qualification inconnue' using errcode = '22023';
    end if;
    if v_qualif = 'non_qualifie'
       and nullif(btrim(coalesce(p_qualification_reason,'')),'') is null then
      raise exception 'un motif est requis pour ecarter un dossier' using errcode = '22023';
    end if;
    update public.buyer_profiles
       set qualification = v_qualif,
           qualification_reason = nullif(btrim(coalesce(p_qualification_reason,'')),''),
           qualification_by = v_uid, qualification_at = now()
     where id = v_profile;
  end if;

  v_stage := public.crm_etape_v2(p_stage);
  if v_stage is null and p_call_outcome = 'mauvais_numero' then
    v_stage := 'mauvais_numero';
  elsif v_stage is null and p_call_outcome in ('sans_reponse','message_laisse') then
    if coalesce(v_qualif, v_old_qualif) <> 'non_qualifie'
       and v_old_stage in ('a_contacter','a_rappeler') then
      v_stage := 'a_rappeler';
    end if;
  end if;

  if v_stage is not null and v_stage is distinct from v_old_stage then
    if v_stage not in ('a_contacter','a_rappeler','en_discussion',
                       'visite_planifiee','vivier','pas_interesse','mauvais_numero') then
      raise exception 'etape inconnue' using errcode = '22023';
    end if;
    update public.buyer_profiles set pipeline_stage = v_stage where id = v_profile;
  end if;

  if p_complete_task_id is not null then
    update public.tasks set status = 'fait', completed_at = now()
     where id = p_complete_task_id and buyer_profile_id = v_profile and status = 'a_faire';
  end if;

  if p_next_action_at is not null then
    if coalesce(p_next_action_kind,'rappel') not in ('rappel','tache','visite') then
      raise exception 'type d''action inconnu' using errcode = '22023';
    end if;
    v_titre := nullif(btrim(coalesce(p_next_action_title,'')),'');

    select t.id into v_task from public.tasks t
     where t.buyer_profile_id = v_profile
       and t.status = 'a_faire'
       and t.kind = coalesce(p_next_action_kind,'rappel')
       and (v_titre is null or lower(btrim(t.title)) = lower(v_titre))
     order by t.due_at asc limit 1;

    if v_task is null then
      insert into public.tasks
        (opportunity_id, author_user_id, assignee_user_id, title, kind, status, due_at,
         buyer_profile_id, interest_id)
      values (null, v_uid, v_uid, coalesce(v_titre,'Rappeler'),
              coalesce(p_next_action_kind,'rappel'), 'a_faire', p_next_action_at,
              v_profile, p_interest_id)
      returning id into v_task;
    else
      update public.tasks
         set due_at = p_next_action_at, title = coalesce(v_titre, title)
       where id = v_task;
    end if;

    if coalesce(p_next_action_kind,'rappel') = 'rappel'
       and v_stage is null
       and coalesce(v_qualif, v_old_qualif) <> 'non_qualifie'
       and v_old_stage in ('a_contacter','a_rappeler') then
      v_stage := 'a_rappeler';
      update public.buyer_profiles set pipeline_stage = v_stage where id = v_profile;
    end if;
  end if;

  update public.buyer_profiles set last_activity_at = now() where id = v_profile;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, old_value, new_value)
  values (v_uid, 'buyer_profile', v_profile, 'acquereur_traitement',
          jsonb_build_object('qualification', v_old_qualif, 'stage', v_old_stage),
          jsonb_build_object('qualification', coalesce(v_qualif, v_old_qualif),
                             'stage', coalesce(v_stage, v_old_stage),
                             'resultat_appel', p_call_outcome,
                             'interest_id', p_interest_id));

  return jsonb_build_object('ok', true, 'activity_id', v_activity, 'task_id', v_task,
                            'qualification', coalesce(v_qualif, v_old_qualif),
                            'stage', coalesce(v_stage, v_old_stage));
end;
$function$;

create or replace function public.crm_buyer_set_interest_stage(p_interest_id uuid, p_stage text)
returns jsonb
language plpgsql security definer
set search_path to 'public','pg_temp'
as $function$
declare v_uid uuid := auth.uid(); v_profile uuid; v_old text; v_stage text;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode='28000'; end if;
  select i.buyer_profile_id into v_profile from public.buyer_interests i where i.id = p_interest_id;
  if v_profile is null then raise exception 'manifestation introuvable' using errcode='22023'; end if;
  if not public.crm_buyer_can_operate(v_profile) then
    raise exception 'droits insuffisants sur ce dossier acquereur' using errcode='42501';
  end if;
  select p.pipeline_stage into v_old from public.buyer_profiles p where p.id = v_profile;
  v_stage := public.crm_etape_v2(p_stage);
  if v_stage not in ('a_contacter','a_rappeler','en_discussion',
                     'visite_planifiee','vivier','pas_interesse','mauvais_numero') then
    raise exception 'etape inconnue' using errcode='22023';
  end if;
  if v_stage is distinct from v_old then
    update public.buyer_profiles set pipeline_stage = v_stage where id = v_profile;
    insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, old_value, new_value)
    values (v_uid, 'buyer_profile', v_profile, 'acquereur_etape',
            jsonb_build_object('stage', v_old),
            jsonb_build_object('stage', v_stage, 'interest_id', p_interest_id));
  end if;
  return jsonb_build_object('ok', true, 'stage', v_stage);
end;
$function$;

create or replace function public.crm_buyer_set_stage(p_buyer_profile_id uuid, p_stage text)
returns jsonb
language plpgsql security definer
set search_path to 'public','pg_temp'
as $function$
declare v_uid uuid := auth.uid(); v_old text; v_stage text;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode='28000'; end if;
  if not public.crm_buyer_can_operate(p_buyer_profile_id) then
    raise exception 'droits insuffisants sur ce dossier acquereur' using errcode='42501';
  end if;
  v_stage := public.crm_etape_v2(p_stage);
  if v_stage not in ('a_contacter','a_rappeler','en_discussion',
                     'visite_planifiee','vivier','pas_interesse','mauvais_numero') then
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
