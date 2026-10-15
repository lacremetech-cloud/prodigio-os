-- Une seule sauvegarde : l'activité, la qualification, l'étape et la tâche
--
-- POURQUOI UNE SEULE ÉCRITURE. Le panneau et la fiche enregistraient en
-- plusieurs appels : l'activité, puis la qualification, puis le rappel. Une
-- coupure entre deux laissait l'activité écrite et le rappel perdu — c'est-à-
-- dire un dossier qu'on croit suivi et que personne ne rappelle. Les quatre
-- faits d'un même traitement partent désormais ensemble, ou pas du tout.
--
-- LES SEPT ACTIVITÉS remplacent « résultat de l'appel ». L'ancien vocabulaire
-- ne savait dire ni « WhatsApp envoyé » ni « e-mail » : le commercial mettait
-- « autre » et la trace ne disait plus rien. Les sept valeurs sont traduites
-- ici vers (type, outcome), une seule fois, pour que les deux écrans ne
-- puissent plus décrire le même fait avec deux mots différents.
--
-- DATE RÉELLE ET DATE DE SAISIE SONT DEUX CHOSES. On note souvent un appel
-- après coup ; dater l'activité de l'heure de saisie décalerait toute la
-- chronologie du dossier. `occurred_at` est donc modifiable et `created_at`
-- ne bouge jamais. Les anciennes dates restent telles quelles : rien ici ne
-- réécrit une ligne existante.

-- ---------------------------------------------------------------------------
-- 1. Les types d'activité : les sept nouveaux ET les quatre anciens
-- ---------------------------------------------------------------------------
-- Les anciens restent acceptés parce que des lignes les portent déjà. Les
-- retirer rendrait l'historique invalide au premier `update` sur la table :
-- une contrainte de contrôle est vérifiée sur toute ligne qu'on touche, pas
-- seulement sur celles qu'on insère.
alter table public.activities drop constraint if exists activities_type_check;
alter table public.activities add constraint activities_type_check check (
  type in (
    -- Le vocabulaire courant
    'appel', 'message_vocal', 'whatsapp', 'sms', 'email', 'note',
    -- Conservés pour l'historique déjà écrit
    'tentative_appel', 'sms_whatsapp', 'rendez_vous', 'autre'
  )
);

comment on column public.activities.occurred_at is
  'Quand le fait a RÉELLEMENT eu lieu. Modifiable : on note souvent un appel après coup.';
comment on column public.activities.created_at is
  'Quand la ligne a été saisie. Ne bouge jamais — c''est la trace, pas la chronologie.';

-- ---------------------------------------------------------------------------
-- 2. La sauvegarde unique
-- ---------------------------------------------------------------------------
create or replace function public.crm_buyer_enregistrer(
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
  v_type text; v_outcome text; v_rappelle boolean := false;
  v_quand timestamptz;
  v_activity uuid; v_task uuid; v_assignee uuid;
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

  -- --- L'activité ----------------------------------------------------------
  if p_activite is not null then
    -- Les sept choix, traduits ICI et nulle part ailleurs.
    case p_activite
      when 'appel_sans_reponse' then v_type := 'appel'; v_outcome := 'sans_reponse'; v_rappelle := true;
      when 'appel_echange'      then v_type := 'appel'; v_outcome := 'contact_etabli';
      when 'message_vocal'      then v_type := 'message_vocal'; v_rappelle := true;
      when 'whatsapp'           then v_type := 'whatsapp';
      when 'sms'                then v_type := 'sms';
      when 'email'              then v_type := 'email';
      when 'note'               then v_type := 'note';
      else raise exception 'activite inconnue' using errcode = '22023';
    end case;

    -- Une date dans le futur n'est pas un fait : c'est une faute de frappe,
    -- et elle mettrait l'activité en tête d'un historique qu'elle fausse.
    v_quand := coalesce(p_occurred_at, now());
    if v_quand > now() + interval '5 minutes' then
      raise exception 'une activite ne peut pas etre datee dans le futur' using errcode = '22023';
    end if;

    insert into public.activities
      (occurred_at, contact_id, buyer_profile_id, interest_id, author_user_id, type, outcome, body)
    values (v_quand, v_contact, v_profile, p_interest_id, v_uid, v_type, v_outcome,
            nullif(btrim(coalesce(p_note,'')),''))
    returning id into v_activity;

  elsif nullif(btrim(coalesce(p_note,'')),'') is not null then
    -- Une note seule est une activité à part entière, datable elle aussi.
    v_quand := coalesce(p_occurred_at, now());
    if v_quand > now() + interval '5 minutes' then
      raise exception 'une note ne peut pas etre datee dans le futur' using errcode = '22023';
    end if;
    insert into public.activities
      (occurred_at, contact_id, buyer_profile_id, interest_id, author_user_id, type, body)
    values (v_quand, v_contact, v_profile, p_interest_id, v_uid, 'note', btrim(p_note))
    returning id into v_activity;
  end if;

  -- --- La qualification ----------------------------------------------------
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

  -- --- L'étape -------------------------------------------------------------
  v_stage := public.crm_etape_v2(p_stage);

  -- Un appel sans réponse ou un message vocal fait passer en « à rappeler »,
  -- MAIS NE RESSUSCITE PERSONNE : composer un numéro ne défait pas un refus.
  if v_stage is null and v_rappelle then
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

  -- « Mauvais numéro » dit que le NUMÉRO est faux, pas que la personne ne vaut
  -- rien : le téléphone est marqué invalide, la qualification reste celle
  -- qu'un humain a posée.
  if coalesce(v_stage, v_old_stage) = 'mauvais_numero' then
    update public.contacts set phone_status = 'invalide' where id = v_contact;
  end if;

  -- --- Le rappel qui avait amené le dossier dans la file est soldé ---------
  if p_complete_task_id is not null then
    update public.tasks set status = 'fait', completed_at = now()
     where id = p_complete_task_id and buyer_profile_id = v_profile and status = 'a_faire';
  end if;

  -- --- La prochaine action -------------------------------------------------
  if p_next_action_at is not null then
    if coalesce(p_next_action_kind,'rappel') not in ('rappel','tache','visite') then
      raise exception 'type d''action inconnu' using errcode = '22023';
    end if;
    v_titre := nullif(btrim(coalesce(p_next_action_title,'')),'');
    -- Responsable explicite, à défaut celui qui enregistre. Un commercial qui
    -- prend l'appel d'un dossier qui n'est pas le sien doit pouvoir rendre le
    -- rappel à son titulaire sans réattribuer le dossier entier.
    v_assignee := coalesce(p_next_action_assignee, v_uid);

    -- Deux « Rappeler » identiques à une minute d'écart sont un double clic.
    -- Mais « Rappeler avant Nîmes » et « Rappeler dans 10j pour la visite »
    -- sont deux rappels légitimes : on ne reprend une tâche que si l'intitulé
    -- est le MÊME, ou qu'aucun n'est donné.
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
      values (null, v_uid, v_assignee, coalesce(v_titre,'Rappeler'),
              coalesce(p_next_action_kind,'rappel'), 'a_faire', p_next_action_at,
              v_profile, p_interest_id)
      returning id into v_task;
    else
      update public.tasks
         set due_at = p_next_action_at,
             title = coalesce(v_titre, title),
             assignee_user_id = v_assignee
       where id = v_task;
    end if;

    -- Un rappel programmé place en « à rappeler », sauf sur un dossier
    -- volontairement sorti de la file : on ne réveille personne par surprise.
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
                             'activite', p_activite,
                             'interest_id', p_interest_id));

  return jsonb_build_object('ok', true, 'activity_id', v_activity, 'task_id', v_task,
                            'qualification', coalesce(v_qualif, v_old_qualif),
                            'stage', coalesce(v_stage, v_old_stage));
end;
$function$;

revoke all on function public.crm_buyer_enregistrer(
  uuid, text, timestamptz, text, text, text, text, text, timestamptz, text, uuid, uuid)
  from public, anon;
grant execute on function public.crm_buyer_enregistrer(
  uuid, text, timestamptz, text, text, text, text, text, timestamptz, text, uuid, uuid)
  to authenticated;
