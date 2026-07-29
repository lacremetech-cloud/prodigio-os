-- =============================================================================
-- Prodigio OS — Migration 20260729160000_mandate_scoring
--
-- Préqualification : deux scores DISTINCTS (0–100), calculés CÔTÉ BASE (source
-- de vérité, non falsifiables depuis le navigateur), déterministes et versionnés.
--   - compatibility : adéquation de la PROPRIÉTÉ avec le Système Prodigio ;
--   - maturity      : maturité du PROJET de vente.
-- En sont déduites une PRIORITÉ opérationnelle (interne) et une APPRÉCIATION
-- publique qualitative (jamais de « non éligible » automatique).
--
-- Cette migration est ADDITIVE au-dessus de 20260729120000_mandate_funnel_capture.
-- Elle NE modifie ni la RLS, ni les GRANT, ni la neutralité de la réponse
-- publique ({ accepted: true }). Les scores sont STOCKÉS, jamais renvoyés.
--
-- ⚠️ Les constantes de scoring reflètent `src/modules/mandates/scoring/config.ts`
-- (SCORE_VERSION = mandate-scoring-v1). Toute évolution incrémente la version des
-- deux côtés. Le « seuil premium » n'est PAS une constante € : il est porté par
-- la répartition de points entre bandes de valeur (docs/05 #6, configurable).
--
-- Application : voir docs/07-SUPABASE-SETUP.md. NE PAS appliquer sans contrôle.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Fonction déterministe de scoring (miroir SQL de la logique TypeScript).
-- IMMUTABLE : mêmes entrées → mêmes sorties. N'utilise que des built-ins.
-- -----------------------------------------------------------------------------
create or replace function public.compute_mandate_scores(
  p_property_type    text,
  p_value_band       text,
  p_sale_horizon     text,
  p_mandate_situation text
)
returns jsonb
language sql
immutable
set search_path = pg_catalog, pg_temp
as $$
  with pts as (
    select
      coalesce(case p_value_band
        when 'plus_2m' then 70 when '1_2m_2m' then 64 when '800k_1_2m' then 55
        when '500k_800k' then 32 when 'moins_500k' then 12
        when 'accompagnement_estimation' then 40 else 0 end, 0) as v_value,
      coalesce(case p_property_type
        when 'villa_architecte' then 30 when 'domaine_caractere' then 30
        when 'chalet' then 28 when 'appartement_exception' then 27
        when 'autre' then 18 else 0 end, 0) as v_type,
      coalesce(case p_sale_horizon
        when 'des_que_possible' then 70 when 'trois_mois' then 58
        when 'six_mois' then 38 when 'en_reflexion' then 15 else 0 end, 0) as v_horizon,
      coalesce(case p_mandate_situation
        when 'mandat_simple' then 30 when 'aucun_mandat' then 26
        when 'mandat_exclusif' then 22 when 'autre' then 14 else 0 end, 0) as v_mandate
  ),
  scored as (
    select
      least(100, greatest(0, v_value + v_type)) as compat,
      least(100, greatest(0, v_horizon + v_mandate)) as maturity,
      v_value, v_type, v_horizon, v_mandate,
      (p_value_band = 'accompagnement_estimation') as needs_estimation
    from pts
  ),
  banded as (
    select *, (compat >= 60) as compat_high, (maturity >= 55) as maturity_high
    from scored
  )
  select jsonb_build_object(
    'score_version', 'mandate-scoring-v1',
    'economic_ruleset_version', 'economic-baseline-v1',
    'compatibility', jsonb_build_object(
      'score', compat,
      'band', case when compat_high then 'haute' else 'basse' end,
      'factors', jsonb_build_array(
        jsonb_build_object('key','value_band','value',p_value_band,'points',v_value,'max',70),
        jsonb_build_object('key','property_type','value',p_property_type,'points',v_type,'max',30))),
    'maturity', jsonb_build_object(
      'score', maturity,
      'band', case when maturity_high then 'haute' else 'basse' end,
      'factors', jsonb_build_array(
        jsonb_build_object('key','sale_horizon','value',p_sale_horizon,'points',v_horizon,'max',70),
        jsonb_build_object('key','mandate_situation','value',p_mandate_situation,'points',v_mandate,'max',30))),
    'priority', case
      when compat_high and maturity_high then 'rappel_prioritaire'
      when compat_high and not maturity_high then 'nurturing'
      when not compat_high and maturity_high then 'circuit_partenaire'
      else 'suivi_long_terme' end,
    'appreciation', case
      when needs_estimation then 'analyse_personnalisee'
      when compat >= 60 then 'fort_potentiel'
      when compat >= 35 then 'a_confirmer'
      else 'analyse_personnalisee' end,
    'needs_estimation', needs_estimation
  )
  from banded;
$$;

comment on function public.compute_mandate_scores(text, text, text, text) is
  'Scoring déterministe et versionné (mandate-scoring-v1). Deux scores distincts (compatibilité propriété / maturité projet), priorité opérationnelle et appréciation publique. Miroir de src/modules/mandates/scoring/config.ts.';

-- Interne : appelée uniquement par submit_mandate_funnel (SECURITY DEFINER).
revoke all on function public.compute_mandate_scores(text, text, text, text) from public;

-- -----------------------------------------------------------------------------
-- Colonnes de scoring — soumission (photographie immuable, versionnée).
-- -----------------------------------------------------------------------------
alter table public.funnel_submissions
  add column if not exists contact_recall_preference text,
  add column if not exists compatibility_score int,
  add column if not exists maturity_score int,
  add column if not exists operational_priority text,
  add column if not exists public_appreciation text,
  add column if not exists score_version text,
  add column if not exists score_breakdown jsonb;

alter table public.funnel_submissions
  drop constraint if exists funnel_submissions_recall_pref_check,
  add constraint funnel_submissions_recall_pref_check check (
    contact_recall_preference is null or contact_recall_preference in (
      'des_que_possible', 'matin', 'apres_midi', 'debut_soiree')),
  drop constraint if exists funnel_submissions_priority_check,
  add constraint funnel_submissions_priority_check check (
    operational_priority is null or operational_priority in (
      'rappel_prioritaire', 'nurturing', 'circuit_partenaire', 'suivi_long_terme')),
  drop constraint if exists funnel_submissions_appreciation_check,
  add constraint funnel_submissions_appreciation_check check (
    public_appreciation is null or public_appreciation in (
      'fort_potentiel', 'a_confirmer', 'analyse_personnalisee'));

-- -----------------------------------------------------------------------------
-- Colonnes de recommandation — opportunité (exploitables par le futur CRM).
-- La segmentation VALIDÉE reste humaine : `segment` demeure 'non_determine'.
-- -----------------------------------------------------------------------------
alter table public.opportunities
  add column if not exists recommended_priority text,
  add column if not exists compatibility_score int,
  add column if not exists maturity_score int,
  add column if not exists score_version text;

alter table public.opportunities
  drop constraint if exists opportunities_recommended_priority_check,
  add constraint opportunities_recommended_priority_check check (
    recommended_priority is null or recommended_priority in (
      'rappel_prioritaire', 'nurturing', 'circuit_partenaire', 'suivi_long_terme'));

-- =============================================================================
-- Fonction de dépôt — MISE À JOUR : calcule et stocke les scores côté base.
--   Les scores sont recalculés depuis les réponses validées : tout score fourni
--   dans le payload est IGNORÉ (impossible d'imposer un score depuis le navigateur).
--   Réponse publique inchangée : { accepted: true }.
-- =============================================================================
create or replace function public.submit_mandate_funnel(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_idempotency_key   text;
  v_email             text := nullif(lower(trim(payload->>'contact_email')), '');
  v_phone             text := nullif(trim(payload->>'contact_phone'), '');
  v_consent           boolean;
  v_pref              text;
  v_recall            text;
  v_property_type     text;
  v_value_band        text;
  v_sale_horizon      text;
  v_mandate_situation text;
  v_channels          text[];
  v_scores            jsonb;
  v_compat            int;
  v_maturity          int;
  v_priority          text;
  v_appreciation      text;
  v_contact_id        uuid;
  v_opportunity_id    uuid;
  v_submission_id     uuid;
  v_resolution        text;
begin
  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'payload invalide' using errcode = '22023';
  end if;
  if length(payload::text) > 65536 then
    raise exception 'payload trop volumineux' using errcode = '22001';
  end if;

  v_idempotency_key := left(nullif(payload->>'idempotency_key', ''), 200);
  if v_idempotency_key is null then
    raise exception 'idempotency_key manquant' using errcode = '22023';
  end if;

  v_email := left(v_email, 320);
  v_phone := left(v_phone, 64);
  v_consent := lower(coalesce(payload->>'consent_given', '')) in ('true', 't', '1', 'yes', 'on');

  -- Énumérations validées (valeur inconnue → null, dégradation propre).
  v_property_type := (case when payload->>'property_type' = any (array[
    'villa_architecte','appartement_exception','chalet','domaine_caractere','autre'])
    then payload->>'property_type' end);
  v_value_band := (case when payload->>'estimated_value_band' = any (array[
    'moins_500k','500k_800k','800k_1_2m','1_2m_2m','plus_2m','accompagnement_estimation'])
    then payload->>'estimated_value_band' end);
  v_sale_horizon := (case when payload->>'sale_horizon' = any (array[
    'des_que_possible','trois_mois','six_mois','en_reflexion'])
    then payload->>'sale_horizon' end);
  v_mandate_situation := (case when payload->>'mandate_situation' = any (array[
    'aucun_mandat','mandat_simple','mandat_exclusif','autre'])
    then payload->>'mandate_situation' end);
  v_pref := (case when payload->>'contact_preference' = any (array[
    'telephone','email','indifferent']) then payload->>'contact_preference' end);
  v_recall := (case when payload->>'contact_recall_preference' = any (array[
    'des_que_possible','matin','apres_midi','debut_soiree'])
    then payload->>'contact_recall_preference' end);

  v_channels := case
    when v_pref = 'telephone' then array['telephone']
    when v_pref = 'email' then array['email']
    else array['telephone', 'email']
  end;

  -- Scores AUTORITAIRES recalculés côté base (jamais depuis le payload).
  v_scores := public.compute_mandate_scores(
    v_property_type, v_value_band, v_sale_horizon, v_mandate_situation);
  v_compat := (v_scores->'compatibility'->>'score')::int;
  v_maturity := (v_scores->'maturity'->>'score')::int;
  v_priority := v_scores->>'priority';
  v_appreciation := v_scores->>'appreciation';

  -- 1) Soumission originale (idempotente).
  insert into public.funnel_submissions (
    funnel_key, funnel_version, landing, variant, idempotency_key,
    raw_answers, normalized_answers,
    property_type, location_city, location_postal_code, location_country,
    estimated_value_band, sale_horizon, mandate_situation,
    contact_first_name, contact_last_name, contact_email, contact_email_raw,
    contact_phone, contact_phone_raw, contact_preference, contact_recall_preference,
    consent_given, consent_notice_version,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content,
    fbclid, gclid, origin_url, referrer, first_touch, last_touch, user_agent,
    processing_status,
    compatibility_score, maturity_score, operational_priority, public_appreciation,
    score_version, score_breakdown
  ) values (
    'mandate_owner', 'v1', '/proprietaire',
    left(nullif(payload->>'variant', ''), 60), v_idempotency_key,
    coalesce(payload->'raw_answers', '{}'::jsonb),
    coalesce(payload->'normalized_answers', '{}'::jsonb),
    v_property_type, left(nullif(payload->>'location_city', ''), 160),
    left(nullif(payload->>'location_postal_code', ''), 32),
    left(nullif(payload->>'location_country', ''), 120),
    v_value_band, v_sale_horizon, v_mandate_situation,
    left(nullif(payload->>'contact_first_name', ''), 120),
    left(nullif(payload->>'contact_last_name', ''), 120),
    v_email, left(nullif(payload->>'contact_email_raw', ''), 320),
    v_phone, left(nullif(payload->>'contact_phone_raw', ''), 64),
    v_pref, v_recall,
    v_consent, left(nullif(payload->>'consent_notice_version', ''), 60),
    left(nullif(payload->>'utm_source', ''), 300), left(nullif(payload->>'utm_medium', ''), 300),
    left(nullif(payload->>'utm_campaign', ''), 300), left(nullif(payload->>'utm_term', ''), 300),
    left(nullif(payload->>'utm_content', ''), 300),
    left(nullif(payload->>'fbclid', ''), 512), left(nullif(payload->>'gclid', ''), 512),
    left(nullif(payload->>'origin_url', ''), 2048), left(nullif(payload->>'referrer', ''), 2048),
    payload->'first_touch', payload->'last_touch',
    left(nullif(payload->>'user_agent', ''), 1024),
    'nouveau',
    v_compat, v_maturity, v_priority, v_appreciation,
    v_scores->>'score_version', v_scores
  )
  on conflict (idempotency_key) do nothing
  returning id into v_submission_id;

  if v_submission_id is null then
    return jsonb_build_object('accepted', true);
  end if;

  -- 2) Résolution du contact (dédoublonnage conservateur par e-mail uniquement).
  if v_email is not null then
    select id into v_contact_id
    from public.contacts
    where lower(email) = v_email
    order by created_at asc
    limit 1;
  end if;

  if v_contact_id is null then
    insert into public.contacts (
      kind, first_name, last_name, email, phone, preferred_channel, status
    ) values (
      'personne_physique',
      left(nullif(payload->>'contact_first_name', ''), 120),
      left(nullif(payload->>'contact_last_name', ''), 120),
      v_email, v_phone, v_pref, 'nouveau'
    )
    returning id into v_contact_id;
    v_resolution := 'nouveau_contact';
  else
    v_resolution := 'contact_existant';
  end if;

  -- 3) Opportunité (stade/segment/statut serveur). La segmentation VALIDÉE reste
  -- humaine ; on ne stocke qu'une RECOMMANDATION de priorité et les scores.
  insert into public.opportunities (
    pipeline_stage, segment, processing_status, source,
    property_type, location_city, location_postal_code, location_country,
    estimated_value_band, sale_horizon, mandate_situation,
    recommended_priority, compatibility_score, maturity_score, score_version
  ) values (
    'nouveau', 'non_determine', 'non_affecte', 'funnel_mandataire',
    v_property_type, left(nullif(payload->>'location_city', ''), 160),
    left(nullif(payload->>'location_postal_code', ''), 32),
    left(nullif(payload->>'location_country', ''), 120),
    v_value_band, v_sale_horizon, v_mandate_situation,
    v_priority, v_compat, v_maturity, v_scores->>'score_version'
  )
  returning id into v_opportunity_id;

  -- 4) Relation opportunité ↔ contact.
  insert into public.opportunity_contacts (opportunity_id, contact_id, role, is_primary)
  values (v_opportunity_id, v_contact_id, 'proprietaire', true);

  -- 5) PrivacyRecord (preuve ; base légale À VALIDER, conformité NON présumée).
  insert into public.privacy_records (
    submission_id, contact_id, purpose, legal_basis, notice_version, notice_text,
    controllers, recipients, authorized_channels, choice, choice_source, proof, do_not_contact
  ) values (
    v_submission_id, v_contact_id,
    'prise_de_contact_projet_vente',
    'a_valider_juridiquement',
    left(nullif(payload->>'consent_notice_version', ''), 60),
    left(nullif(payload->>'consent_notice_text', ''), 2000),
    'Prodigio (opérateur du système) — à confirmer contractuellement',
    'Agence immobilière habilitée, partenaire de Prodigio (transmission future, à confirmer)',
    v_channels,
    case when v_consent then 'accorde' else 'refuse' end,
    'funnel_mandataire',
    case when jsonb_typeof(payload->'consent_proof') = 'object'
         then payload->'consent_proof' else null end,
    false
  );

  -- 6) Rattachement de la soumission (résolution interne, jamais renvoyée).
  update public.funnel_submissions
  set contact_id = v_contact_id,
      opportunity_id = v_opportunity_id,
      resolution = v_resolution,
      processing_status = 'traite'
  where id = v_submission_id;

  -- Accusé NEUTRE : aucun score, aucune donnée, aucune existence de contact révélée.
  return jsonb_build_object('accepted', true);
end;
$$;

comment on function public.submit_mandate_funnel(jsonb) is
  'Dépôt public contrôlé + préqualification. Recalcule les scores côté base (non falsifiables), stocke soumission/contact/opportunité/relation/preuve, idempotent, dédoublonnage par e-mail. Réponse neutre { accepted: true }.';

commit;
