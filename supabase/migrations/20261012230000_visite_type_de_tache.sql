-- =============================================================================
-- La visite devient un type de tâche à part entière
-- =============================================================================
--
-- Une visite n'était inscrite nulle part en tant que telle. `planifierVisite`
-- écrivait un simple « rappel » et déplaçait le dossier à l'étape « visite » :
-- le fait « visite calée le 14 à 15 h » ne se reconstituait qu'en recoupant une
-- tâche et un stade de pipeline. Dès que le dossier avançait (discussion,
-- offre), la visite devenait introuvable, et l'agenda ne pouvait pas la
-- montrer.
--
-- `kind = 'visite'` nomme le fait là où il se produit. L'agenda des visites le
-- lit directement, sans dépendre de l'étape du pipeline ni de l'intitulé saisi.
--
-- Aucune reprise de données : la table `tasks` est vide à l'application de
-- cette migration (vérifié), il n'existe donc aucune visite ancienne à
-- requalifier.
--
-- Le CRM Mandats n'est pas concerné : ses rendez-vous d'estimation vivent dans
-- `estimation_appointments` et ne passent pas par `tasks`.

alter table public.tasks drop constraint if exists tasks_kind_check;
alter table public.tasks
  add constraint tasks_kind_check
  check (kind in ('rappel', 'tache', 'visite'));

-- La fonction ramenait silencieusement tout type inconnu à « rappel » : sans
-- cette reprise, `p_kind => 'visite'` aurait été accepté par l'application et
-- écrit comme un rappel, sans la moindre erreur pour le signaler.
create or replace function public.crm_buyer_create_task(
  p_buyer_profile_id uuid,
  p_title text,
  p_kind text default 'rappel',
  p_due_at timestamptz default null,
  p_assignee_user_id uuid default null)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_kind text; v_id uuid;
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

  v_kind := case when p_kind in ('rappel', 'tache', 'visite') then p_kind else 'rappel' end;

  insert into public.tasks
    (buyer_profile_id, author_user_id, assignee_user_id, title, kind, due_at)
  values (p_buyer_profile_id, v_uid, coalesce(p_assignee_user_id, v_uid),
          left(btrim(p_title), 300), v_kind, p_due_at)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- L'agenda des visites interroge « les visites à venir, toutes personnes
-- confondues sur mon périmètre » : l'index porte sur l'échéance, filtré sur le
-- seul type concerné.
create index if not exists tasks_visites_a_venir_idx
  on public.tasks (due_at)
  where kind = 'visite' and buyer_profile_id is not null;
