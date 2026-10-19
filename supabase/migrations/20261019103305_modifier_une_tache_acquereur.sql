-- MODIFIER UNE TACHE OUVERTE : INTITULE, ECHEANCE, RESPONSABLE.
--
-- Le CRM savait CREER une tache et la TERMINER, jamais la corriger. Tant qu un
-- second formulaire de creation vivait sur la fiche, on contournait : on
-- creait une tache de remplacement et on soldait l ancienne. Ce formulaire
-- disparait — il faisait saisir deux fois la meme decision — donc le moyen de
-- corriger une echeance doit exister pour de bon, sans quoi on retire une
-- capacite au lieu d en simplifier une.
--
-- Memes controles que `crm_buyer_set_task_status`, a la lettre : session
-- requise, tache rattachee a un dossier acquereur, et droit d operer dessus.
--
-- SEULES LES TACHES ENCORE A FAIRE sont modifiables. Une tache terminee est de
-- l historique : la reecrire changerait ce qui s est passe, et le journal
-- d activite cesserait de dire la verite.
--
-- Chaque parametre nul signifie « ne pas toucher a ce champ », SAUF l echeance,
-- qu on doit pouvoir effacer. D ou `p_effacer_echeance`, explicite : sans lui,
-- « enlever la date » et « ne pas y toucher » s ecriraient pareil.

create or replace function public.crm_buyer_update_task(
  p_task_id uuid,
  p_title text default null,
  p_due_at timestamptz default null,
  p_assignee_user_id uuid default null,
  p_effacer_echeance boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_profile uuid;
  v_statut text;
  v_titre text := nullif(btrim(coalesce(p_title, '')), '');
begin
  if v_uid is null then
    raise exception 'authentification requise' using errcode = '28000';
  end if;

  select buyer_profile_id, status into v_profile, v_statut
    from public.tasks where id = p_task_id;
  if v_profile is null then
    raise exception 'tâche acquéreur introuvable' using errcode = '22023';
  end if;
  if not public.crm_buyer_can_operate(v_profile) then
    raise exception 'droits insuffisants sur ce dossier acquéreur' using errcode = '42501';
  end if;
  if v_statut <> 'a_faire' then
    raise exception 'une tâche terminée ne se modifie plus' using errcode = '22023';
  end if;
  if p_title is not null and v_titre is null then
    raise exception 'un intitulé vide ne remplace pas un intitulé' using errcode = '22023';
  end if;

  update public.tasks set
    title            = coalesce(v_titre, title),
    due_at           = case when p_effacer_echeance then null
                            else coalesce(p_due_at, due_at) end,
    assignee_user_id = coalesce(p_assignee_user_id, assignee_user_id),
    updated_at       = now()
  where id = p_task_id;

  return jsonb_build_object('ok', true);
end;
$function$;

comment on function public.crm_buyer_update_task(uuid, text, timestamptz, uuid, boolean) is
  'Corrige une tâche acquéreur ENCORE A FAIRE : intitulé, échéance, responsable. Un paramètre nul laisse le champ inchangé ; `p_effacer_echeance` distingue « enlever la date » de « ne pas y toucher ». Une tâche terminée est de l''historique et refuse toute modification.';

revoke all on function public.crm_buyer_update_task(uuid, text, timestamptz, uuid, boolean) from public;
grant execute on function public.crm_buyer_update_task(uuid, text, timestamptz, uuid, boolean) to authenticated;
