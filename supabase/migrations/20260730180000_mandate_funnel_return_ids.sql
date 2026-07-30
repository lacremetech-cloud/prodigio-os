-- =============================================================================
-- Prodigio OS — Migration 20260730180000_mandate_funnel_return_ids
--
-- Additive au-dessus de 20260729160000_mandate_scoring : `submit_mandate_funnel`
-- renvoie désormais, EN PLUS de `accepted`, deux champs destinés au SERVEUR
-- uniquement (action Next), afin de déclencher une alerte Slack fiable et sans
-- doublon lors d'une VRAIE nouvelle demande :
--
--   - `created`        : true UNIQUEMENT pour l'appel qui a réellement inséré la
--                        soumission (gagnant du `on conflict do nothing`). Un
--                        rejeu / double-clic / retry avec la même clé
--                        d'idempotence renvoie `created = false`.
--   - `opportunity_id` : identifiant de l'opportunité créée (deep link CRM).
--                        Présent uniquement quand `created = true`.
--
-- Neutralité PRÉSERVÉE : `accepted` reste toujours présent ; l'existence
-- PRÉALABLE d'un contact n'est TOUJOURS PAS révélée (`created` reflète la
-- fraîcheur de la clé d'idempotence, jamais l'existence d'un contact e-mail/
-- téléphone). `opportunity_id` est un UUID qui n'ouvre AUCUN accès sans
-- authentification (la fiche /crm/mandats/{id} reste protégée par la RLS et le
-- middleware). L'action serveur ne renvoie JAMAIS ces champs au navigateur.
--
-- Le CORPS de la fonction est IDENTIQUE à la version déployée : SEULES les deux
-- instructions `return` changent. RLS, GRANT, scoring, dédoublonnage, preuve
-- RGPD et idempotence sont INCHANGÉS. `CREATE OR REPLACE` conserve les
-- privilèges existants (anon/authenticated). Aucune migration antérieure n'est
-- modifiée ni réappliquée.
-- =============================================================================

begin;

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

  v_scores := public.compute_mandate_scores(
    v_property_type, v_value_band, v_sale_horizon, v_mandate_situation);
  v_compat := (v_scores->'compatibility'->>'score')::int;
  v_maturity := (v_scores->'maturity'->>'score')::int;
  v_priority := v_scores->>'priority';
  v_appreciation := v_scores->>'appreciation';

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

  -- Rejeu idempotent : accusé NEUTRE + created=false (aucune alerte Slack).
  if v_submission_id is null then
    return jsonb_build_object('accepted', true, 'created', false);
  end if;

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

  insert into public.opportunity_contacts (opportunity_id, contact_id, role, is_primary)
  values (v_opportunity_id, v_contact_id, 'proprietaire', true);

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

  update public.funnel_submissions
  set contact_id = v_contact_id,
      opportunity_id = v_opportunity_id,
      resolution = v_resolution,
      processing_status = 'traite'
  where id = v_submission_id;

  -- Nouvelle demande RÉELLEMENT enregistrée : renvoie l'identifiant d'opportunité
  -- (deep link CRM) + created=true. Champs destinés au SERVEUR uniquement — jamais
  -- renvoyés au navigateur par l'action Next.
  return jsonb_build_object('accepted', true, 'created', true, 'opportunity_id', v_opportunity_id);
end;
$$;

comment on function public.submit_mandate_funnel(jsonb) is
  'Dépôt public contrôlé + préqualification. Recalcule les scores côté base, stocke soumission/contact/opportunité/relation/preuve, idempotent, dédoublonnage par e-mail. Réponse serveur : { accepted:true, created:bool, opportunity_id? } — created/opportunity_id destinés au serveur (alerte Slack sans doublon), jamais renvoyés au navigateur ; neutralité (existence de contact) préservée.';

commit;
