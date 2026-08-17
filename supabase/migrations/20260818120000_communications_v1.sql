-- =============================================================================
-- Prodigio OS — Migration 20260818120000_communications_v1
--
-- « Centre de communications, e-mails transactionnels et fondation des
--   automatisations ».
--
-- STRICTEMENT ADDITIVE. Ne supprime aucune table, colonne, contrainte, politique
-- ni fonction existante. Ne modifie AUCUNE migration historique. Les seuls
-- objets existants touchés sont :
--   • `privacy_records` : DEUX colonnes de rattachement ajoutées (aucune
--     colonne existante modifiée) — elle RESTE la source de vérité du consentement ;
--   • `audit_events` : les deux CHECK sont ÉTENDUS (aucune valeur retirée).
--
-- PRINCIPES (voir docs/adr/002-COMMUNICATIONS-LAYER.md et docs/21)
--   1. Le domaine ne connaît AUCUN fournisseur. Lumail et Twilio n'apparaissent
--      que comme des VALEURS de la colonne `provider` — jamais comme des clés.
--   2. Flux unique : événement métier → éligibilité → outbox → fournisseur →
--      retour → historique. Aucun code métier n'appelle un fournisseur.
--   3. L'idempotence est portée par PRODIGIO (index uniques), car ni Lumail ni
--      Twilio n'exposent d'en-tête d'idempotence sur l'envoi.
--   4. AUCUNE PII dans les clés d'idempotence ni dans la charge utile d'outbox :
--      uniquement des identifiants techniques et des horodatages.
--   5. AUCUN ENVOI n'est activé par cette migration. Les modèles sont créés en
--      `brouillon` : la politique d'éligibilité refuse tout modèle non `actif`.
--   6. Le marketing est STRUCTURELLEMENT bloqué tant que la base légale vaut
--      `a_valider_juridiquement` (aucune règle juridique n'est inventée ici).
--
-- Application : voir docs/07-SUPABASE-SETUP.md. NE PAS exécuter automatiquement.
-- =============================================================================

begin;

-- =============================================================================
-- 1. PRIVACY_RECORDS — rattachement au dossier (aucune duplication).
--    `privacy_records` reste l'UNIQUE source de vérité du consentement, de la
--    base légale, des canaux autorisés et de `do_not_contact`. On ajoute
--    seulement de quoi relier une preuve à un dossier Mandat ou Acquéreur.
-- =============================================================================
alter table public.privacy_records
  add column if not exists opportunity_id   uuid references public.opportunities (id) on delete set null,
  add column if not exists buyer_profile_id uuid references public.buyer_profiles (id) on delete set null;

create index if not exists privacy_records_opportunity_idx
  on public.privacy_records (opportunity_id) where opportunity_id is not null;
create index if not exists privacy_records_buyer_profile_idx
  on public.privacy_records (buyer_profile_id) where buyer_profile_id is not null;
create index if not exists privacy_records_contact_idx
  on public.privacy_records (contact_id) where contact_id is not null;

comment on column public.privacy_records.opportunity_id is
  'Rattachement FACULTATIF au dossier Mandat. N''altère ni la finalité, ni la base légale, ni la preuve conservée.';
comment on column public.privacy_records.buyer_profile_id is
  'Rattachement FACULTATIF au dossier Acquéreur. N''altère ni la finalité, ni la base légale, ni la preuve conservée.';

-- =============================================================================
-- 2. AUDIT_EVENTS — extension des CHECK (aucune valeur retirée).
--    L'audit des communications ne contient JAMAIS le contenu du message, ni une
--    coordonnée, ni un secret : uniquement des identifiants et des statuts.
-- =============================================================================
alter table public.audit_events drop constraint if exists audit_events_entity_type_check;
alter table public.audit_events add constraint audit_events_entity_type_check
  check (entity_type = any (array[
    'opportunity', 'contact', 'membership', 'organization', 'invitation',
    'calendar_connection', 'estimation_appointment', 'estimation_report',
    'mandate', 'economic_rule', 'document', 'property',
    'buyer_interest', 'buyer_profile',
    -- Communications V1
    'communication_message', 'communication_template', 'communication_automation',
    'communication_suppression']));

alter table public.audit_events drop constraint if exists audit_events_event_type_check;
alter table public.audit_events add constraint audit_events_event_type_check
  check (event_type = any (array[
    'creation', 'changement_stade', 'changement_segment', 'changement_affectation',
    'changement_permission', 'resolution_doublon', 'resultat_commercial',
    'invitation_creee', 'invitation_renvoyee', 'invitation_revoquee',
    'invitation_acceptee', 'changement_role', 'activation_membre',
    'desactivation_membre', 'calendrier_connecte', 'calendrier_deconnecte',
    'estimation_planifiee', 'estimation_replanifiee', 'estimation_annulee',
    'estimation_resultat', 'estimation_realisee', 'decision_eligibilite',
    'regle_economique_maj', 'mandat_brouillon', 'mandat_propose', 'mandat_signe',
    'mandat_refuse', 'mandat_expire', 'mandat_annule', 'document_ajoute',
    'document_remplace', 'document_supprime', 'bien_cree', 'bien_identite',
    'bien_positionnement', 'bien_statut', 'bien_responsable', 'bien_media_ajoute',
    'bien_media_supprime', 'bien_media_principal', 'bien_document_ajoute',
    'bien_document_supprime', 'bien_production_maj', 'bien_pret',
    'bien_public_config', 'bien_public_media_ajoute', 'bien_public_media_supprime',
    'bien_public_hero', 'bien_public_valide', 'bien_public_statut', 'bien_publie',
    'bien_depublie', 'acquereur_interet_statut', 'acquereur_profil_cree',
    'acquereur_interet_rattache', 'acquereur_stade', 'acquereur_qualification',
    'acquereur_affectation', 'acquereur_criteres', 'acquereur_offre',
    'acquereur_resultat',
    -- Communications V1
    'communication_planifiee', 'communication_preparee', 'communication_envoyee',
    'communication_livree', 'communication_echec', 'communication_bloquee',
    'communication_annulee', 'communication_rejouee', 'communication_statut',
    'modele_cree', 'modele_maj', 'modele_statut',
    'automatisation_creee', 'automatisation_maj', 'automatisation_statut',
    'opposition_ajoutee', 'opposition_levee']));

-- =============================================================================
-- 3. COMMUNICATION_TEMPLATES — modèles VERSIONNÉS.
--    Une clé stable (`template_key`) + une version entière. Les variables sont
--    DÉCLARÉES : le rendu refuse toute variable inconnue (miroir TypeScript
--    dans src/modules/communications/templates/render.ts).
-- =============================================================================
create table if not exists public.communication_templates (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  organization_id   uuid not null references public.organizations (id) on delete cascade,

  -- Clé STABLE, indépendante du fournisseur et de la version.
  template_key      text not null check (template_key ~ '^[a-z0-9_]{3,64}$'),
  version           integer not null default 1 check (version >= 1),

  channel           text not null check (channel in ('email', 'sms')),
  -- Catégorie JURIDIQUEMENT structurante : un transactionnel répond à une
  -- demande de la personne ; un marketing relève d'une finalité distincte.
  category          text not null check (category in ('transactionnel', 'marketing')),

  name              text not null,
  subject           text,                       -- e-mail uniquement
  body              text not null,
  body_format       text not null default 'markdown'
                      check (body_format in ('markdown', 'html', 'texte')),
  preview_text      text,

  -- Variables AUTORISÉES. Toute autre variable est refusée au rendu.
  allowed_variables text[] not null default '{}',

  status            text not null default 'brouillon'
                      check (status in ('brouillon', 'actif', 'archive')),
  notes             text,

  created_by        uuid references auth.users (id) on delete set null,
  updated_by        uuid references auth.users (id) on delete set null,

  constraint communication_templates_key_version_unique
    unique (organization_id, template_key, version),
  -- Un e-mail a toujours un sujet ; un SMS n'en a pas.
  constraint communication_templates_subject_per_channel
    check ((channel = 'email' and subject is not null) or (channel = 'sms'))
);

comment on table public.communication_templates is
  'Modèle de message VERSIONNÉ (clé stable + version). Indépendant du fournisseur : ne contient aucun identifiant Lumail ou Twilio. Les variables autorisées sont déclarées ; le rendu refuse toute variable inconnue. Un modèle `brouillon` ou `archive` ne peut JAMAIS être envoyé.';

-- Une seule version ACTIVE par clé et par canal : garantit qu''un envoi ne peut
-- pas être ambigu entre deux versions.
create unique index if not exists communication_templates_active_unique
  on public.communication_templates (organization_id, template_key, channel)
  where status = 'actif';

create index if not exists communication_templates_org_idx
  on public.communication_templates (organization_id, status, channel);

drop trigger if exists communication_templates_set_updated_at on public.communication_templates;
create trigger communication_templates_set_updated_at
  before update on public.communication_templates
  for each row execute function public.set_updated_at();

alter table public.communication_templates enable row level security;
grant select on public.communication_templates to authenticated;

-- =============================================================================
-- 4. COMMUNICATION_MESSAGES — HISTORIQUE d'un message.
--    ⚠️ N'est PAS une `activity` : une activité est une interaction commerciale
--    saisie par un humain. Un message est un envoi (ou un blocage) du système.
--    Aucune coordonnée n'est dupliquée ici : le destinataire est le CONTACT,
--    dont les coordonnées restent dans `contacts` et sont masquées selon le rôle.
-- =============================================================================
create table if not exists public.communication_messages (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  organization_id       uuid not null references public.organizations (id) on delete cascade,

  -- LE DESTINATAIRE : la personne. Obligatoire. Jamais une adresse dupliquée.
  contact_id            uuid not null references public.contacts (id) on delete cascade,

  -- Rattachements FACULTATIFS au dossier / bien / rendez-vous.
  opportunity_id        uuid references public.opportunities (id) on delete set null,
  buyer_profile_id      uuid references public.buyer_profiles (id) on delete set null,
  property_id           uuid references public.properties (id) on delete set null,
  appointment_id        uuid references public.estimation_appointments (id) on delete set null,

  channel               text not null check (channel in ('email', 'sms')),
  category              text not null check (category in ('transactionnel', 'marketing')),

  -- POURQUOI ce message existe (événement métier d'origine).
  event_type            text not null,

  -- Modèle utilisé : référence ET photographie (clé + version), pour que
  -- l'historique reste lisible même si le modèle évolue ensuite.
  template_id           uuid references public.communication_templates (id) on delete set null,
  template_key          text,
  template_version      integer,

  status                text not null default 'planifie'
                          check (status in ('planifie', 'en_attente', 'envoye',
                                            'livre', 'echec', 'bloque', 'annule')),

  -- Traces fournisseur : jamais des clés métier. Remplaçables sans perte.
  provider              text check (provider is null or provider in ('lumail', 'twilio', 'aucun')),
  provider_message_id   text,
  provider_status       text,

  scheduled_at          timestamptz,
  sent_at               timestamptz,
  delivered_at          timestamptz,
  failed_at             timestamptz,

  -- Code d'erreur NORMALISÉ (indépendant du fournisseur).
  error_code            text
                          check (error_code is null or error_code in (
                            'configuration_absente', 'authentification_refusee',
                            'destinataire_invalide', 'domaine_non_verifie',
                            'limite_debit', 'indisponible', 'delai_depasse',
                            'rejet_permanent', 'erreur_inconnue')),
  error_detail          text,

  -- Motif de blocage par la POLITIQUE (jamais un motif fournisseur).
  blocked_reason        text
                          check (blocked_reason is null or blocked_reason in (
                            'coordonnee_absente', 'ne_plus_contacter', 'opposition_active',
                            'base_legale_insuffisante', 'canal_non_autorise',
                            'modele_absent', 'modele_inactif', 'google_couvre_l_envoi',
                            'envoi_desactive')),

  -- Contenu RENDU, conservé pour l'historique. Sous RLS, jamais journalisé,
  -- jamais recopié dans `audit_events`.
  rendered_subject      text,
  rendered_body         text,

  -- IDEMPOTENCE portée par Prodigio. AUCUNE PII : uniquement des identifiants
  -- techniques et le canal.
  idempotency_key       text not null,

  attempt_count         integer not null default 0 check (attempt_count >= 0),
  created_by            uuid references auth.users (id) on delete set null,

  constraint communication_messages_idempotency_unique unique (idempotency_key),
  -- Un message envoyé porte forcément une date d'envoi.
  constraint communication_messages_sent_consistency
    check (status <> 'envoye' or sent_at is not null),
  -- Un message bloqué porte forcément un motif de politique.
  constraint communication_messages_blocked_consistency
    check (status <> 'bloque' or blocked_reason is not null)
);

comment on table public.communication_messages is
  'Historique d''un message adressé à un CONTACT : à qui, pourquoi, quand, par quel canal, livré ou échoué, ou bloqué par la politique. Distinct d''une `activity` (interaction commerciale humaine) et d''un `audit_event` (trace technique). Ne duplique aucune coordonnée : le destinataire est le contact.';
comment on column public.communication_messages.idempotency_key is
  'Clé d''idempotence SANS PII (identifiants techniques + canal). Un rejeu du même événement métier ne peut pas créer un second message.';
comment on column public.communication_messages.rendered_body is
  'Contenu réellement rendu, conservé pour l''historique. Protégé par RLS ; JAMAIS journalisé ni recopié dans l''audit.';

create index if not exists communication_messages_contact_idx
  on public.communication_messages (contact_id, created_at desc);
create index if not exists communication_messages_status_idx
  on public.communication_messages (status, created_at desc);
create index if not exists communication_messages_opportunity_idx
  on public.communication_messages (opportunity_id, created_at desc) where opportunity_id is not null;
create index if not exists communication_messages_buyer_idx
  on public.communication_messages (buyer_profile_id, created_at desc) where buyer_profile_id is not null;
create index if not exists communication_messages_property_idx
  on public.communication_messages (property_id, created_at desc) where property_id is not null;
create index if not exists communication_messages_appointment_idx
  on public.communication_messages (appointment_id, created_at desc) where appointment_id is not null;
create index if not exists communication_messages_provider_idx
  on public.communication_messages (provider, provider_message_id)
  where provider_message_id is not null;

drop trigger if exists communication_messages_set_updated_at on public.communication_messages;
create trigger communication_messages_set_updated_at
  before update on public.communication_messages
  for each row execute function public.set_updated_at();

alter table public.communication_messages enable row level security;
grant select on public.communication_messages to authenticated;

-- =============================================================================
-- 5. COMMUNICATION_OUTBOX — file des ÉVÉNEMENTS MÉTIER à traiter.
--    Écrite dans la MÊME TRANSACTION que l'événement métier (via déclencheur) :
--    une panne fournisseur ne peut donc ni annuler ni corrompre le dossier.
--    ⚠️ `payload` ne contient QUE des identifiants et des horodatages.
-- =============================================================================
create table if not exists public.communication_outbox (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  organization_id   uuid not null references public.organizations (id) on delete cascade,

  event_type        text not null check (event_type in (
                      'demande_mandat_enregistree',
                      'interet_acquereur_enregistre',
                      'estimation_planifiee',
                      'estimation_reportee',
                      'estimation_annulee',
                      'estimation_rappel')),

  -- Clé d'événement UNIQUE, SANS PII : un rejeu n'insère rien (do nothing).
  event_key         text not null,

  contact_id        uuid references public.contacts (id) on delete cascade,
  opportunity_id    uuid references public.opportunities (id) on delete set null,
  buyer_profile_id  uuid references public.buyer_profiles (id) on delete set null,
  property_id       uuid references public.properties (id) on delete set null,
  appointment_id    uuid references public.estimation_appointments (id) on delete set null,

  template_key      text not null,
  channel           text not null check (channel in ('email', 'sms')),

  -- Charge utile MINIMALE. Aucune coordonnée, aucun nom, aucun contenu.
  payload           jsonb not null default '{}'::jsonb,

  available_at      timestamptz not null default now(),
  attempt_count     integer not null default 0 check (attempt_count >= 0),
  max_attempts      integer not null default 5 check (max_attempts between 1 and 10),

  -- Verrou de traitement : empêche deux dispatchers de traiter la même ligne.
  locked_at         timestamptz,
  locked_by         uuid references auth.users (id) on delete set null,

  status            text not null default 'en_attente'
                      check (status in ('en_attente', 'en_cours', 'traite',
                                        'ignore', 'echec', 'abandonne')),
  -- Motif d'un `ignore` : aucune perte silencieuse, la raison est toujours lisible.
  skip_reason       text,
  last_error_code   text,
  message_id        uuid references public.communication_messages (id) on delete set null,

  constraint communication_outbox_event_key_unique unique (event_key),
  constraint communication_outbox_skip_reason_required
    check (status <> 'ignore' or skip_reason is not null)
);

comment on table public.communication_outbox is
  'File d''événements métier en attente de traitement. Écrite par déclencheur dans la même transaction que l''événement, de sorte qu''une panne fournisseur ne remette jamais en cause le dossier. La charge utile ne contient AUCUNE donnée personnelle : uniquement des identifiants techniques et des horodatages.';
comment on column public.communication_outbox.event_key is
  'Clé d''idempotence de l''ÉVÉNEMENT, sans PII. Un rejeu du même événement n''insère aucune ligne supplémentaire.';

create index if not exists communication_outbox_ready_idx
  on public.communication_outbox (status, available_at)
  where status in ('en_attente', 'en_cours');
create index if not exists communication_outbox_org_idx
  on public.communication_outbox (organization_id, created_at desc);

drop trigger if exists communication_outbox_set_updated_at on public.communication_outbox;
create trigger communication_outbox_set_updated_at
  before update on public.communication_outbox
  for each row execute function public.set_updated_at();

alter table public.communication_outbox enable row level security;
grant select on public.communication_outbox to authenticated;

-- =============================================================================
-- 6. COMMUNICATION_SUPPRESSIONS — liste d'opposition CENTRALISÉE.
--    ⚠️ NE REMPLACE PAS `privacy_records`, qui porte le CHOIX éclairé et la base
--    légale. Ici on enregistre un FAIT : rebond définitif, plainte,
--    désinscription, demande explicite. Les deux sont consultées ensemble ;
--    l'une comme l'autre ne peut que RESTREINDRE, jamais autoriser.
-- =============================================================================
create table if not exists public.communication_suppressions (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  organization_id   uuid not null references public.organizations (id) on delete cascade,
  contact_id        uuid not null references public.contacts (id) on delete cascade,

  channel           text not null check (channel in ('email', 'sms', 'tout')),
  -- Portée : bloque le marketing seul, le transactionnel seul, ou tout.
  scope             text not null default 'marketing'
                      check (scope in ('marketing', 'transactionnel', 'tout')),

  reason            text not null check (reason in (
                      'rebond_definitif', 'plainte', 'desinscription',
                      'demande_personne', 'erreur_permanente', 'decision_interne')),
  source            text not null default 'humain'
                      check (source in ('fournisseur', 'humain', 'import')),
  provider          text check (provider is null or provider in ('lumail', 'twilio')),

  -- Preuve SANS secret : aucun jeton, aucune URL signée, aucun en-tête d'auth.
  evidence          jsonb,
  notes             text,

  active            boolean not null default true,
  created_by        uuid references auth.users (id) on delete set null,
  released_at       timestamptz,
  released_by       uuid references auth.users (id) on delete set null,
  released_reason   text,

  constraint communication_suppressions_release_consistency
    check (active or (released_at is not null and released_reason is not null))
);

comment on table public.communication_suppressions is
  'Opposition centralisée (rebond définitif, plainte, désinscription, demande). Complète `privacy_records` sans la remplacer : `privacy_records` porte le CHOIX et la base légale, cette table porte un FAIT bloquant. Une entrée active empêche l''envoi ; aucune entrée ne peut AUTORISER un envoi.';

-- Une seule opposition ACTIVE par (contact, canal, portée).
create unique index if not exists communication_suppressions_active_unique
  on public.communication_suppressions (contact_id, channel, scope)
  where active;

create index if not exists communication_suppressions_contact_idx
  on public.communication_suppressions (contact_id) where active;

drop trigger if exists communication_suppressions_set_updated_at on public.communication_suppressions;
create trigger communication_suppressions_set_updated_at
  before update on public.communication_suppressions
  for each row execute function public.set_updated_at();

alter table public.communication_suppressions enable row level security;
grant select on public.communication_suppressions to authenticated;

-- =============================================================================
-- 7. AUTOMATISATIONS — fondation MINIMALE, versionnée.
--    Pas d'éditeur graphique, pas de moteur d'exécution autonome : une
--    définition versionnée et un journal d'exécution, prêts pour la V1.1.
-- =============================================================================
create table if not exists public.communication_automations (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  organization_id   uuid not null references public.organizations (id) on delete cascade,

  automation_key    text not null check (automation_key ~ '^[a-z0-9_]{3,64}$'),
  version           integer not null default 1 check (version >= 1),
  name              text not null,

  -- DÉCLENCHEUR : un événement métier déjà modélisé (mêmes valeurs que l'outbox).
  trigger_event     text not null check (trigger_event in (
                      'demande_mandat_enregistree',
                      'interet_acquereur_enregistre',
                      'estimation_planifiee',
                      'estimation_reportee',
                      'estimation_annulee',
                      'estimation_rappel')),
  -- CONDITIONS déclaratives, évaluées côté serveur. Jamais du code arbitraire.
  conditions        jsonb not null default '{}'::jsonb,
  -- DÉLAI avant action.
  delay_minutes     integer not null default 0 check (delay_minutes between 0 and 525600),

  -- ACTION : en V1, uniquement « créer un message à partir d'un modèle ».
  action_type       text not null default 'envoyer_message'
                      check (action_type in ('envoyer_message')),
  template_key      text not null,
  channel           text not null check (channel in ('email', 'sms')),

  -- RÈGLES DE SORTIE déclaratives (ex. dossier clos, opposition, résultat atteint).
  exit_rules        jsonb not null default '{}'::jsonb,

  status            text not null default 'brouillon'
                      check (status in ('brouillon', 'actif', 'en_pause', 'archive')),
  notes             text,
  created_by        uuid references auth.users (id) on delete set null,
  updated_by        uuid references auth.users (id) on delete set null,

  constraint communication_automations_key_version_unique
    unique (organization_id, automation_key, version)
);

comment on table public.communication_automations is
  'Définition VERSIONNÉE d''une automatisation : déclencheur métier, conditions déclaratives, délai, action, règles de sortie. Aucune exécution autonome n''est activée en V1 : une automatisation `brouillon`, `en_pause` ou `archive` ne produit rien.';

create unique index if not exists communication_automations_active_unique
  on public.communication_automations (organization_id, automation_key)
  where status = 'actif';

drop trigger if exists communication_automations_set_updated_at on public.communication_automations;
create trigger communication_automations_set_updated_at
  before update on public.communication_automations
  for each row execute function public.set_updated_at();

alter table public.communication_automations enable row level security;
grant select on public.communication_automations to authenticated;

create table if not exists public.communication_automation_runs (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  organization_id   uuid not null references public.organizations (id) on delete cascade,
  automation_id     uuid not null references public.communication_automations (id) on delete cascade,
  -- Photographie de la version exécutée : un changement de définition ne
  -- réinterprète JAMAIS une exécution passée.
  automation_version integer not null,

  contact_id        uuid references public.contacts (id) on delete cascade,
  opportunity_id    uuid references public.opportunities (id) on delete set null,
  buyer_profile_id  uuid references public.buyer_profiles (id) on delete set null,
  appointment_id    uuid references public.estimation_appointments (id) on delete set null,

  status            text not null default 'planifie'
                      check (status in ('planifie', 'en_pause', 'execute',
                                        'sorti', 'annule', 'echec')),
  scheduled_at      timestamptz not null default now(),
  executed_at       timestamptz,
  exit_reason       text,

  message_id        uuid references public.communication_messages (id) on delete set null,
  idempotency_key   text not null,

  constraint communication_automation_runs_idempotency_unique unique (idempotency_key)
);

comment on table public.communication_automation_runs is
  'Exécution d''une automatisation pour une entité donnée : planifiée, en pause, exécutée, sortie ou annulée. Idempotente par construction. Conserve la VERSION exécutée.';

create index if not exists communication_automation_runs_due_idx
  on public.communication_automation_runs (status, scheduled_at)
  where status in ('planifie', 'en_pause');

drop trigger if exists communication_automation_runs_set_updated_at on public.communication_automation_runs;
create trigger communication_automation_runs_set_updated_at
  before update on public.communication_automation_runs
  for each row execute function public.set_updated_at();

alter table public.communication_automation_runs enable row level security;
grant select on public.communication_automation_runs to authenticated;

-- =============================================================================
-- 8. HELPERS D'ACCÈS.
--    `comm_message_access` est appelé DIRECTEMENT par des politiques RLS : il
--    conserve donc EXECUTE pour `authenticated` (une politique est évaluée avec
--    les privilèges du rôle appelant — cf. 20260817120000).
-- =============================================================================

-- Organisation opérateur Prodigio : résolue SANS session (les déclencheurs
-- s'exécutent aussi sous `anon`, lors d'un dépôt public).
create or replace function public.comm_operator_org()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select id from public.organizations
  where kind = 'operateur_prodigio' and status = 'actif'
  order by created_at
  limit 1;
$$;

comment on function public.comm_operator_org() is
  'HELPER INTERNE — non exécutable par public/anon/authenticated. Organisation opérateur Prodigio active, résolue sans session (les déclencheurs s''exécutent aussi sous anon).';

revoke all on function public.comm_operator_org() from public, anon, authenticated;

-- Accès en LECTURE à une communication : réutilise strictement les règles
-- d'accès déjà en vigueur (dossier Mandat, dossier Acquéreur, bien).
-- `partenaire_lecture` n'est jamais autorisé : aucun partage explicite de
-- communication n'existe en V1 (décision produit).
create or replace function public.comm_message_access(
  p_opportunity_id uuid,
  p_buyer_profile_id uuid,
  p_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.crm_is_operator()
    or (
      public.crm_has_role('agent_immobilier')
      and (
        (p_opportunity_id is not null
          and p_opportunity_id in (select public.crm_assigned_opportunity_ids()))
        or (p_buyer_profile_id is not null
          and public.crm_buyer_profile_access(p_buyer_profile_id))
        or (p_property_id is not null
          and public.crm_property_access(p_property_id))
      )
    );
$$;

comment on function public.comm_message_access(uuid, uuid, uuid) is
  'Décision d''accès en lecture à une communication, réutilisant les règles existantes (opérateur, ou agent immobilier sur SES dossiers/biens). Appelé DIRECTEMENT par les politiques RLS : conserve EXECUTE pour authenticated. `partenaire_lecture` n''est jamais autorisé.';

revoke all on function public.comm_message_access(uuid, uuid, uuid) from public, anon;
grant execute on function public.comm_message_access(uuid, uuid, uuid) to authenticated;

-- Administration des modèles, oppositions et automatisations.
create or replace function public.comm_can_manage()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.crm_has_role('administrateur', 'manager');
$$;

comment on function public.comm_can_manage() is
  'HELPER INTERNE — non exécutable par public/anon/authenticated. Vrai si l''utilisateur peut administrer modèles, oppositions et automatisations (administrateur ou manager).';

revoke all on function public.comm_can_manage() from public, anon, authenticated;

-- =============================================================================
-- 9. RLS — lecture seule côté table ; TOUTE écriture passe par les fonctions §12.
--    Aucun grant `anon`, aucune politique `anon` : refus total pour le public.
-- =============================================================================
drop policy if exists communication_messages_read on public.communication_messages;
create policy communication_messages_read on public.communication_messages
  for select to authenticated
  using (public.comm_message_access(opportunity_id, buyer_profile_id, property_id));

-- Modèles, oppositions, automatisations : périmètre d'ORGANISATION, non de
-- dossier. Lisibles par les rôles opérationnels et l'agent immobilier ;
-- `partenaire_lecture` en est exclu.
drop policy if exists communication_templates_read on public.communication_templates;
create policy communication_templates_read on public.communication_templates
  for select to authenticated
  using (public.crm_is_operator() or public.crm_has_role('agent_immobilier'));

drop policy if exists communication_outbox_read on public.communication_outbox;
create policy communication_outbox_read on public.communication_outbox
  for select to authenticated using (public.crm_is_operator());

drop policy if exists communication_suppressions_read on public.communication_suppressions;
create policy communication_suppressions_read on public.communication_suppressions
  for select to authenticated
  using (public.crm_is_operator() or public.crm_has_role('agent_immobilier'));

drop policy if exists communication_automations_read on public.communication_automations;
create policy communication_automations_read on public.communication_automations
  for select to authenticated using (public.crm_is_operator());

drop policy if exists communication_automation_runs_read on public.communication_automation_runs;
create policy communication_automation_runs_read on public.communication_automation_runs
  for select to authenticated using (public.crm_is_operator());

-- Défense en profondeur : jamais d'accès direct anon/public.
revoke all on public.communication_templates, public.communication_messages,
  public.communication_outbox, public.communication_suppressions,
  public.communication_automations, public.communication_automation_runs
  from anon, public;

-- =============================================================================
-- 10. POLITIQUE D'ÉLIGIBILITÉ — AUTORITÉ SERVEUR.
--     Le navigateur ne décide JAMAIS si un message peut partir. Cette fonction
--     est la seule autorité ; le miroir TypeScript sert uniquement à EXPLIQUER.
--
--     ⚠️ Aucune règle juridique n'est inventée : le marketing exige une base
--     légale explicitement établie. Tant qu'elle vaut `a_valider_juridiquement`,
--     le marketing est REFUSÉ — c'est un refus prudent, pas une conformité.
-- =============================================================================
create or replace function public.crm_comm_eligibility(
  p_contact_id uuid,
  p_channel text,
  p_category text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_contact  public.contacts;
  v_address  text;
  v_blocked  boolean;
  v_legal    boolean;
begin
  if p_channel not in ('email', 'sms') then
    return jsonb_build_object('allowed', false, 'reason', 'canal_non_autorise');
  end if;
  if p_category not in ('transactionnel', 'marketing') then
    return jsonb_build_object('allowed', false, 'reason', 'canal_non_autorise');
  end if;

  select * into v_contact from public.contacts where id = p_contact_id;
  if v_contact.id is null then
    return jsonb_build_object('allowed', false, 'reason', 'coordonnee_absente');
  end if;

  -- 1. Le canal doit disposer d'une coordonnée exploitable.
  v_address := case when p_channel = 'email' then v_contact.email else v_contact.phone end;
  if v_address is null or length(trim(v_address)) = 0 then
    return jsonb_build_object('allowed', false, 'reason', 'coordonnee_absente');
  end if;

  -- 2. « Ne plus contacter » : opposition ABSOLUE, tous canaux, toutes catégories.
  select exists (
    select 1 from public.privacy_records pr
    where pr.contact_id = p_contact_id and pr.do_not_contact
  ) into v_blocked;
  if v_blocked then
    return jsonb_build_object('allowed', false, 'reason', 'ne_plus_contacter');
  end if;

  -- 3. Opposition centralisée active sur ce canal et cette catégorie.
  select exists (
    select 1 from public.communication_suppressions s
    where s.contact_id = p_contact_id
      and s.active
      and s.channel in (p_channel, 'tout')
      and s.scope in (p_category, 'tout')
  ) into v_blocked;
  if v_blocked then
    return jsonb_build_object('allowed', false, 'reason', 'opposition_active');
  end if;

  -- 4. Marketing : exige une base légale ÉTABLIE et le canal explicitement
  --    autorisé. `a_valider_juridiquement` ne vaut PAS consentement.
  if p_category = 'marketing' then
    select exists (
      select 1 from public.privacy_records pr
      where pr.contact_id = p_contact_id
        and pr.choice = 'accorde'
        and pr.legal_basis is distinct from 'a_valider_juridiquement'
        and p_channel = any (pr.authorized_channels)
    ) into v_legal;
    if not v_legal then
      return jsonb_build_object('allowed', false, 'reason', 'base_legale_insuffisante');
    end if;
  end if;

  return jsonb_build_object('allowed', true, 'reason', null);
end;
$$;

comment on function public.crm_comm_eligibility(uuid, text, text) is
  'AUTORITÉ SERVEUR de la politique d''envoi. Consulte `privacy_records` (choix, base légale, canaux autorisés, ne_plus_contacter) ET `communication_suppressions` (faits bloquants). Ne peut que RESTREINDRE. Le marketing est refusé tant que la base légale vaut `a_valider_juridiquement` : refus prudent, jamais une conformité.';

revoke all on function public.crm_comm_eligibility(uuid, text, text) from public, anon;
grant execute on function public.crm_comm_eligibility(uuid, text, text) to authenticated;

-- Google couvre-t-il déjà l'envoi pour ce rendez-vous ?
-- Vrai UNIQUEMENT si un événement Google existe ET que le propriétaire y est
-- réellement invité (`owner_email` renseigné) : la règle est évaluée sur la
-- donnée, jamais supposée. Voir docs/adr/002 §5.
create or replace function public.comm_google_covers_appointment(p_appointment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select a.google_event_id is not null
       and a.owner_email is not null
       and length(trim(a.owner_email)) > 0
    from public.estimation_appointments a
    where a.id = p_appointment_id
  ), false);
$$;

comment on function public.comm_google_covers_appointment(uuid) is
  'HELPER INTERNE — non exécutable par public/anon/authenticated. Vrai si Google Calendar envoie déjà l''invitation / la mise à jour / l''annulation au propriétaire (événement présent ET propriétaire réellement invité). Évite le doublon d''e-mail. N''affecte pas le RAPPEL, qui reste de la responsabilité de Prodigio.';

revoke all on function public.comm_google_covers_appointment(uuid) from public, anon, authenticated;

-- =============================================================================
-- 11. OUTBOX — helper d'insertion et DÉCLENCHEURS.
--     Les déclencheurs écrivent dans la même transaction que l'événement métier.
--     Aucune fonction métier existante n'est modifiée ni remplacée.
-- =============================================================================
create or replace function public.comm_enqueue(
  p_event_type text,
  p_event_key text,
  p_contact_id uuid,
  p_template_key text,
  p_channel text,
  p_payload jsonb default '{}'::jsonb,
  p_opportunity_id uuid default null,
  p_buyer_profile_id uuid default null,
  p_property_id uuid default null,
  p_appointment_id uuid default null,
  p_available_at timestamptz default now())
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid;
  v_id  uuid;
begin
  -- Sans contact identifié, aucun message ne peut exister : on n'enfile rien.
  if p_contact_id is null then return null; end if;

  v_org := public.comm_operator_org();
  if v_org is null then return null; end if;

  insert into public.communication_outbox (
    organization_id, event_type, event_key, contact_id,
    opportunity_id, buyer_profile_id, property_id, appointment_id,
    template_key, channel, payload, available_at)
  values (
    v_org, p_event_type, p_event_key, p_contact_id,
    p_opportunity_id, p_buyer_profile_id, p_property_id, p_appointment_id,
    p_template_key, p_channel, coalesce(p_payload, '{}'::jsonb), coalesce(p_available_at, now()))
  on conflict (event_key) do nothing
  returning id into v_id;

  return v_id;   -- NULL si l'événement était déjà enfilé (rejeu : aucun doublon)
end;
$$;

comment on function public.comm_enqueue(text, text, uuid, text, text, jsonb, uuid, uuid, uuid, uuid, timestamptz) is
  'HELPER INTERNE — non exécutable par public/anon/authenticated. Enfile un événement métier. Idempotent par `event_key` : un rejeu renvoie NULL sans créer de doublon. La charge utile ne doit contenir AUCUNE donnée personnelle.';

revoke all on function public.comm_enqueue(text, text, uuid, text, text, jsonb, uuid, uuid, uuid, uuid, timestamptz)
  from public, anon, authenticated;

-- --- Déclencheur : demande de mandat enregistrée -----------------------------
create or replace function public.comm_tg_funnel_submission()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.comm_enqueue(
    'demande_mandat_enregistree',
    'demande_mandat_enregistree:' || new.id::text,
    new.contact_id,
    'mandat_demande_accusee',
    'email',
    jsonb_build_object('submission_id', new.id, 'recorded_at', new.created_at),
    new.opportunity_id);
  return null;   -- AFTER trigger : la valeur de retour est ignorée
end;
$$;

revoke all on function public.comm_tg_funnel_submission() from public, anon, authenticated;

drop trigger if exists comm_funnel_submission_enqueue on public.funnel_submissions;
create trigger comm_funnel_submission_enqueue
  after insert on public.funnel_submissions
  for each row execute function public.comm_tg_funnel_submission();

-- --- Déclencheur : intérêt acquéreur enregistré ------------------------------
create or replace function public.comm_tg_buyer_interest()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.comm_enqueue(
    'interet_acquereur_enregistre',
    'interet_acquereur_enregistre:' || new.id::text,
    new.contact_id,
    'acquereur_interet_accuse',
    'email',
    jsonb_build_object('interest_id', new.id, 'recorded_at', new.created_at),
    null,
    new.buyer_profile_id,
    new.property_id);
  return null;
end;
$$;

revoke all on function public.comm_tg_buyer_interest() from public, anon, authenticated;

drop trigger if exists comm_buyer_interest_enqueue on public.buyer_interests;
create trigger comm_buyer_interest_enqueue
  after insert on public.buyer_interests
  for each row execute function public.comm_tg_buyer_interest();

-- --- Déclencheur : rendez-vous d'estimation ----------------------------------
-- Trois événements distincts. Le RAPPEL n'est PAS enfilé ici : il dépend d'une
-- échéance, pas d'un changement de ligne (voir crm_comm_schedule_reminders).
create or replace function public.comm_tg_estimation_appointment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_contact uuid := coalesce(new.owner_contact_id, null);
begin
  if v_contact is null then return null; end if;

  if tg_op = 'INSERT' then
    -- Un rendez-vous naît en `planifie` puis est confirmé : on n'enfile qu'à la
    -- confirmation (voir la branche UPDATE), sinon un créneau abandonné
    -- produirait un message.
    return null;
  end if;

  -- Confirmation (l'événement Google vient d'être rattaché).
  if new.google_event_id is not null and old.google_event_id is null then
    perform public.comm_enqueue(
      'estimation_planifiee',
      'estimation_planifiee:' || new.id::text,
      v_contact,
      'estimation_planifiee',
      'email',
      jsonb_build_object('appointment_id', new.id, 'starts_at', new.starts_at),
      new.opportunity_id, null, null, new.id);
  end if;

  -- Report : le créneau change sur un rendez-vous déjà confirmé.
  if new.starts_at is distinct from old.starts_at and old.google_event_id is not null then
    perform public.comm_enqueue(
      'estimation_reportee',
      'estimation_reportee:' || new.id::text || ':' || extract(epoch from new.starts_at)::bigint::text,
      v_contact,
      'estimation_reportee',
      'email',
      jsonb_build_object('appointment_id', new.id, 'starts_at', new.starts_at,
                         'previous_starts_at', old.starts_at),
      new.opportunity_id, null, null, new.id);
  end if;

  -- Annulation.
  if new.status = 'annule' and old.status is distinct from 'annule' then
    perform public.comm_enqueue(
      'estimation_annulee',
      'estimation_annulee:' || new.id::text,
      v_contact,
      'estimation_annulee',
      'email',
      jsonb_build_object('appointment_id', new.id, 'cancelled_at', new.cancelled_at),
      new.opportunity_id, null, null, new.id);
  end if;

  return null;
end;
$$;

revoke all on function public.comm_tg_estimation_appointment() from public, anon, authenticated;

drop trigger if exists comm_estimation_appointment_enqueue on public.estimation_appointments;
create trigger comm_estimation_appointment_enqueue
  after insert or update on public.estimation_appointments
  for each row execute function public.comm_tg_estimation_appointment();

-- =============================================================================
-- 12. FONCTIONS D'ÉCRITURE CRM — toutes SECURITY DEFINER, `search_path` figé,
--     auditées, et refusant l'accès sans droits.
-- =============================================================================

-- --- Modèles -----------------------------------------------------------------
create or replace function public.crm_comm_upsert_template(
  p_template_key text,
  p_channel text,
  p_category text,
  p_name text,
  p_subject text,
  p_body text,
  p_body_format text default 'markdown',
  p_preview_text text default null,
  p_allowed_variables text[] default '{}',
  p_notes text default null)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_version integer;
  v_id uuid;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.comm_can_manage() then
    raise exception 'droits insuffisants sur les modèles de communication' using errcode = '42501';
  end if;
  if p_template_key !~ '^[a-z0-9_]{3,64}$' then
    raise exception 'clé de modèle invalide' using errcode = '22023';
  end if;
  if p_channel = 'email' and (p_subject is null or length(trim(p_subject)) = 0) then
    raise exception 'un modèle e-mail exige un sujet' using errcode = '22023';
  end if;

  v_org := coalesce(public.crm_current_operator_org(), public.comm_operator_org());
  if v_org is null then raise exception 'organisation introuvable' using errcode = '22023'; end if;

  -- Nouvelle VERSION : on n'écrase jamais une version existante.
  select coalesce(max(version), 0) + 1 into v_version
  from public.communication_templates
  where organization_id = v_org and template_key = p_template_key;

  insert into public.communication_templates (
    organization_id, template_key, version, channel, category, name, subject,
    body, body_format, preview_text, allowed_variables, notes, status,
    created_by, updated_by)
  values (
    v_org, p_template_key, v_version, p_channel, p_category, p_name, p_subject,
    p_body, coalesce(p_body_format, 'markdown'), p_preview_text,
    coalesce(p_allowed_variables, '{}'), p_notes, 'brouillon', v_uid, v_uid)
  returning id into v_id;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'communication_template', v_id,
          case when v_version = 1 then 'modele_cree' else 'modele_maj' end,
          jsonb_build_object('template_key', p_template_key, 'version', v_version,
                             'channel', p_channel, 'category', p_category));

  return jsonb_build_object('ok', true, 'id', v_id, 'version', v_version);
end;
$$;

create or replace function public.crm_comm_set_template_status(p_template_id uuid, p_status text)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_old text;
  v_key text;
  v_channel text;
  v_org uuid;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.comm_can_manage() then
    raise exception 'droits insuffisants sur les modèles de communication' using errcode = '42501';
  end if;
  if p_status not in ('brouillon', 'actif', 'archive') then
    raise exception 'statut inconnu' using errcode = '22023';
  end if;

  select status, template_key, channel, organization_id
    into v_old, v_key, v_channel, v_org
  from public.communication_templates where id = p_template_id;
  if v_old is null then raise exception 'modèle introuvable' using errcode = '22023'; end if;

  -- Une seule version active : la précédente est repassée en `archive`.
  if p_status = 'actif' then
    update public.communication_templates
    set status = 'archive', updated_by = v_uid
    where organization_id = v_org and template_key = v_key and channel = v_channel
      and status = 'actif' and id <> p_template_id;
  end if;

  update public.communication_templates
  set status = p_status, updated_by = v_uid
  where id = p_template_id;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, old_value, new_value)
  values (v_uid, 'communication_template', p_template_id, 'modele_statut',
          jsonb_build_object('status', v_old), jsonb_build_object('status', p_status));

  return jsonb_build_object('ok', true, 'status', p_status);
end;
$$;

-- --- Oppositions --------------------------------------------------------------
create or replace function public.crm_comm_add_suppression(
  p_contact_id uuid,
  p_channel text,
  p_scope text,
  p_reason text,
  p_notes text default null)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_id uuid;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.comm_can_manage() then
    raise exception 'droits insuffisants sur les oppositions' using errcode = '42501';
  end if;
  if p_channel not in ('email', 'sms', 'tout') then
    raise exception 'canal inconnu' using errcode = '22023';
  end if;
  if p_scope not in ('marketing', 'transactionnel', 'tout') then
    raise exception 'portée inconnue' using errcode = '22023';
  end if;

  v_org := coalesce(public.crm_current_operator_org(), public.comm_operator_org());

  insert into public.communication_suppressions (
    organization_id, contact_id, channel, scope, reason, source, notes, created_by)
  values (v_org, p_contact_id, p_channel, p_scope, p_reason, 'humain', p_notes, v_uid)
  on conflict (contact_id, channel, scope) where active do nothing
  returning id into v_id;

  if v_id is null then
    return jsonb_build_object('ok', true, 'created', false);
  end if;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'communication_suppression', v_id, 'opposition_ajoutee',
          jsonb_build_object('contact_id', p_contact_id, 'channel', p_channel,
                             'scope', p_scope, 'reason', p_reason));

  return jsonb_build_object('ok', true, 'created', true, 'id', v_id);
end;
$$;

-- La levée d'une opposition est une décision SENSIBLE : administrateur seul,
-- motif obligatoire, tracée.
create or replace function public.crm_comm_release_suppression(p_id uuid, p_reason text)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_contact uuid;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  perform public.crm_require_role('administrateur');
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'un motif est obligatoire pour lever une opposition' using errcode = '22023';
  end if;

  update public.communication_suppressions
  set active = false, released_at = now(), released_by = v_uid, released_reason = p_reason
  where id = p_id and active
  returning contact_id into v_contact;

  if v_contact is null then
    raise exception 'opposition introuvable ou déjà levée' using errcode = '22023';
  end if;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'communication_suppression', p_id, 'opposition_levee',
          jsonb_build_object('contact_id', v_contact, 'reason', p_reason));

  return jsonb_build_object('ok', true);
end;
$$;

-- --- Automatisations ----------------------------------------------------------
create or replace function public.crm_comm_upsert_automation(
  p_automation_key text,
  p_name text,
  p_trigger_event text,
  p_template_key text,
  p_channel text,
  p_delay_minutes integer default 0,
  p_conditions jsonb default '{}'::jsonb,
  p_exit_rules jsonb default '{}'::jsonb,
  p_notes text default null)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_version integer;
  v_id uuid;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  perform public.crm_require_role('administrateur');
  if p_automation_key !~ '^[a-z0-9_]{3,64}$' then
    raise exception 'clé d''automatisation invalide' using errcode = '22023';
  end if;

  v_org := coalesce(public.crm_current_operator_org(), public.comm_operator_org());
  if v_org is null then raise exception 'organisation introuvable' using errcode = '22023'; end if;

  select coalesce(max(version), 0) + 1 into v_version
  from public.communication_automations
  where organization_id = v_org and automation_key = p_automation_key;

  insert into public.communication_automations (
    organization_id, automation_key, version, name, trigger_event, conditions,
    delay_minutes, template_key, channel, exit_rules, notes, status,
    created_by, updated_by)
  values (
    v_org, p_automation_key, v_version, p_name, p_trigger_event,
    coalesce(p_conditions, '{}'::jsonb), coalesce(p_delay_minutes, 0),
    p_template_key, p_channel, coalesce(p_exit_rules, '{}'::jsonb), p_notes,
    'brouillon', v_uid, v_uid)
  returning id into v_id;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'communication_automation', v_id,
          case when v_version = 1 then 'automatisation_creee' else 'automatisation_maj' end,
          jsonb_build_object('automation_key', p_automation_key, 'version', v_version,
                             'trigger_event', p_trigger_event));

  return jsonb_build_object('ok', true, 'id', v_id, 'version', v_version);
end;
$$;

create or replace function public.crm_comm_set_automation_status(p_automation_id uuid, p_status text)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_old text; v_key text; v_org uuid;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  perform public.crm_require_role('administrateur');
  if p_status not in ('brouillon', 'actif', 'en_pause', 'archive') then
    raise exception 'statut inconnu' using errcode = '22023';
  end if;

  select status, automation_key, organization_id into v_old, v_key, v_org
  from public.communication_automations where id = p_automation_id;
  if v_old is null then raise exception 'automatisation introuvable' using errcode = '22023'; end if;

  if p_status = 'actif' then
    update public.communication_automations
    set status = 'archive', updated_by = v_uid
    where organization_id = v_org and automation_key = v_key
      and status = 'actif' and id <> p_automation_id;
  end if;

  update public.communication_automations
  set status = p_status, updated_by = v_uid where id = p_automation_id;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, old_value, new_value)
  values (v_uid, 'communication_automation', p_automation_id, 'automatisation_statut',
          jsonb_build_object('status', v_old), jsonb_build_object('status', p_status));

  return jsonb_build_object('ok', true, 'status', p_status);
end;
$$;

-- --- Traitement de la file ----------------------------------------------------
-- Réservation ATOMIQUE : `for update skip locked` garantit qu'un double appel
-- (double clic, deux dispatchers) ne traite jamais deux fois la même ligne.
create or replace function public.crm_comm_claim_outbox(p_limit integer default 10)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_rows jsonb;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.comm_can_manage() then
    raise exception 'droits insuffisants sur la file de communications' using errcode = '42501';
  end if;

  with candidates as (
    select id from public.communication_outbox
    where status = 'en_attente'
      and available_at <= now()
      and attempt_count < max_attempts
    order by available_at
    limit greatest(1, least(coalesce(p_limit, 10), 100))
    for update skip locked
  ), claimed as (
    update public.communication_outbox o
    set status = 'en_cours', locked_at = now(), locked_by = v_uid,
        attempt_count = o.attempt_count + 1
    from candidates c
    where o.id = c.id
    returning o.*
  )
  select coalesce(jsonb_agg(to_jsonb(claimed) - 'payload' || jsonb_build_object('payload', claimed.payload)), '[]'::jsonb)
  into v_rows from claimed;

  return jsonb_build_object('ok', true, 'items', v_rows);
end;
$$;

-- Prépare le message : applique la POLITIQUE (autorité serveur) et crée la ligne
-- d'historique. Ne réalise AUCUN envoi.
create or replace function public.crm_comm_prepare_message(p_outbox_id uuid)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_o public.communication_outbox;
  v_tpl public.communication_templates;
  v_elig jsonb;
  v_reason text;
  v_key text;
  v_msg_id uuid;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.comm_can_manage() then
    raise exception 'droits insuffisants sur la file de communications' using errcode = '42501';
  end if;

  select * into v_o from public.communication_outbox where id = p_outbox_id;
  if v_o.id is null then raise exception 'événement introuvable' using errcode = '22023'; end if;

  -- 1. Anti-doublon Google : évalué SUR LA DONNÉE, jamais supposé.
  if v_o.appointment_id is not null
     and v_o.event_type in ('estimation_planifiee', 'estimation_reportee', 'estimation_annulee')
     and public.comm_google_covers_appointment(v_o.appointment_id) then
    v_reason := 'google_couvre_l_envoi';
  end if;

  -- 2. Modèle : absent ou non actif ⇒ aucun message ne peut partir.
  if v_reason is null then
    select * into v_tpl from public.communication_templates
    where organization_id = v_o.organization_id
      and template_key = v_o.template_key
      and channel = v_o.channel
      and status = 'actif'
    order by version desc limit 1;

    if v_tpl.id is null then
      select * into v_tpl from public.communication_templates
      where organization_id = v_o.organization_id
        and template_key = v_o.template_key
        and channel = v_o.channel
      order by version desc limit 1;
      v_reason := case when v_tpl.id is null then 'modele_absent' else 'modele_inactif' end;
    end if;
  end if;

  -- 3. Politique d'éligibilité (opposition, base légale, coordonnée).
  if v_reason is null then
    v_elig := public.crm_comm_eligibility(v_o.contact_id, v_o.channel, v_tpl.category);
    if not (v_elig->>'allowed')::boolean then
      v_reason := v_elig->>'reason';
    end if;
  end if;

  -- Clé d'idempotence : événement + canal. AUCUNE PII.
  v_key := v_o.event_key || ':' || v_o.channel;

  insert into public.communication_messages (
    organization_id, contact_id, opportunity_id, buyer_profile_id, property_id,
    appointment_id, channel, category, event_type, template_id, template_key,
    template_version, status, blocked_reason, scheduled_at, idempotency_key, created_by)
  values (
    v_o.organization_id, v_o.contact_id, v_o.opportunity_id, v_o.buyer_profile_id,
    v_o.property_id, v_o.appointment_id, v_o.channel,
    coalesce(v_tpl.category, 'transactionnel'), v_o.event_type, v_tpl.id,
    v_o.template_key, v_tpl.version,
    case when v_reason is null then 'en_attente' else 'bloque' end,
    v_reason, v_o.available_at, v_key, v_uid)
  on conflict (idempotency_key) do nothing
  returning id into v_msg_id;

  if v_msg_id is null then
    -- Rejeu : le message existe déjà. On rattache sans jamais dupliquer.
    select id into v_msg_id from public.communication_messages where idempotency_key = v_key;
    update public.communication_outbox
    set status = 'traite', message_id = v_msg_id, locked_at = null, locked_by = null
    where id = p_outbox_id;
    return jsonb_build_object('ok', true, 'duplicate', true, 'message_id', v_msg_id);
  end if;

  update public.communication_outbox
  set status = case when v_reason is null then 'traite' else 'ignore' end,
      skip_reason = v_reason,
      message_id = v_msg_id,
      locked_at = null, locked_by = null
  where id = p_outbox_id;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'communication_message', v_msg_id,
          case when v_reason is null then 'communication_preparee' else 'communication_bloquee' end,
          jsonb_build_object('event_type', v_o.event_type, 'channel', v_o.channel,
                             'template_key', v_o.template_key, 'reason', v_reason));

  return jsonb_build_object('ok', true, 'message_id', v_msg_id,
                            'blocked', v_reason is not null, 'reason', v_reason);
end;
$$;

-- Enregistre le RÉSULTAT d'un envoi réalisé par un adaptateur fournisseur.
-- Le fournisseur n'écrit jamais directement : il rapporte ici.
create or replace function public.crm_comm_record_send(
  p_message_id uuid,
  p_status text,
  p_provider text,
  p_provider_message_id text default null,
  p_error_code text default null,
  p_error_detail text default null,
  p_rendered_subject text default null,
  p_rendered_body text default null)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_old text;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.comm_can_manage() then
    raise exception 'droits insuffisants sur la file de communications' using errcode = '42501';
  end if;
  if p_status not in ('envoye', 'echec') then
    raise exception 'statut d''envoi inconnu' using errcode = '22023';
  end if;

  select status into v_old from public.communication_messages where id = p_message_id;
  if v_old is null then raise exception 'message introuvable' using errcode = '22023'; end if;
  if v_old in ('envoye', 'livre') then
    -- Anti-double envoi : un message déjà parti n'est jamais réécrit.
    return jsonb_build_object('ok', true, 'unchanged', true, 'status', v_old);
  end if;
  if v_old = 'bloque' then
    raise exception 'ce message est bloqué par la politique : aucun envoi possible'
      using errcode = '42501';
  end if;

  update public.communication_messages
  set status = p_status,
      provider = p_provider,
      provider_message_id = p_provider_message_id,
      sent_at = case when p_status = 'envoye' then now() else sent_at end,
      failed_at = case when p_status = 'echec' then now() else failed_at end,
      error_code = p_error_code,
      error_detail = p_error_detail,
      rendered_subject = coalesce(p_rendered_subject, rendered_subject),
      rendered_body = coalesce(p_rendered_body, rendered_body),
      attempt_count = attempt_count + 1
  where id = p_message_id;

  -- L'audit ne contient JAMAIS le contenu ni une coordonnée.
  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, old_value, new_value)
  values (v_uid, 'communication_message', p_message_id,
          case when p_status = 'envoye' then 'communication_envoyee' else 'communication_echec' end,
          jsonb_build_object('status', v_old),
          jsonb_build_object('status', p_status, 'provider', p_provider, 'error_code', p_error_code));

  return jsonb_build_object('ok', true, 'status', p_status);
end;
$$;

-- Rapprochement des statuts de livraison (sondage fournisseur ou action humaine).
create or replace function public.crm_comm_reconcile_status(
  p_message_id uuid,
  p_status text,
  p_provider_status text default null,
  p_error_code text default null)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_old text;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.comm_can_manage() then
    raise exception 'droits insuffisants sur la file de communications' using errcode = '42501';
  end if;
  if p_status not in ('livre', 'echec') then
    raise exception 'statut de livraison inconnu' using errcode = '22023';
  end if;

  select status into v_old from public.communication_messages where id = p_message_id;
  if v_old is null then raise exception 'message introuvable' using errcode = '22023'; end if;
  if v_old not in ('envoye', 'livre', 'echec') then
    raise exception 'ce message n''a pas encore été envoyé' using errcode = '22023';
  end if;

  update public.communication_messages
  set status = p_status,
      provider_status = coalesce(p_provider_status, provider_status),
      delivered_at = case when p_status = 'livre' then now() else delivered_at end,
      failed_at = case when p_status = 'echec' then now() else failed_at end,
      error_code = coalesce(p_error_code, error_code)
  where id = p_message_id;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, old_value, new_value)
  values (v_uid, 'communication_message', p_message_id, 'communication_statut',
          jsonb_build_object('status', v_old),
          jsonb_build_object('status', p_status, 'error_code', p_error_code));

  return jsonb_build_object('ok', true, 'status', p_status);
end;
$$;

create or replace function public.crm_comm_cancel_message(p_message_id uuid, p_reason text)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_old text;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.comm_can_manage() then
    raise exception 'droits insuffisants sur la file de communications' using errcode = '42501';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'un motif est obligatoire' using errcode = '22023';
  end if;

  select status into v_old from public.communication_messages where id = p_message_id;
  if v_old is null then raise exception 'message introuvable' using errcode = '22023'; end if;
  if v_old in ('envoye', 'livre') then
    raise exception 'un message déjà envoyé ne peut plus être annulé' using errcode = '22023';
  end if;

  update public.communication_messages
  set status = 'annule', error_detail = p_reason where id = p_message_id;

  update public.communication_outbox
  set status = 'abandonne', skip_reason = 'annule_manuellement'
  where message_id = p_message_id and status in ('en_attente', 'en_cours');

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, old_value, new_value)
  values (v_uid, 'communication_message', p_message_id, 'communication_annulee',
          jsonb_build_object('status', v_old), jsonb_build_object('status', 'annule'));

  return jsonb_build_object('ok', true);
end;
$$;

-- Rejoue un message en ÉCHEC. Un message bloqué par la politique n'est jamais
-- rejouable : il faudrait d'abord lever la cause (opposition, base légale…).
create or replace function public.crm_comm_retry_message(p_message_id uuid)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_old text; v_attempts integer;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.comm_can_manage() then
    raise exception 'droits insuffisants sur la file de communications' using errcode = '42501';
  end if;

  select status, attempt_count into v_old, v_attempts
  from public.communication_messages where id = p_message_id;
  if v_old is null then raise exception 'message introuvable' using errcode = '22023'; end if;
  if v_old <> 'echec' then
    raise exception 'seul un message en échec peut être rejoué' using errcode = '22023';
  end if;
  if v_attempts >= 5 then
    raise exception 'nombre maximal de tentatives atteint' using errcode = '22023';
  end if;

  update public.communication_messages
  set status = 'en_attente', error_code = null, error_detail = null, failed_at = null
  where id = p_message_id;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, old_value, new_value)
  values (v_uid, 'communication_message', p_message_id, 'communication_rejouee',
          jsonb_build_object('status', v_old), jsonb_build_object('attempt_count', v_attempts));

  return jsonb_build_object('ok', true);
end;
$$;

-- Planifie les RAPPELS de rendez-vous à venir. Responsabilité PRODIGIO : Google
-- ne garantit aucun rappel côté destinataire (voir docs/adr/002 §5).
create or replace function public.crm_comm_schedule_reminders(p_hours_ahead integer default 24)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_count integer := 0; v_row record;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.comm_can_manage() then
    raise exception 'droits insuffisants sur la file de communications' using errcode = '42501';
  end if;

  for v_row in
    select a.id, a.opportunity_id, a.owner_contact_id, a.starts_at
    from public.estimation_appointments a
    where a.status in ('planifie', 'confirme')
      and a.owner_contact_id is not null
      and a.starts_at > now()
      and a.starts_at <= now() + make_interval(hours => greatest(1, least(coalesce(p_hours_ahead, 24), 168)))
  loop
    if public.comm_enqueue(
      'estimation_rappel',
      'estimation_rappel:' || v_row.id::text || ':' || extract(epoch from v_row.starts_at)::bigint::text,
      v_row.owner_contact_id,
      'estimation_rappel',
      'email',
      jsonb_build_object('appointment_id', v_row.id, 'starts_at', v_row.starts_at),
      v_row.opportunity_id, null, null, v_row.id) is not null then
      v_count := v_count + 1;
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'scheduled', v_count);
end;
$$;

-- =============================================================================
-- 13. SURFACE EXECUTE — révocation systématique puis octroi explicite.
--     Convention posée par 20260817120000 : ne JAMAIS se reposer sur les
--     privilèges par défaut de Supabase.
-- =============================================================================
do $$
declare
  fn text;
  actions text[] := array[
    'public.crm_comm_upsert_template(text, text, text, text, text, text, text, text, text[], text)',
    'public.crm_comm_set_template_status(uuid, text)',
    'public.crm_comm_add_suppression(uuid, text, text, text, text)',
    'public.crm_comm_release_suppression(uuid, text)',
    'public.crm_comm_upsert_automation(text, text, text, text, text, integer, jsonb, jsonb, text)',
    'public.crm_comm_set_automation_status(uuid, text)',
    'public.crm_comm_claim_outbox(integer)',
    'public.crm_comm_prepare_message(uuid)',
    'public.crm_comm_record_send(uuid, text, text, text, text, text, text, text)',
    'public.crm_comm_reconcile_status(uuid, text, text, text)',
    'public.crm_comm_cancel_message(uuid, text)',
    'public.crm_comm_retry_message(uuid)',
    'public.crm_comm_schedule_reminders(integer)'
  ];
begin
  foreach fn in array actions loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end $$;

-- =============================================================================
-- 14. AMORÇAGE DES MODÈLES — en `brouillon`, JAMAIS `actif`.
--     Aucun envoi n'est donc possible : la politique refuse tout modèle non
--     actif (`modele_inactif`). Le contenu est un point de départ éditorial,
--     à valider avant toute activation.
-- =============================================================================
do $$
declare v_org uuid;
begin
  select id into v_org from public.organizations
  where kind = 'operateur_prodigio' and status = 'actif'
  order by created_at limit 1;

  if v_org is null then return; end if;

  insert into public.communication_templates (
    organization_id, template_key, version, channel, category, name, subject,
    body, body_format, allowed_variables, status, notes)
  values
    (v_org, 'mandat_demande_accusee', 1, 'email', 'transactionnel',
     'Accusé de réception — demande d''estimation',
     'Votre demande a bien été reçue',
     E'Bonjour {{prenom}},\n\nNous avons bien reçu votre demande concernant votre bien à {{ville}}.\n\nUn membre de l''équipe vous recontacte prochainement pour en échanger.\n\nÀ très vite,\nL''équipe Prodigio',
     'markdown', array['prenom', 'nom', 'ville'], 'brouillon',
     'BROUILLON — contenu à valider. Répond à une demande de la personne : transactionnel.'),

    (v_org, 'acquereur_interet_accuse', 1, 'email', 'transactionnel',
     'Accusé de réception — intérêt acquéreur',
     'Votre demande concernant {{nom_bien}}',
     E'Bonjour {{prenom}},\n\nNous avons bien reçu votre demande d''information concernant {{nom_bien}}.\n\nUn conseiller revient vers vous rapidement.\n\nL''équipe Prodigio',
     'markdown', array['prenom', 'nom', 'nom_bien'], 'brouillon',
     'BROUILLON — contenu à valider. Répond à une demande de la personne : transactionnel.'),

    (v_org, 'estimation_planifiee', 1, 'email', 'transactionnel',
     'Confirmation de rendez-vous d''estimation',
     'Votre rendez-vous du {{date_rdv}}',
     E'Bonjour {{prenom}},\n\nVotre rendez-vous d''estimation est confirmé le {{date_rdv}} à {{heure_rdv}}.\n\n{{adresse}}\n\nL''équipe Prodigio',
     'markdown', array['prenom', 'nom', 'date_rdv', 'heure_rdv', 'adresse'], 'brouillon',
     'BROUILLON — Google Calendar envoie déjà cette confirmation lorsque le propriétaire est invité : ce modèle ne sert qu''aux cas non couverts.'),

    (v_org, 'estimation_reportee', 1, 'email', 'transactionnel',
     'Report de rendez-vous d''estimation',
     'Votre rendez-vous est reporté au {{date_rdv}}',
     E'Bonjour {{prenom}},\n\nVotre rendez-vous d''estimation est reporté au {{date_rdv}} à {{heure_rdv}}.\n\nL''équipe Prodigio',
     'markdown', array['prenom', 'nom', 'date_rdv', 'heure_rdv'], 'brouillon',
     'BROUILLON — Google Calendar envoie déjà cette mise à jour lorsque le propriétaire est invité.'),

    (v_org, 'estimation_annulee', 1, 'email', 'transactionnel',
     'Annulation de rendez-vous d''estimation',
     'Votre rendez-vous a été annulé',
     E'Bonjour {{prenom}},\n\nVotre rendez-vous d''estimation a été annulé.\n\nNous restons à votre disposition pour convenir d''une nouvelle date.\n\nL''équipe Prodigio',
     'markdown', array['prenom', 'nom'], 'brouillon',
     'BROUILLON — Google Calendar envoie déjà cette annulation lorsque le propriétaire est invité.'),

    (v_org, 'estimation_rappel', 1, 'email', 'transactionnel',
     'Rappel de rendez-vous d''estimation',
     'Rappel : votre rendez-vous du {{date_rdv}}',
     E'Bonjour {{prenom}},\n\nPetit rappel : votre rendez-vous d''estimation a lieu le {{date_rdv}} à {{heure_rdv}}.\n\n{{adresse}}\n\nL''équipe Prodigio',
     'markdown', array['prenom', 'nom', 'date_rdv', 'heure_rdv', 'adresse'], 'brouillon',
     'BROUILLON — RESPONSABILITÉ PRODIGIO : Google ne garantit aucun rappel côté destinataire.')
  on conflict (organization_id, template_key, version) do nothing;
end $$;

commit;
