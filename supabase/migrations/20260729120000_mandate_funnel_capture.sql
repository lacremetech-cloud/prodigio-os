-- =============================================================================
-- Prodigio OS — Migration 20260729120000_mandate_funnel_capture
--
-- Tranche verticale « capture » du moteur Mandats :
--   Publicité → landing propriétaire → analyse d'éligibilité → soumission.
--
-- Objets créés (conformes à docs/03-DOMAIN-MODEL.md) :
--   - funnel_submissions   (FunnelSubmission — soumission originale, conservée)
--   - contacts             (Contact — partie externe)
--   - opportunities        (Opportunité de mandat — dossier commercial)
--   - opportunity_contacts (relation N-N Opportunité ↔ Contact, avec rôle)
--   - privacy_records      (PrivacyRecord / preuve RGPD — conformité NON présumée)
--
-- Principes appliqués :
--   - La base est l'unique source de vérité.
--   - Le public peut DÉPOSER une demande, mais ne peut JAMAIS lire, modifier ni
--     supprimer les données : RLS activé sans politique publique + une seule
--     fonction contrôlée `submit_mandate_funnel` (SECURITY DEFINER).
--   - La soumission originale est conservée telle quelle ; contact et opportunité
--     ne la remplacent pas. Aucune suppression au seul motif de doublon.
--   - Stade (pipeline) et Segment sont deux dimensions SÉPARÉES.
--   - Aucune conformité RGPD présumée : la base légale reste « à valider ».
--   - Aucun paramètre économique (seuil, partages, HT/TTC) n'est codé ici.
--
-- Cette migration NE crée PAS le CRM complet, ni l'authentification, ni les
-- organisations/affectations : uniquement la capture atomique demandée.
--
-- Application : voir docs/07-SUPABASE-SETUP.md. NE PAS exécuter automatiquement.
-- =============================================================================

begin;

-- gen_random_uuid() (fourni par pgcrypto ; présent par défaut sur Supabase).
create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Fonction utilitaire : maintien de updated_at.
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- CONTACTS — partie externe (personne physique ou morale). ≠ Organisation, ≠ Utilisateur.
-- =============================================================================
create table if not exists public.contacts (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  kind               text not null default 'personne_physique'
                       check (kind in ('personne_physique', 'personne_morale')),

  first_name         text,
  last_name          text,
  company_name       text,

  -- Coordonnées normalisées (l'application normalise avant insertion).
  email              text,
  phone              text,

  preferred_channel  text
                       check (preferred_channel is null
                              or preferred_channel in ('telephone', 'email', 'indifferent')),

  status             text not null default 'nouveau'
);

comment on table public.contacts is
  'Contact : partie externe (personne physique ou morale). Distinct d''une Organisation interne et d''un Utilisateur.';

-- Rapprochement de doublons (normalisé, insensible à la casse pour l'e-mail).
create index if not exists contacts_email_lower_idx on public.contacts (lower(email));
create index if not exists contacts_phone_idx on public.contacts (phone);

drop trigger if exists contacts_set_updated_at on public.contacts;
create trigger contacts_set_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

-- =============================================================================
-- OPPORTUNITIES — projet de vente (dossier commercial). ≠ Mandat, ≠ Résultat.
--   Stade (pipeline) et Segment sont deux dimensions SÉPARÉES.
--   Le « bien candidat » (1-1) est ici capturé à plat sur l'opportunité pour la
--   tranche de capture ; il pourra être normalisé dans une table dédiée plus tard.
-- =============================================================================
create table if not exists public.opportunities (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- Deux dimensions indépendantes (docs/03-DOMAIN-MODEL.md).
  pipeline_stage        text not null default 'nouveau'
                          check (pipeline_stage in (
                            'nouveau', 'prise_de_contact_en_cours', 'contact_etabli',
                            'qualification_en_cours', 'rendez_vous_planifie',
                            'rendez_vous_realise', 'estimation_etude_dossier',
                            'proposition_de_mandat', 'en_attente_de_signature',
                            'mandat_signe', 'perdu')),
  segment               text not null default 'non_determine'
                          check (segment in (
                            'non_determine', 'cible_prodigio_premium',
                            'agence_partenaire_classique', 'hors_perimetre', 'a_reevaluer')),

  -- File d'affectation : aucun lead ne reste silencieusement sans suite.
  processing_status     text not null default 'non_affecte'
                          check (processing_status in ('non_affecte', 'affecte', 'clos')),

  source                text not null default 'funnel_mandataire',

  -- Bien candidat (snapshot à plat, capture uniquement).
  property_type         text
                          check (property_type is null or property_type in (
                            'villa_architecte', 'appartement_exception', 'chalet',
                            'domaine_caractere', 'autre')),
  location_city         text,
  location_postal_code  text,
  location_country      text,
  estimated_value_band  text
                          check (estimated_value_band is null or estimated_value_band in (
                            'moins_500k', '500k_800k', '800k_1_2m', '1_2m_2m', 'plus_2m',
                            'accompagnement_estimation')),
  sale_horizon          text
                          check (sale_horizon is null or sale_horizon in (
                            'des_que_possible', 'trois_mois', 'six_mois', 'en_reflexion')),
  mandate_situation     text
                          check (mandate_situation is null or mandate_situation in (
                            'aucun_mandat', 'mandat_simple', 'mandat_exclusif', 'autre')),

  loss_reason           text
);

comment on table public.opportunities is
  'Opportunité de mandat : dossier commercial. Stade et Segment séparés. Distincte du Mandat et du résultat commercial.';

create index if not exists opportunities_created_at_idx on public.opportunities (created_at desc);
create index if not exists opportunities_processing_status_idx on public.opportunities (processing_status);

drop trigger if exists opportunities_set_updated_at on public.opportunities;
create trigger opportunities_set_updated_at
  before update on public.opportunities
  for each row execute function public.set_updated_at();

-- =============================================================================
-- FUNNEL_SUBMISSIONS — soumission originale, CONSERVÉE telle quelle.
--   Jamais remplacée par la création de contact/opportunité. Idempotence.
-- =============================================================================
create table if not exists public.funnel_submissions (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),

  -- Identité du funnel et version du formulaire.
  funnel_key            text not null default 'mandate_owner',
  funnel_version        text not null,
  landing               text,
  variant               text,

  -- Anti double-soumission (idempotence).
  idempotency_key       text not null,

  -- Réponses brutes ET normalisées, conservées intégralement.
  raw_answers           jsonb not null,
  normalized_answers    jsonb not null,

  -- Champs normalisés dénormalisés pour requêtage.
  property_type         text,
  location_city         text,
  location_postal_code  text,
  location_country      text,
  estimated_value_band  text,
  sale_horizon          text,
  mandate_situation     text,

  contact_first_name    text,
  contact_last_name     text,
  contact_email         text,
  contact_email_raw     text,
  contact_phone         text,
  contact_phone_raw     text,
  contact_preference    text,

  -- Preuve de consentement (le PrivacyRecord porte le détail).
  consent_given         boolean not null default false,
  consent_notice_version text,

  -- Attribution / source (multi-points : premier & dernier contact au minimum).
  utm_source            text,
  utm_medium            text,
  utm_campaign          text,
  utm_term              text,
  utm_content           text,
  fbclid                text,
  gclid                 text,
  origin_url            text,
  referrer              text,
  first_touch           jsonb,
  last_touch            jsonb,
  user_agent            text,

  -- Traitement.
  processing_status     text not null default 'nouveau'
                          check (processing_status in ('nouveau', 'traite', 'invalide')),
  resolution            text
                          check (resolution is null or resolution in (
                            'nouveau_contact', 'contact_existant', 'nouvelle_opportunite', 'doublon')),

  -- Rattachements (renseignés après résolution ; la soumission reste la source).
  contact_id            uuid references public.contacts (id) on delete set null,
  opportunity_id        uuid references public.opportunities (id) on delete set null,

  constraint funnel_submissions_idempotency_key_unique unique (idempotency_key)
);

comment on table public.funnel_submissions is
  'FunnelSubmission : soumission originale conservée telle quelle (idempotence, UTM, attribution, preuves). Jamais remplacée par le contact/opportunité.';

create index if not exists funnel_submissions_created_at_idx on public.funnel_submissions (created_at desc);
create index if not exists funnel_submissions_contact_email_idx on public.funnel_submissions (lower(contact_email));
create index if not exists funnel_submissions_contact_id_idx on public.funnel_submissions (contact_id);
create index if not exists funnel_submissions_opportunity_id_idx on public.funnel_submissions (opportunity_id);
create index if not exists funnel_submissions_utm_campaign_idx on public.funnel_submissions (utm_campaign);

-- =============================================================================
-- OPPORTUNITY_CONTACTS — relation N-N Opportunité ↔ Contact, avec rôle.
--   Exactement UN contact principal par opportunité.
-- =============================================================================
create table if not exists public.opportunity_contacts (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),

  opportunity_id  uuid not null references public.opportunities (id) on delete cascade,
  contact_id      uuid not null references public.contacts (id) on delete cascade,

  role            text not null default 'proprietaire'
                    check (role in ('proprietaire', 'coproprietaire', 'conjoint',
                                    'representant', 'intermediaire', 'decisionnaire')),
  is_primary      boolean not null default true,

  constraint opportunity_contacts_unique unique (opportunity_id, contact_id)
);

comment on table public.opportunity_contacts is
  'Relation N-N Opportunité ↔ Contact avec rôle. Un seul contact principal par opportunité.';

-- Un seul contact principal par opportunité.
create unique index if not exists opportunity_contacts_one_primary_idx
  on public.opportunity_contacts (opportunity_id)
  where is_primary;

create index if not exists opportunity_contacts_contact_id_idx on public.opportunity_contacts (contact_id);

-- =============================================================================
-- PRIVACY_RECORDS — traçabilité RGPD. La conformité n'est PAS présumée.
--   Rattaché d'abord à la soumission (preuve originale), puis au contact.
-- =============================================================================
create table if not exists public.privacy_records (
  id                   uuid primary key default gen_random_uuid(),
  created_at           timestamptz not null default now(),
  occurred_at          timestamptz not null default now(),

  submission_id        uuid references public.funnel_submissions (id) on delete set null,
  contact_id           uuid references public.contacts (id) on delete set null,

  purpose              text not null default 'prise_de_contact_projet_vente',

  -- Base légale RÉELLEMENT retenue : à valider juridiquement avant production.
  -- On ne présume aucune conformité (docs/05-OPEN-QUESTIONS.md).
  legal_basis          text not null default 'a_valider_juridiquement',

  notice_version       text,
  notice_text          text,          -- texte réellement affiché (preuve)
  controllers          text,          -- responsable(s) de traitement (à confirmer)
  recipients           text,          -- destinataires annoncés (à confirmer)

  authorized_channels  text[] not null default '{}',
  choice               text not null default 'accorde'
                         check (choice in ('accorde', 'refuse', 'retire')),
  choice_source        text not null default 'funnel_mandataire',
  proof                jsonb,         -- preuve de l'action (horodatage, valeur cochée…)
  do_not_contact       boolean not null default false
);

comment on table public.privacy_records is
  'PrivacyRecord : preuve RGPD (finalité, base légale À VALIDER, notice, canaux, choix, preuve). Conserver une preuve n''affirme PAS la conformité.';

create index if not exists privacy_records_submission_id_idx on public.privacy_records (submission_id);
create index if not exists privacy_records_contact_id_idx on public.privacy_records (contact_id);

-- =============================================================================
-- SÉCURITÉ — RLS : verrouillage total de l'accès direct public.
--   RLS activé + AUCUNE politique => anon/authenticated n'ont aucun accès direct.
--   Le seul point d'entrée public est la fonction `submit_mandate_funnel`.
-- =============================================================================
alter table public.contacts             enable row level security;
alter table public.opportunities        enable row level security;
alter table public.funnel_submissions   enable row level security;
alter table public.opportunity_contacts enable row level security;
alter table public.privacy_records      enable row level security;

-- Refus explicite de tout privilège direct aux rôles publics (défense en
-- profondeur, en plus de RLS). Les rôles internes (dashboard/back-office) seront
-- gérés par des politiques dédiées dans une migration ultérieure.
revoke all on public.contacts             from anon, authenticated;
revoke all on public.opportunities        from anon, authenticated;
revoke all on public.funnel_submissions   from anon, authenticated;
revoke all on public.opportunity_contacts from anon, authenticated;
revoke all on public.privacy_records      from anon, authenticated;

-- =============================================================================
-- FONCTION CONTRÔLÉE DE DÉPÔT — seul point d'entrée public (SECURITY DEFINER).
--   Crée/relie atomiquement : FunnelSubmission + Contact + Opportunity +
--   OpportunityContact + PrivacyRecord. Idempotente sur idempotency_key.
--   Ne renvoie que des identifiants et un statut — jamais de données d'autrui.
-- =============================================================================
create or replace function public.submit_mandate_funnel(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_idempotency_key   text := nullif(payload->>'idempotency_key', '');
  v_email             text := nullif(lower(trim(payload->>'contact_email')), '');
  v_phone             text := nullif(payload->>'contact_phone', '');
  v_existing          public.funnel_submissions%rowtype;
  v_contact_id        uuid;
  v_opportunity_id    uuid;
  v_submission_id     uuid;
  v_resolution        text;
begin
  if v_idempotency_key is null then
    raise exception 'idempotency_key manquant' using errcode = '22023';
  end if;

  -- Idempotence : un rejeu renvoie la soumission déjà enregistrée.
  select * into v_existing
  from public.funnel_submissions
  where idempotency_key = v_idempotency_key;

  if found then
    return jsonb_build_object(
      'submission_id', v_existing.id,
      'contact_id', v_existing.contact_id,
      'opportunity_id', v_existing.opportunity_id,
      'resolution', v_existing.resolution,
      'idempotent_replay', true
    );
  end if;

  -- 1) Soumission originale (conservée telle quelle).
  insert into public.funnel_submissions (
    funnel_key, funnel_version, landing, variant, idempotency_key,
    raw_answers, normalized_answers,
    property_type, location_city, location_postal_code, location_country,
    estimated_value_band, sale_horizon, mandate_situation,
    contact_first_name, contact_last_name, contact_email, contact_email_raw,
    contact_phone, contact_phone_raw, contact_preference,
    consent_given, consent_notice_version,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content,
    fbclid, gclid, origin_url, referrer, first_touch, last_touch, user_agent,
    processing_status
  ) values (
    coalesce(nullif(payload->>'funnel_key', ''), 'mandate_owner'),
    coalesce(nullif(payload->>'funnel_version', ''), 'v1'),
    payload->>'landing', payload->>'variant', v_idempotency_key,
    coalesce(payload->'raw_answers', '{}'::jsonb),
    coalesce(payload->'normalized_answers', '{}'::jsonb),
    nullif(payload->>'property_type', ''), nullif(payload->>'location_city', ''),
    nullif(payload->>'location_postal_code', ''), nullif(payload->>'location_country', ''),
    nullif(payload->>'estimated_value_band', ''), nullif(payload->>'sale_horizon', ''),
    nullif(payload->>'mandate_situation', ''),
    nullif(payload->>'contact_first_name', ''), nullif(payload->>'contact_last_name', ''),
    v_email, nullif(payload->>'contact_email_raw', ''),
    v_phone, nullif(payload->>'contact_phone_raw', ''),
    nullif(payload->>'contact_preference', ''),
    coalesce((payload->>'consent_given')::boolean, false),
    nullif(payload->>'consent_notice_version', ''),
    nullif(payload->>'utm_source', ''), nullif(payload->>'utm_medium', ''),
    nullif(payload->>'utm_campaign', ''), nullif(payload->>'utm_term', ''),
    nullif(payload->>'utm_content', ''),
    nullif(payload->>'fbclid', ''), nullif(payload->>'gclid', ''),
    nullif(payload->>'origin_url', ''), nullif(payload->>'referrer', ''),
    payload->'first_touch', payload->'last_touch', nullif(payload->>'user_agent', ''),
    'nouveau'
  )
  returning id into v_submission_id;

  -- 2) Résolution du contact (dédoublonnage retraçable, sans suppression).
  if v_email is not null then
    select id into v_contact_id
    from public.contacts
    where lower(email) = v_email
    order by created_at asc
    limit 1;
  end if;

  if v_contact_id is null and v_phone is not null then
    select id into v_contact_id
    from public.contacts
    where phone = v_phone
    order by created_at asc
    limit 1;
  end if;

  if v_contact_id is null then
    insert into public.contacts (
      kind, first_name, last_name, email, phone, preferred_channel, status
    ) values (
      'personne_physique',
      nullif(payload->>'contact_first_name', ''),
      nullif(payload->>'contact_last_name', ''),
      v_email, v_phone,
      nullif(payload->>'contact_preference', ''),
      'nouveau'
    )
    returning id into v_contact_id;
    v_resolution := 'nouveau_contact';
  else
    v_resolution := 'contact_existant';
  end if;

  -- 3) Opportunité (stade et segment initiaux, dimensions séparées).
  insert into public.opportunities (
    pipeline_stage, segment, processing_status, source,
    property_type, location_city, location_postal_code, location_country,
    estimated_value_band, sale_horizon, mandate_situation
  ) values (
    'nouveau', 'non_determine', 'non_affecte', 'funnel_mandataire',
    nullif(payload->>'property_type', ''), nullif(payload->>'location_city', ''),
    nullif(payload->>'location_postal_code', ''), nullif(payload->>'location_country', ''),
    nullif(payload->>'estimated_value_band', ''), nullif(payload->>'sale_horizon', ''),
    nullif(payload->>'mandate_situation', '')
  )
  returning id into v_opportunity_id;

  -- 4) Relation opportunité ↔ contact (propriétaire, contact principal).
  insert into public.opportunity_contacts (opportunity_id, contact_id, role, is_primary)
  values (v_opportunity_id, v_contact_id, 'proprietaire', true);

  -- 5) PrivacyRecord (preuve rattachée à la soumission ET au contact).
  insert into public.privacy_records (
    submission_id, contact_id, purpose, legal_basis, notice_version, notice_text,
    controllers, recipients, authorized_channels, choice, choice_source, proof, do_not_contact
  ) values (
    v_submission_id, v_contact_id,
    coalesce(nullif(payload->>'privacy_purpose', ''), 'prise_de_contact_projet_vente'),
    'a_valider_juridiquement',
    nullif(payload->>'consent_notice_version', ''),
    nullif(payload->>'consent_notice_text', ''),
    nullif(payload->>'privacy_controllers', ''),
    nullif(payload->>'privacy_recipients', ''),
    coalesce(
      (select array_agg(value::text) from jsonb_array_elements_text(
        case when jsonb_typeof(payload->'authorized_channels') = 'array'
             then payload->'authorized_channels' else '[]'::jsonb end) as value),
      '{}'
    ),
    case when coalesce((payload->>'consent_given')::boolean, false) then 'accorde' else 'refuse' end,
    'funnel_mandataire',
    payload->'consent_proof',
    false
  );

  -- 6) Rattachement de la soumission (elle reste la source ; elle n'est pas remplacée).
  update public.funnel_submissions
  set contact_id = v_contact_id,
      opportunity_id = v_opportunity_id,
      resolution = v_resolution,
      processing_status = 'traite'
  where id = v_submission_id;

  return jsonb_build_object(
    'submission_id', v_submission_id,
    'contact_id', v_contact_id,
    'opportunity_id', v_opportunity_id,
    'resolution', v_resolution,
    'idempotent_replay', false
  );
end;
$$;

comment on function public.submit_mandate_funnel(jsonb) is
  'Seul point d''entrée public de dépôt d''une demande. Crée/relie atomiquement FunnelSubmission + Contact + Opportunity + OpportunityContact + PrivacyRecord. Idempotente. Le public ne peut rien lire ni modifier directement.';

-- Le dépôt est autorisé au public ; la lecture/écriture directe ne l'est pas.
revoke all on function public.submit_mandate_funnel(jsonb) from public;
grant execute on function public.submit_mandate_funnel(jsonb) to anon, authenticated;

commit;
