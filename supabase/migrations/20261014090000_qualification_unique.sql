-- =====================================================================
-- UNE SEULE QUALIFICATION COMMERCIALE
--
-- Le CRM en portait deux, et les montrait sur des écrans différents :
--
--   • `buyer_profiles.qualification_status` — l'ancienne, PAR PERSONNE,
--     quatre valeurs (non_qualifie / en_cours / qualifie / ecarte),
--     affichée sur le Kanban et sur le cockpit du bien ;
--   • `buyer_interests.qualification` — la nouvelle, PAR DOSSIER (personne
--     × projet), cinq valeurs, affichée dans la liste, le panneau et la
--     fiche.
--
-- Même mot, deux échelles, deux écrans : impossible de savoir laquelle fait
-- foi. Cette migration ne garde que la seconde, ramenée à QUATRE valeurs,
-- et y reprend ce que la première savait.
--
-- ---------------------------------------------------------------------
-- CE QUI N'EST PAS SUPPRIMÉ
--
-- `buyer_profiles.qualification_status` reste en base, avec sa valeur.
-- `recommended_priority` et les scores du formulaire aussi. Ils quittent
-- les écrans commerciaux, pas la base : effacer une colonne pour réduire
-- un compte, c'est perdre de l'historique en échange de rien. Leur sort
-- se décidera après inventaire des dépendances, séparément.
--
-- ---------------------------------------------------------------------
-- LE PIÈGE DU DÉFAUT
--
-- `qualification_status` vaut `non_qualifie` PAR DÉFAUT : c'est l'état de
-- quelqu'un que personne n'a jamais jugé, pas celui de quelqu'un qu'on a
-- écarté. Le reprendre littéralement aurait marqué « Non qualifié » tout
-- le fichier jamais traité — exactement l'inverse de ce qu'il raconte.
-- Seul `ecarte` porte un rejet explicite, et lui seul devient
-- `non_qualifie`.
--
-- De même, aucun ancien « Qualifié » ne devient « Gros potentiel » :
-- « Qualifié » disait qu'un humain avait validé le dossier, pas qu'il le
-- jugeait fort. Promouvoir d'office aurait fabriqué des gros potentiels
-- que personne n'a confirmés. Ces dossiers reviennent donc « À qualifier »
-- — la file de travail, pas la poubelle — et leur valeur d'origine reste
-- lisible dans la colonne conservée et dans le journal d'audit.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Trace AVANT de toucher quoi que ce soit
--
-- Le journal est écrit en premier, et il porte les deux anciennes valeurs.
-- Si la reprise se révélait fausse, c'est lui qui permet de la rejouer
-- autrement : une migration qui efface sa propre source est une migration
-- qu'on ne peut pas corriger.
-- ---------------------------------------------------------------------
insert into public.audit_events
  (actor_user_id, entity_type, entity_id, event_type, old_value, new_value, metadata)
select
  null,                                   -- aucun acteur : c'est une migration
  'buyer_interest',
  i.id,
  'acquereur_qualification',
  jsonb_build_object(
    'qualification', i.qualification,
    'qualification_status_profil', p.qualification_status
  ),
  jsonb_build_object(
    'qualification',
    case
      -- Le seul rejet explicite de l'ancienne échelle.
      when i.qualification = 'a_qualifier' and p.qualification_status = 'ecarte'
        then 'non_qualifie'
      -- « Qualifié » n'est pas un niveau de potentiel : retour à la file.
      when i.qualification = 'qualifie' then 'a_qualifier'
      else i.qualification
    end
  ),
  jsonb_build_object(
    'source', 'consolidation_qualification_unique',
    'migration', '20261014090000'
  )
from public.buyer_interests i
join public.buyer_profiles p on p.id = i.buyer_profile_id
where
  -- On ne journalise que ce qui change réellement.
  i.qualification = 'qualifie'
  or (i.qualification = 'a_qualifier' and p.qualification_status = 'ecarte');

-- ---------------------------------------------------------------------
-- 2. Reprise de l'ancienne qualification — AVANT le repli de « Qualifié »
--
-- L'ordre n'est pas indifférent. En repliant « Qualifié » d'abord, un
-- dossier à la fois `qualification = 'qualifie'` (jugement récent, positif)
-- et `qualification_status = 'ecarte'` (jugement ancien, négatif) se
-- retrouvait à `a_qualifier`, redevenait éligible à la reprise, et finissait
-- `non_qualifie` : le vieux rejet écrasait le jugement récent, et le journal
-- écrit plus haut annonçait autre chose que ce que la base contenait.
--
-- La reprise ne touche donc que les dossiers restés au défaut `a_qualifier`,
-- c'est-à-dire ceux sur lesquels personne ne s'est jamais prononcé sur la
-- nouvelle échelle.
--
-- Le motif est obligatoire pour `non_qualifie` (contrainte existante) : il
-- dit d'où vient la valeur, pour que personne ne cherche trois semaines plus
-- tard qui a écarté ce dossier et pourquoi.
-- ---------------------------------------------------------------------
update public.buyer_interests i
   set qualification = 'non_qualifie',
       qualification_reason = coalesce(
         nullif(btrim(coalesce(i.qualification_reason, '')), ''),
         'Écarté — repris de l''ancienne qualification'
       ),
       qualification_at = coalesce(i.qualification_at, now())
  from public.buyer_profiles p
 where p.id = i.buyer_profile_id
   and i.qualification = 'a_qualifier'
   and p.qualification_status = 'ecarte';

-- `non_qualifie`, `en_cours` et `qualifie` de l'ancienne échelle ne donnent
-- lieu à AUCUNE écriture : ils valent tous « personne n'a encore tranché sur
-- la nouvelle échelle », ce que `a_qualifier` dit déjà.

-- ---------------------------------------------------------------------
-- 3. Repli de « Qualifié »
--
-- Il ne disait pas un niveau de potentiel. Le dossier revient dans la file à
-- qualifier, et c'est tout : la date est posée pour que la fiche montre que
-- quelque chose s'est passé ce jour-là.
-- ---------------------------------------------------------------------
update public.buyer_interests
   set qualification = 'a_qualifier',
       qualification_at = coalesce(qualification_at, now())
 where qualification = 'qualifie';

-- ---------------------------------------------------------------------
-- 4. Quatre valeurs, et pas cinq
-- ---------------------------------------------------------------------
alter table public.buyer_interests
  drop constraint if exists buyer_interests_qualification_check;

alter table public.buyer_interests
  add constraint buyer_interests_qualification_check
  check (qualification in ('a_qualifier','gros_potentiel','en_reflexion','non_qualifie'));

-- ---------------------------------------------------------------------
-- 5. La fonction de traitement refuse désormais « qualifie »
--
-- La contrainte suffirait à faire échouer l'écriture, mais avec un message
-- de base de données. Le contrôle explicite rend l'erreur lisible, et vaut
-- documentation de ce que la fonction accepte.
-- ---------------------------------------------------------------------
create or replace function public.crm_buyer_record_treatment(
  p_interest_id uuid,
  p_call_outcome text,
  p_qualification text,
  p_qualification_reason text,
  p_note text,
  p_stage text,
  p_next_action_kind text,
  p_next_action_at timestamptz,
  p_next_action_title text,
  p_complete_task_id uuid
) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_profile uuid;
  v_contact uuid;
  v_old_qualif text;
  v_old_stage text;
  v_activity uuid;
  v_task uuid;
begin
  if v_uid is null then
    raise exception 'authentification requise' using errcode = '28000';
  end if;

  select i.buyer_profile_id, i.contact_id, i.qualification, i.pipeline_stage
    into v_profile, v_contact, v_old_qualif, v_old_stage
    from public.buyer_interests i where i.id = p_interest_id;

  if v_profile is null then
    raise exception 'manifestation introuvable' using errcode = '22023';
  end if;
  if not public.crm_buyer_can_operate(v_profile) then
    raise exception 'droits insuffisants sur ce dossier acquéreur' using errcode = '42501';
  end if;

  if p_call_outcome is not null then
    if p_call_outcome not in ('contact_etabli','sans_reponse','message_laisse','mauvais_numero') then
      raise exception 'résultat d''appel inconnu' using errcode = '22023';
    end if;
    insert into public.activities
      (occurred_at, contact_id, buyer_profile_id, interest_id, author_user_id, type, outcome, body)
    values
      (now(), v_contact, v_profile, p_interest_id, v_uid, 'appel', p_call_outcome,
       nullif(btrim(coalesce(p_note, '')), ''))
    returning id into v_activity;

    if p_call_outcome = 'mauvais_numero' then
      update public.contacts set phone_status = 'invalide' where id = v_contact;
    end if;
  elsif nullif(btrim(coalesce(p_note, '')), '') is not null then
    insert into public.activities
      (occurred_at, contact_id, buyer_profile_id, interest_id, author_user_id, type, body)
    values (now(), v_contact, v_profile, p_interest_id, v_uid, 'note', btrim(p_note))
    returning id into v_activity;
  end if;

  if p_qualification is not null then
    -- SEULE LIGNE CHANGÉE PAR CETTE MIGRATION : « qualifie » n'existe plus.
    if p_qualification not in ('a_qualifier','gros_potentiel','en_reflexion','non_qualifie') then
      raise exception 'qualification inconnue' using errcode = '22023';
    end if;
    if p_qualification = 'non_qualifie'
       and nullif(btrim(coalesce(p_qualification_reason, '')), '') is null then
      raise exception 'un motif est requis pour écarter un dossier' using errcode = '22023';
    end if;
    update public.buyer_interests
       set qualification = p_qualification,
           qualification_reason = nullif(btrim(coalesce(p_qualification_reason, '')), ''),
           qualification_by = v_uid,
           qualification_at = now()
     where id = p_interest_id;
  end if;

  if p_stage is not null and p_stage is distinct from v_old_stage then
    if p_stage not in ('nouveau','a_rappeler','en_discussion','visite','vivier') then
      raise exception 'cette étape passe par une action métier dédiée' using errcode = '22023';
    end if;
    if v_old_stage in ('gagne','perdu') then
      raise exception 'cette manifestation est close' using errcode = '22023';
    end if;
    update public.buyer_interests set pipeline_stage = p_stage where id = p_interest_id;
    perform public.crm_buyer_sync_profile_stage(v_profile);
  end if;

  if p_complete_task_id is not null then
    update public.tasks
       set status = 'fait', completed_at = now()
     where id = p_complete_task_id
       and buyer_profile_id = v_profile
       and status = 'a_faire';
  end if;

  if p_next_action_at is not null then
    if coalesce(p_next_action_kind, 'rappel') not in ('rappel','tache','visite') then
      raise exception 'type d''action inconnu' using errcode = '22023';
    end if;
    select t.id into v_task
      from public.tasks t
     where t.interest_id = p_interest_id
       and t.status = 'a_faire'
       and t.kind = coalesce(p_next_action_kind, 'rappel')
     order by t.due_at asc
     limit 1;

    if v_task is null then
      insert into public.tasks
        (opportunity_id, author_user_id, assignee_user_id, title, kind, status, due_at,
         buyer_profile_id, interest_id)
      values
        (null, v_uid, v_uid,
         coalesce(nullif(btrim(coalesce(p_next_action_title, '')), ''), 'Rappeler'),
         coalesce(p_next_action_kind, 'rappel'), 'a_faire', p_next_action_at,
         v_profile, p_interest_id)
      returning id into v_task;
    else
      update public.tasks
         set due_at = p_next_action_at,
             title = coalesce(nullif(btrim(coalesce(p_next_action_title, '')), ''), title)
       where id = v_task;
    end if;
  end if;

  update public.buyer_profiles set last_activity_at = now() where id = v_profile;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, old_value, new_value)
  values (v_uid, 'buyer_interest', p_interest_id, 'acquereur_traitement',
          jsonb_build_object('qualification', v_old_qualif, 'stage', v_old_stage),
          jsonb_build_object('qualification', coalesce(p_qualification, v_old_qualif),
                             'stage', coalesce(p_stage, v_old_stage),
                             'resultat_appel', p_call_outcome));

  return jsonb_build_object(
    'ok', true,
    'activity_id', v_activity,
    'task_id', v_task,
    'qualification', coalesce(p_qualification, v_old_qualif),
    'stage', coalesce(p_stage, v_old_stage)
  );
end;
$$;

-- Le piège de ce projet : `revoke ... from public` NE SUFFIT PAS. Supabase
-- accorde EXECUTE explicitement à `anon`, `authenticated` et `service_role`
-- par des privilèges par défaut ; il faut nommer `anon` pour le retirer.
revoke all on function public.crm_buyer_record_treatment(
  uuid, text, text, text, text, text, text, timestamptz, text, uuid
) from public, anon;

grant execute on function public.crm_buyer_record_treatment(
  uuid, text, text, text, text, text, text, timestamptz, text, uuid
) to authenticated;
