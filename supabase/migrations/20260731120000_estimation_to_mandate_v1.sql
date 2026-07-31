-- =============================================================================
-- Prodigio OS — Migration 20260731120000_estimation_to_mandate_v1
--
-- « Résultat d'estimation → décision d'éligibilité → mandat → résultat
--   commercial → passage contrôlé vers la Fabrique de biens » (V1).
--
-- STRICTEMENT ADDITIVE. Ne modifie NI ne supprime aucune migration historique,
-- aucune donnée réelle, aucune fonction/colonne existante de façon destructive.
-- S'appuie sur l'existant : opportunities (outcome/segment déjà en colonnes),
-- estimation_appointments, organizations, audit_events immuable, RLS, helpers
-- crm_has_role / crm_is_operator / crm_require_role / crm_assigned_opportunity_ids.
--
-- Ajoute :
--   1. Extension ADDITIVE des CHECK d'audit_events (nouvelles entités/événements).
--   2. Colonnes additives sur opportunities : décision d'ÉLIGIBILITÉ (distincte du
--      segment) + code de raison structuré du résultat commercial.
--   3. estimation_reports  — compte rendu d'estimation (montants en centimes,
--      notes confidentielles cloisonnées).
--   4. economic_rule_sets  — règles économiques versionnées (aucune valeur codée
--      en dur : tout est saisi/administré).
--   5. mandates            — entité Mandat distincte de l'opportunité, avec
--      snapshot économique immuable et transitions contrôlées.
--   6. mandate_documents   — métadonnées des documents (fichiers dans un bucket
--      Storage PRIVÉ ; accès par URL signée serveur uniquement).
--   7. properties          — socle canonique minimal du futur Bien (handoff
--      idempotent : un seul bien par mandat).
--   8. Fonctions SECURITY DEFINER (search_path figé, rôle re-vérifié, audit) pour
--      toutes les écritures ; EXECUTE retiré à anon/public.
--
-- Rôles (matrice, appliquée EN BASE) :
--   - administrateur / manager : validation d'éligibilité, mandat (brouillon →
--     proposé → signé / refusé / perdu), documents, règles éco (admin), handoff.
--   - agent_immobilier AFFECTÉ : compte rendu d'estimation + recommandation.
--   - setter : consultation ; ne modifie ni montants, ni segment, ni signature.
--   - partenaire_lecture : lecture seule des dossiers partagés (inchangé).
--
-- Aucune valeur économique inventée. Aucune agence codée en dur. La signature
-- reste MANUELLE (import du document signé) — pas de signature électronique ici.
-- =============================================================================

begin;

-- =============================================================================
-- 1. AUDIT — extension ADDITIVE des contraintes CHECK (sur-ensemble strict).
-- =============================================================================
alter table public.audit_events
  drop constraint if exists audit_events_entity_type_check,
  add constraint audit_events_entity_type_check check (
    entity_type in (
      'opportunity', 'contact', 'membership', 'organization', 'invitation',
      'calendar_connection', 'estimation_appointment',
      -- Nouveaux (estimation → mandat) :
      'estimation_report', 'mandate', 'economic_rule', 'document', 'property'));

alter table public.audit_events
  drop constraint if exists audit_events_event_type_check,
  add constraint audit_events_event_type_check check (
    event_type in (
      'creation', 'changement_stade', 'changement_segment',
      'changement_affectation', 'changement_permission',
      'resolution_doublon', 'resultat_commercial',
      'invitation_creee', 'invitation_renvoyee', 'invitation_revoquee',
      'invitation_acceptee', 'changement_role',
      'activation_membre', 'desactivation_membre',
      'calendrier_connecte', 'calendrier_deconnecte',
      'estimation_planifiee', 'estimation_replanifiee',
      'estimation_annulee', 'estimation_resultat',
      -- Nouveaux (estimation → mandat) :
      'estimation_realisee', 'decision_eligibilite',
      'regle_economique_maj',
      'mandat_brouillon', 'mandat_propose', 'mandat_signe',
      'mandat_refuse', 'mandat_expire', 'mandat_annule',
      'document_ajoute', 'document_remplace', 'document_supprime',
      'bien_cree'));

-- =============================================================================
-- 2. OPPORTUNITIES — colonnes ADDITIVES : décision d'ÉLIGIBILITÉ (≠ segment) +
--    code de raison structuré du résultat commercial.
-- =============================================================================
alter table public.opportunities
  add column if not exists eligibility_decision text,
  add column if not exists eligibility_reason text,
  add column if not exists eligibility_decided_by uuid references auth.users (id) on delete set null,
  add column if not exists eligibility_decided_at timestamptz,
  add column if not exists eligibility_is_derogation boolean not null default false,
  add column if not exists eligibility_derogation_reason text,
  add column if not exists outcome_reason_code text;

alter table public.opportunities
  drop constraint if exists opportunities_eligibility_decision_check,
  add constraint opportunities_eligibility_decision_check check (
    eligibility_decision is null or eligibility_decision in (
      'parcours_premium_prodigio', 'agence_classique', 'non_retenu', 'a_completer'));

comment on column public.opportunities.eligibility_decision is
  'Décision d''éligibilité VALIDÉE par un humain (distincte du segment et de la recommandation). Gate du parcours premium et du mandat.';

-- =============================================================================
-- 3. ESTIMATION_REPORTS — compte rendu d'estimation. Montants en CENTIMES d'euro
--    (stockage fiable). Notes confidentielles JAMAIS exposées au propriétaire.
-- =============================================================================
create table if not exists public.estimation_reports (
  id                      uuid primary key default gen_random_uuid(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  organization_id         uuid not null references public.organizations (id) on delete cascade,
  opportunity_id          uuid not null references public.opportunities (id) on delete cascade,
  appointment_id          uuid references public.estimation_appointments (id) on delete set null,
  outcome                 text not null
                            check (outcome in ('realisee', 'proprietaire_absent', 'rdv_annule',
                                               'estimation_impossible', 'nouveau_rdv_necessaire')),
  performed_at            timestamptz,          -- date réelle de l'estimation
  performed_by            uuid references auth.users (id) on delete set null, -- agent
  value_low_cents         bigint check (value_low_cents is null or value_low_cents >= 0),
  value_recommended_cents bigint check (value_recommended_cents is null or value_recommended_cents >= 0),
  value_high_cents        bigint check (value_high_cents is null or value_high_cents >= 0),
  owner_expected_cents    bigint check (owner_expected_cents is null or owner_expected_cents >= 0),
  property_condition      text,
  strengths               text,
  risks                   text,
  owner_project_summary   text,
  confidential_notes      text,                 -- INTERNE : jamais exposé
  agent_recommendation    text,                 -- recommandation de l'agent (texte)
  next_action             text,
  next_action_at          timestamptz,
  created_by              uuid references auth.users (id) on delete set null,
  updated_by              uuid references auth.users (id) on delete set null,
  -- Une estimation « réalisée » exige au minimum la valeur recommandée + la date.
  constraint estimation_reports_realisee_requirements check (
    outcome <> 'realisee'
    or (value_recommended_cents is not null and performed_at is not null)),
  -- Un seul compte rendu par opportunité en V1 (mise à jour en place).
  constraint estimation_reports_opportunity_unique unique (opportunity_id)
);

comment on table public.estimation_reports is
  'Compte rendu d''estimation (résultat du rendez-vous + montants en centimes + notes internes). Distinct du mandat et du résultat commercial. Notes confidentielles jamais exposées au propriétaire.';

create index if not exists estimation_reports_opportunity_idx
  on public.estimation_reports (opportunity_id);

drop trigger if exists estimation_reports_set_updated_at on public.estimation_reports;
create trigger estimation_reports_set_updated_at
  before update on public.estimation_reports
  for each row execute function public.set_updated_at();

alter table public.estimation_reports enable row level security;
grant select on public.estimation_reports to authenticated;

drop policy if exists estimation_reports_read on public.estimation_reports;
create policy estimation_reports_read on public.estimation_reports
  for select to authenticated
  using (
    public.crm_is_operator()
    or (public.crm_has_role('agent_immobilier')
        and opportunity_id in (select public.crm_assigned_opportunity_ids()))
  );

-- =============================================================================
-- 4. ECONOMIC_RULE_SETS — règles économiques versionnées (aucune valeur en dur).
-- =============================================================================
create table if not exists public.economic_rule_sets (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  name                text not null,
  segment             text not null,                      -- segment concerné (token)
  organization_id     uuid references public.organizations (id) on delete set null, -- partenaire/porteuse
  effective_from      date not null,
  effective_to        date,
  fee_basis           text not null default 'a_confirmer'
                        check (fee_basis in ('HT', 'TTC', 'a_confirmer')),
  prodigio_share_pct  numeric(5,2) check (prodigio_share_pct is null or (prodigio_share_pct >= 0 and prodigio_share_pct <= 100)),
  partner_share_pct   numeric(5,2) check (partner_share_pct is null or (partner_share_pct >= 0 and partner_share_pct <= 100)),
  status              text not null default 'actif' check (status in ('actif', 'inactif')),
  version             integer not null default 1,
  created_by          uuid references auth.users (id) on delete set null,
  notes               text
);

comment on table public.economic_rule_sets is
  'Règles économiques VERSIONNÉES par segment / partenaire, avec date d''entrée en vigueur et historique. Aucune valeur (seuil, partage, base HT/TTC) codée en dur : tout est administré.';

create index if not exists economic_rule_sets_lookup_idx
  on public.economic_rule_sets (segment, status, effective_from desc);

drop trigger if exists economic_rule_sets_set_updated_at on public.economic_rule_sets;
create trigger economic_rule_sets_set_updated_at
  before update on public.economic_rule_sets
  for each row execute function public.set_updated_at();

alter table public.economic_rule_sets enable row level security;
grant select on public.economic_rule_sets to authenticated;

-- Lecture réservée aux rôles opérateur (les partenaires n'y accèdent pas ici).
drop policy if exists economic_rule_sets_read on public.economic_rule_sets;
create policy economic_rule_sets_read on public.economic_rule_sets
  for select to authenticated
  using (public.crm_is_operator());

-- =============================================================================
-- 5. MANDATES — entité Mandat distincte de l'opportunité. Snapshot immuable.
-- =============================================================================
create table if not exists public.mandates (
  id                      uuid primary key default gen_random_uuid(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  organization_id         uuid not null references public.organizations (id) on delete cascade, -- org opérateur (cloisonnement)
  opportunity_id          uuid not null references public.opportunities (id) on delete cascade,
  holder_organization_id  uuid references public.organizations (id) on delete restrict,         -- porteuse juridique (agence)
  mandate_type            text,
  is_exclusive            boolean,
  mandate_number          text,
  status                  text not null default 'brouillon'
                            check (status in ('brouillon', 'propose', 'en_attente_signature',
                                              'signe', 'refuse', 'expire', 'annule')),
  proposed_at             timestamptz,
  signed_at               timestamptz,
  start_date              date,
  expires_at              date,
  end_reason_code         text,
  end_reason              text,
  economic_snapshot       jsonb,                 -- copie IMMUABLE des conditions à la proposition
  signed_document_id      uuid,                  -- fk mandate_documents (ajoutée après la table docs)
  created_by              uuid references auth.users (id) on delete set null,
  last_modified_by        uuid references auth.users (id) on delete set null,
  -- Un mandat « signé » exige date de signature, numéro et snapshot.
  constraint mandates_signed_requirements check (
    status <> 'signe' or (signed_at is not null and nullif(btrim(mandate_number), '') is not null
                          and economic_snapshot is not null)),
  -- Dès « proposé » (et au-delà), le snapshot économique est obligatoire.
  constraint mandates_snapshot_from_propose check (
    status = 'brouillon' or economic_snapshot is not null),
  -- Dès « proposé », une organisation porteuse est obligatoire.
  constraint mandates_holder_from_propose check (
    status = 'brouillon' or holder_organization_id is not null)
);

comment on table public.mandates is
  'Mandat : proposition puis contrat, DISTINCT de l''opportunité et du résultat commercial. Porté par une organisation habilitée (jamais Prodigio). Snapshot économique immuable dès « proposé ». Signature manuelle (document importé).';

-- Un seul mandat ACTIF (non terminal) par opportunité en V1.
create unique index if not exists mandates_one_active_per_opportunity
  on public.mandates (opportunity_id)
  where status in ('brouillon', 'propose', 'en_attente_signature', 'signe');

create index if not exists mandates_opportunity_idx on public.mandates (opportunity_id);
create index if not exists mandates_status_idx on public.mandates (organization_id, status);

drop trigger if exists mandates_set_updated_at on public.mandates;
create trigger mandates_set_updated_at
  before update on public.mandates
  for each row execute function public.set_updated_at();

alter table public.mandates enable row level security;
grant select on public.mandates to authenticated;

drop policy if exists mandates_read on public.mandates;
create policy mandates_read on public.mandates
  for select to authenticated
  using (
    public.crm_is_operator()
    or (public.crm_has_role('agent_immobilier')
        and opportunity_id in (select public.crm_assigned_opportunity_ids()))
  );

-- =============================================================================
-- 6. MANDATE_DOCUMENTS — métadonnées ; fichiers dans un bucket Storage PRIVÉ.
-- =============================================================================
create table if not exists public.mandate_documents (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  opportunity_id   uuid not null references public.opportunities (id) on delete cascade,
  mandate_id       uuid references public.mandates (id) on delete set null,
  kind             text not null
                     check (kind in ('mandat_propose', 'mandat_signe',
                                     'estimation_avis_valeur', 'piece_interne')),
  storage_path     text not null,          -- chemin dans le bucket privé (sans PII)
  file_name        text not null,          -- nom affiché, assaini
  mime_type        text not null,
  size_bytes       bigint not null check (size_bytes >= 0),
  status           text not null default 'actif' check (status in ('actif', 'supprime')),
  uploaded_by      uuid references auth.users (id) on delete set null,
  deleted_by       uuid references auth.users (id) on delete set null,
  deleted_at       timestamptz,
  constraint mandate_documents_storage_unique unique (storage_path)
);

comment on table public.mandate_documents is
  'Métadonnées des documents (mandat proposé/signé, avis de valeur, pièce interne). Le fichier vit dans un bucket Storage PRIVÉ ; accès uniquement par URL signée serveur, après contrôle de rôle et d''organisation. Aucune PII dans storage_path.';

create index if not exists mandate_documents_opportunity_idx
  on public.mandate_documents (opportunity_id, status);
create index if not exists mandate_documents_mandate_idx
  on public.mandate_documents (mandate_id);

drop trigger if exists mandate_documents_set_updated_at on public.mandate_documents;
create trigger mandate_documents_set_updated_at
  before update on public.mandate_documents
  for each row execute function public.set_updated_at();

alter table public.mandate_documents enable row level security;
grant select on public.mandate_documents to authenticated;

drop policy if exists mandate_documents_read on public.mandate_documents;
create policy mandate_documents_read on public.mandate_documents
  for select to authenticated
  using (
    status = 'actif'
    and (
      public.crm_is_operator()
      or (public.crm_has_role('agent_immobilier')
          and opportunity_id in (select public.crm_assigned_opportunity_ids()))
    )
  );

-- Lien mandat → document signé (fk ajoutée après création de la table docs).
alter table public.mandates
  drop constraint if exists mandates_signed_document_fk,
  add constraint mandates_signed_document_fk
    foreign key (signed_document_id) references public.mandate_documents (id) on delete set null;

-- =============================================================================
-- 7. PROPERTIES — socle canonique minimal du Bien (handoff idempotent).
-- =============================================================================
create table if not exists public.properties (
  id                      uuid primary key default gen_random_uuid(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  organization_id         uuid not null references public.organizations (id) on delete cascade,
  opportunity_id          uuid not null references public.opportunities (id) on delete cascade,
  mandate_id              uuid not null references public.mandates (id) on delete cascade,
  holder_organization_id  uuid references public.organizations (id) on delete set null,
  status                  text not null default 'preparation_a_lancer'
                            check (status in ('preparation_a_lancer')),
  created_by              uuid references auth.users (id) on delete set null,
  -- Idempotence : un seul bien par mandat (et par opportunité).
  constraint properties_mandate_unique unique (mandate_id),
  constraint properties_opportunity_unique unique (opportunity_id)
);

comment on table public.properties is
  'Socle canonique minimal du futur Bien (handoff vers la Fabrique de biens). Références uniquement (opportunité, mandat, org porteuse). Un seul bien par mandat (idempotent). La Fabrique complète est hors périmètre.';

create index if not exists properties_opportunity_idx on public.properties (opportunity_id);

drop trigger if exists properties_set_updated_at on public.properties;
create trigger properties_set_updated_at
  before update on public.properties
  for each row execute function public.set_updated_at();

alter table public.properties enable row level security;
grant select on public.properties to authenticated;

drop policy if exists properties_read on public.properties;
create policy properties_read on public.properties
  for select to authenticated
  using (
    public.crm_is_operator()
    or (public.crm_has_role('agent_immobilier')
        and opportunity_id in (select public.crm_assigned_opportunity_ids()))
  );

-- =============================================================================
-- 8. HELPERS DE DROITS (additifs).
-- =============================================================================

-- Peut décider/valider (éligibilité, mandat, handoff) : administrateur / manager.
create or replace function public.crm_can_decide()
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$ select public.crm_has_role('administrateur', 'manager'); $$;

comment on function public.crm_can_decide() is
  'Vrai si l''utilisateur courant peut valider une décision sensible (éligibilité, transitions de mandat, handoff) : administrateur / manager.';

-- Peut renseigner un compte rendu d'estimation : admin/manager, OU agent affecté.
create or replace function public.crm_can_report_estimation(p_opportunity_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.crm_can_decide()
      or (public.crm_has_role('agent_immobilier')
          and p_opportunity_id in (select public.crm_assigned_opportunity_ids()));
$$;

revoke all on function public.crm_can_decide() from public;
revoke all on function public.crm_can_report_estimation(uuid) from public;
grant execute on function public.crm_can_decide() to authenticated;
grant execute on function public.crm_can_report_estimation(uuid) to authenticated;

-- =============================================================================
-- 9. FONCTIONS — COMPTE RENDU D'ESTIMATION.
-- =============================================================================
create or replace function public.crm_save_estimation_report(
  p_opportunity_id uuid,
  p_outcome text,
  p_performed_at timestamptz default null,
  p_performed_by uuid default null,
  p_value_low_cents bigint default null,
  p_value_recommended_cents bigint default null,
  p_value_high_cents bigint default null,
  p_owner_expected_cents bigint default null,
  p_property_condition text default null,
  p_strengths text default null,
  p_risks text default null,
  p_owner_project_summary text default null,
  p_confidential_notes text default null,
  p_agent_recommendation text default null,
  p_next_action text default null,
  p_next_action_at timestamptz default null,
  p_appointment_id uuid default null
)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'authentification requise' using errcode = '28000';
  end if;
  if not public.crm_can_report_estimation(p_opportunity_id) then
    raise exception 'droits insuffisants pour renseigner l''estimation' using errcode = '42501';
  end if;
  if p_outcome not in ('realisee','proprietaire_absent','rdv_annule','estimation_impossible','nouveau_rdv_necessaire') then
    raise exception 'résultat de rendez-vous invalide' using errcode = '22023';
  end if;
  if p_outcome = 'realisee' and (p_value_recommended_cents is null or p_performed_at is null) then
    raise exception 'estimation réalisée : valeur recommandée et date requises' using errcode = '22023';
  end if;
  if not exists (select 1 from public.opportunities where id = p_opportunity_id) then
    raise exception 'opportunité introuvable' using errcode = '22023';
  end if;

  select organization_id into v_org from public.opportunity_organizations
  where opportunity_id = p_opportunity_id order by (function = 'operateur_prodigio') desc limit 1;
  if v_org is null then v_org := public.crm_current_operator_org(); end if;

  insert into public.estimation_reports as er (
    organization_id, opportunity_id, appointment_id, outcome, performed_at, performed_by,
    value_low_cents, value_recommended_cents, value_high_cents, owner_expected_cents,
    property_condition, strengths, risks, owner_project_summary, confidential_notes,
    agent_recommendation, next_action, next_action_at, created_by, updated_by)
  values (
    v_org, p_opportunity_id, p_appointment_id, p_outcome, p_performed_at,
    coalesce(p_performed_by, v_uid),
    p_value_low_cents, p_value_recommended_cents, p_value_high_cents, p_owner_expected_cents,
    nullif(btrim(p_property_condition), ''), nullif(btrim(p_strengths), ''), nullif(btrim(p_risks), ''),
    nullif(btrim(p_owner_project_summary), ''), nullif(btrim(p_confidential_notes), ''),
    nullif(btrim(p_agent_recommendation), ''), nullif(btrim(p_next_action), ''), p_next_action_at,
    v_uid, v_uid)
  on conflict (opportunity_id) do update set
    appointment_id = excluded.appointment_id,
    outcome = excluded.outcome,
    performed_at = excluded.performed_at,
    performed_by = excluded.performed_by,
    value_low_cents = excluded.value_low_cents,
    value_recommended_cents = excluded.value_recommended_cents,
    value_high_cents = excluded.value_high_cents,
    owner_expected_cents = excluded.owner_expected_cents,
    property_condition = excluded.property_condition,
    strengths = excluded.strengths,
    risks = excluded.risks,
    owner_project_summary = excluded.owner_project_summary,
    confidential_notes = excluded.confidential_notes,
    agent_recommendation = excluded.agent_recommendation,
    next_action = excluded.next_action,
    next_action_at = excluded.next_action_at,
    updated_by = v_uid
  returning er.id into v_id;

  -- Avance le stade vers « rendez_vous_realise » (si réalisée) sans rétrograder.
  if p_outcome = 'realisee' then
    update public.opportunities o set pipeline_stage = 'rendez_vous_realise'
    where o.id = p_opportunity_id
      and array_position(array[
        'nouveau','prise_de_contact_en_cours','contact_etabli','qualification_en_cours',
        'rendez_vous_planifie','rendez_vous_realise','estimation_etude_dossier',
        'proposition_de_mandat','en_attente_de_signature','mandat_signe'], o.pipeline_stage)
          < array_position(array[
        'nouveau','prise_de_contact_en_cours','contact_etabli','qualification_en_cours',
        'rendez_vous_planifie','rendez_vous_realise','estimation_etude_dossier',
        'proposition_de_mandat','en_attente_de_signature','mandat_signe'], 'rendez_vous_realise');
  end if;

  -- Audit SANS montants ni notes confidentielles (métadonnées seulement).
  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'estimation_report', v_id, 'estimation_realisee',
          jsonb_build_object('opportunity_id', p_opportunity_id, 'outcome', p_outcome));

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- =============================================================================
-- 10. FONCTIONS — DÉCISION D'ÉLIGIBILITÉ (validation humaine, admin/manager).
-- =============================================================================
create or replace function public.crm_validate_eligibility(
  p_opportunity_id uuid,
  p_decision text,
  p_reason text default null,
  p_is_derogation boolean default false,
  p_derogation_reason text default null
)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_old text;
begin
  if v_uid is null then
    raise exception 'authentification requise' using errcode = '28000';
  end if;
  if not public.crm_can_decide() then
    raise exception 'seul un administrateur ou un manager valide l''éligibilité' using errcode = '42501';
  end if;
  if p_decision not in ('parcours_premium_prodigio','agence_classique','non_retenu','a_completer') then
    raise exception 'décision d''éligibilité invalide' using errcode = '22023';
  end if;
  if p_is_derogation and nullif(btrim(coalesce(p_derogation_reason, '')), '') is null then
    raise exception 'une dérogation exige une justification' using errcode = '22023';
  end if;

  select eligibility_decision into v_old from public.opportunities where id = p_opportunity_id;
  if not found then
    raise exception 'opportunité introuvable' using errcode = '22023';
  end if;

  update public.opportunities set
    eligibility_decision = p_decision,
    eligibility_reason = nullif(btrim(p_reason), ''),
    eligibility_decided_by = v_uid,
    eligibility_decided_at = now(),
    eligibility_is_derogation = coalesce(p_is_derogation, false),
    eligibility_derogation_reason = nullif(btrim(p_derogation_reason), '')
  where id = p_opportunity_id;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, old_value, new_value)
  values (v_uid, 'opportunity', p_opportunity_id, 'decision_eligibilite',
          jsonb_build_object('eligibility', v_old),
          jsonb_build_object('eligibility', p_decision, 'derogation', coalesce(p_is_derogation, false)));

  return jsonb_build_object('ok', true, 'decision', p_decision);
end;
$$;

-- =============================================================================
-- 11. FONCTIONS — RÈGLES ÉCONOMIQUES (administrateur uniquement).
-- =============================================================================
create or replace function public.crm_upsert_economic_rule(
  p_id uuid,
  p_name text,
  p_segment text,
  p_effective_from date,
  p_fee_basis text default 'a_confirmer',
  p_prodigio_share_pct numeric default null,
  p_partner_share_pct numeric default null,
  p_organization_id uuid default null,
  p_effective_to date default null,
  p_status text default 'actif',
  p_notes text default null
)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  perform public.crm_require_role('administrateur');
  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception 'nom de règle requis' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_segment, '')), '') is null then
    raise exception 'segment requis' using errcode = '22023';
  end if;
  if p_fee_basis not in ('HT','TTC','a_confirmer') then
    raise exception 'base des honoraires invalide' using errcode = '22023';
  end if;
  if p_status not in ('actif','inactif') then
    raise exception 'statut invalide' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.economic_rule_sets
      (name, segment, organization_id, effective_from, effective_to, fee_basis,
       prodigio_share_pct, partner_share_pct, status, version, created_by, notes)
    values
      (btrim(p_name), btrim(p_segment), p_organization_id, p_effective_from, p_effective_to,
       p_fee_basis, p_prodigio_share_pct, p_partner_share_pct, p_status, 1, v_uid, nullif(btrim(p_notes), ''))
    returning id into v_id;
  else
    update public.economic_rule_sets set
      name = btrim(p_name), segment = btrim(p_segment), organization_id = p_organization_id,
      effective_from = p_effective_from, effective_to = p_effective_to, fee_basis = p_fee_basis,
      prodigio_share_pct = p_prodigio_share_pct, partner_share_pct = p_partner_share_pct,
      status = p_status, version = version + 1, notes = nullif(btrim(p_notes), '')
    where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'règle introuvable' using errcode = '22023';
    end if;
  end if;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'economic_rule', v_id, 'regle_economique_maj',
          jsonb_build_object('segment', btrim(p_segment), 'status', p_status));

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- =============================================================================
-- 12. FONCTIONS — MANDAT (transitions contrôlées, admin/manager).
-- =============================================================================

-- --- Brouillon -----------------------------------------------------------------
create or replace function public.crm_create_mandate_draft(
  p_opportunity_id uuid,
  p_holder_organization_id uuid default null,
  p_mandate_type text default null,
  p_is_exclusive boolean default null
)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_id uuid;
  v_holder_kind text;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.crm_can_decide() then
    raise exception 'seul un administrateur ou un manager gère les mandats' using errcode = '42501';
  end if;
  if not exists (select 1 from public.opportunities where id = p_opportunity_id) then
    raise exception 'opportunité introuvable' using errcode = '22023';
  end if;
  -- La porteuse, si fournie, ne peut JAMAIS être l'opérateur Prodigio.
  if p_holder_organization_id is not null then
    select kind into v_holder_kind from public.organizations where id = p_holder_organization_id;
    if v_holder_kind is distinct from 'agence_partenaire' then
      raise exception 'l''organisation porteuse doit être une agence partenaire habilitée' using errcode = '22023';
    end if;
  end if;

  v_org := public.crm_current_operator_org();
  if v_org is null then raise exception 'organisation introuvable' using errcode = '22023'; end if;

  insert into public.mandates
    (organization_id, opportunity_id, holder_organization_id, mandate_type, is_exclusive,
     status, created_by, last_modified_by)
  values
    (v_org, p_opportunity_id, p_holder_organization_id, nullif(btrim(p_mandate_type), ''),
     p_is_exclusive, 'brouillon', v_uid, v_uid)
  returning id into v_id;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'mandate', v_id, 'mandat_brouillon',
          jsonb_build_object('opportunity_id', p_opportunity_id));

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- --- Proposer (fige le snapshot économique depuis une règle active) -----------
create or replace function public.crm_propose_mandate(
  p_mandate_id uuid,
  p_economic_rule_id uuid,
  p_mandate_type text default null,
  p_is_exclusive boolean default null,
  p_start_date date default null,
  p_expires_at date default null
)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_m public.mandates;
  v_rule public.economic_rule_sets;
  v_snapshot jsonb;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.crm_can_decide() then
    raise exception 'droits insuffisants' using errcode = '42501';
  end if;

  select * into v_m from public.mandates where id = p_mandate_id;
  if v_m.id is null then raise exception 'mandat introuvable' using errcode = '22023'; end if;
  if v_m.status <> 'brouillon' then
    raise exception 'seul un brouillon peut être proposé' using errcode = '22023';
  end if;
  if v_m.holder_organization_id is null then
    raise exception 'organisation porteuse obligatoire avant proposition' using errcode = '22023';
  end if;

  select * into v_rule from public.economic_rule_sets where id = p_economic_rule_id;
  if v_rule.id is null or v_rule.status <> 'actif' then
    raise exception 'aucune règle économique active sélectionnée' using errcode = '22023';
  end if;

  -- Snapshot IMMUABLE des conditions applicables (photographie à la proposition).
  v_snapshot := jsonb_build_object(
    'economic_rule_id', v_rule.id, 'name', v_rule.name, 'segment', v_rule.segment,
    'organization_id', v_rule.organization_id, 'fee_basis', v_rule.fee_basis,
    'prodigio_share_pct', v_rule.prodigio_share_pct, 'partner_share_pct', v_rule.partner_share_pct,
    'version', v_rule.version, 'effective_from', v_rule.effective_from, 'captured_at', now());

  update public.mandates set
    status = 'propose',
    mandate_type = coalesce(nullif(btrim(p_mandate_type), ''), mandate_type),
    is_exclusive = coalesce(p_is_exclusive, is_exclusive),
    start_date = coalesce(p_start_date, start_date),
    expires_at = coalesce(p_expires_at, expires_at),
    economic_snapshot = v_snapshot,
    proposed_at = now(),
    last_modified_by = v_uid
  where id = p_mandate_id;

  update public.opportunities o set pipeline_stage = 'proposition_de_mandat'
  where o.id = v_m.opportunity_id
    and array_position(array[
      'nouveau','prise_de_contact_en_cours','contact_etabli','qualification_en_cours',
      'rendez_vous_planifie','rendez_vous_realise','estimation_etude_dossier',
      'proposition_de_mandat','en_attente_de_signature','mandat_signe'], o.pipeline_stage)
        < array_position(array[
      'nouveau','prise_de_contact_en_cours','contact_etabli','qualification_en_cours',
      'rendez_vous_planifie','rendez_vous_realise','estimation_etude_dossier',
      'proposition_de_mandat','en_attente_de_signature','mandat_signe'], 'proposition_de_mandat');

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'mandate', p_mandate_id, 'mandat_propose',
          jsonb_build_object('holder_organization_id', v_m.holder_organization_id));

  return jsonb_build_object('ok', true, 'id', p_mandate_id);
end;
$$;

-- --- Signer (import manuel : numéro + date + document obligatoires) -----------
create or replace function public.crm_sign_mandate(
  p_mandate_id uuid,
  p_mandate_number text,
  p_signed_at timestamptz,
  p_signed_document_id uuid,
  p_start_date date default null,
  p_expires_at date default null
)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_m public.mandates;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.crm_can_decide() then
    raise exception 'droits insuffisants' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_mandate_number, '')), '') is null then
    raise exception 'numéro de mandat requis pour signer' using errcode = '22023';
  end if;
  if p_signed_at is null then
    raise exception 'date de signature requise' using errcode = '22023';
  end if;
  if p_signed_document_id is null then
    raise exception 'document signé requis' using errcode = '22023';
  end if;

  select * into v_m from public.mandates where id = p_mandate_id;
  if v_m.id is null then raise exception 'mandat introuvable' using errcode = '22023'; end if;
  if v_m.status not in ('propose','en_attente_signature') then
    raise exception 'seul un mandat proposé / en attente peut être signé' using errcode = '22023';
  end if;
  if v_m.economic_snapshot is null then
    raise exception 'snapshot économique manquant' using errcode = '22023';
  end if;
  if not exists (select 1 from public.mandate_documents
                 where id = p_signed_document_id and opportunity_id = v_m.opportunity_id and status = 'actif') then
    raise exception 'document signé introuvable pour ce dossier' using errcode = '22023';
  end if;

  update public.mandates set
    status = 'signe', mandate_number = btrim(p_mandate_number), signed_at = p_signed_at,
    signed_document_id = p_signed_document_id,
    start_date = coalesce(p_start_date, start_date),
    expires_at = coalesce(p_expires_at, expires_at),
    last_modified_by = v_uid
  where id = p_mandate_id;

  update public.opportunities o set pipeline_stage = 'mandat_signe'
  where o.id = v_m.opportunity_id
    and array_position(array[
      'nouveau','prise_de_contact_en_cours','contact_etabli','qualification_en_cours',
      'rendez_vous_planifie','rendez_vous_realise','estimation_etude_dossier',
      'proposition_de_mandat','en_attente_de_signature','mandat_signe'], o.pipeline_stage)
        < array_position(array[
      'nouveau','prise_de_contact_en_cours','contact_etabli','qualification_en_cours',
      'rendez_vous_planifie','rendez_vous_realise','estimation_etude_dossier',
      'proposition_de_mandat','en_attente_de_signature','mandat_signe'], 'mandat_signe');

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'mandate', p_mandate_id, 'mandat_signe',
          jsonb_build_object('mandate_number', btrim(p_mandate_number)));

  return jsonb_build_object('ok', true, 'id', p_mandate_id);
end;
$$;

-- --- Transition terminale : en attente / refusé / expiré / annulé -------------
create or replace function public.crm_transition_mandate(
  p_mandate_id uuid,
  p_status text,
  p_reason_code text default null,
  p_reason text default null
)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_m public.mandates;
  v_evt text;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.crm_can_decide() then
    raise exception 'droits insuffisants' using errcode = '42501';
  end if;
  if p_status not in ('en_attente_signature','refuse','expire','annule') then
    raise exception 'transition invalide' using errcode = '22023';
  end if;

  select * into v_m from public.mandates where id = p_mandate_id;
  if v_m.id is null then raise exception 'mandat introuvable' using errcode = '22023'; end if;

  -- Transitions autorisées.
  if p_status = 'en_attente_signature' and v_m.status <> 'propose' then
    raise exception 'seul un mandat proposé passe en attente de signature' using errcode = '22023';
  end if;
  if p_status in ('refuse','annule') and v_m.status not in ('propose','en_attente_signature','brouillon') then
    raise exception 'ce mandat ne peut plus être refusé / annulé' using errcode = '22023';
  end if;
  if p_status = 'expire' and v_m.status not in ('propose','en_attente_signature','signe') then
    raise exception 'ce mandat ne peut pas expirer depuis son statut' using errcode = '22023';
  end if;

  update public.mandates set
    status = p_status,
    end_reason_code = case when p_status in ('refuse','expire','annule') then nullif(btrim(p_reason_code), '') else end_reason_code end,
    end_reason = case when p_status in ('refuse','expire','annule') then nullif(btrim(p_reason), '') else end_reason end,
    last_modified_by = v_uid
  where id = p_mandate_id;

  v_evt := case p_status
    when 'refuse' then 'mandat_refuse' when 'expire' then 'mandat_expire'
    when 'annule' then 'mandat_annule' else 'mandat_propose' end;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'mandate', p_mandate_id, v_evt,
          jsonb_build_object('status', p_status, 'reason_code', nullif(btrim(p_reason_code), '')));

  return jsonb_build_object('ok', true, 'status', p_status);
end;
$$;

-- =============================================================================
-- 13. FONCTIONS — RÉSULTAT COMMERCIAL structuré (code de raison).
--     Remplace crm_record_outcome par une version à paramètre `p_reason_code`
--     optionnel (l'ancienne signature 3-args est retirée pour éviter toute
--     ambiguïté de résolution PostgREST ; les appels existants — 3 arguments
--     nommés — résolvent la nouvelle fonction, p_reason_code prenant sa valeur
--     par défaut). « signé/gagné » réservé à admin/manager ; les pertes restent
--     ouvertes aux opérateurs (setter inclus) MAIS avec motif obligatoire.
-- =============================================================================
drop function if exists public.crm_record_outcome(uuid, text, text);

create or replace function public.crm_record_outcome(
  p_opportunity_id uuid,
  p_outcome text,
  p_reason text default null,
  p_reason_code text default null
)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_old text;
begin
  -- Le résultat « signé / gagné » ne peut être déclaré que par admin/manager
  -- (le setter ne déclare jamais un mandat signé).
  if p_outcome = 'signe_gagne' then
    perform public.crm_require_role('administrateur', 'manager');
  else
    perform public.crm_require_role('administrateur', 'manager', 'setter');
  end if;

  if p_outcome <> all (array['signe_gagne','refuse_apres_proposition','perdu_avant_signature']) then
    raise exception 'résultat invalide' using errcode = '22023';
  end if;
  if p_outcome <> 'signe_gagne' and nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'motif requis pour une perte ou une disqualification' using errcode = '22023';
  end if;

  select outcome into v_old from public.opportunities where id = p_opportunity_id;
  if not exists (select 1 from public.opportunities where id = p_opportunity_id) then
    raise exception 'opportunité introuvable' using errcode = '22023';
  end if;

  update public.opportunities set
    outcome = p_outcome,
    outcome_reason = nullif(left(p_reason, 1000), ''),
    outcome_reason_code = nullif(btrim(p_reason_code), ''),
    loss_reason = case when p_outcome <> 'signe_gagne'
                       then nullif(left(p_reason, 1000), '') else loss_reason end,
    outcome_recorded_by = auth.uid(),
    outcome_recorded_at = now(),
    pipeline_stage = case
      when p_outcome = 'signe_gagne' then 'mandat_signe'
      when p_outcome = 'perdu_avant_signature' then 'perdu'
      else pipeline_stage end,
    processing_status = 'clos'
  where id = p_opportunity_id;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, old_value, new_value)
  values (auth.uid(), 'opportunity', p_opportunity_id, 'resultat_commercial',
          jsonb_build_object('outcome', v_old),
          jsonb_build_object('outcome', p_outcome, 'reason_code', nullif(btrim(p_reason_code), '')));

  return jsonb_build_object('ok', true);
end;
$$;

-- =============================================================================
-- 14. FONCTIONS — DOCUMENTS (métadonnées ; fichiers gérés côté serveur).
--     L'upload/téléchargement passe par le rôle de service (URL signée) ; ici on
--     enregistre / supprime les MÉTADONNÉES, avec audit.
-- =============================================================================
create or replace function public.crm_register_document(
  p_opportunity_id uuid,
  p_kind text,
  p_storage_path text,
  p_file_name text,
  p_mime_type text,
  p_size_bytes bigint,
  p_mandate_id uuid default null
)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_id uuid;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.crm_can_decide() then
    raise exception 'droits insuffisants pour gérer les documents' using errcode = '42501';
  end if;
  if p_kind not in ('mandat_propose','mandat_signe','estimation_avis_valeur','piece_interne') then
    raise exception 'type de document invalide' using errcode = '22023';
  end if;
  if p_mime_type not in ('application/pdf','image/jpeg','image/png') then
    raise exception 'type de fichier non autorisé' using errcode = '22023';
  end if;
  if p_size_bytes is null or p_size_bytes <= 0 then
    raise exception 'fichier vide' using errcode = '22023';
  end if;
  if not exists (select 1 from public.opportunities where id = p_opportunity_id) then
    raise exception 'opportunité introuvable' using errcode = '22023';
  end if;

  v_org := public.crm_current_operator_org();

  insert into public.mandate_documents
    (organization_id, opportunity_id, mandate_id, kind, storage_path, file_name,
     mime_type, size_bytes, uploaded_by)
  values
    (v_org, p_opportunity_id, p_mandate_id, p_kind, p_storage_path,
     left(btrim(p_file_name), 300), p_mime_type, p_size_bytes, v_uid)
  returning id into v_id;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'document', v_id, 'document_ajoute',
          jsonb_build_object('opportunity_id', p_opportunity_id, 'kind', p_kind));

  return jsonb_build_object('ok', true, 'id', v_id, 'storage_path', p_storage_path);
end;
$$;

create or replace function public.crm_delete_document(p_document_id uuid)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_doc public.mandate_documents;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.crm_can_decide() then
    raise exception 'droits insuffisants' using errcode = '42501';
  end if;

  update public.mandate_documents set status = 'supprime', deleted_by = v_uid, deleted_at = now()
  where id = p_document_id and status = 'actif'
  returning * into v_doc;
  if v_doc.id is null then
    raise exception 'document introuvable ou déjà supprimé' using errcode = '22023';
  end if;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'document', p_document_id, 'document_supprime',
          jsonb_build_object('opportunity_id', v_doc.opportunity_id));

  return jsonb_build_object('ok', true, 'storage_path', v_doc.storage_path);
end;
$$;

-- =============================================================================
-- 15. FONCTIONS — HANDOFF vers la Fabrique de biens (idempotent, gate strict).
-- =============================================================================
create or replace function public.crm_handoff_create_property(p_mandate_id uuid)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_m public.mandates;
  v_elig text;
  v_org uuid;
  v_id uuid;
  v_existing uuid;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.crm_can_decide() then
    raise exception 'droits insuffisants pour créer le bien' using errcode = '42501';
  end if;

  select * into v_m from public.mandates where id = p_mandate_id;
  if v_m.id is null then raise exception 'mandat introuvable' using errcode = '22023'; end if;

  -- Idempotence : un bien existe déjà pour ce mandat → on le renvoie.
  select id into v_existing from public.properties where mandate_id = p_mandate_id;
  if v_existing is not null then
    return jsonb_build_object('ok', true, 'id', v_existing, 'already', true);
  end if;

  -- Gate : premium + signé + porteuse + document signé.
  select eligibility_decision into v_elig from public.opportunities where id = v_m.opportunity_id;
  if v_elig is distinct from 'parcours_premium_prodigio' then
    raise exception 'création réservée aux dossiers premium validés' using errcode = '22023';
  end if;
  if v_m.status <> 'signe' then
    raise exception 'le mandat doit être signé' using errcode = '22023';
  end if;
  if v_m.holder_organization_id is null then
    raise exception 'organisation porteuse manquante' using errcode = '22023';
  end if;
  if v_m.signed_document_id is null then
    raise exception 'document signé manquant' using errcode = '22023';
  end if;

  v_org := public.crm_current_operator_org();

  insert into public.properties
    (organization_id, opportunity_id, mandate_id, holder_organization_id, status, created_by)
  values
    (v_org, v_m.opportunity_id, p_mandate_id, v_m.holder_organization_id, 'preparation_a_lancer', v_uid)
  on conflict (mandate_id) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.properties where mandate_id = p_mandate_id;
    return jsonb_build_object('ok', true, 'id', v_id, 'already', true);
  end if;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'property', v_id, 'bien_cree',
          jsonb_build_object('opportunity_id', v_m.opportunity_id, 'mandate_id', p_mandate_id));

  return jsonb_build_object('ok', true, 'id', v_id, 'already', false);
end;
$$;

-- =============================================================================
-- 16. GRANTS — EXECUTE aux seuls `authenticated`, jamais anon/public.
-- =============================================================================
do $$
declare fn text;
begin
  for fn in
    select unnest(array[
      'public.crm_save_estimation_report(uuid, text, timestamptz, uuid, bigint, bigint, bigint, bigint, text, text, text, text, text, text, text, timestamptz, uuid)',
      'public.crm_validate_eligibility(uuid, text, text, boolean, text)',
      'public.crm_upsert_economic_rule(uuid, text, text, date, text, numeric, numeric, uuid, date, text, text)',
      'public.crm_create_mandate_draft(uuid, uuid, text, boolean)',
      'public.crm_propose_mandate(uuid, uuid, text, boolean, date, date)',
      'public.crm_sign_mandate(uuid, text, timestamptz, uuid, date, date)',
      'public.crm_transition_mandate(uuid, text, text, text)',
      'public.crm_record_outcome(uuid, text, text, text)',
      'public.crm_register_document(uuid, text, text, text, text, bigint, uuid)',
      'public.crm_delete_document(uuid)',
      'public.crm_handoff_create_property(uuid)'
    ])
  loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end $$;

commit;
