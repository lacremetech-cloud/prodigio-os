-- L'activité appartient à la PERSONNE ; le bien est facultatif
--
-- CE QUI N'ALLAIT PAS. Enregistrer une activité exigeait un bien. Un seul
-- appel qui parle de deux villas obligeait donc à saisir deux activités — ou,
-- plus souvent, à en saisir une et à perdre la moitié de l'information. Pire :
-- le choix du bien était demandé AVANT de savoir si la conversation portait
-- sur un bien en particulier, ce qui n'est pas le cas le plus fréquent.
--
-- L'activité est désormais ancrée sur le DOSSIER. Le bien est une précision
-- qu'on apporte quand l'échange la mérite. C'est l'ordre naturel : on parle à
-- quelqu'un, puis éventuellement d'un bien.
--
-- CE QUI RESTE RATTACHÉ À UN BIEN : les visites et les offres. Une visite est
-- toujours la visite de quelque chose, et une offre porte sur un bien précis.
-- Une visite sans bien serait un rendez-vous sans adresse ; la fonction la
-- refuse plutôt que de l'enregistrer à moitié.
--
-- AUCUNE DONNÉE N'EST TOUCHÉE. `activities.interest_id` était déjà nullable et
-- 9 des 26 activités existantes n'en portaient aucun : le modèle acceptait
-- déjà ce que l'écran interdisait. Rien n'est réécrit, rien n'est effacé.

-- ---------------------------------------------------------------------------
-- Le dossier devient l'ancre ; la manifestation, une précision facultative
-- ---------------------------------------------------------------------------
create or replace function public.crm_buyer_enregistrer(
  p_buyer_profile_id uuid,
  p_interest_id uuid,
  p_activite text,
  p_occurred_at timestamptz,
  p_note text,
  p_qualification text,
  p_qualification_reason text,
  p_stage text,
  p_next_action_kind text,
  p_next_action_at timestamptz,
  p_next_action_title text,
  p_next_action_assignee uuid,
  p_complete_task_id uuid)
returns jsonb
language plpgsql security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_profile uuid; v_contact uuid;
  v_old_qualif text; v_old_stage text;
  v_qualif text; v_stage text; v_titre text;
  v_type text; v_outcome text; v_quand timestamptz;
  v_activity uuid; v_task uuid; v_assignee uuid;
begin
  if v_uid is null then
    raise exception 'authentification requise' using errcode = '28000';
  end if;

  -- Le dossier d'abord. La manifestation, si elle est donnée, doit lui
  -- appartenir : sans cette vérification, on pourrait rattacher l'activité
  -- d'une personne au projet d'une autre.
  select p.id, p.contact_id, p.qualification, p.pipeline_stage
    into v_profile, v_contact, v_old_qualif, v_old_stage
    from public.buyer_profiles p where p.id = p_buyer_profile_id;
  if v_profile is null then
    raise exception 'dossier acquereur introuvable' using errcode = '22023';
  end if;
  if p_interest_id is not null
     and not exists (select 1 from public.buyer_interests i
                      where i.id = p_interest_id and i.buyer_profile_id = v_profile) then
    raise exception 'ce projet n''appartient pas a ce dossier' using errcode = '22023';
  end if;
  if not public.crm_buyer_can_operate(v_profile) then
    raise exception 'droits insuffisants sur ce dossier acquereur' using errcode = '42501';
  end if;

  -- 1. L'ACTIVITE. Sept choix, traduits vers le couple (type, resultat) que la
  --    base connait deja. `occurred_at` est la date REELLE de l'echange, que
  --    l'on peut corriger ; `created_at` reste la date de saisie, jamais
  --    modifiable. On note souvent un appel apres coup : dater la note de
  --    l'heure de saisie fausserait la chronologie du dossier.
  --    `interest_id` peut rester nul : l'activite est alors « generale », et
  --    c'est le cas le plus frequent.
  if p_activite is not null then
    v_quand := coalesce(p_occurred_at, now());
    if v_quand > now() + interval '5 minutes' then
      raise exception 'une activite ne se date pas dans le futur' using errcode = '22023';
    end if;

    case p_activite
      when 'appel_sans_reponse' then v_type := 'appel';         v_outcome := 'sans_reponse';
      when 'appel_echange'      then v_type := 'appel';         v_outcome := 'contact_etabli';
      when 'message_vocal'      then v_type := 'message_vocal'; v_outcome := 'message_laisse';
      when 'whatsapp'           then v_type := 'whatsapp';      v_outcome := null;
      when 'sms'                then v_type := 'sms';           v_outcome := null;
      when 'email'              then v_type := 'email';         v_outcome := null;
      when 'note'               then v_type := 'note';          v_outcome := null;
      else raise exception 'type d''activite inconnu' using errcode = '22023';
    end case;

    insert into public.activities
      (occurred_at, contact_id, buyer_profile_id, interest_id, author_user_id, type, outcome, body)
    values (v_quand, v_contact, v_profile, p_interest_id, v_uid, v_type, v_outcome,
            nullif(btrim(coalesce(p_note,'')),''))
    returning id into v_activity;
  elsif nullif(btrim(coalesce(p_note,'')),'') is not null then
    v_quand := coalesce(p_occurred_at, now());
    if v_quand > now() + interval '5 minutes' then
      raise exception 'une note ne se date pas dans le futur' using errcode = '22023';
    end if;
    insert into public.activities
      (occurred_at, contact_id, buyer_profile_id, interest_id, author_user_id, type, body)
    values (v_quand, v_contact, v_profile, p_interest_id, v_uid, 'note', btrim(p_note))
    returning id into v_activity;
  end if;

  -- 2. LA QUALIFICATION, sur la personne. Jamais deduite d'une activite.
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

  -- 3. L'ETAPE. Les regles validees sont reprises telles quelles.
  v_stage := public.crm_etape_v2(p_stage);
  if v_stage is null and p_activite in ('appel_sans_reponse','message_vocal') then
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

  -- Un mauvais numero marque le TELEPHONE, jamais la qualification : le numero
  -- est faux, la personne vaut ce qu'elle vaut. Verifie sur l'etape RESULTANTE
  -- et non sur le changement, pour qu'un second passage repare un telephone
  -- reste « ok » par accident.
  if coalesce(v_stage, v_old_stage) = 'mauvais_numero' then
    update public.contacts set phone_status = 'invalide' where id = v_contact;
  end if;

  -- 4. LES TACHES.
  if p_complete_task_id is not null then
    update public.tasks set status = 'fait', completed_at = now()
     where id = p_complete_task_id and buyer_profile_id = v_profile and status = 'a_faire';
  end if;

  if p_next_action_at is not null then
    if coalesce(p_next_action_kind,'rappel') not in ('rappel','tache','visite') then
      raise exception 'type d''action inconnu' using errcode = '22023';
    end if;
    -- Une visite est toujours la visite de QUELQUE CHOSE. Sans bien, c'est un
    -- rendez-vous sans adresse : on refuse plutot que d'enregistrer a moitie.
    if coalesce(p_next_action_kind,'rappel') = 'visite' and p_interest_id is null then
      raise exception 'une visite se rattache a un bien precis' using errcode = '22023';
    end if;
    v_titre := nullif(btrim(coalesce(p_next_action_title,'')),'');

    select t.id into v_task from public.tasks t
     where t.buyer_profile_id = v_profile and t.status = 'a_faire'
       and t.kind = coalesce(p_next_action_kind,'rappel')
       and (v_titre is null or lower(btrim(t.title)) = lower(v_titre))
     order by t.due_at asc limit 1;

    if v_task is null then
      insert into public.tasks
        (opportunity_id, author_user_id, assignee_user_id, title, kind, status, due_at,
         buyer_profile_id, interest_id)
      values (null, v_uid, coalesce(p_next_action_assignee, v_uid),
              coalesce(v_titre,'Rappeler'), coalesce(p_next_action_kind,'rappel'),
              'a_faire', p_next_action_at, v_profile, p_interest_id)
      returning id into v_task;
    else
      update public.tasks
         set due_at = p_next_action_at,
             title = coalesce(v_titre, title),
             assignee_user_id = coalesce(p_next_action_assignee, assignee_user_id)
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
                             'activite', p_activite, 'interest_id', p_interest_id));

  -- La reponse DIT CE QUI A ETE ECRIT, pas ce qui a ete demande. L'appelant
  -- peut donc verifier que le responsable qu'il a choisi est bien celui qui
  -- est enregistre : un champ accepte a l'ecran et perdu en base est la pire
  -- des pannes, parce qu'elle ne se voit pas.
  select t.assignee_user_id into v_assignee from public.tasks t where t.id = v_task;

  return jsonb_build_object('ok', true, 'activity_id', v_activity, 'task_id', v_task,
                            'qualification', coalesce(v_qualif, v_old_qualif),
                            'stage', coalesce(v_stage, v_old_stage),
                            'interest_id', p_interest_id,
                            'next_action_assignee', v_assignee);
end;
$function$;

revoke all on function public.crm_buyer_enregistrer(
  uuid, uuid, text, timestamptz, text, text, text, text, text, timestamptz, text, uuid, uuid)
  from public, anon;
grant execute on function public.crm_buyer_enregistrer(
  uuid, uuid, text, timestamptz, text, text, text, text, text, timestamptz, text, uuid, uuid)
  to authenticated;

comment on column public.activities.interest_id is
  'Bien concerné, FACULTATIF. Nul = activité générale, rattachée à la personne : un appel qui parle de deux villas est une seule activité. Visites et offres, elles, portent toujours un bien.';

-- ---------------------------------------------------------------------------
-- Compatibilité : l'ancienne signature reste, et redirige
-- ---------------------------------------------------------------------------
-- La migration s'applique AVANT que l'interface qui en dépend soit déployée.
-- Entre les deux, c'est l'ancienne interface qui tourne, et elle appelle
-- l'ancienne signature. La supprimer ferait échouer chaque enregistrement
-- pendant cette fenêtre : un commercial au téléphone perdrait sa saisie pour
-- une raison qui n'a rien à voir avec lui.
--
-- Elle ne duplique AUCUNE règle : elle retrouve le dossier depuis la
-- manifestation et délègue. Il n'y a toujours qu'un seul chemin d'écriture.
-- À supprimer une fois la nouvelle interface en ligne.
create or replace function public.crm_buyer_enregistrer(
  p_interest_id uuid, p_activite text, p_occurred_at timestamptz, p_note text,
  p_qualification text, p_qualification_reason text, p_stage text,
  p_next_action_kind text, p_next_action_at timestamptz, p_next_action_title text,
  p_next_action_assignee uuid, p_complete_task_id uuid)
returns jsonb
language plpgsql security definer
set search_path to 'public','pg_temp'
as $function$
declare v_profile uuid;
begin
  select i.buyer_profile_id into v_profile
    from public.buyer_interests i where i.id = p_interest_id;
  if v_profile is null then
    raise exception 'manifestation introuvable' using errcode = '22023';
  end if;
  return public.crm_buyer_enregistrer(
    v_profile, p_interest_id, p_activite, p_occurred_at, p_note,
    p_qualification, p_qualification_reason, p_stage,
    p_next_action_kind, p_next_action_at, p_next_action_title,
    p_next_action_assignee, p_complete_task_id);
end;
$function$;

comment on function public.crm_buyer_enregistrer(
  uuid, text, timestamptz, text, text, text, text, text, timestamptz, text, uuid, uuid) is
  'OBSOLÈTE — compatibilité le temps du déploiement. Redirige vers la version ancrée sur le dossier. À supprimer une fois la nouvelle interface en ligne.';

revoke all on function public.crm_buyer_enregistrer(
  uuid, text, timestamptz, text, text, text, text, text, timestamptz, text, uuid, uuid)
  from public, anon;
grant execute on function public.crm_buyer_enregistrer(
  uuid, text, timestamptz, text, text, text, text, text, timestamptz, text, uuid, uuid)
  to authenticated;
