-- =============================================================================
-- Le suivi commercial se fait PAR PROJET, pas par personne
-- =============================================================================
--
-- `buyer_profiles.pipeline_stage` portait UNE étape pour toute la personne.
-- Quelqu'un intéressé par Villa Verdun ET Villa Jean Jaurès n'avait donc qu'une
-- seule position commerciale : caler une visite à Verdun faisait aussi passer
-- son intérêt Jean Jaurès à « Visite », et le pipeline global ne pouvait pas
-- dire de quel projet une carte parlait.
--
-- La fiche CONTACT reste unique — c'est la même personne, ses coordonnées ne
-- sont pas dupliquées. Seul le SUIVI se dédouble, sur la manifestation.
--
-- `buyer_profiles.pipeline_stage` demeure, mais DÉRIVÉE : elle vaut la plus
-- avancée des manifestations de la personne, recalculée à chaque changement.
-- La supprimer aurait cassé les lectures existantes ; la laisser figée en
-- aurait fait un chiffre faux. Le CRM Acquéreurs lit désormais la manifestation.

alter table public.buyer_interests
  add column if not exists pipeline_stage text not null default 'nouveau',
  add column if not exists outcome text,
  add column if not exists outcome_reason text,
  add column if not exists outcome_recorded_by uuid,
  add column if not exists outcome_recorded_at timestamptz;

do $$
begin
  alter table public.buyer_interests
    add constraint buyer_interests_pipeline_stage_check
    check (pipeline_stage = any (array['nouveau','a_rappeler','en_discussion','visite','offre','vivier','gagne','perdu']));
  alter table public.buyer_interests
    add constraint buyer_interests_outcome_check
    check (outcome is null or outcome = any (array['gagne','perdu']));
exception when duplicate_object then null;
end $$;

-- Reprise : chaque manifestation hérite de l'étape de sa personne. Sans elle,
-- tous les dossiers existants seraient retombés à « nouveau ».
update public.buyer_interests i
   set pipeline_stage = p.pipeline_stage,
       outcome = p.outcome,
       outcome_reason = p.outcome_reason,
       outcome_recorded_by = p.outcome_recorded_by,
       outcome_recorded_at = p.outcome_recorded_at
  from public.buyer_profiles p
 where p.id = i.buyer_profile_id;

-- Une tâche peut appartenir à UN projet (une visite) ou à la personne entière
-- (un rappel général). Sans cette distinction, caler une visite à Verdun aurait
-- donné « prochaine action : visite » à la ligne Jean Jaurès de la même
-- personne.
alter table public.tasks
  add column if not exists interest_id uuid references public.buyer_interests(id) on delete set null;
create index if not exists tasks_interest_idx on public.tasks (interest_id) where interest_id is not null;

-- --- Ordre des étapes, pour savoir laquelle est « la plus avancée » ----------
create or replace function public.crm_buyer_interest_rank(p_stage text)
returns int language sql immutable
as $$
  select case p_stage
    when 'perdu' then 0
    when 'vivier' then 1
    when 'nouveau' then 2
    when 'a_rappeler' then 3
    when 'en_discussion' then 4
    when 'visite' then 5
    when 'offre' then 6
    when 'gagne' then 7
    else 2 end;
$$;

create or replace function public.crm_buyer_sync_profile_stage(p_buyer_profile_id uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_stage text;
begin
  select i.pipeline_stage into v_stage
    from public.buyer_interests i
   where i.buyer_profile_id = p_buyer_profile_id
   order by public.crm_buyer_interest_rank(i.pipeline_stage) desc, i.created_at desc
   limit 1;
  if v_stage is not null then
    update public.buyer_profiles set pipeline_stage = v_stage where id = p_buyer_profile_id;
  end if;
end;
$$;

-- --- Déplacer UNE manifestation ----------------------------------------------
create or replace function public.crm_buyer_set_interest_stage(p_interest_id uuid, p_stage text)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_old text; v_profile uuid;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;

  select i.buyer_profile_id, i.pipeline_stage into v_profile, v_old
    from public.buyer_interests i where i.id = p_interest_id;
  if v_profile is null then raise exception 'manifestation introuvable' using errcode = '22023'; end if;

  if not public.crm_buyer_can_operate(v_profile) then
    raise exception 'droits insuffisants sur ce dossier acquéreur' using errcode = '42501';
  end if;
  -- Offre et résultat engagent : ils passent par une action dédiée, avec motif
  -- et audit. Un simple déplacement de carte ne les atteint pas.
  if p_stage in ('offre', 'gagne', 'perdu') then
    raise exception 'cette étape passe par une action métier dédiée (offre / résultat)'
      using errcode = '22023';
  end if;
  if p_stage not in ('nouveau','a_rappeler','en_discussion','visite','vivier') then
    raise exception 'étape inconnue' using errcode = '22023';
  end if;
  if v_old in ('gagne', 'perdu') then
    raise exception 'cette manifestation est close : rouvrez-la depuis une action métier dédiée'
      using errcode = '22023';
  end if;

  update public.buyer_interests set pipeline_stage = p_stage where id = p_interest_id;
  perform public.crm_buyer_sync_profile_stage(v_profile);

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, old_value, new_value)
  values (v_uid, 'buyer_interest', p_interest_id, 'acquereur_stade',
          jsonb_build_object('stage', v_old), jsonb_build_object('stage', p_stage));

  return jsonb_build_object('ok', true, 'stage', p_stage);
end;
$$;

revoke all on function public.crm_buyer_set_interest_stage(uuid, text) from public;
grant execute on function public.crm_buyer_set_interest_stage(uuid, text) to authenticated;
revoke all on function public.crm_buyer_sync_profile_stage(uuid) from public;
revoke all on function public.crm_buyer_interest_rank(text) from public;
grant execute on function public.crm_buyer_interest_rank(text) to authenticated;

-- --- Tâche rattachée à une manifestation -------------------------------------
--
-- ATTENTION — DETTE CONNUE : cette fonction existe en production sous DEUX
-- signatures (5 et 6 paramètres). L'outil d'administration utilisé ne sait pas
-- exécuter `drop function`, et Postgres refuse de retirer une valeur par défaut
-- d'une fonction existante. La version à 5 paramètres a donc été transformée en
-- simple relais vers celle-ci, pour qu'elles ne puissent pas diverger.
--
-- Conséquence : l'application transmet TOUJOURS les six paramètres. Un appel
-- partiel correspondrait aux deux signatures et serait rejeté par PostgREST.
-- Sur une base neuve, seule la version à 6 paramètres est créée.
--
-- À faire dès qu'un accès psql est disponible :
--   drop function public.crm_buyer_create_task(uuid, text, text, timestamptz, uuid);
create or replace function public.crm_buyer_create_task(
  p_buyer_profile_id uuid,
  p_title text,
  p_kind text default 'rappel',
  p_due_at timestamptz default null,
  p_assignee_user_id uuid default null,
  p_interest_id uuid default null)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_kind text; v_id uuid; v_interest uuid;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.crm_buyer_can_operate(p_buyer_profile_id) then
    raise exception 'droits insuffisants sur ce dossier acquéreur' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_title, '')), '') is null then
    raise exception 'intitulé requis' using errcode = '22023';
  end if;
  if not exists (select 1 from public.buyer_profiles where id = p_buyer_profile_id) then
    raise exception 'dossier introuvable' using errcode = '22023';
  end if;

  -- Une manifestation d'un AUTRE dossier rattacherait la tâche au mauvais
  -- projet : on ne retient l'identifiant que s'il appartient bien à ce dossier.
  if p_interest_id is not null then
    select i.id into v_interest from public.buyer_interests i
     where i.id = p_interest_id and i.buyer_profile_id = p_buyer_profile_id;
    if v_interest is null then
      raise exception 'manifestation étrangère à ce dossier' using errcode = '22023';
    end if;
  end if;

  v_kind := case when p_kind in ('rappel', 'tache', 'visite') then p_kind else 'rappel' end;

  insert into public.tasks
    (buyer_profile_id, interest_id, author_user_id, assignee_user_id, title, kind, due_at)
  values (p_buyer_profile_id, v_interest, v_uid, coalesce(p_assignee_user_id, v_uid),
          left(btrim(p_title), 300), v_kind, p_due_at)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;
