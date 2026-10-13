-- =====================================================================
-- Traitement des appels : qualification par projet, résultats, tentatives
-- =====================================================================
--
-- Ce que cette migration rend possible : appeler un lead, consigner ce qui
-- s'est passé, qualifier, noter, programmer une relance — EN UNE SEULE
-- écriture, et passer au suivant.
--
-- Trois données étaient confondues et le sont désormais plus :
--
--   * le RÉSULTAT d'un appel      → une activité, horodatée, qui ne bouge plus
--   * la QUALIFICATION commerciale → un jugement, porté par la manifestation
--   * l'ÉTAPE du pipeline          → où en est l'affaire
--
-- Un gros potentiel injoignable reste un gros potentiel. C'est tout l'objet
-- de cette séparation.

-- ---------------------------------------------------------------------
-- 1. La qualification vit sur la MANIFESTATION, pas sur la personne
-- ---------------------------------------------------------------------
--
-- ATTENTION — le vocabulaire existant sur `buyer_profiles.qualification_status`
-- ('non_qualifie', 'en_cours', 'qualifie', 'ecarte') porte un sens DIFFÉRENT :
-- son « non_qualifie » veut dire « pas encore qualifié », alors qu'ici il veut
-- dire « écarté ». Réutiliser la colonne aurait inversé le sens d'un signal
-- rouge. On ouvre donc une colonne distincte, au nom distinct.

alter table public.buyer_interests
  add column if not exists qualification text not null default 'a_qualifier',
  add column if not exists qualification_reason text,
  add column if not exists qualification_by uuid references auth.users(id),
  add column if not exists qualification_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'buyer_interests_qualification_check'
  ) then
    alter table public.buyer_interests
      add constraint buyer_interests_qualification_check
      check (qualification in ('a_qualifier','gros_potentiel','qualifie','en_reflexion','non_qualifie'));
  end if;
end $$;

-- Un motif court est EXIGÉ pour écarter quelqu'un : « non qualifié » sans
-- raison ne s'explique ni au vendeur, ni trois semaines plus tard.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'buyer_interests_qualification_motif_check'
  ) then
    alter table public.buyer_interests
      add constraint buyer_interests_qualification_motif_check
      check (qualification <> 'non_qualifie' or qualification_reason is not null);
  end if;
end $$;

-- Aucun rattrapage automatique : la qualification est un jugement du
-- commercial. La déduire d'un budget déclaré produirait des « gros potentiel »
-- que personne n'a confirmés.

-- ---------------------------------------------------------------------
-- 2. L'historique devient lisible PAR PROJET
-- ---------------------------------------------------------------------
alter table public.activities
  add column if not exists interest_id uuid references public.buyer_interests(id) on delete cascade;

create index if not exists activities_interest_idx
  on public.activities (interest_id, occurred_at desc)
  where interest_id is not null;

-- ---------------------------------------------------------------------
-- 3. Un numéro invalide sort de la file d'appels — jusqu'à correction
-- ---------------------------------------------------------------------
alter table public.contacts
  add column if not exists phone_status text not null default 'ok';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'contacts_phone_status_check') then
    alter table public.contacts
      add constraint contacts_phone_status_check check (phone_status in ('ok','invalide'));
  end if;
end $$;

-- Corriger le numéro le rend appelable : inutile de penser à lever le drapeau.
create or replace function public.contacts_phone_status_reset()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.phone is distinct from old.phone then
    new.phone_status := 'ok';
  end if;
  return new;
end;
$$;

drop trigger if exists contacts_phone_status_reset_trg on public.contacts;
create trigger contacts_phone_status_reset_trg
  before update on public.contacts
  for each row execute function public.contacts_phone_status_reset();

-- ---------------------------------------------------------------------
-- 4. Enregistrer un traitement : UNE écriture, pas six
-- ---------------------------------------------------------------------
--
-- Le commercial raccroche et renseigne, dans le même geste : ce qui s'est
-- passé, ce qu'il en pense, ce qu'il note, quand il rappelle. Six allers-
-- retours réseau pour cela rendraient « Enregistrer et suivant » poussif, et
-- laisseraient un dossier à moitié écrit si l'un d'eux échouait.
--
-- Tous les paramètres sont OBLIGATOIRES dans la signature — aucune valeur par
-- défaut. C'est délibéré : une valeur par défaut ajoutée plus tard créerait une
-- seconde surcharge en production, que l'outil d'administration ne sait pas
-- supprimer. On a déjà payé cette dette sur `crm_buyer_create_task`.
create or replace function public.crm_buyer_record_treatment(
  p_interest_id uuid,
  p_call_outcome text,          -- null = aucun appel consigné
  p_qualification text,         -- null = qualification inchangée
  p_qualification_reason text,
  p_note text,                  -- null ou vide = aucune note
  p_stage text,                 -- null = étape inchangée
  p_next_action_kind text,      -- null = aucune prochaine action
  p_next_action_at timestamptz,
  p_next_action_title text,
  p_complete_task_id uuid       -- rappel que ce traitement solde
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

  -- --- Le résultat de l'appel : un fait, daté, qui ne se réécrit pas --------
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

    -- Un numéro qui ne mène nulle part quitte la file d'appels. Le dossier,
    -- lui, reste ouvert : on n'a pas perdu la personne, on a perdu un numéro.
    if p_call_outcome = 'mauvais_numero' then
      update public.contacts set phone_status = 'invalide' where id = v_contact;
    end if;
  elsif nullif(btrim(coalesce(p_note, '')), '') is not null then
    -- Une note sans appel reste une note : elle ne gonfle pas les tentatives.
    insert into public.activities
      (occurred_at, contact_id, buyer_profile_id, interest_id, author_user_id, type, body)
    values (now(), v_contact, v_profile, p_interest_id, v_uid, 'note', btrim(p_note))
    returning id into v_activity;
  end if;

  -- --- La qualification : un jugement, porté par le projet -----------------
  if p_qualification is not null then
    if p_qualification not in ('a_qualifier','gros_potentiel','qualifie','en_reflexion','non_qualifie') then
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

  -- --- L'étape : facultative, et jamais une rétrogradation subie -----------
  if p_stage is not null and p_stage is distinct from v_old_stage then
    -- Les étapes engageantes gardent leur action métier dédiée.
    if p_stage not in ('nouveau','a_rappeler','en_discussion','visite','vivier') then
      raise exception 'cette étape passe par une action métier dédiée' using errcode = '22023';
    end if;
    if v_old_stage in ('gagne','perdu') then
      raise exception 'cette manifestation est close' using errcode = '22023';
    end if;
    update public.buyer_interests set pipeline_stage = p_stage where id = p_interest_id;
    perform public.crm_buyer_sync_profile_stage(v_profile);
  end if;

  -- --- Le rappel soldé ------------------------------------------------------
  if p_complete_task_id is not null then
    update public.tasks
       set status = 'fait', completed_at = now()
     where id = p_complete_task_id
       and buyer_profile_id = v_profile
       and status = 'a_faire';
  end if;

  -- --- La prochaine action --------------------------------------------------
  if p_next_action_at is not null then
    if coalesce(p_next_action_kind, 'rappel') not in ('rappel','tache','visite') then
      raise exception 'type d''action inconnu' using errcode = '22023';
    end if;
    -- Deux rappels identiques sur le même dossier n'aident personne : on
    -- réutilise celui qui est déjà prévu au lieu d'en empiler un second.
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

-- ATTENTION — `revoke ... from public` NE SUFFIT PAS sur ce projet.
-- Supabase pose des privilèges par défaut qui accordent EXECUTE explicitement à
-- `anon`, `authenticated` et `service_role` sur toute nouvelle fonction du
-- schéma `public`. Un revoke adressé à `public` laisse donc ces trois grants
-- intacts : vérifié sur la base, `anon` conservait le droit d'exécution.
-- Il faut nommer `anon` explicitement.
revoke all on function public.crm_buyer_record_treatment(
  uuid, text, text, text, text, text, text, timestamptz, text, uuid) from public;
revoke all on function public.crm_buyer_record_treatment(
  uuid, text, text, text, text, text, text, timestamptz, text, uuid) from anon;
grant execute on function public.crm_buyer_record_treatment(
  uuid, text, text, text, text, text, text, timestamptz, text, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Ce que la liste doit savoir de l'historique, agrégé EN BASE
-- ---------------------------------------------------------------------
--
-- Rapatrier toutes les activités pour compter des tentatives côté serveur Node
-- fait grossir la charge avec le nombre d'appels passés, sans rien apporter.
-- `security_invoker` : la vue est lue avec les droits de l'appelant, la RLS des
-- activités s'applique donc comme partout ailleurs.
--
-- Limite assumée : les activités antérieures à cette migration n'ont pas de
-- `interest_id` et ne sont donc comptées dans AUCUNE tentative par projet.
-- Elles restent visibles dans l'historique du dossier. Inventer un rattachement
-- aurait attribué à un projet des appels passés pour un autre.
create or replace view public.crm_buyer_interest_activity
with (security_invoker = true) as
select
  a.interest_id,
  count(*) filter (where a.type in ('appel', 'tentative_appel')) as call_attempts,
  max(a.occurred_at) filter (where a.type in ('appel', 'tentative_appel')) as last_call_at,
  max(a.occurred_at) as last_activity_at,
  (array_agg(a.outcome order by a.occurred_at desc)
     filter (where a.type in ('appel','tentative_appel') and a.outcome is not null))[1] as last_call_outcome,
  (array_agg(a.body order by a.occurred_at desc)
     filter (where a.body is not null and btrim(a.body) <> ''))[1] as last_note,
  (array_agg(a.occurred_at order by a.occurred_at desc)
     filter (where a.body is not null and btrim(a.body) <> ''))[1] as last_note_at,
  (array_agg(a.author_user_id order by a.occurred_at desc)
     filter (where a.body is not null and btrim(a.body) <> ''))[1] as last_note_by
from public.activities a
where a.interest_id is not null
group by a.interest_id;

revoke all on public.crm_buyer_interest_activity from public;
revoke all on public.crm_buyer_interest_activity from anon;
grant select on public.crm_buyer_interest_activity to authenticated;
