-- =============================================================================
-- Consentement : distinguer « non demandé » de « refusé »
-- =============================================================================
-- CORRECTIF DE SÉMANTIQUE. Le formulaire universel ne recueille aucun
-- consentement marketing — il n'en demande pas. Or le modèle ne connaissait que
-- trois états (`accorde`, `refuse`, `retire`) et un booléen non nul, si bien
-- qu'une absence de demande s'enregistrait en `refuse` / `false`.
--
-- C'est une donnée FAUSSE, pas une imprécision : elle affirme un acte
-- d'opposition que la personne n'a jamais posé, sur un dossier qu'elle venait
-- elle-même d'ouvrir. Un audit, une demande d'accès ou une reprise du modèle
-- en tireraient une conclusion erronée.
--
-- L'invariant visé :
--   * aucun consentement marketing demandé ;
--   * aucun consentement marketing accordé ;
--   * AUCUNE opposition explicite inventée ;
--   * la présentation de l'information reste tracée, séparément du choix.
--
-- Tout est ADDITIF : un état s'ajoute, une contrainte se relâche. Aucune ligne
-- existante n'est réécrite, et le funnel V1 garde exactement son comportement.
-- =============================================================================

-- --- 1. Un quatrième état, neutre et explicite ------------------------------
-- `non_demande` n'est pas un choix : c'est l'absence de question. Il se
-- distingue de `refuse` (on a demandé, la personne a dit non) et de `retire`
-- (elle avait accordé, puis s'est rétractée).
alter table public.privacy_records
  drop constraint if exists privacy_records_choice_check;
alter table public.privacy_records
  add constraint privacy_records_choice_check
  check (choice in ('accorde', 'refuse', 'retire', 'non_demande'));

comment on column public.privacy_records.choice is
  'État du choix de la personne. `accorde` / `refuse` supposent qu''une question a été posée ; `retire` une rétractation ; `non_demande` signifie qu''AUCUNE question n''a été posée — ce n''est pas une opposition. Seul `accorde` autorise une finalité marketing (voir src/modules/communications/policy.ts, qui exige un accord positif).';

-- --- 2. Le booléen sait désormais dire « on n'a pas demandé » ----------------
-- `not null default false` forçait à écrire « aucun consentement donné » là où
-- la vérité est « aucun consentement demandé ». NULL porte cette absence.
-- Relâchement de contrainte : aucune ligne existante n'est affectée, et le
-- défaut `false` reste en place pour les formulaires qui posent la question.
alter table public.buyer_interests
  alter column consent_given drop not null;

comment on column public.buyer_interests.consent_given is
  'Consentement recueilli par le formulaire. `true` accordé, `false` demandé mais refusé, NULL AUCUNE question posée. Le formulaire universel écrit NULL : il ne demande rien, donc n''enregistre ni accord ni refus.';

-- --- 3. Le dépôt public respecte la distinction ------------------------------
-- Un nouveau champ de payload, `consent_requested`. Absent ⇒ `true` : le funnel
-- V1, qui pose bien une case, garde son comportement au bit près.
create or replace function public.submit_buyer_interest(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_idempotency_key   text;
  v_slug              text;
  v_property_id       uuid;
  v_property_name     text;
  v_org               uuid;
  v_pub_status        text;
  v_ref_cents         bigint;
  v_email             text := nullif(lower(trim(payload->>'contact_email')), '');
  v_phone             text := nullif(trim(payload->>'contact_phone'), '');
  v_consent           boolean;
  v_consent_asked     boolean;
  v_choice            text;
  v_pref              text;
  v_recall            text;
  v_project_nature    text;
  v_budget_band       text;
  v_budget_choice     text;
  v_form_status       text;
  v_financing         text;
  v_purchase_horizon  text;
  v_decision_mode     text;
  v_availability      text;
  v_channels          text[];
  v_scores            jsonb;
  v_contact_id        uuid;
  v_interest_id       uuid;
  v_resolution        text;
  v_profile_id        uuid;
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

  v_slug := public.normalize_public_slug(payload->>'slug');
  if v_slug is null then raise exception 'bien inconnu' using errcode = '22023'; end if;
  select c.property_id, c.publication_status, c.reference_value_cents, c.public_name,
         c.buyer_form_status
    into v_property_id, v_pub_status, v_ref_cents, v_property_name, v_form_status
  from public.property_public_config c
  where lower(c.slug) = v_slug limit 1;
  -- Collecter un intérêt et publier la vitrine Prodigio sont deux décisions
  -- distinctes : une annonce hébergée ailleurs doit pouvoir recevoir des
  -- demandes sans que la page Prodigio soit en ligne. L'accusé public reste
  -- neutre dans tous les cas (aucune divulgation d'existence).
  if v_property_id is null
     or (coalesce(v_form_status, 'inactif') <> 'actif' and v_pub_status <> 'publie') then
    return jsonb_build_object('accepted', true, 'created', false);
  end if;
  select organization_id into v_org from public.properties where id = v_property_id;

  v_email := left(v_email, 320);
  v_phone := left(v_phone, 64);

  -- Une question a-t-elle seulement été posée ? Champ absent ⇒ oui, pour que le
  -- funnel V1 (qui affiche bien une case) reste inchangé.
  v_consent_asked := coalesce(
    lower(coalesce(payload->>'consent_requested', '')) not in ('false', 'f', '0', 'no', 'off'),
    true);

  if v_consent_asked then
    v_consent := lower(coalesce(payload->>'consent_given', '')) in ('true', 't', '1', 'yes', 'on');
    v_choice  := case when v_consent then 'accorde' else 'refuse' end;
  else
    -- Rien n'a été demandé : ni accord, ni refus. On n'invente aucune opposition.
    v_consent := null;
    v_choice  := 'non_demande';
  end if;

  v_project_nature := (case when payload->>'project_nature' = any (array[
    'residence_principale','residence_secondaire','investissement','autre']) then payload->>'project_nature' end);
  v_budget_band := (case when payload->>'budget_band' = any (array[
    'moins_800k','800k_1_2m','1_2m_2m','2m_3m','plus_3m','a_definir']) then payload->>'budget_band' end);
  -- Vocabulaire du formulaire universel. AUCUNE conversion vers `budget_band` :
  -- trois des cinq réponses sont à cheval sur les anciennes tranches, et
  -- « aucun projet » n'est pas « à définir ». Rapprocher les deux détruirait
  -- l'information. Les deux colonnes coexistent, chacune fidèle à son formulaire.
  v_budget_choice := (case when payload->>'budget_choice' = any (array[
    'aucun_projet','500k_1m','1m_2m','2m_3m','plus_3m']) then payload->>'budget_choice' end);
  v_financing := (case when payload->>'financing' = any (array[
    'fonds_propres','accord_bancaire','financement_a_organiser']) then payload->>'financing' end);
  v_purchase_horizon := (case when payload->>'purchase_horizon' = any (array[
    'immediat','trois_mois','six_mois','en_reflexion']) then payload->>'purchase_horizon' end);
  v_decision_mode := (case when payload->>'decision_mode' = any (array[
    'seul','avec_autres']) then payload->>'decision_mode' end);
  v_availability := (case when payload->>'availability' = any (array[
    'disponible_visite','disponible_echange','a_convenir']) then payload->>'availability' end);
  v_pref := (case when payload->>'contact_preference' = any (array[
    'telephone','email','indifferent']) then payload->>'contact_preference' end);
  v_recall := (case when payload->>'contact_recall_preference' = any (array[
    'des_que_possible','matin','apres_midi','debut_soiree']) then payload->>'contact_recall_preference' end);

  v_channels := case
    when v_pref = 'telephone' then array['telephone']
    when v_pref = 'email' then array['email']
    else array['telephone', 'email'] end;

  v_scores := public.compute_buyer_scores(
    v_budget_band, v_financing, v_purchase_horizon, v_project_nature,
    v_decision_mode, v_availability, v_ref_cents);

  insert into public.buyer_interests (
    organization_id, property_id, funnel_key, funnel_version, idempotency_key,
    raw_answers, normalized_answers,
    project_nature, budget_band, budget_choice, financing, purchase_horizon, decision_mode, availability,
    residence_country, residence_area,
    contact_first_name, contact_last_name, contact_email, contact_email_raw,
    contact_phone, contact_phone_raw, contact_preference, contact_recall_preference,
    consent_given, consent_notice_version,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content,
    fbclid, gclid, origin_url, referrer, first_touch, last_touch, user_agent,
    budget_score, maturity_score, financing_score, availability_score, overall_score,
    priority, score_version, score_breakdown
  ) values (
    v_org, v_property_id, 'buyer_interest', 'v1', v_idempotency_key,
    coalesce(payload->'raw_answers', '{}'::jsonb),
    coalesce(payload->'normalized_answers', '{}'::jsonb),
    v_project_nature, v_budget_band, v_budget_choice, v_financing, v_purchase_horizon, v_decision_mode, v_availability,
    left(nullif(payload->>'residence_country', ''), 120),
    left(nullif(payload->>'residence_area', ''), 160),
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
    (v_scores->'budget'->>'score')::int, (v_scores->'maturity'->>'score')::int,
    (v_scores->'financing'->>'score')::int, (v_scores->'availability'->>'score')::int,
    (v_scores->>'overall')::int, v_scores->>'priority', v_scores->>'score_version', v_scores
  )
  on conflict (idempotency_key) do nothing
  returning id into v_interest_id;

  if v_interest_id is null then
    return jsonb_build_object('accepted', true, 'created', false);
  end if;

  -- Dédoublonnage CONSERVATEUR par e-mail uniquement. Un contact existant
  -- (vendeur ou acquéreur) est RÉUTILISÉ TEL QUEL : aucune donnée modifiée.
  if v_email is not null then
    select id into v_contact_id from public.contacts
      where lower(email) = v_email order by created_at asc limit 1;
  end if;
  if v_contact_id is null then
    insert into public.contacts (kind, first_name, last_name, email, phone, preferred_channel, status)
    values ('personne_physique',
      left(nullif(payload->>'contact_first_name', ''), 120),
      left(nullif(payload->>'contact_last_name', ''), 120),
      v_email, v_phone, v_pref, 'nouveau')
    returning id into v_contact_id;
    v_resolution := 'nouveau_contact';
  else
    v_resolution := 'contact_existant';
  end if;

  -- `notice_version` / `notice_text` tracent ce qui a été AFFICHÉ, quel que soit
  -- le choix : l'information reste donc prouvée même quand aucune question n'a
  -- été posée. `do_not_contact` reste false — aucune opposition n'est inventée.
  insert into public.privacy_records (
    buyer_interest_id, contact_id, purpose, legal_basis, notice_version, notice_text,
    controllers, recipients, authorized_channels, choice, choice_source, proof, do_not_contact
  ) values (
    v_interest_id, v_contact_id,
    'manifestation_interet_acquereur',
    'a_valider_juridiquement',
    left(nullif(payload->>'consent_notice_version', ''), 60),
    left(nullif(payload->>'consent_notice_text', ''), 2000),
    'Prodigio (opérateur du système) — à confirmer contractuellement',
    'Agence immobilière habilitée, partenaire de Prodigio (transmission future, à confirmer)',
    v_channels,
    v_choice,
    'funnel_acquereur',
    case when jsonb_typeof(payload->'consent_proof') = 'object' then payload->'consent_proof' else null end,
    false
  );

  update public.buyer_interests set contact_id = v_contact_id, resolution = v_resolution
    where id = v_interest_id;

  v_profile_id := public.buyer_attach_interest(v_interest_id);

  return jsonb_build_object(
    'accepted', true, 'created', true,
    'interest_id', v_interest_id, 'property_id', v_property_id,
    'property_name', v_property_name,
    'buyer_profile_id', v_profile_id);
end;
$$;

comment on function public.submit_buyer_interest(jsonb) is
  'Dépôt public d''un intérêt acquéreur. Distingue « aucune question posée » (`consent_requested: false` ⇒ consent_given NULL, choice `non_demande`) d''un refus explicite. Champ absent ⇒ question posée, comportement du funnel V1 inchangé. Accepte le vocabulaire de budget universel (`budget_choice`, jamais converti) et les biens dont le formulaire est actif sans être publiés. L''accusé reste neutre.';
