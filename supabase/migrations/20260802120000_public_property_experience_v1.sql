-- =============================================================================
-- Prodigio OS — Migration 20260802120000_public_property_experience_v1
--
-- « Expérience publique du bien & Funnel Acquéreur — V1 ».
-- Transforme un bien préparé dans la Fabrique en une expérience publique premium
-- dédiée à cette seule propriété, puis permet aux acquéreurs de se qualifier.
--
-- STRICTEMENT ADDITIVE. Ne modifie ni ne supprime aucune migration historique,
-- aucune donnée réelle. S'appuie sur l'existant : properties (Fabrique),
-- property_media (bucket PRIVÉ), contacts, privacy_records, organizations,
-- audit_events immuable, RLS, helpers crm_is_operator / crm_has_role /
-- crm_can_decide / crm_assigned_opportunity_ids / crm_property_access /
-- crm_property_readiness.
--
-- Ajoute :
--   1. Extension ADDITIVE des CHECK d'audit_events (entity « buyer_interest »,
--      événements « bien_public_* », « bien_publie/depublie », « acquereur_* »).
--   2. property_public_config      — configuration éditable de l'expérience
--      publique (slug, contenus, sections, hero, CTA, prix, localisation
--      approximative, SEO, statut de publication). 1-1 avec le bien.
--   3. property_public_media        — médias EXPRESSÉMENT approuvés pour diffusion
--      (bucket Storage PUBLIC dédié, aucun document légal, aucune PII).
--   4. property_public_snapshots    — snapshots publics VERSIONNÉS et immuables
--      (le seul contenu servi au public ; jamais les données privées).
--   5. buyer_interests              — soumission acquéreur conservée + réception
--      opérationnelle minimale (idempotence, attribution, scoring, statut).
--   6. Extension ADDITIVE de privacy_records (rattachement à un intérêt acquéreur).
--   7. compute_buyer_scores         — scoring acquéreur déterministe & versionné.
--   8. Fonctions SECURITY DEFINER   — configuration, médias publics, publication
--      contrôlée (garde côté serveur), snapshot, prévisualisation, réception.
--   9. public_property_by_slug + submit_buyer_interest — points d'entrée PUBLICS
--      (anon) : lecture du snapshot publié uniquement, dépôt acquéreur contrôlé.
--  10. Bucket Storage PUBLIC « property-public » (médias approuvés uniquement).
--
-- Sécurité : aucune fuite d'adresse exacte, de notes internes, de documents
-- privés, de mandat, de données économiques ou du propriétaire vers le public.
-- Le contrôle de publication est CALCULÉ et effectué côté serveur. La réponse du
-- dépôt acquéreur est NEUTRE. Aucun paramètre économique n'est codé en dur.
-- Le bucket PRIVÉ « property-assets » de la Fabrique n'est JAMAIS rendu public.
--
-- Application : voir docs/07-SUPABASE-SETUP.md. NE PAS exécuter automatiquement.
-- =============================================================================

begin;

-- =============================================================================
-- 1. AUDIT — extension ADDITIVE (sur-ensemble strict).
-- =============================================================================
alter table public.audit_events
  drop constraint if exists audit_events_entity_type_check,
  add constraint audit_events_entity_type_check check (
    entity_type in (
      'opportunity', 'contact', 'membership', 'organization', 'invitation',
      'calendar_connection', 'estimation_appointment',
      'estimation_report', 'mandate', 'economic_rule', 'document', 'property',
      -- Nouveau (expérience publique & acquéreurs) :
      'buyer_interest'));

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
      'estimation_realisee', 'decision_eligibilite',
      'regle_economique_maj',
      'mandat_brouillon', 'mandat_propose', 'mandat_signe',
      'mandat_refuse', 'mandat_expire', 'mandat_annule',
      'document_ajoute', 'document_remplace', 'document_supprime',
      'bien_cree',
      'bien_identite', 'bien_positionnement', 'bien_statut', 'bien_responsable',
      'bien_media_ajoute', 'bien_media_supprime', 'bien_media_principal',
      'bien_document_ajoute', 'bien_document_supprime',
      'bien_production_maj', 'bien_pret',
      -- Nouveaux (expérience publique & acquéreurs) :
      'bien_public_config', 'bien_public_media_ajoute', 'bien_public_media_supprime',
      'bien_public_hero', 'bien_public_valide', 'bien_public_statut',
      'bien_publie', 'bien_depublie',
      'acquereur_interet_statut'));

-- =============================================================================
-- 2. PROPERTY_PUBLIC_CONFIG — configuration de l'expérience publique (1-1).
--    Contient UNIQUEMENT des champs destinés à un usage public sélectionné
--    (sauf `reference_value_cents`, interne, jamais diffusé — sert le scoring
--    acquéreur côté serveur). L'adresse EXACTE n'est jamais ici : seule une
--    localisation APPROXIMATIVE publique est stockée.
-- =============================================================================
create table if not exists public.property_public_config (
  property_id            uuid primary key references public.properties (id) on delete cascade,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  -- Identité publique.
  slug                   text,
  public_name            text,
  tagline                text,          -- signature / accroche
  intro                  text,
  story                  text,
  experience_text        text,          -- l'expérience de vie
  architecture_text      text,          -- architecture & caractère
  pillars                text,          -- piliers de valorisation
  highlighted_features   text,          -- caractéristiques à mettre en avant
  emotional_details      text,          -- détails « coup de cœur »
  environment_text       text,          -- environnement & art de vivre

  -- Composition.
  sections_config        jsonb,         -- { visible: {...}, order: [...] }
  hero_media_id          uuid,          -- média Hero (image/vidéo)
  main_public_media_id   uuid,          -- image principale (aperçu social)
  social_image_media_id  uuid,          -- image sociale dédiée (sinon principale)

  -- Appel à l'action acquéreur.
  cta_label              text,

  -- Prix & localisation (confidentialité par défaut).
  show_price             boolean not null default false,
  price_label            text,          -- libellé libre (ex. « Sur demande »)
  public_location        text,          -- localisation APPROXIMATIVE publique

  -- Interne au scoring acquéreur (JAMAIS diffusé au public).
  reference_value_cents  bigint check (reference_value_cents is null or reference_value_cents >= 0),

  -- SEO.
  seo_index              boolean not null default false,  -- noindex par défaut
  seo_title              text,
  seo_description        text,

  -- Réglages de confidentialité définis (garde de publication).
  privacy_reviewed       boolean not null default false,

  -- Validation humaine du contenu public (décision : admin/manager).
  validated              boolean not null default false,
  validated_by           uuid references auth.users (id) on delete set null,
  validated_at           timestamptz,

  -- Workflow de publication (distinct de la machine d'état de la Fabrique).
  publication_status     text not null default 'brouillon'
                           check (publication_status in (
                             'brouillon', 'en_preparation', 'pret_a_publier',
                             'publie', 'depublie', 'archive')),
  published_snapshot_id  uuid,          -- snapshot actuellement en ligne
  first_published_at     timestamptz,
  published_at           timestamptz,
  published_by           uuid references auth.users (id) on delete set null,

  updated_by             uuid references auth.users (id) on delete set null
);

comment on table public.property_public_config is
  'Configuration de l''expérience publique d''un bien (slug, contenus éditoriaux, sections, hero, CTA, prix, localisation approximative, SEO, statut de publication). 1-1 avec properties. `reference_value_cents` est INTERNE (scoring acquéreur), jamais diffusé. Aucune adresse exacte, aucune donnée privée.';

-- Slug public unique (globalement). Insensible à la casse, hors valeurs nulles.
create unique index if not exists property_public_config_slug_unique
  on public.property_public_config (lower(slug)) where slug is not null;

drop trigger if exists property_public_config_set_updated_at on public.property_public_config;
create trigger property_public_config_set_updated_at
  before update on public.property_public_config
  for each row execute function public.set_updated_at();

alter table public.property_public_config enable row level security;
grant select on public.property_public_config to authenticated;

-- =============================================================================
-- 3. PROPERTY_PUBLIC_MEDIA — médias EXPRESSÉMENT approuvés.
--    CYCLE DE VIE MAÎTRISÉ (cf. docs/19 § Médias) :
--      - le MASTER est téléversé dans un bucket PRIVÉ dédié
--        « property-public-master » (jamais public) : colonne `storage_path` ;
--      - à la PUBLICATION, une COPIE publique (chemin frais, sans PII) est créée
--        dans le bucket PUBLIC « property-public » : colonne `public_path` ;
--      - à la DÉPUBLICATION / archivage, les COPIES publiques sont SUPPRIMÉES
--        (`public_path` remis à null) — la copie directe cesse de résoudre.
--    Aucun objet du bucket privé de la Fabrique (`property-assets`) n'est rendu
--    public. Aucun document légal ici. Aucune PII dans les chemins.
-- =============================================================================
create table if not exists public.property_public_media (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  property_id      uuid not null references public.properties (id) on delete cascade,
  -- Origine privée éventuelle (traçabilité ; sans accès depuis le public).
  source_media_id  uuid references public.property_media (id) on delete set null,
  kind             text not null
                     check (kind in ('photo', 'video', 'drone', 'rendu', 'plan', 'couverture')),
  -- MASTER dans le bucket PRIVÉ « property-public-master ». Jamais public.
  storage_path     text not null,
  -- COPIE publique courante dans « property-public » (null = non publié / dépublié).
  public_path      text,
  file_name        text not null,
  mime_type        text not null,
  size_bytes       bigint not null check (size_bytes >= 0),
  alt_text         text,
  caption          text,
  sort_order       integer not null default 0,
  -- Approbation EXPLICITE pour diffusion (seuls les approuvés deviennent publics).
  approved         boolean not null default true,
  status           text not null default 'actif' check (status in ('actif', 'supprime')),
  uploaded_by      uuid references auth.users (id) on delete set null,
  deleted_by       uuid references auth.users (id) on delete set null,
  deleted_at       timestamptz,
  constraint property_public_media_storage_unique unique (storage_path)
);

comment on table public.property_public_media is
  'Médias EXPRESSÉMENT approuvés pour la diffusion. MASTER privé (storage_path, bucket « property-public-master »), COPIE publique courante (public_path, bucket « property-public ») créée à la publication et SUPPRIMÉE à la dépublication/archivage. Aucun document légal, aucune PII. Seuls les médias approuvés et actifs entrent dans un snapshot.';

create index if not exists property_public_media_property_idx
  on public.property_public_media (property_id, status, sort_order);

drop trigger if exists property_public_media_set_updated_at on public.property_public_media;
create trigger property_public_media_set_updated_at
  before update on public.property_public_media
  for each row execute function public.set_updated_at();

alter table public.property_public_media enable row level security;
grant select on public.property_public_media to authenticated;

-- FK des médias sélectionnés (ajoutées après la table media).
alter table public.property_public_config
  drop constraint if exists property_public_config_hero_fk,
  add constraint property_public_config_hero_fk
    foreign key (hero_media_id) references public.property_public_media (id) on delete set null,
  drop constraint if exists property_public_config_main_fk,
  add constraint property_public_config_main_fk
    foreign key (main_public_media_id) references public.property_public_media (id) on delete set null,
  drop constraint if exists property_public_config_social_fk,
  add constraint property_public_config_social_fk
    foreign key (social_image_media_id) references public.property_public_media (id) on delete set null;

-- =============================================================================
-- 4. PROPERTY_PUBLIC_SNAPSHOTS — snapshots publics VERSIONNÉS et immuables.
--    Le seul contenu servi au public. Contient EXCLUSIVEMENT des champs publics
--    sélectionnés (jamais de données privées). Conserve version et date.
-- =============================================================================
create table if not exists public.property_public_snapshots (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  property_id      uuid not null references public.properties (id) on delete cascade,
  version          integer not null,
  slug             text not null,
  seo_index        boolean not null default false,
  content          jsonb not null,      -- charge publique sélectionnée & figée
  published_by     uuid references auth.users (id) on delete set null,
  constraint property_public_snapshots_version_unique unique (property_id, version)
);

comment on table public.property_public_snapshots is
  'Snapshots publics VERSIONNÉS et immuables d''un bien. Seul contenu servi au public (via public_property_by_slug), figé au moment de la publication. Contient uniquement des champs publics sélectionnés. Modifier la Fabrique ne change pas la page publiée tant qu''un nouveau snapshot n''est pas publié.';

create index if not exists property_public_snapshots_property_idx
  on public.property_public_snapshots (property_id, version desc);

alter table public.property_public_snapshots enable row level security;
grant select on public.property_public_snapshots to authenticated;

-- FK du snapshot en ligne (ajoutée après la table snapshots).
alter table public.property_public_config
  drop constraint if exists property_public_config_snapshot_fk,
  add constraint property_public_config_snapshot_fk
    foreign key (published_snapshot_id) references public.property_public_snapshots (id) on delete set null;

-- =============================================================================
-- 5. BUYER_INTERESTS — soumission acquéreur conservée + réception minimale.
--    Rattachée à UN bien. Réutilise `contacts` pour la personne (dédoublonnage
--    conservateur par e-mail). Ne crée AUCUNE opportunité (le CRM Acquéreurs
--    complet est hors périmètre). Idempotence sur idempotency_key.
-- =============================================================================
create table if not exists public.buyer_interests (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  organization_id       uuid not null references public.organizations (id) on delete cascade,
  property_id           uuid not null references public.properties (id) on delete cascade,
  contact_id            uuid references public.contacts (id) on delete set null,

  funnel_key            text not null default 'buyer_interest',
  funnel_version        text not null,
  idempotency_key       text not null,

  -- Réponses BRUTES ET normalisées, conservées intégralement.
  raw_answers           jsonb not null,
  normalized_answers    jsonb not null,

  -- Réponses dénormalisées (requêtage / cockpit).
  project_nature        text,
  budget_band           text,
  financing             text,
  purchase_horizon      text,
  decision_mode         text,
  availability          text,
  residence_country     text,
  residence_area        text,

  contact_first_name    text,
  contact_last_name     text,
  contact_email         text,
  contact_email_raw     text,
  contact_phone         text,
  contact_phone_raw     text,
  contact_preference    text,
  contact_recall_preference text,

  consent_given         boolean not null default false,
  consent_notice_version text,

  -- Attribution / source (premier & dernier contact au minimum).
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

  -- Scoring acquéreur (photographie versionnée). Le score reste INTERNE.
  budget_score          integer,
  maturity_score        integer,
  financing_score       integer,
  availability_score    integer,
  overall_score         integer,
  priority              text,
  score_version         text,
  score_breakdown       jsonb,

  -- Réception opérationnelle minimale (mutable, distincte de la soumission).
  review_status         text not null default 'nouveau'
                          check (review_status in ('nouveau', 'consulte', 'traite')),
  reviewed_by           uuid references auth.users (id) on delete set null,
  reviewed_at           timestamptz,

  -- Résolution du contact (interne ; la soumission reste la source).
  resolution            text
                          check (resolution is null or resolution in ('nouveau_contact', 'contact_existant')),

  constraint buyer_interests_idempotency_key_unique unique (idempotency_key)
);

comment on table public.buyer_interests is
  'Intérêt acquéreur : soumission originale conservée (idempotence, attribution, preuve RGPD reliée) + réception opérationnelle minimale (statut nouveau/consulté/traité). Rattaché à UN bien ; réutilise contacts (dédoublonnage par e-mail). Ne crée aucune opportunité (CRM Acquéreurs complet hors périmètre V1).';

create index if not exists buyer_interests_property_idx
  on public.buyer_interests (property_id, created_at desc);
create index if not exists buyer_interests_contact_idx on public.buyer_interests (contact_id);
create index if not exists buyer_interests_review_idx on public.buyer_interests (property_id, review_status);

drop trigger if exists buyer_interests_set_updated_at on public.buyer_interests;
create trigger buyer_interests_set_updated_at
  before update on public.buyer_interests
  for each row execute function public.set_updated_at();

alter table public.buyer_interests enable row level security;
grant select on public.buyer_interests to authenticated;

-- =============================================================================
-- 6. PRIVACY_RECORDS — extension ADDITIVE (rattachement à un intérêt acquéreur).
-- =============================================================================
alter table public.privacy_records
  add column if not exists buyer_interest_id uuid references public.buyer_interests (id) on delete set null;

create index if not exists privacy_records_buyer_interest_idx
  on public.privacy_records (buyer_interest_id);

-- =============================================================================
-- 7. SÉCURITÉ — RLS des tables internes (accès dérivé du bien). Aucun accès
--    public direct : le public passe UNIQUEMENT par les fonctions dédiées.
-- =============================================================================
drop policy if exists property_public_config_read on public.property_public_config;
create policy property_public_config_read on public.property_public_config
  for select to authenticated using (public.crm_property_access(property_id));

drop policy if exists property_public_media_read on public.property_public_media;
create policy property_public_media_read on public.property_public_media
  for select to authenticated
  using (status = 'actif' and public.crm_property_access(property_id));

drop policy if exists property_public_snapshots_read on public.property_public_snapshots;
create policy property_public_snapshots_read on public.property_public_snapshots
  for select to authenticated using (public.crm_property_access(property_id));

drop policy if exists buyer_interests_read on public.buyer_interests;
create policy buyer_interests_read on public.buyer_interests
  for select to authenticated using (public.crm_property_access(property_id));

-- Défense en profondeur : jamais d'accès direct anon/public aux tables.
revoke all on public.property_public_config, public.property_public_media,
  public.property_public_snapshots, public.buyer_interests from anon, public;

-- =============================================================================
-- 8. SCORING ACQUÉREUR — déterministe, versionné, explicable (miroir SQL).
--    Dimensions : compatibilité budgétaire, maturité du projet, financement,
--    disponibilité. Le score exact reste INTERNE ; jamais de « refusé » auto.
--    ⚠️ Miroir de src/modules/buyers/scoring/config.ts (buyer-scoring-v1).
-- =============================================================================
create or replace function public.compute_buyer_scores(
  p_budget_band       text,
  p_financing         text,
  p_purchase_horizon  text,
  p_project_nature    text,
  p_decision_mode     text,
  p_availability      text,
  p_reference_cents   bigint
)
returns jsonb
language sql
immutable
set search_path = pg_catalog, pg_temp
as $$
  with band as (
    -- Bornes indicatives (cents) de chaque tranche de budget acquéreur.
    select
      case p_budget_band
        when 'moins_800k' then 0 when '800k_1_2m' then 80000000
        when '1_2m_2m' then 120000000 when '2m_3m' then 200000000
        when 'plus_3m' then 300000000 else null end as b_min,
      case p_budget_band
        when 'moins_800k' then 80000000 when '800k_1_2m' then 120000000
        when '1_2m_2m' then 200000000 when '2m_3m' then 300000000
        when 'plus_3m' then null else null end as b_max
  ),
  dims as (
    select
      -- Compatibilité budgétaire vs valeur de référence (interne). Sans référence
      -- ou tranche « à définir » : neutre (aucune fausse précision).
      case
        when p_reference_cents is null or p_budget_band is null or p_budget_band = 'a_definir' then 50
        when (select b_min from band) is not null
             and (select b_min from band) >= p_reference_cents then 92
        when (select b_max from band) is null then 78                       -- plus_3m couvre tout
        when (select b_max from band) >= p_reference_cents then 66
        when (select b_max from band) >= (p_reference_cents * 85 / 100) then 42
        else 20
      end as budget,
      -- Financement.
      coalesce(case p_financing
        when 'fonds_propres' then 100 when 'accord_bancaire' then 76
        when 'financement_a_organiser' then 40 else 45 end, 45) as financing,
      -- Maturité (horizon + décision + nature du projet).
      coalesce(case p_purchase_horizon
        when 'immediat' then 60 when 'trois_mois' then 50
        when 'six_mois' then 34 when 'en_reflexion' then 14 else 20 end, 20)
      + coalesce(case p_decision_mode
        when 'seul' then 22 when 'avec_autres' then 14 else 12 end, 12)
      + coalesce(case p_project_nature
        when 'residence_principale' then 18 when 'residence_secondaire' then 16
        when 'investissement' then 12 when 'autre' then 8 else 8 end, 8) as maturity_raw,
      -- Disponibilité.
      coalesce(case p_availability
        when 'disponible_visite' then 100 when 'disponible_echange' then 72
        when 'a_convenir' then 45 else 45 end, 45) as availability
    from band
  ),
  scored as (
    select
      least(100, greatest(0, budget)) as budget,
      least(100, greatest(0, financing)) as financing,
      least(100, greatest(0, maturity_raw)) as maturity,
      least(100, greatest(0, availability)) as availability
    from dims
  ),
  overall as (
    select *,
      -- Pondération : budget 35 %, maturité 30 %, financement 20 %, dispo 15 %.
      round((budget * 0.35 + maturity * 0.30 + financing * 0.20 + availability * 0.15))::int as overall
    from scored
  )
  select jsonb_build_object(
    'score_version', 'buyer-scoring-v1',
    'budget', jsonb_build_object('score', budget, 'value', p_budget_band, 'weight', 35),
    'maturity', jsonb_build_object('score', maturity, 'value', p_purchase_horizon, 'weight', 30),
    'financing', jsonb_build_object('score', financing, 'value', p_financing, 'weight', 20),
    'availability', jsonb_build_object('score', availability, 'value', p_availability, 'weight', 15),
    'overall', overall,
    'priority', case
      when overall >= 68 and budget >= 55 and financing >= 55 then 'prioritaire'
      when overall >= 45 then 'a_qualifier'
      else 'a_suivre' end
  )
  from overall;
$$;

comment on function public.compute_buyer_scores(text, text, text, text, text, text, bigint) is
  'Scoring acquéreur déterministe et versionné (buyer-scoring-v1). Dimensions : compatibilité budgétaire (vs valeur de référence INTERNE), maturité du projet, financement, disponibilité. Priorité opérationnelle interne. Miroir de src/modules/buyers/scoring/config.ts. Le score exact reste interne ; jamais de refus automatique.';

revoke all on function public.compute_buyer_scores(text, text, text, text, text, text, bigint) from public, anon;

-- =============================================================================
-- 9. HELPER — assemblage du CONTENU PUBLIC (source du snapshot & de la preview).
--    Lit UNIQUEMENT property_public_config + property_public_media : jamais les
--    champs privés du bien, ni les notes, ni les documents, ni l'adresse exacte,
--    ni les données économiques ou du propriétaire. Garantie structurelle
--    d'absence de fuite.
-- =============================================================================
create or replace function public.build_property_public_content(
  p_property_id uuid, p_mode text default 'publish')
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  -- Deux modes :
  --   'publish'  → chemins de COPIE publique (public_path, bucket « property-public »),
  --                servis directement au public. Exclut les médias non encore copiés.
  --   'preview'  → chemins du MASTER privé (storage_path, bucket
  --                « property-public-master ») + `needs_sign` : la prévisualisation
  --                (authentifiée) génère des URL signées côté serveur. AUCUN chemin
  --                de master n'est jamais exposé au public (mode 'preview' réservé
  --                à crm_property_public_preview).
  with params as (
    select (p_mode = 'preview') as preview
  ),
  cfg as (
    select * from public.property_public_config where property_id = p_property_id
  ),
  eligible as (
    -- En publication : seulement les médias disposant d'une copie publique.
    select m.*,
      case when (select preview from params) then m.storage_path else m.public_path end as path,
      case when (select preview from params) then 'property-public-master' else 'property-public' end as bucket
    from public.property_public_media m
    where m.property_id = p_property_id and m.status = 'actif' and m.approved is true
      and (case when (select preview from params) then m.storage_path else m.public_path end) is not null
  ),
  media as (
    select jsonb_agg(
             jsonb_build_object(
               'id', e.id, 'kind', e.kind, 'bucket', e.bucket,
               'storage_path', e.path, 'mime_type', e.mime_type,
               'alt', e.alt_text, 'caption', e.caption, 'sort_order', e.sort_order,
               'needs_sign', (select preview from params)
             ) order by e.sort_order, e.created_at
           ) as items
    from eligible e
  ),
  hero as (
    select jsonb_build_object(
             'id', e.id, 'kind', e.kind, 'bucket', e.bucket,
             'storage_path', e.path, 'mime_type', e.mime_type, 'alt', e.alt_text,
             'needs_sign', (select preview from params)
           ) as node
    from eligible e join cfg on cfg.hero_media_id = e.id
  ),
  main as (
    select jsonb_build_object(
             'id', e.id, 'bucket', e.bucket, 'storage_path', e.path,
             'mime_type', e.mime_type, 'alt', e.alt_text,
             'needs_sign', (select preview from params)
           ) as node
    from eligible e join cfg on cfg.main_public_media_id = e.id
  ),
  social as (
    -- Chemin de l'image sociale (SEO). En publication uniquement : copie publique.
    select case when (select preview from params) then null else coalesce(
      (select e.path from eligible e join cfg on cfg.social_image_media_id = e.id),
      (select e.path from eligible e join cfg on cfg.main_public_media_id = e.id)
    ) end as social_path
  )
  select jsonb_build_object(
    'slug', (select slug from cfg),
    'public_name', (select public_name from cfg),
    'tagline', (select tagline from cfg),
    'intro', (select intro from cfg),
    'story', (select story from cfg),
    'experience', (select experience_text from cfg),
    'architecture', (select architecture_text from cfg),
    'pillars', (select pillars from cfg),
    'features', (select highlighted_features from cfg),
    'emotional_details', (select emotional_details from cfg),
    'environment', (select environment_text from cfg),
    'sections', (select sections_config from cfg),
    'cta_label', (select cta_label from cfg),
    'show_price', (select show_price from cfg),
    'price_label', (select price_label from cfg),
    'location', (select public_location from cfg),
    'seo', jsonb_build_object(
      'index', (select seo_index from cfg),
      'title', (select seo_title from cfg),
      'description', (select seo_description from cfg),
      'social_path', (select social_path from social)
    ),
    'hero', (select node from hero),
    'main_media', (select node from main),
    'gallery', coalesce((select items from media), '[]'::jsonb)
  );
$$;

comment on function public.build_property_public_content(uuid, text) is
  'Assemble le CONTENU PUBLIC d''un bien à partir de property_public_config + property_public_media UNIQUEMENT (aucune donnée privée). Mode publish → copies publiques ; mode preview → masters privés à signer. Source unique du snapshot publié et de la prévisualisation privée.';

revoke all on function public.build_property_public_content(uuid, text) from public, anon;
grant execute on function public.build_property_public_content(uuid, text) to authenticated;

-- =============================================================================
-- 10. GARDE DE PUBLICATION — readiness publique CALCULÉE (source de vérité).
--     Un bien ne peut être publié que si TOUTES les conditions sont réunies.
-- =============================================================================
create or replace function public.crm_property_public_readiness(p_property_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_cfg public.property_public_config;
  v_internal jsonb;
  v_internal_ready boolean;
  v_has_title boolean;
  v_has_intro boolean;
  v_has_slug boolean;
  v_positioning_validated boolean;
  v_content_validated boolean;
  v_main_media boolean;
  v_approved_media boolean;
  v_privacy boolean;
  v_cta boolean;
  v_ok int := 0; v_total int := 10;
begin
  if not public.crm_property_access(p_property_id) then
    raise exception 'droits insuffisants sur ce bien' using errcode = '42501';
  end if;
  select * into v_cfg from public.property_public_config where property_id = p_property_id;

  v_internal := public.crm_property_readiness(p_property_id);
  v_internal_ready := coalesce((v_internal->>'ready')::boolean, false);
  v_positioning_validated := coalesce(
    (select validated from public.property_positioning where property_id = p_property_id), false);
  v_has_title := nullif(btrim(coalesce(v_cfg.public_name, '')), '') is not null;
  v_has_intro := nullif(btrim(coalesce(v_cfg.intro, '')), '') is not null;
  v_has_slug  := nullif(btrim(coalesce(v_cfg.slug, '')), '') is not null;
  v_content_validated := coalesce(v_cfg.validated, false);
  v_main_media := v_cfg.main_public_media_id is not null and exists (
    select 1 from public.property_public_media
    where id = v_cfg.main_public_media_id and status = 'actif' and approved is true);
  v_approved_media := exists (
    select 1 from public.property_public_media
    where property_id = p_property_id and status = 'actif' and approved is true);
  v_privacy := coalesce(v_cfg.privacy_reviewed, false)
               and nullif(btrim(coalesce(v_cfg.public_location, '')), '') is not null;
  v_cta := nullif(btrim(coalesce(v_cfg.cta_label, '')), '') is not null;

  v_ok := (v_internal_ready)::int + (v_positioning_validated)::int + (v_has_title)::int
          + (v_has_intro)::int + (v_has_slug)::int + (v_content_validated)::int
          + (v_main_media)::int + (v_approved_media)::int + (v_privacy)::int + (v_cta)::int;

  return jsonb_build_object(
    'ready', (v_ok = v_total),
    'total', v_total,
    'done', v_ok,
    'percent', round((v_ok::numeric / v_total) * 100),
    'checks', jsonb_build_object(
      'internal_readiness', v_internal_ready,
      'positioning_validated', v_positioning_validated,
      'public_title', v_has_title,
      'intro', v_has_intro,
      'slug', v_has_slug,
      'content_validated', v_content_validated,
      'main_public_media', v_main_media,
      'approved_media', v_approved_media,
      'privacy_defined', v_privacy,
      'cta', v_cta
    )
  );
end;
$$;

comment on function public.crm_property_public_readiness(uuid) is
  'Readiness de PUBLICATION calculée (readiness interne, positionnement validé, titre/intro/slug publics, contenu public validé, image principale publique, médias approuvés, confidentialité définie, CTA). Source de vérité de la garde de publication côté serveur.';

revoke all on function public.crm_property_public_readiness(uuid) from public, anon;
grant execute on function public.crm_property_public_readiness(uuid) to authenticated;

-- =============================================================================
-- 11. FONCTIONS D'ÉCRITURE — configuration, médias, publication (SECURITY DEFINER).
-- =============================================================================

-- Normalisation d'un slug : minuscule ASCII, tirets, sans PII.
create or replace function public.normalize_public_slug(p_input text)
returns text
language sql
immutable
set search_path = pg_catalog, pg_temp
as $$
  select nullif(
    btrim(
      regexp_replace(
        regexp_replace(lower(coalesce(p_input, '')), '[^a-z0-9]+', '-', 'g'),
        '(^-+)|(-+$)', '', 'g'),
      '-'),
    '');
$$;

revoke all on function public.normalize_public_slug(text) from public, anon;
grant execute on function public.normalize_public_slug(text) to authenticated;

-- --- Configuration de l'expérience publique ----------------------------------
create or replace function public.crm_property_upsert_public_config(
  p_property_id uuid,
  p_slug text default null,
  p_public_name text default null,
  p_tagline text default null,
  p_intro text default null,
  p_story text default null,
  p_experience_text text default null,
  p_architecture_text text default null,
  p_pillars text default null,
  p_highlighted_features text default null,
  p_emotional_details text default null,
  p_environment_text text default null,
  p_sections_config jsonb default null,
  p_cta_label text default null,
  p_show_price boolean default null,
  p_price_label text default null,
  p_public_location text default null,
  p_reference_value_cents bigint default null,
  p_seo_index boolean default null,
  p_seo_title text default null,
  p_seo_description text default null,
  p_privacy_reviewed boolean default null
)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_slug text; v_conflict uuid;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.crm_property_access(p_property_id) then
    raise exception 'droits insuffisants sur ce bien' using errcode = '42501';
  end if;

  if p_slug is not null then
    v_slug := public.normalize_public_slug(p_slug);
    if v_slug is not null then
      if length(v_slug) < 3 or length(v_slug) > 80 then
        raise exception 'slug invalide (3 à 80 caractères, lettres/chiffres/tirets)' using errcode = '22023';
      end if;
      select property_id into v_conflict from public.property_public_config
        where lower(slug) = v_slug and property_id <> p_property_id;
      if v_conflict is not null then
        raise exception 'ce slug est déjà utilisé par un autre bien' using errcode = '23505';
      end if;
    end if;
  end if;

  insert into public.property_public_config as c (
    property_id, slug, public_name, tagline, intro, story, experience_text,
    architecture_text, pillars, highlighted_features, emotional_details,
    environment_text, sections_config, cta_label, show_price, price_label,
    public_location, reference_value_cents, seo_index, seo_title, seo_description,
    privacy_reviewed, updated_by
  ) values (
    p_property_id,
    case when p_slug is null then null else v_slug end,
    p_public_name, p_tagline, p_intro, p_story, p_experience_text,
    p_architecture_text, p_pillars, p_highlighted_features, p_emotional_details,
    p_environment_text, p_sections_config, p_cta_label,
    coalesce(p_show_price, false), p_price_label, p_public_location,
    p_reference_value_cents,
    coalesce(p_seo_index, false), p_seo_title, p_seo_description,
    coalesce(p_privacy_reviewed, false), v_uid
  )
  on conflict (property_id) do update set
    slug = case when p_slug is null then c.slug else v_slug end,
    public_name = coalesce(p_public_name, c.public_name),
    tagline = coalesce(p_tagline, c.tagline),
    intro = coalesce(p_intro, c.intro),
    story = coalesce(p_story, c.story),
    experience_text = coalesce(p_experience_text, c.experience_text),
    architecture_text = coalesce(p_architecture_text, c.architecture_text),
    pillars = coalesce(p_pillars, c.pillars),
    highlighted_features = coalesce(p_highlighted_features, c.highlighted_features),
    emotional_details = coalesce(p_emotional_details, c.emotional_details),
    environment_text = coalesce(p_environment_text, c.environment_text),
    sections_config = coalesce(p_sections_config, c.sections_config),
    cta_label = coalesce(p_cta_label, c.cta_label),
    show_price = coalesce(p_show_price, c.show_price),
    price_label = coalesce(p_price_label, c.price_label),
    public_location = coalesce(p_public_location, c.public_location),
    reference_value_cents = coalesce(p_reference_value_cents, c.reference_value_cents),
    seo_index = coalesce(p_seo_index, c.seo_index),
    seo_title = coalesce(p_seo_title, c.seo_title),
    seo_description = coalesce(p_seo_description, c.seo_description),
    privacy_reviewed = coalesce(p_privacy_reviewed, c.privacy_reviewed),
    -- Toute modification du contenu invalide la validation précédente.
    validated = false, validated_by = null, validated_at = null,
    updated_by = v_uid;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'property', p_property_id, 'bien_public_config', jsonb_build_object('updated', true));

  return jsonb_build_object('ok', true, 'slug', (select slug from public.property_public_config where property_id = p_property_id));
end;
$$;

-- Validation du contenu public (décision : admin/manager).
create or replace function public.crm_property_validate_public_content(
  p_property_id uuid, p_validated boolean default true)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.crm_can_decide() then
    raise exception 'seul un administrateur ou un manager valide le contenu public' using errcode = '42501';
  end if;
  if not public.crm_property_access(p_property_id) then
    raise exception 'droits insuffisants sur ce bien' using errcode = '42501';
  end if;

  insert into public.property_public_config (property_id, validated, validated_by, validated_at, updated_by)
  values (p_property_id, coalesce(p_validated, true), v_uid, now(), v_uid)
  on conflict (property_id) do update set
    validated = coalesce(p_validated, true),
    validated_by = case when coalesce(p_validated, true) then v_uid else null end,
    validated_at = case when coalesce(p_validated, true) then now() else null end,
    updated_by = v_uid;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'property', p_property_id, 'bien_public_valide',
          jsonb_build_object('validated', coalesce(p_validated, true)));

  return jsonb_build_object('ok', true, 'validated', coalesce(p_validated, true));
end;
$$;

-- --- Médias publics (bucket PUBLIC) ------------------------------------------
create or replace function public.crm_property_register_public_media(
  p_property_id uuid, p_kind text, p_storage_path text, p_file_name text,
  p_mime_type text, p_size_bytes bigint, p_alt_text text default null,
  p_caption text default null, p_source_media_id uuid default null)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_org uuid; v_id uuid; v_order int;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.crm_property_access(p_property_id) then
    raise exception 'droits insuffisants sur ce bien' using errcode = '42501';
  end if;
  if p_kind not in ('photo','video','drone','rendu','plan','couverture') then
    raise exception 'type de média invalide' using errcode = '22023';
  end if;
  if p_mime_type not in ('image/jpeg','image/png','image/webp','video/mp4') then
    raise exception 'type de fichier non autorisé pour le public' using errcode = '22023';
  end if;
  if p_size_bytes is null or p_size_bytes <= 0 then raise exception 'fichier vide' using errcode = '22023'; end if;

  select organization_id into v_org from public.properties where id = p_property_id;
  if v_org is null then raise exception 'bien introuvable' using errcode = '22023'; end if;

  select coalesce(max(sort_order), 0) + 1 into v_order
    from public.property_public_media where property_id = p_property_id and status = 'actif';

  insert into public.property_public_media
    (organization_id, property_id, source_media_id, kind, storage_path, file_name,
     mime_type, size_bytes, alt_text, caption, sort_order, uploaded_by)
  values (v_org, p_property_id, p_source_media_id, p_kind, p_storage_path,
          left(btrim(p_file_name), 300), p_mime_type, p_size_bytes,
          nullif(btrim(p_alt_text), ''), nullif(btrim(p_caption), ''), v_order, v_uid)
  returning id into v_id;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'property', p_property_id, 'bien_public_media_ajoute', jsonb_build_object('kind', p_kind));

  return jsonb_build_object('ok', true, 'id', v_id, 'storage_path', p_storage_path);
end;
$$;

create or replace function public.crm_property_update_public_media(
  p_media_id uuid, p_alt_text text default null, p_caption text default null,
  p_kind text default null, p_sort_order integer default null, p_approved boolean default null)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_prop uuid;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  select property_id into v_prop from public.property_public_media where id = p_media_id and status = 'actif';
  if v_prop is null then raise exception 'média introuvable' using errcode = '22023'; end if;
  if not public.crm_property_access(v_prop) then raise exception 'droits insuffisants' using errcode = '42501'; end if;
  if p_kind is not null and p_kind not in ('photo','video','drone','rendu','plan','couverture') then
    raise exception 'type de média invalide' using errcode = '22023';
  end if;

  update public.property_public_media set
    alt_text = coalesce(nullif(btrim(p_alt_text), ''), alt_text),
    caption = case when p_caption is null then caption else nullif(btrim(p_caption), '') end,
    kind = coalesce(p_kind, kind),
    sort_order = coalesce(p_sort_order, sort_order),
    approved = coalesce(p_approved, approved)
  where id = p_media_id;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.crm_property_delete_public_media(p_media_id uuid)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_m public.property_public_media;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  select * into v_m from public.property_public_media where id = p_media_id and status = 'actif';
  if v_m.id is null then raise exception 'média introuvable' using errcode = '22023'; end if;
  if not public.crm_property_access(v_m.property_id) then raise exception 'droits insuffisants' using errcode = '42501'; end if;

  update public.property_public_media set status = 'supprime', deleted_by = v_uid, deleted_at = now(), public_path = null
    where id = p_media_id;
  -- Détache le média s'il servait de hero / image principale / image sociale.
  update public.property_public_config set
    hero_media_id = nullif(hero_media_id, p_media_id),
    main_public_media_id = nullif(main_public_media_id, p_media_id),
    social_image_media_id = nullif(social_image_media_id, p_media_id)
  where property_id = v_m.property_id;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'property', v_m.property_id, 'bien_public_media_supprime', jsonb_build_object('kind', v_m.kind));

  -- Renvoie le MASTER (privé) et la COPIE publique éventuelle : l'action serveur
  -- supprime les deux objets Storage.
  return jsonb_build_object('ok', true, 'storage_path', v_m.storage_path, 'public_path', v_m.public_path);
end;
$$;

-- Choix du hero / image principale / image sociale.
create or replace function public.crm_property_set_public_media_role(
  p_property_id uuid, p_role text, p_media_id uuid)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.crm_property_access(p_property_id) then raise exception 'droits insuffisants' using errcode = '42501'; end if;
  if p_role not in ('hero','main','social') then raise exception 'rôle invalide' using errcode = '22023'; end if;
  if p_media_id is not null and not exists (
      select 1 from public.property_public_media
      where id = p_media_id and property_id = p_property_id and status = 'actif' and approved is true) then
    raise exception 'média introuvable ou non approuvé pour ce bien' using errcode = '22023';
  end if;

  insert into public.property_public_config (property_id, updated_by) values (p_property_id, v_uid)
    on conflict (property_id) do nothing;

  update public.property_public_config set
    hero_media_id = case when p_role = 'hero' then p_media_id else hero_media_id end,
    main_public_media_id = case when p_role = 'main' then p_media_id else main_public_media_id end,
    social_image_media_id = case when p_role = 'social' then p_media_id else social_image_media_id end,
    updated_by = v_uid
  where property_id = p_property_id;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'property', p_property_id, 'bien_public_hero', jsonb_build_object('role', p_role, 'media_id', p_media_id));

  return jsonb_build_object('ok', true);
end;
$$;

-- --- Prévisualisation privée (contenu identique au futur snapshot) ------------
create or replace function public.crm_property_public_preview(p_property_id uuid)
returns jsonb language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.crm_property_access(p_property_id) then raise exception 'droits insuffisants' using errcode = '42501'; end if;
  -- Mode 'preview' : chemins du MASTER privé, signés par la page de prévisualisation.
  return public.build_property_public_content(p_property_id, 'preview');
end;
$$;

-- --- Publication contrôlée (décision : admin/manager) + snapshot versionné ----
-- p_public_paths : map { media_id (text) -> chemin de la COPIE publique fraîche }
-- produite CÔTÉ SERVEUR (action Next) qui a copié le master privé vers le bucket
-- public AVANT cet appel. La fonction re-vérifie le rôle et la readiness (autorité
-- serveur), impose le préfixe `{propertyId}/` sur chaque chemin (anti-détournement),
-- fixe `public_path`, assemble le snapshot depuis les copies publiques puis publie.
create or replace function public.crm_property_publish(
  p_property_id uuid, p_public_paths jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_ready jsonb;
  v_cfg public.property_public_config;
  v_version int;
  v_content jsonb;
  v_snapshot_id uuid;
  v_media record;
  v_path text;
  v_prefix text := p_property_id::text || '/';
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.crm_can_decide() then
    raise exception 'seul un administrateur ou un manager publie un bien' using errcode = '42501';
  end if;
  if not public.crm_property_access(p_property_id) then raise exception 'droits insuffisants' using errcode = '42501'; end if;
  if p_public_paths is null or jsonb_typeof(p_public_paths) <> 'object' then
    raise exception 'chemins publics invalides' using errcode = '22023';
  end if;

  v_ready := public.crm_property_public_readiness(p_property_id);
  if not (v_ready->>'ready')::boolean then
    raise exception 'préparation publique incomplète : le bien ne peut pas être publié' using errcode = '22023';
  end if;

  -- Fixe la COPIE publique de chaque média approuvé/actif à partir de la map.
  -- Toute copie hors du préfixe du bien est refusée (anti-détournement).
  for v_media in
    select id from public.property_public_media
    where property_id = p_property_id and status = 'actif' and approved is true
  loop
    v_path := nullif(p_public_paths->>v_media.id::text, '');
    if v_path is not null then
      if left(v_path, length(v_prefix)) <> v_prefix then
        raise exception 'chemin public hors du périmètre du bien' using errcode = '42501';
      end if;
      update public.property_public_media set public_path = v_path where id = v_media.id;
    end if;
  end loop;

  select * into v_cfg from public.property_public_config where property_id = p_property_id;
  -- Assemble le snapshot depuis les COPIES publiques (mode 'publish').
  v_content := public.build_property_public_content(p_property_id, 'publish');

  select coalesce(max(version), 0) + 1 into v_version
    from public.property_public_snapshots where property_id = p_property_id;

  insert into public.property_public_snapshots (property_id, version, slug, seo_index, content, published_by)
  values (p_property_id, v_version, v_cfg.slug, coalesce(v_cfg.seo_index, false), v_content, v_uid)
  returning id into v_snapshot_id;

  update public.property_public_config set
    publication_status = 'publie',
    published_snapshot_id = v_snapshot_id,
    published_at = now(),
    published_by = v_uid,
    first_published_at = coalesce(first_published_at, now()),
    updated_by = v_uid
  where property_id = p_property_id;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'property', p_property_id, 'bien_publie',
          jsonb_build_object('version', v_version, 'slug', v_cfg.slug));

  return jsonb_build_object('ok', true, 'version', v_version, 'slug', v_cfg.slug);
end;
$$;

-- Médias approuvés/actifs à COPIER vers le public (masters). Sert l'orchestration
-- de publication côté serveur (lecture RLS-safe des chemins de master).
create or replace function public.crm_property_media_to_publish(p_property_id uuid)
returns table (id uuid, storage_path text, mime_type text)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select m.id, m.storage_path, m.mime_type
  from public.property_public_media m
  where m.property_id = p_property_id and m.status = 'actif' and m.approved is true
    and public.crm_property_access(p_property_id);
$$;

-- Dépublication (décision : admin/manager). Le snapshot est CONSERVÉ (historique)
-- mais les COPIES publiques sont retirées : `public_path` remis à null et la liste
-- des chemins retournée pour SUPPRESSION des objets du bucket public par l'action
-- serveur. La copie directe cesse alors de résoudre (voir docs/19 § caches).
create or replace function public.crm_property_unpublish(p_property_id uuid, p_reason text default null)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_paths text[];
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.crm_can_decide() then
    raise exception 'seul un administrateur ou un manager dépublie un bien' using errcode = '42501';
  end if;
  if not public.crm_property_access(p_property_id) then raise exception 'droits insuffisants' using errcode = '42501'; end if;

  update public.property_public_config set
    publication_status = 'depublie', published_snapshot_id = null, updated_by = v_uid
    where property_id = p_property_id;
  if not found then raise exception 'configuration publique introuvable' using errcode = '22023'; end if;

  -- Retire les copies publiques (chemins retournés pour suppression Storage).
  select array_agg(public_path) into v_paths
    from public.property_public_media
    where property_id = p_property_id and public_path is not null;
  update public.property_public_media set public_path = null
    where property_id = p_property_id and public_path is not null;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'property', p_property_id, 'bien_depublie',
          jsonb_build_object('reason', nullif(btrim(p_reason), '')));

  return jsonb_build_object('ok', true, 'public_paths', to_jsonb(coalesce(v_paths, array[]::text[])));
end;
$$;

-- Transitions de statut non sensibles (brouillon / en_preparation / pret_a_publier / archive).
create or replace function public.crm_property_set_publication_status(
  p_property_id uuid, p_status text)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.crm_property_access(p_property_id) then raise exception 'droits insuffisants' using errcode = '42501'; end if;
  -- Publier / dépublier passent par leurs fonctions dédiées (garde + snapshot).
  if p_status not in ('brouillon','en_preparation','pret_a_publier','archive') then
    raise exception 'statut non pilotable ici (utilisez publier/dépublier)' using errcode = '22023';
  end if;
  -- Archiver est une décision sensible.
  if p_status = 'archive' and not public.crm_can_decide() then
    raise exception 'seul un administrateur ou un manager archive' using errcode = '42501';
  end if;

  insert into public.property_public_config (property_id, publication_status, updated_by)
  values (p_property_id, p_status, v_uid)
  on conflict (property_id) do update set publication_status = p_status, updated_by = v_uid;

  -- Archiver retire aussi les copies publiques (comme la dépublication).
  if p_status = 'archive' then
    declare v_paths text[];
    begin
      select array_agg(public_path) into v_paths
        from public.property_public_media
        where property_id = p_property_id and public_path is not null;
      update public.property_public_media set public_path = null
        where property_id = p_property_id and public_path is not null;
      update public.property_public_config set published_snapshot_id = null
        where property_id = p_property_id;

      insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
      values (v_uid, 'property', p_property_id, 'bien_public_statut', jsonb_build_object('status', p_status));

      return jsonb_build_object('ok', true, 'status', p_status,
                                'public_paths', to_jsonb(coalesce(v_paths, array[]::text[])));
    end;
  end if;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'property', p_property_id, 'bien_public_statut', jsonb_build_object('status', p_status));

  return jsonb_build_object('ok', true, 'status', p_status);
end;
$$;

-- --- Réception acquéreur : changement de statut (opérateur) -------------------
create or replace function public.crm_buyer_interest_set_status(p_interest_id uuid, p_status text)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_prop uuid; v_old text;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if p_status not in ('nouveau','consulte','traite') then raise exception 'statut invalide' using errcode = '22023'; end if;
  select property_id, review_status into v_prop, v_old from public.buyer_interests where id = p_interest_id;
  if v_prop is null then raise exception 'intérêt introuvable' using errcode = '22023'; end if;
  if not public.crm_property_access(v_prop) then raise exception 'droits insuffisants' using errcode = '42501'; end if;

  update public.buyer_interests set
    review_status = p_status,
    reviewed_by = v_uid,
    reviewed_at = now()
  where id = p_interest_id;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, old_value, new_value)
  values (v_uid, 'buyer_interest', p_interest_id, 'acquereur_interet_statut',
          jsonb_build_object('status', v_old), jsonb_build_object('status', p_status));

  return jsonb_build_object('ok', true, 'status', p_status);
end;
$$;

-- =============================================================================
-- 12. POINTS D'ENTRÉE PUBLICS (anon) — lecture snapshot publié, dépôt acquéreur.
-- =============================================================================

-- Lecture publique : renvoie le CONTENU du snapshot EN LIGNE d'un bien PUBLIÉ.
-- Ne renvoie rien pour un brouillon, une prévisualisation ou un bien dépublié.
create or replace function public.public_property_by_slug(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_norm text;
  v_slug text; v_version int; v_seo boolean; v_content jsonb; v_created timestamptz;
begin
  v_norm := public.normalize_public_slug(p_slug);
  if v_norm is null then return null; end if;

  select s.slug, s.version, s.seo_index, s.content, s.created_at
    into v_slug, v_version, v_seo, v_content, v_created
  from public.property_public_config c
  join public.property_public_snapshots s on s.id = c.published_snapshot_id
  where lower(c.slug) = v_norm and c.publication_status = 'publie'
  limit 1;

  if v_content is null then return null; end if;

  return jsonb_build_object(
    'slug', v_slug,
    'version', v_version,
    'seo_index', v_seo,
    'published_at', v_created,
    'content', v_content
  );
end;
$$;

comment on function public.public_property_by_slug(text) is
  'Point d''entrée PUBLIC (anon) : renvoie le contenu du snapshot EN LIGNE d''un bien PUBLIÉ, par slug. Rien pour un brouillon / une prévisualisation / un bien dépublié. Ne renvoie jamais de données privées.';

revoke all on function public.public_property_by_slug(text) from public;
grant execute on function public.public_property_by_slug(text) to anon, authenticated;

-- Slugs des biens PUBLIÉS et INDEXABLES (sitemap public). Ne renvoie ni les
-- brouillons, ni les biens en `noindex`, ni les prévisualisations. Aucune donnée
-- privée : uniquement slug + date de dernière publication.
create or replace function public.public_indexable_properties()
returns table (slug text, published_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.slug, c.published_at
  from public.property_public_config c
  join public.property_public_snapshots s on s.id = c.published_snapshot_id
  where c.publication_status = 'publie'
    and c.slug is not null
    and coalesce(s.seo_index, false) is true;
$$;

comment on function public.public_indexable_properties() is
  'Slugs des biens PUBLIÉS et INDEXABLES (sitemap public). Exclut brouillons, prévisualisations et biens en noindex. Aucune donnée privée.';

revoke all on function public.public_indexable_properties() from public;
grant execute on function public.public_indexable_properties() to anon, authenticated;

-- Dépôt acquéreur contrôlé (seul point d'entrée public d'écriture). Idempotent,
-- dédoublonnage conservateur par e-mail, scoring recalculé en base, preuve RGPD.
-- Ne renvoie qu'un accusé neutre (+ champs SERVEUR pour l'alerte Slack sans doublon).
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
  v_pref              text;
  v_recall            text;
  v_project_nature    text;
  v_budget_band       text;
  v_financing         text;
  v_purchase_horizon  text;
  v_decision_mode     text;
  v_availability      text;
  v_channels          text[];
  v_scores            jsonb;
  v_contact_id        uuid;
  v_interest_id       uuid;
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

  -- Résolution du bien par slug PUBLIÉ uniquement : impossible de déposer sur un
  -- brouillon, une prévisualisation ou un bien dépublié.
  v_slug := public.normalize_public_slug(payload->>'slug');
  if v_slug is null then raise exception 'bien inconnu' using errcode = '22023'; end if;
  select c.property_id, c.publication_status, c.reference_value_cents, c.public_name
    into v_property_id, v_pub_status, v_ref_cents, v_property_name
  from public.property_public_config c
  where lower(c.slug) = v_slug limit 1;
  if v_property_id is null or v_pub_status <> 'publie' then
    -- Réponse neutre : ne révèle pas l'état interne. Aucune insertion.
    return jsonb_build_object('accepted', true, 'created', false);
  end if;
  select organization_id into v_org from public.properties where id = v_property_id;

  v_email := left(v_email, 320);
  v_phone := left(v_phone, 64);
  v_consent := lower(coalesce(payload->>'consent_given', '')) in ('true', 't', '1', 'yes', 'on');

  -- Validation stricte des énumérations (valeur inconnue → null).
  v_project_nature := (case when payload->>'project_nature' = any (array[
    'residence_principale','residence_secondaire','investissement','autre']) then payload->>'project_nature' end);
  v_budget_band := (case when payload->>'budget_band' = any (array[
    'moins_800k','800k_1_2m','1_2m_2m','2m_3m','plus_3m','a_definir']) then payload->>'budget_band' end);
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

  -- Scoring recalculé CÔTÉ BASE (source de vérité, non falsifiable). La valeur de
  -- référence reste interne (jamais renvoyée au client).
  v_scores := public.compute_buyer_scores(
    v_budget_band, v_financing, v_purchase_horizon, v_project_nature,
    v_decision_mode, v_availability, v_ref_cents);

  -- 1) Intérêt (soumission conservée). Idempotent : gère aussi la course.
  insert into public.buyer_interests (
    organization_id, property_id, funnel_key, funnel_version, idempotency_key,
    raw_answers, normalized_answers,
    project_nature, budget_band, financing, purchase_horizon, decision_mode, availability,
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
    v_project_nature, v_budget_band, v_financing, v_purchase_horizon, v_decision_mode, v_availability,
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

  -- Rejeu idempotent : accusé NEUTRE, aucune alerte Slack, aucun doublon.
  if v_interest_id is null then
    return jsonb_build_object('accepted', true, 'created', false);
  end if;

  -- 2) Résolution du contact — dédoublonnage CONSERVATEUR par e-mail uniquement.
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

  -- 3) PrivacyRecord (preuve). Rattaché à l'intérêt acquéreur. Base légale À VALIDER.
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
    case when v_consent then 'accorde' else 'refuse' end,
    'funnel_acquereur',
    case when jsonb_typeof(payload->'consent_proof') = 'object' then payload->'consent_proof' else null end,
    false
  );

  -- 4) Rattachement du contact à l'intérêt (la soumission reste la source).
  update public.buyer_interests set contact_id = v_contact_id, resolution = v_resolution
    where id = v_interest_id;

  -- Accusé NEUTRE + champs SERVEUR (alerte Slack sans doublon), jamais renvoyés
  -- au navigateur par l'action Next.
  return jsonb_build_object(
    'accepted', true, 'created', true,
    'interest_id', v_interest_id, 'property_id', v_property_id,
    'property_name', v_property_name);
end;
$$;

comment on function public.submit_buyer_interest(jsonb) is
  'Seul point d''entrée public de dépôt d''un intérêt acquéreur. Résout le bien par slug PUBLIÉ, valide structure/tailles/énumérations, recalcule le scoring en base, crée/relie intérêt + contact (dédoublonnage e-mail) + preuve RGPD, idempotent (on conflict), et ne renvoie qu''un accusé neutre (+ interest_id/property_id destinés au serveur pour l''alerte Slack). Aucune donnée d''autrui, aucun refus automatique.';

revoke all on function public.submit_buyer_interest(jsonb) from public;
grant execute on function public.submit_buyer_interest(jsonb) to anon, authenticated;

-- =============================================================================
-- 13. GRANTS — EXECUTE aux seuls `authenticated` pour les fonctions CRM.
-- =============================================================================
do $$
declare fn text;
begin
  for fn in
    select unnest(array[
      'public.crm_property_upsert_public_config(uuid, text, text, text, text, text, text, text, text, text, text, text, jsonb, text, boolean, text, text, bigint, boolean, text, text, boolean)',
      'public.crm_property_validate_public_content(uuid, boolean)',
      'public.crm_property_register_public_media(uuid, text, text, text, text, bigint, text, text, uuid)',
      'public.crm_property_update_public_media(uuid, text, text, text, integer, boolean)',
      'public.crm_property_delete_public_media(uuid)',
      'public.crm_property_set_public_media_role(uuid, text, uuid)',
      'public.crm_property_public_preview(uuid)',
      'public.crm_property_publish(uuid, jsonb)',
      'public.crm_property_media_to_publish(uuid)',
      'public.crm_property_unpublish(uuid, text)',
      'public.crm_property_set_publication_status(uuid, text)',
      'public.crm_buyer_interest_set_status(uuid, text)'
    ])
  loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end $$;

-- =============================================================================
-- 14. STORAGE — deux buckets DÉDIÉS (cycle de vie des médias publics) :
--     - « property-public-master » : PRIVÉ. Masters des médias approuvés. Accès
--       serveur (rôle de service) uniquement ; jamais public ; URL signée courte
--       pour la prévisualisation authentifiée. JAMAIS d'objet du bucket privé de
--       la Fabrique (« property-assets ») rendu public.
--     - « property-public » : PUBLIC. Copies publiques des médias approuvés du
--       bien PUBLIÉ uniquement ; supprimées à la dépublication / archivage.
-- =============================================================================
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public)
    values ('property-public-master', 'property-public-master', false)
    on conflict (id) do update set public = false;

    insert into storage.buckets (id, name, public)
    values ('property-public', 'property-public', true)
    on conflict (id) do update set public = true;
  end if;
end $$;

commit;
