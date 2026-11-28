-- =============================================================================
-- Fiche acquéreur : les formulaires « Offre », « Résultat commercial » et
-- « Rouvrir » remis en état, sur les neuf étapes du pipeline.
--
-- LA PANNE. Le 12/10/2026, `20261012170000_pipeline_acquereur_huit_colonnes`
-- a réécrit le corps de ces trois fonctions vers les clés du pipeline à huit
-- colonnes (`offre`, `gagne`, `perdu`, `visite`). Le pipeline compte neuf
-- étapes depuis le 10/11/2026 (`crm_etapes_acquereur()`), sans aucune de ces
-- clés : la contrainte `buyer_profiles_pipeline_stage_check` refuse chaque
-- appel (23514). Les trois formulaires de la fiche échouent ; aucune offre ni
-- aucun montant ne peut être saisi, aucun résultat noté, aucun dossier rouvert.
--
-- LA RÈGLE, décidée par Victor le 23/11/2026 :
--  - Offre        → « Offre en cours » (`offre_en_cours`), l'offre notée sur
--                   la personne (bien, montant), comme avant ;
--  - Perdu        → « Pas intéressé » (`pas_interesse`), motif obligatoire ;
--  - Gagné        → l'étape NE CHANGE PAS : le résultat « gagné » est noté sur
--                   la fiche (`outcome`), la carte reste dans sa colonne ;
--  - Rouvrir      → « À rappeler » (`a_rappeler`), résultat effacé, motif
--                   obligatoire.
--
-- Le reste de chaque fonction est inchangé : mêmes signatures, mêmes contrôles
-- de droits (SECURITY DEFINER, `search_path` fixé), mêmes écritures et même
-- journal ; le journal de l'offre dit en plus l'étape d'arrivée.
--
-- STRICTEMENT LIMITÉE : trois fonctions remplacées (`create or replace`, droits
-- conservés et rappelés) ; aucune table, aucune colonne, aucune donnée
-- touchée. Rejouable.
-- =============================================================================

begin;

set local lock_timeout = '2s';

-- -----------------------------------------------------------------------------
-- 1. Offre → « Offre en cours »
-- -----------------------------------------------------------------------------
create or replace function public.crm_buyer_record_offer(
  p_buyer_profile_id uuid,
  p_property_id      uuid   default null,
  p_amount_cents     bigint default null,
  p_note             text   default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_old text;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.crm_buyer_can_operate(p_buyer_profile_id) then
    raise exception 'droits insuffisants sur ce dossier acquéreur' using errcode = '42501';
  end if;
  if p_amount_cents is not null and p_amount_cents < 0 then
    raise exception 'montant invalide' using errcode = '22023';
  end if;
  if p_property_id is not null
     and not exists (select 1 from public.properties where id = p_property_id) then
    raise exception 'bien introuvable' using errcode = '22023';
  end if;

  select pipeline_stage into v_old from public.buyer_profiles where id = p_buyer_profile_id;
  if v_old is null then raise exception 'dossier introuvable' using errcode = '22023'; end if;

  update public.buyer_profiles set
    pipeline_stage = 'offre_en_cours',
    offer_property_id = p_property_id,
    offer_amount_cents = p_amount_cents,
    offer_recorded_by = v_uid,
    offer_recorded_at = now()
  where id = p_buyer_profile_id;

  insert into public.activities (buyer_profile_id, author_user_id, type, body)
  values (p_buyer_profile_id, v_uid, 'note',
          nullif(btrim(left(coalesce(p_note, ''), 4000)), ''));

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, old_value, new_value)
  values (v_uid, 'buyer_profile', p_buyer_profile_id, 'acquereur_offre',
          jsonb_build_object('stage', v_old),
          jsonb_build_object('stage', 'offre_en_cours',
                             'property_id', p_property_id, 'amount_cents', p_amount_cents));

  return jsonb_build_object('ok', true, 'stage', 'offre_en_cours');
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Résultat commercial : perdu → « Pas intéressé » ; gagné → étape inchangée
-- -----------------------------------------------------------------------------
create or replace function public.crm_buyer_record_outcome(
  p_buyer_profile_id uuid,
  p_outcome          text,
  p_reason           text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_old text; v_stage text;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.crm_can_decide() then
    raise exception 'seul un administrateur ou un manager enregistre le résultat d''un dossier acquéreur'
      using errcode = '42501';
  end if;
  if not public.crm_buyer_profile_access(p_buyer_profile_id) then
    raise exception 'droits insuffisants sur ce dossier acquéreur' using errcode = '42501';
  end if;
  if p_outcome not in ('gagne', 'perdu') then
    raise exception 'résultat invalide' using errcode = '22023';
  end if;
  if p_outcome = 'perdu' and nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'un motif de perte est obligatoire' using errcode = '22023';
  end if;

  select pipeline_stage into v_old from public.buyer_profiles where id = p_buyer_profile_id;
  if v_old is null then raise exception 'dossier introuvable' using errcode = '22023'; end if;

  -- Gagné : la carte reste dans sa colonne ; perdu : « Pas intéressé ».
  v_stage := case when p_outcome = 'gagne' then v_old else 'pas_interesse' end;

  update public.buyer_profiles set
    outcome = p_outcome,
    outcome_reason = nullif(btrim(left(coalesce(p_reason, ''), 2000)), ''),
    outcome_recorded_by = v_uid,
    outcome_recorded_at = now(),
    pipeline_stage = v_stage
  where id = p_buyer_profile_id;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, old_value, new_value)
  values (v_uid, 'buyer_profile', p_buyer_profile_id, 'acquereur_resultat',
          jsonb_build_object('stage', v_old),
          jsonb_build_object('outcome', p_outcome, 'stage', v_stage));

  return jsonb_build_object('ok', true, 'outcome', p_outcome, 'stage', v_stage);
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Rouvrir → « À rappeler »
-- -----------------------------------------------------------------------------
create or replace function public.crm_buyer_reopen(
  p_buyer_profile_id uuid,
  p_reason           text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_old text;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.crm_can_decide() then
    raise exception 'seul un administrateur ou un manager rouvre un dossier acquéreur'
      using errcode = '42501';
  end if;
  if not public.crm_buyer_profile_access(p_buyer_profile_id) then
    raise exception 'droits insuffisants sur ce dossier acquéreur' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'un motif est requis pour rouvrir un dossier' using errcode = '22023';
  end if;

  select pipeline_stage into v_old from public.buyer_profiles where id = p_buyer_profile_id;
  if v_old is null then raise exception 'dossier introuvable' using errcode = '22023'; end if;

  update public.buyer_profiles set
    pipeline_stage = 'a_rappeler',
    outcome = null, outcome_reason = null,
    outcome_recorded_by = null, outcome_recorded_at = null
  where id = p_buyer_profile_id;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, old_value, new_value)
  values (v_uid, 'buyer_profile', p_buyer_profile_id, 'acquereur_stade',
          jsonb_build_object('stage', v_old),
          jsonb_build_object('stage', 'a_rappeler',
                             'reason', left(btrim(p_reason), 2000), 'reopened', true));

  return jsonb_build_object('ok', true, 'stage', 'a_rappeler');
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. DROITS : ceux d'aujourd'hui, rappelés (`create or replace` les conserve).
--    Un client connecté peut appeler ; jamais anon ; les contrôles de rôle et
--    de dossier sont dans chaque fonction.
-- -----------------------------------------------------------------------------
revoke all on function public.crm_buyer_record_offer(uuid, uuid, bigint, text) from public, anon;
revoke all on function public.crm_buyer_record_outcome(uuid, text, text) from public, anon;
revoke all on function public.crm_buyer_reopen(uuid, text) from public, anon;

grant execute on function public.crm_buyer_record_offer(uuid, uuid, bigint, text) to authenticated, service_role;
grant execute on function public.crm_buyer_record_outcome(uuid, text, text) to authenticated, service_role;
grant execute on function public.crm_buyer_reopen(uuid, text) to authenticated, service_role;

commit;
