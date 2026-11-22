-- =============================================================================
-- PILOTAGE PUB — ÉTAPE 2 : LA LECTURE DES CHIFFRES META, EN LECTURE SEULE
-- =============================================================================
-- Chaque matin, Prodigio OS lit les statistiques Meta Ads du compte publicitaire
-- et les range ici. RIEN N'EST JAMAIS ÉCRIT CHEZ META : le jeton utilisé
-- (`META_ADS_READ_TOKEN`) n'a que le droit `ads_read`, et le client ne fait que
-- des lectures. La remontée de conversions reste l'étape 4, à la toute fin.
--
-- Cette migration pose :
--
--   1. pilotage_meta_insights   — une ligne par JOUR et par PUB : dépense en
--                                 centimes, impressions, couverture, clics,
--                                 clics sur lien, leads (action `lead` seule),
--                                 actions brutes, noms et identifiants campagne
--                                 / ensemble / pub. Remplacée PAR PÉRIODE à
--                                 chaque lecture (Meta corrige ses chiffres
--                                 plusieurs jours après) : jamais de doublon.
--   2. pilotage_meta_synchros   — le JOURNAL des lectures : qui, quand, quelle
--                                 période, combien d'appels, quel résultat.
--      pilotage_meta_controles  — le CONTRÔLE de chaque jour : la somme des
--                                 pubs doit égaler la dépense du compte.
--   3. pilotage_meta_pubs       — les pubs : nom, statut, lien d'aperçu.
--   4. pilotage_meta_couverture — la couverture (personnes touchées) de chaque
--                                 période proposée, par bien et au total : elle
--                                 ne s'additionne pas, elle se lit chez Meta.
--   5. pilotage_meta_regles     — le RATTACHEMENT des campagnes aux biens,
--                                 réglable dans l'application : jetons de la
--                                 convention de nommage, exceptions par
--                                 identifiant de campagne, « hors portefeuille ».
--   6. buyer_interests.meta_ad_id — l'identifiant de la pub qui a amené chaque
--                                 demande, tiré d'`utm_id` (adresse du
--                                 formulaire, puis première visite) et, à
--                                 défaut, d'un `utm_content` numérique. Les
--                                 anciennes lignes sont remplies, SANS RIEN
--                                 ÉCRASER ; les nouvelles le sont à l'insertion.
--
-- LE RATTACHEMENT N'EST PAS RECOPIÉ DANS CHAQUE LIGNE : il se calcule à la
-- lecture, à partir des règles en vigueur (`src/modules/pilotage/meta/
-- rattachement.ts`). Changer une règle reclasse donc tout l'historique d'un
-- coup, sans relancer de lecture ni réécrire une seule ligne de Meta.
--
-- RÉSERVÉ AUX ADMINISTRATEURS. RLS `crm_has_role('administrateur')` sur chaque
-- table ; aucune écriture directe. Les écritures de la lecture passent par des
-- fonctions exécutables par le SEUL rôle de service (la route du matin et le
-- bouton « Lire maintenant », côté serveur) ; les règles, par des fonctions
-- `crm_*` réservées à l'administrateur, auditées sans montant.
--
-- STRICTEMENT ADDITIVE. Six tables nouvelles ; une colonne ajoutée à
-- `buyer_interests`, remplie là où elle est vide ; un déclencheur d'insertion
-- qui ne peut JAMAIS faire échouer un dépôt ; les deux listes fermées d'audit
-- réécrites en entier, en sur-ensemble strict. Aucune valeur du compte
-- publicitaire n'est écrite ici : identifiants de campagne et jetons se
-- règlent dans l'application.
-- =============================================================================

begin;

-- Un dépôt de demande qui attendrait derrière cette migration ne doit pas
-- attendre plus longtemps que l'API ne le laisse faire : si un verrou n'est pas
-- obtenu en deux secondes, la migration s'arrête (rien n'est modifié, on la
-- relance plus tard) plutôt que de faire patienter les dépôts derrière elle.
set local lock_timeout = '2s';

-- =============================================================================
-- 1. AUDIT — les deux listes fermées, RÉÉCRITES EN ENTIER (89 → 91, 21 → 22).
-- =============================================================================
alter table public.audit_events drop constraint if exists audit_events_entity_type_check;

alter table public.audit_events add constraint audit_events_entity_type_check check (
  entity_type = any (array[
    'opportunity', 'contact', 'membership', 'organization', 'invitation',
    'calendar_connection', 'estimation_appointment', 'estimation_report',
    'mandate', 'economic_rule', 'document', 'property',
    'buyer_interest', 'buyer_profile',
    'communication_message', 'communication_template', 'communication_automation',
    'communication_suppression',
    'pilotage_conditions', 'pilotage_lot', 'pilotage_cout_fixe',
    -- Ajout du 12 novembre, étape 2 (lecture Meta).
    'pilotage_meta_regle'
  ]::text[])
);

alter table public.audit_events drop constraint if exists audit_events_event_type_check;

alter table public.audit_events add constraint audit_events_event_type_check check (
  event_type = any (array[
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
    'acquereur_resultat', 'acquereur_traitement', 'communication_planifiee',
    'communication_preparee', 'communication_envoyee', 'communication_livree',
    'communication_echec', 'communication_bloquee', 'communication_annulee',
    'communication_rejouee', 'communication_statut', 'modele_cree', 'modele_maj',
    'modele_statut', 'automatisation_creee', 'automatisation_maj',
    'automatisation_statut', 'opposition_ajoutee', 'opposition_levee',
    'formulaire_acquereur', 'bien_espace_travail',
    'acquereur_archive', 'acquereur_desarchive',
    'acquereur_budget',
    'pilotage_conditions_saisies',
    'pilotage_lot_cree', 'pilotage_lot_modifie',
    'pilotage_cout_saisi', 'pilotage_cout_annule',
    -- Ajout du 12 novembre, étape 2 (lecture Meta).
    'pilotage_regle_ajoutee', 'pilotage_regle_retiree'
  ]::text[])
);

-- =============================================================================
-- 2. LE JOURNAL DES LECTURES, ET LE CONTRÔLE DE CHAQUE JOUR.
-- =============================================================================
create table if not exists public.pilotage_meta_synchros (
  id                     uuid primary key default gen_random_uuid(),
  demarree_le            timestamptz not null default now(),
  terminee_le            timestamptz,
  -- `matin` : la tâche planifiée (Vercel Cron) ; `manuel` : le bouton.
  declencheur            text not null check (declencheur in ('matin', 'manuel')),
  demandee_par           uuid,
  statut                 text not null default 'en_cours'
                           check (statut in ('en_cours', 'reussie', 'partielle', 'echec')),
  periode_debut          date,
  periode_fin            date,
  -- Dernier jour entièrement relu et enregistré. C'est d'ici que repart la
  -- lecture suivante (moins sept jours : Meta corrige ses chiffres).
  couvert_jusqu_au       date,
  appels_api             integer not null default 0 check (appels_api >= 0),
  lignes_lues            integer not null default 0 check (lignes_lues >= 0),
  devise                 text,
  -- Message en français pour l'écran. Jamais un jeton, jamais une adresse.
  erreur                 text check (erreur is null or length(erreur) <= 1000),
  details                jsonb
);

comment on table public.pilotage_meta_synchros is
  'Journal des lectures Meta Ads (pilotage pub). Une ligne par lecture : déclencheur, période, appels, lignes, résultat. Figée une fois terminée. Réservé aux administrateurs.';

create index if not exists pilotage_meta_synchros_recentes_idx
  on public.pilotage_meta_synchros (demarree_le desc);

create table if not exists public.pilotage_meta_controles (
  jour                   date primary key,
  -- Somme des pubs du jour, calculée EN BASE à partir des lignes enregistrées.
  depense_pubs_cents     bigint not null check (depense_pubs_cents >= 0),
  -- Dépense du compte lue chez Meta au niveau du compte (`level=account`).
  depense_compte_cents   bigint not null check (depense_compte_cents >= 0),
  -- Pubs ayant dépensé ce jour-là : borne de l'écart d'arrondi (un centime par pub).
  pubs                   integer not null default 0 check (pubs >= 0),
  synchro_id             uuid references public.pilotage_meta_synchros (id) on delete set null,
  verifie_le             timestamptz not null default now()
);

comment on table public.pilotage_meta_controles is
  'Contrôle quotidien de la lecture Meta : la somme des pubs doit égaler la dépense du compte. Écart toléré : un centime par pub (arrondis de Meta). Réservé aux administrateurs.';

-- =============================================================================
-- 3. UNE LIGNE PAR JOUR ET PAR PUB.
-- =============================================================================
create table if not exists public.pilotage_meta_insights (
  jour                   date not null,
  ad_id                  text not null check (ad_id ~ '^[0-9]{1,30}$'),
  ad_name                text,
  adset_id               text check (adset_id is null or adset_id ~ '^[0-9]{1,30}$'),
  adset_name             text,
  campaign_id            text check (campaign_id is null or campaign_id ~ '^[0-9]{1,30}$'),
  campaign_name          text,
  -- Dépense prise comme HT (règle validée), en CENTIMES de la devise du compte.
  depense_cents          bigint not null default 0 check (depense_cents >= 0),
  impressions            bigint not null default 0 check (impressions >= 0),
  -- Personnes touchées CE JOUR par CETTE pub. Ne s'additionne pas : la
  -- couverture d'une période se lit chez Meta (pilotage_meta_couverture).
  couverture             bigint check (couverture is null or couverture >= 0),
  frequence              numeric(14,6),
  clics                  bigint not null default 0 check (clics >= 0),
  clics_lien             bigint not null default 0 check (clics_lien >= 0),
  ctr                    numeric(14,6),
  cpm                    numeric(16,6),
  -- L'action `lead` SEULE. Meta renvoie aussi onsite_web_lead,
  -- offsite_conversion.fb_pixel_lead et offsite_lead_add_20_s_calls, aux mêmes
  -- valeurs : les additionner compterait chaque demande plusieurs fois.
  leads                  integer not null default 0 check (leads >= 0),
  actions                jsonb,
  cout_par_action        jsonb,
  synchro_id             uuid references public.pilotage_meta_synchros (id) on delete set null,
  lu_le                  timestamptz not null default now(),
  primary key (jour, ad_id)
);

comment on table public.pilotage_meta_insights is
  'Statistiques Meta Ads, une ligne par jour et par pub, en lecture seule. Remplacées par période à chaque lecture (jamais de doublon). Le rattachement à un bien se calcule à la lecture, d''après pilotage_meta_regles. Réservé aux administrateurs.';

create index if not exists pilotage_meta_insights_campagne_idx
  on public.pilotage_meta_insights (campaign_id, jour);
create index if not exists pilotage_meta_insights_pub_idx
  on public.pilotage_meta_insights (ad_id, jour);

-- =============================================================================
-- 4. LES PUBS : NOM, STATUT, LIEN D'APERÇU.
-- =============================================================================
create table if not exists public.pilotage_meta_pubs (
  ad_id                  text primary key check (ad_id ~ '^[0-9]{1,30}$'),
  ad_name                text,
  adset_id               text,
  campaign_id            text,
  -- `effective_status` de Meta (ACTIVE, PAUSED, ARCHIVED…), tel quel.
  statut                 text check (statut is null or length(statut) <= 60),
  -- Aperçu partageable de Meta (« Voir la pub »).
  lien_apercu            text check (lien_apercu is null or lien_apercu ~ '^https://'),
  cree_le_chez_meta      timestamptz,
  vue_le                 timestamptz not null default now(),
  synchro_id             uuid references public.pilotage_meta_synchros (id) on delete set null
);

comment on table public.pilotage_meta_pubs is
  'Les pubs du compte Meta (nom, statut, lien d''aperçu partageable), mises à jour à chaque lecture. Réservé aux administrateurs.';

-- =============================================================================
-- 5. LA COUVERTURE DE CHAQUE PÉRIODE PROPOSÉE, PAR BIEN ET AU TOTAL.
-- =============================================================================
create table if not exists public.pilotage_meta_couverture (
  periode                text not null check (periode in (
                           'aujourdhui', 'hier', '7_derniers_jours', 'cette_semaine',
                           '30_derniers_jours', 'ce_mois', 'mois_dernier',
                           'cette_annee', 'toute_la_periode')),
  -- NULL : le total du portefeuille (toutes les pubs, hors « hors portefeuille »).
  property_id            uuid references public.properties (id) on delete restrict,
  couverture             bigint check (couverture is null or couverture >= 0),
  impressions            bigint check (impressions is null or impressions >= 0),
  date_debut             date,
  date_fin               date,
  pubs                   integer not null default 0 check (pubs >= 0),
  -- Pourquoi la couverture manque, quand elle manque. Jamais remplacée par 0.
  raison                 text check (raison is null or length(raison) <= 300),
  synchro_id             uuid references public.pilotage_meta_synchros (id) on delete set null,
  lu_le                  timestamptz not null default now(),
  constraint pilotage_meta_couverture_unique unique nulls not distinct (periode, property_id)
);

comment on table public.pilotage_meta_couverture is
  'Couverture (personnes touchées) de chaque période proposée, lue chez Meta pour les pubs de chaque bien et pour le total : elle ne s''additionne pas. Sert à la fréquence (impressions ÷ couverture). Réservé aux administrateurs.';

-- =============================================================================
-- 6. LE RATTACHEMENT DES CAMPAGNES AUX BIENS, RÉGLABLE DANS L'APPLICATION.
-- =============================================================================
create table if not exists public.pilotage_meta_regles (
  id                     uuid primary key default gen_random_uuid(),
  -- `jeton` : le BIEN de la convention de nommage (campagne
  -- « PRODIGIO | BIEN | LEADS », pub « BIEN | ANGLE | FORMAT | V1 »).
  -- `campagne` : une exception, par identifiant de campagne ; elle prime.
  type_regle             text not null check (type_regle in ('jeton', 'campagne')),
  valeur                 text not null,
  -- `biens` : un bien, ou plusieurs (groupe, réparti au prorata du prix).
  -- `hors_portefeuille` : visible, mais hors des indicateurs (ex. un ancien bien).
  cible                  text not null check (cible in ('biens', 'hors_portefeuille')),
  biens                  uuid[] not null default '{}'::uuid[],
  note                   text check (note is null or length(note) <= 500),
  creee_le               timestamptz not null default now(),
  creee_par              uuid,
  retiree_le             timestamptz,
  retiree_par            uuid,
  motif_retrait          text check (motif_retrait is null or length(motif_retrait) <= 500),
  constraint pilotage_meta_regles_valeur check (
    (type_regle = 'jeton' and valeur ~ '^[A-Z0-9][A-Z0-9 _-]{0,39}$')
    or (type_regle = 'campagne' and valeur ~ '^[0-9]{5,30}$')
  ),
  constraint pilotage_meta_regles_cible check (
    (cible = 'biens' and cardinality(biens) >= 1)
    or (cible = 'hors_portefeuille' and cardinality(biens) = 0)
  ),
  constraint pilotage_meta_regles_retrait check (
    retiree_le is not null or (retiree_par is null and motif_retrait is null)
  )
);

comment on table public.pilotage_meta_regles is
  'Règles de rattachement des dépenses Meta aux biens : jetons de la convention de nommage et exceptions par identifiant de campagne. Une règle ne se modifie pas : elle se retire (datée) et se remplace. Réservé aux administrateurs.';

-- Une seule règle EN VIGUEUR par jeton ou par campagne.
create unique index if not exists pilotage_meta_regles_en_vigueur_unique
  on public.pilotage_meta_regles (type_regle, valeur)
  where retiree_le is null;

-- =============================================================================
-- 7. LES GARDES : un journal terminé ne bouge plus ; une règle se retire, une fois.
-- =============================================================================
create or replace function public.pilotage_meta_synchro_garde()
returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'le journal des lectures Meta ne s''efface pas' using errcode = '0A000';
  end if;
  if old.statut <> 'en_cours' then
    raise exception 'une lecture terminée ne se modifie plus' using errcode = '0A000';
  end if;
  return new;
end;
$$;

create or replace function public.pilotage_meta_regle_garde()
returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'une règle de rattachement ne s''efface pas : elle se retire' using errcode = '0A000';
  end if;
  if old.retiree_le is not null then
    raise exception 'cette règle est déjà retirée' using errcode = '0A000';
  end if;
  if new.retiree_le is null
     or row(new.id, new.type_regle, new.valeur, new.cible, new.biens, new.note, new.creee_le, new.creee_par)
        is distinct from
        row(old.id, old.type_regle, old.valeur, old.cible, old.biens, old.note, old.creee_le, old.creee_par) then
    raise exception 'une règle ne se modifie pas : retirez-la et créez la bonne' using errcode = '0A000';
  end if;
  return new;
end;
$$;

revoke all on function public.pilotage_meta_synchro_garde() from public, anon, authenticated;
revoke all on function public.pilotage_meta_regle_garde() from public, anon, authenticated;

drop trigger if exists pilotage_meta_synchros_garde on public.pilotage_meta_synchros;
create trigger pilotage_meta_synchros_garde
  before update or delete on public.pilotage_meta_synchros
  for each row execute function public.pilotage_meta_synchro_garde();

drop trigger if exists pilotage_meta_regles_garde on public.pilotage_meta_regles;
create trigger pilotage_meta_regles_garde
  before update or delete on public.pilotage_meta_regles
  for each row execute function public.pilotage_meta_regle_garde();

-- =============================================================================
-- 8. ACCÈS — lecture administrateur seule ; aucune écriture directe.
-- =============================================================================
alter table public.pilotage_meta_synchros   enable row level security;
alter table public.pilotage_meta_controles  enable row level security;
alter table public.pilotage_meta_insights   enable row level security;
alter table public.pilotage_meta_pubs       enable row level security;
alter table public.pilotage_meta_couverture enable row level security;
alter table public.pilotage_meta_regles     enable row level security;

revoke all on table public.pilotage_meta_synchros   from anon, authenticated;
revoke all on table public.pilotage_meta_controles  from anon, authenticated;
revoke all on table public.pilotage_meta_insights   from anon, authenticated;
revoke all on table public.pilotage_meta_pubs       from anon, authenticated;
revoke all on table public.pilotage_meta_couverture from anon, authenticated;
revoke all on table public.pilotage_meta_regles     from anon, authenticated;

grant select on table public.pilotage_meta_synchros   to authenticated;
grant select on table public.pilotage_meta_controles  to authenticated;
grant select on table public.pilotage_meta_insights   to authenticated;
grant select on table public.pilotage_meta_pubs       to authenticated;
grant select on table public.pilotage_meta_couverture to authenticated;
grant select on table public.pilotage_meta_regles     to authenticated;

drop policy if exists pilotage_meta_synchros_lecture_admin on public.pilotage_meta_synchros;
create policy pilotage_meta_synchros_lecture_admin on public.pilotage_meta_synchros
  for select to authenticated using (public.crm_has_role('administrateur'));

drop policy if exists pilotage_meta_controles_lecture_admin on public.pilotage_meta_controles;
create policy pilotage_meta_controles_lecture_admin on public.pilotage_meta_controles
  for select to authenticated using (public.crm_has_role('administrateur'));

drop policy if exists pilotage_meta_insights_lecture_admin on public.pilotage_meta_insights;
create policy pilotage_meta_insights_lecture_admin on public.pilotage_meta_insights
  for select to authenticated using (public.crm_has_role('administrateur'));

drop policy if exists pilotage_meta_pubs_lecture_admin on public.pilotage_meta_pubs;
create policy pilotage_meta_pubs_lecture_admin on public.pilotage_meta_pubs
  for select to authenticated using (public.crm_has_role('administrateur'));

drop policy if exists pilotage_meta_couverture_lecture_admin on public.pilotage_meta_couverture;
create policy pilotage_meta_couverture_lecture_admin on public.pilotage_meta_couverture
  for select to authenticated using (public.crm_has_role('administrateur'));

drop policy if exists pilotage_meta_regles_lecture_admin on public.pilotage_meta_regles;
create policy pilotage_meta_regles_lecture_admin on public.pilotage_meta_regles
  for select to authenticated using (public.crm_has_role('administrateur'));

-- =============================================================================
-- 9. ÉCRITURES DE LA LECTURE — rôle de service SEUL (route du matin, bouton).
-- =============================================================================

-- --- Démarrer : une seule lecture à la fois -----------------------------------
create or replace function public.crm_pilotage_meta_synchro_demarrer(
  p_declencheur  text,
  p_demandee_par uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id      uuid;
  v_couvert date;
begin
  if p_declencheur is null or p_declencheur not in ('matin', 'manuel') then
    raise exception 'déclencheur invalide' using errcode = '22023';
  end if;

  -- Deux lectures en même temps se marcheraient dessus : la seconde s'efface.
  perform pg_advisory_xact_lock(hashtext('pilotage_meta_synchro'));

  -- Une lecture restée « en cours » plus de 20 minutes a été interrompue (la
  -- fonction serveur a été arrêtée) : on la clôt, pour ne pas bloquer à vie.
  update public.pilotage_meta_synchros
     set statut = 'echec', terminee_le = now(),
         erreur = 'lecture interrompue avant la fin (délai dépassé)'
   where statut = 'en_cours' and demarree_le < now() - interval '20 minutes';

  if exists (select 1 from public.pilotage_meta_synchros where statut = 'en_cours') then
    return jsonb_build_object('ok', false, 'occupe', true);
  end if;

  -- D'où repartir : le dernier jour entièrement enregistré, toutes lectures
  -- confondues (une tranche enregistrée reste valable même si la suite a échoué).
  select max(couvert_jusqu_au) into v_couvert from public.pilotage_meta_synchros;

  insert into public.pilotage_meta_synchros (declencheur, demandee_par)
  values (p_declencheur, p_demandee_par)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'synchro_id', v_id, 'couvert_jusqu_au', v_couvert);
end;
$$;

-- --- Remplacer une période : tout ou rien -------------------------------------
create or replace function public.crm_pilotage_meta_remplacer_tranche(
  p_synchro_id uuid,
  p_debut      date,
  p_fin        date,
  p_lignes     jsonb,
  p_controle   jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lignes   integer;
  v_hors     integer;
begin
  if p_debut is null or p_fin is null or p_fin < p_debut or p_fin - p_debut > 31 then
    raise exception 'période invalide (31 jours au plus)' using errcode = '22023';
  end if;
  if not exists (select 1 from public.pilotage_meta_synchros
                 where id = p_synchro_id and statut = 'en_cours') then
    raise exception 'lecture introuvable ou déjà terminée' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_lignes, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_controle, '[]'::jsonb)) <> 'array' then
    raise exception 'données de lecture invalides' using errcode = '22023';
  end if;

  select count(*) into v_hors
    from jsonb_to_recordset(coalesce(p_lignes, '[]'::jsonb)) as x(jour date)
   where x.jour is null or x.jour < p_debut or x.jour > p_fin;
  if v_hors > 0 then
    raise exception 'ligne hors de la période remplacée' using errcode = '22023';
  end if;

  -- REMPLACEMENT PAR PÉRIODE. Ce que Meta ne renvoie plus disparaît, ce qu'il
  -- a corrigé est remplacé : jamais de doublon, jamais de reste.
  delete from public.pilotage_meta_insights where jour between p_debut and p_fin;

  insert into public.pilotage_meta_insights (
    jour, ad_id, ad_name, adset_id, adset_name, campaign_id, campaign_name,
    depense_cents, impressions, couverture, frequence, clics, clics_lien, ctr, cpm,
    leads, actions, cout_par_action, synchro_id
  )
  select distinct on (x.jour, x.ad_id)
         x.jour, x.ad_id, left(x.ad_name, 500), x.adset_id, left(x.adset_name, 500),
         x.campaign_id, left(x.campaign_name, 500),
         coalesce(x.depense_cents, 0), coalesce(x.impressions, 0), x.couverture, x.frequence,
         coalesce(x.clics, 0), coalesce(x.clics_lien, 0), x.ctr, x.cpm,
         coalesce(x.leads, 0), x.actions, x.cout_par_action, p_synchro_id
    from jsonb_to_recordset(coalesce(p_lignes, '[]'::jsonb)) as x(
           jour date, ad_id text, ad_name text, adset_id text, adset_name text,
           campaign_id text, campaign_name text, depense_cents bigint, impressions bigint,
           couverture bigint, frequence numeric, clics bigint, clics_lien bigint,
           ctr numeric, cpm numeric, leads integer, actions jsonb, cout_par_action jsonb)
   order by x.jour, x.ad_id;
  get diagnostics v_lignes = row_count;

  -- LE CONTRÔLE DU JOUR : la somme des pubs, calculée ICI à partir de ce qui
  -- vient d'être enregistré, face à la dépense du compte lue chez Meta.
  delete from public.pilotage_meta_controles where jour between p_debut and p_fin;
  insert into public.pilotage_meta_controles
    (jour, depense_pubs_cents, depense_compte_cents, pubs, synchro_id)
  select j.jour,
         coalesce((select sum(i.depense_cents) from public.pilotage_meta_insights i
                    where i.jour = j.jour), 0),
         greatest(coalesce(c.depense_compte_cents, 0), 0),
         (select count(*) from public.pilotage_meta_insights i
           where i.jour = j.jour and i.depense_cents > 0),
         p_synchro_id
    from (select g::date as jour
            from generate_series(p_debut::timestamp, p_fin::timestamp, interval '1 day') as g) as j
    left join jsonb_to_recordset(coalesce(p_controle, '[]'::jsonb))
           as c(jour date, depense_compte_cents bigint) on c.jour = j.jour;

  update public.pilotage_meta_synchros
     set lignes_lues = lignes_lues + v_lignes,
         periode_debut = least(coalesce(periode_debut, p_debut), p_debut),
         periode_fin = greatest(coalesce(periode_fin, p_fin), p_fin),
         couvert_jusqu_au = greatest(coalesce(couvert_jusqu_au, p_fin), p_fin)
   where id = p_synchro_id;

  return jsonb_build_object('ok', true, 'lignes', v_lignes);
end;
$$;

-- --- Les pubs : nom, statut, lien d'aperçu --------------------------------------
create or replace function public.crm_pilotage_meta_enregistrer_pubs(
  p_synchro_id uuid,
  p_pubs       jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer;
begin
  if not exists (select 1 from public.pilotage_meta_synchros
                 where id = p_synchro_id and statut = 'en_cours') then
    raise exception 'lecture introuvable ou déjà terminée' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_pubs, '[]'::jsonb)) <> 'array' then
    raise exception 'liste de pubs invalide' using errcode = '22023';
  end if;

  insert into public.pilotage_meta_pubs
    (ad_id, ad_name, adset_id, campaign_id, statut, lien_apercu, cree_le_chez_meta, vue_le, synchro_id)
  select distinct on (x.ad_id)
         x.ad_id, left(x.ad_name, 500), x.adset_id, x.campaign_id, left(x.statut, 60),
         case when x.lien_apercu ~ '^https://' then left(x.lien_apercu, 2000) end,
         x.cree_le_chez_meta, now(), p_synchro_id
    from jsonb_to_recordset(coalesce(p_pubs, '[]'::jsonb)) as x(
           ad_id text, ad_name text, adset_id text, campaign_id text, statut text,
           lien_apercu text, cree_le_chez_meta timestamptz)
   where x.ad_id ~ '^[0-9]{1,30}$'
   order by x.ad_id
  on conflict (ad_id) do update set
    ad_name = excluded.ad_name,
    adset_id = excluded.adset_id,
    campaign_id = excluded.campaign_id,
    statut = excluded.statut,
    lien_apercu = coalesce(excluded.lien_apercu, pilotage_meta_pubs.lien_apercu),
    cree_le_chez_meta = coalesce(excluded.cree_le_chez_meta, pilotage_meta_pubs.cree_le_chez_meta),
    vue_le = excluded.vue_le,
    synchro_id = excluded.synchro_id;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- --- La couverture des périodes proposées : remplacée d'un bloc ----------------
create or replace function public.crm_pilotage_meta_remplacer_couverture(
  p_synchro_id uuid,
  p_lignes     jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer;
begin
  if not exists (select 1 from public.pilotage_meta_synchros
                 where id = p_synchro_id and statut = 'en_cours') then
    raise exception 'lecture introuvable ou déjà terminée' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_lignes, '[]'::jsonb)) <> 'array' then
    raise exception 'couverture invalide' using errcode = '22023';
  end if;

  delete from public.pilotage_meta_couverture;
  insert into public.pilotage_meta_couverture
    (periode, property_id, couverture, impressions, date_debut, date_fin, pubs, raison, synchro_id)
  select x.periode, x.property_id, x.couverture, x.impressions, x.date_debut, x.date_fin,
         coalesce(x.pubs, 0), left(x.raison, 300), p_synchro_id
    from jsonb_to_recordset(coalesce(p_lignes, '[]'::jsonb)) as x(
           periode text, property_id uuid, couverture bigint, impressions bigint,
           date_debut date, date_fin date, pubs integer, raison text);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- --- Terminer : le journal se fige ----------------------------------------------
create or replace function public.crm_pilotage_meta_synchro_terminer(
  p_synchro_id uuid,
  p_statut     text,
  p_erreur     text,
  p_appels_api integer,
  p_devise     text,
  p_details    jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_statut is null or p_statut not in ('reussie', 'partielle', 'echec') then
    raise exception 'statut de fin invalide' using errcode = '22023';
  end if;
  update public.pilotage_meta_synchros
     set statut = p_statut,
         terminee_le = now(),
         erreur = left(nullif(btrim(coalesce(p_erreur, '')), ''), 1000),
         appels_api = greatest(coalesce(p_appels_api, 0), 0),
         devise = left(p_devise, 10),
         details = p_details
   where id = p_synchro_id and statut = 'en_cours';
  if not found then
    raise exception 'lecture introuvable ou déjà terminée' using errcode = '22023';
  end if;
end;
$$;

-- =============================================================================
-- 10. RÈGLES DE RATTACHEMENT — administrateur seul, auditées sans montant.
-- =============================================================================
create or replace function public.crm_pilotage_meta_ajouter_regle(
  p_type_regle text,
  p_valeur     text,
  p_cible      text,
  p_biens      uuid[],
  p_note       text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_valeur text;
  v_biens  uuid[];
  v_id     uuid;
  v_note   text := nullif(btrim(coalesce(p_note, '')), '');
begin
  perform public.crm_require_role('administrateur');

  if p_type_regle is null or p_type_regle not in ('jeton', 'campagne') then
    raise exception 'type de règle invalide' using errcode = '22023';
  end if;
  if p_cible is null or p_cible not in ('biens', 'hors_portefeuille') then
    raise exception 'cible invalide' using errcode = '22023';
  end if;
  if v_note is not null and length(v_note) > 500 then
    raise exception 'note trop longue (500 caractères au plus)' using errcode = '22023';
  end if;

  -- Un jeton s'écrit comme dans les noms Meta, mais sans accent ni casse :
  -- « Verdun », « VERDUN » et « verdùn » désignent le même bien.
  if p_type_regle = 'jeton' then
    v_valeur := upper(translate(btrim(coalesce(p_valeur, '')),
                'àâäáãåçéèêëíìîïñóòôöõúùûüýÿÀÂÄÁÃÅÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝ',
                'aaaaaaceeeeiiiinooooouuuuyyAAAAAACEEEEIIIINOOOOOUUUUY'));
    v_valeur := regexp_replace(v_valeur, '\s+', ' ', 'g');
    if v_valeur !~ '^[A-Z0-9][A-Z0-9 _-]{0,39}$' then
      raise exception 'jeton invalide : lettres, chiffres, espaces, - ou _, 40 caractères au plus' using errcode = '22023';
    end if;
  else
    v_valeur := btrim(coalesce(p_valeur, ''));
    if v_valeur !~ '^[0-9]{5,30}$' then
      raise exception 'identifiant de campagne invalide : des chiffres seulement' using errcode = '22023';
    end if;
  end if;

  select coalesce(array_agg(distinct b), '{}'::uuid[]) into v_biens
    from unnest(coalesce(p_biens, '{}'::uuid[])) as t(b) where b is not null;
  if p_cible = 'biens' then
    if cardinality(v_biens) = 0 then
      raise exception 'choisissez au moins un bien' using errcode = '22023';
    end if;
    if exists (select 1 from unnest(v_biens) as t(b)
                where not exists (select 1 from public.properties p where p.id = t.b)) then
      raise exception 'bien introuvable' using errcode = '22023';
    end if;
  else
    v_biens := '{}'::uuid[];
  end if;

  if exists (select 1 from public.pilotage_meta_regles
              where type_regle = p_type_regle and valeur = v_valeur and retiree_le is null) then
    raise exception 'une règle existe déjà pour cette valeur : retirez-la d''abord' using errcode = '22023';
  end if;

  insert into public.pilotage_meta_regles (type_regle, valeur, cible, biens, note, creee_par)
  values (p_type_regle, v_valeur, p_cible, v_biens, v_note, v_uid)
  returning id into v_id;

  -- Identifiants seulement : le journal est lisible par les managers.
  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'pilotage_meta_regle', v_id, 'pilotage_regle_ajoutee',
          jsonb_build_object('type_regle', p_type_regle));

  return jsonb_build_object('ok', true, 'id', v_id, 'valeur', v_valeur);
end;
$$;

create or replace function public.crm_pilotage_meta_retirer_regle(
  p_regle_id uuid,
  p_motif    text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
  v_regle public.pilotage_meta_regles;
begin
  perform public.crm_require_role('administrateur');
  if v_motif is not null and length(v_motif) > 500 then
    raise exception 'motif trop long (500 caractères au plus)' using errcode = '22023';
  end if;

  select * into v_regle from public.pilotage_meta_regles where id = p_regle_id for update;
  if v_regle.id is null then
    raise exception 'règle introuvable' using errcode = '22023';
  end if;
  if v_regle.retiree_le is not null then
    return jsonb_build_object('ok', true, 'id', v_regle.id, 'deja_retiree', true);
  end if;

  update public.pilotage_meta_regles
     set retiree_le = now(), retiree_par = v_uid, motif_retrait = v_motif
   where id = v_regle.id;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'pilotage_meta_regle', v_regle.id, 'pilotage_regle_retiree',
          jsonb_build_object('type_regle', v_regle.type_regle));

  return jsonb_build_object('ok', true, 'id', v_regle.id, 'deja_retiree', false);
end;
$$;

-- =============================================================================
-- 11. LECTURE — totaux par pub sur une période. SECURITY INVOKER : la RLS des
--     tables s'applique, un autre rôle qu'administrateur ne reçoit rien.
-- =============================================================================
create or replace function public.crm_pilotage_meta_totaux(
  p_debut date,
  p_fin   date
)
returns table (
  ad_id          text,
  ad_name        text,
  adset_id       text,
  adset_name     text,
  campaign_id    text,
  campaign_name  text,
  depense_cents  bigint,
  impressions    bigint,
  clics          bigint,
  clics_lien     bigint,
  leads          bigint,
  premier_jour   date,
  dernier_jour   date
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  -- Les noms peuvent changer chez Meta : on garde le plus récent de chaque pub.
  select i.ad_id,
         (array_agg(i.ad_name order by i.jour desc))[1],
         (array_agg(i.adset_id order by i.jour desc))[1],
         (array_agg(i.adset_name order by i.jour desc))[1],
         (array_agg(i.campaign_id order by i.jour desc))[1],
         (array_agg(i.campaign_name order by i.jour desc))[1],
         sum(i.depense_cents)::bigint,
         sum(i.impressions)::bigint,
         sum(i.clics)::bigint,
         sum(i.clics_lien)::bigint,
         sum(i.leads)::bigint,
         min(i.jour),
         max(i.jour)
    from public.pilotage_meta_insights i
   where i.jour between coalesce(p_debut, '1970-01-01'::date) and coalesce(p_fin, '2999-12-31'::date)
   group by i.ad_id;
$$;

-- =============================================================================
-- 12. buyer_interests.meta_ad_id — la pub exacte de chaque demande.
-- =============================================================================
-- Le remplissage des anciennes lignes est une mise à jour : il ne doit
-- réveiller AUCUN autre déclencheur que la date de mise à jour (suspendue plus
-- bas). Un déclencheur de mise à jour inconnu du dépôt — un webhook posé à la
-- main, par exemple — pourrait envoyer une alerte par ligne : la migration
-- s'arrête alors, sans rien avoir modifié.
do $$
declare
  v_inattendus text;
begin
  select string_agg(t.tgname, ', ' order by t.tgname)
    into v_inattendus
    from pg_trigger t
   where t.tgrelid = 'public.buyer_interests'::regclass
     and not t.tgisinternal
     and (t.tgtype & 16) <> 0
     and t.tgname not in ('buyer_interests_set_updated_at');
  if v_inattendus is not null then
    raise exception 'Déclencheur de mise à jour inattendu sur buyer_interests (%) : migration arrêtée, rien n''a été modifié.', v_inattendus;
  end if;
end;
$$;

alter table public.buyer_interests add column if not exists meta_ad_id text;

comment on column public.buyer_interests.meta_ad_id is
  'Identifiant de la pub Meta qui a amené la demande : utm_id de l''adresse du formulaire, sinon de la première visite, sinon un utm_content numérique. Rempli à l''insertion ; les anciennes lignes ont été complétées sans rien écraser. NULL : inconnu.';

create index if not exists buyer_interests_meta_ad_idx
  on public.buyer_interests (meta_ad_id) where meta_ad_id is not null;

-- L'extraction, écrite une fois. `utm_id={{ad.id}}` est la consigne donnée au
-- media buyer (docs/31) ; avant elle, les campagnes de Cassis envoyaient
-- l'identifiant de la pub dans `utm_content`.
create or replace function public.pilotage_extraire_meta_ad_id(
  p_origin_url      text,
  p_first_touch_url text,
  p_utm_content     text
)
returns text
language sql
immutable
set search_path = pg_catalog, pg_temp
as $$
  select coalesce(
    substring(p_origin_url from '[?&]utm_id=([0-9]{5,30})(?:[&#]|$)'),
    substring(p_first_touch_url from '[?&]utm_id=([0-9]{5,30})(?:[&#]|$)'),
    case when btrim(coalesce(p_utm_content, '')) ~ '^[0-9]{5,30}$' then btrim(p_utm_content) end
  );
$$;

revoke all on function public.pilotage_extraire_meta_ad_id(text, text, text) from public, anon, authenticated;

-- À l'insertion : un identifiant de pub manquant ne doit JAMAIS faire perdre un
-- dépôt. Toute erreur est avalée, la demande part sans identifiant.
create or replace function public.pilotage_buyer_interest_meta_ad_id()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  begin
    if new.meta_ad_id is null then
      new.meta_ad_id := public.pilotage_extraire_meta_ad_id(
        new.origin_url,
        case when jsonb_typeof(new.first_touch) = 'object' then new.first_touch ->> 'url' end,
        new.utm_content);
    end if;
  exception when others then
    new.meta_ad_id := null;
  end;
  return new;
end;
$$;

revoke all on function public.pilotage_buyer_interest_meta_ad_id() from public, anon, authenticated;

drop trigger if exists buyer_interests_meta_ad_id on public.buyer_interests;
create trigger buyer_interests_meta_ad_id
  before insert on public.buyer_interests
  for each row execute function public.pilotage_buyer_interest_meta_ad_id();

-- Les anciennes lignes, SANS RIEN ÉCRASER : seules celles où la colonne est
-- vide. Le déclencheur de date de mise à jour est suspendu le temps de ce
-- remplissage — dans cette transaction seulement, personne d'autre ne le voit
-- suspendu — pour qu'aucune demande ne paraisse modifiée aujourd'hui.
alter table public.buyer_interests disable trigger buyer_interests_set_updated_at;

update public.buyer_interests
   set meta_ad_id = public.pilotage_extraire_meta_ad_id(
         origin_url,
         case when jsonb_typeof(first_touch) = 'object' then first_touch ->> 'url' end,
         utm_content)
 where meta_ad_id is null
   and public.pilotage_extraire_meta_ad_id(
         origin_url,
         case when jsonb_typeof(first_touch) = 'object' then first_touch ->> 'url' end,
         utm_content) is not null;

alter table public.buyer_interests enable trigger buyer_interests_set_updated_at;

-- =============================================================================
-- 13. DROITS D'EXÉCUTION.
-- =============================================================================
-- La lecture Meta : rôle de service SEUL. Un navigateur, même administrateur,
-- ne peut ni démarrer une lecture ni écrire des chiffres Meta.
revoke all on function public.crm_pilotage_meta_synchro_demarrer(text, uuid) from public, anon, authenticated;
revoke all on function public.crm_pilotage_meta_remplacer_tranche(uuid, date, date, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.crm_pilotage_meta_enregistrer_pubs(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.crm_pilotage_meta_remplacer_couverture(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.crm_pilotage_meta_synchro_terminer(uuid, text, text, integer, text, jsonb) from public, anon, authenticated;

grant execute on function public.crm_pilotage_meta_synchro_demarrer(text, uuid) to service_role;
grant execute on function public.crm_pilotage_meta_remplacer_tranche(uuid, date, date, jsonb, jsonb) to service_role;
grant execute on function public.crm_pilotage_meta_enregistrer_pubs(uuid, jsonb) to service_role;
grant execute on function public.crm_pilotage_meta_remplacer_couverture(uuid, jsonb) to service_role;
grant execute on function public.crm_pilotage_meta_synchro_terminer(uuid, text, text, integer, text, jsonb) to service_role;

-- Les règles et la lecture des totaux : authenticated, la fonction (ou la RLS)
-- revérifiant le rôle administrateur.
revoke all on function public.crm_pilotage_meta_ajouter_regle(text, text, text, uuid[], text) from public, anon;
revoke all on function public.crm_pilotage_meta_retirer_regle(uuid, text) from public, anon;
revoke all on function public.crm_pilotage_meta_totaux(date, date) from public, anon;

grant execute on function public.crm_pilotage_meta_ajouter_regle(text, text, text, uuid[], text) to authenticated;
grant execute on function public.crm_pilotage_meta_retirer_regle(uuid, text) to authenticated;
grant execute on function public.crm_pilotage_meta_totaux(date, date) to authenticated;

commit;
