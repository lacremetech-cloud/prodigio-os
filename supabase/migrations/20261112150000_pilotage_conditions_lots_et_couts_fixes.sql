-- =============================================================================
-- PILOTAGE PUB — ÉTAPE 1 : LES DONNÉES (conditions, lots, coûts fixes)
-- =============================================================================
-- Le pilotage relie la dépense publicitaire aux commissions de Prodigio : ce
-- qu'un bien peut rapporter, ce qu'on a investi pour le vendre, et si cela
-- vaut le coup. Décision de Victor du 12 novembre 2026, qui étend le périmètre
-- du MVP (docs/02-MVP-SCOPE.md) : la lecture des dépenses et le calcul des
-- commissions y entrent.
--
-- Cette migration ne pose QUE les données saisies à la main :
--
--   1. pilotage_conditions    — les conditions de commercialisation d'un bien
--                               (prix affiché, taux de commission, part de
--                               Prodigio, base des honoraires, TVA, statut),
--                               VERSIONNÉES : chaque changement est une
--                               nouvelle ligne, avec sa date d'effet, son
--                               auteur et son motif. Le calcul prend celle en
--                               vigueur.
--   2. pilotage_lots          — les lots d'un programme (Les Airelles) : un
--      pilotage_lot_versions    numéro immuable, et des états successifs
--                               (description, prix, statut, vente).
--   3. pilotage_couts_fixes   — les coûts fixes d'un bien (tournage, montage,
--                               photos, autre), en HT. La date et l'heure de
--                               la saisie sont notées d'office ; une erreur se
--                               corrige en ANNULANT, jamais en effaçant.
--
-- RIEN N'EST EFFACÉ, RIEN N'EST RÉÉCRIT.
-- Des déclencheurs refusent toute modification ou suppression de ces lignes,
-- même pour le rôle de service. La seule écriture permise après coup est
-- l'annulation d'un coût fixe, une fois, sans toucher au reste de la ligne.
--
-- RÉSERVÉ AUX ADMINISTRATEURS, EN BASE COMME À L'ÉCRAN.
-- Lecture : politique RLS `crm_has_role('administrateur')` sur les quatre
-- tables. Écriture : uniquement par les fonctions `crm_pilotage_*`
-- (SECURITY DEFINER, `search_path` figé) qui revérifient le rôle et écrivent
-- un AuditEvent. Aucun chiffre de commission n'entre dans une table lisible
-- par un commercial (property_public_config, notamment, leur est lisible).
--
-- LE JOURNAL D'AUDIT NE PORTE AUCUN MONTANT.
-- `audit_events` est lisible par les managers. Les événements du pilotage n'y
-- écrivent donc que des identifiants (bien, version, lot, coût) : ni prix, ni
-- taux, ni part, ni montant, ni motif — le motif est un texte libre qui
-- pourrait en contenir. L'historique complet vit dans les tables ci-dessus,
-- que seul un administrateur lit. Les événements portent leurs propres types
-- d'entité (`pilotage_*`) : ils n'apparaissent pas dans l'historique du bien
-- que les managers consultent sur la fiche.
--
-- STRICTEMENT ADDITIVE.
-- Quatre tables nouvelles, six fonctions nouvelles, deux contraintes d'audit
-- RÉÉCRITES EN ENTIER en sur-ensemble strict (aucune valeur retirée : un test
-- relit toutes les migrations et le vérifie). Aucune table existante modifiée,
-- aucune donnée insérée : les valeurs du portefeuille se saisissent par les
-- formulaires de l'application. Le dépôt est public, et les aperçus Vercel
-- écrivent dans la base de production.
--
-- AUCUNE VALEUR ÉCONOMIQUE EN DUR.
-- Le taux de commission, la part de Prodigio, la base HT/TTC des honoraires et
-- le taux de TVA sont des données saisies et versionnées, pas des constantes.
-- La NATURE DU PRIX (prix affiché FAI, ou prix HT de la grille d'un promoteur)
-- est une notion DISTINCTE de la base HT/TTC des honoraires : les deux ne sont
-- jamais déduites l'une de l'autre (CLAUDE.md, §1).
-- =============================================================================

begin;

-- =============================================================================
-- 1. AUDIT — les deux listes fermées, RÉÉCRITES EN ENTIER.
--    Reprise intégrale des 84 types d'événement (20261102100000) et des 18
--    types d'entité (20260818120000), puis ajout des valeurs du pilotage.
--    La leçon du 28 octobre : un type absent de la contrainte fait échouer
--    toute la transaction qui l'écrit.
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
    -- Ajout du 12 novembre (pilotage pub).
    'pilotage_conditions', 'pilotage_lot', 'pilotage_cout_fixe'
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
    -- Ajout du 12 novembre (pilotage pub).
    'pilotage_conditions_saisies',
    'pilotage_lot_cree', 'pilotage_lot_modifie',
    'pilotage_cout_saisi', 'pilotage_cout_annule'
  ]::text[])
);

-- =============================================================================
-- 2. LES GARDES : on ajoute, on n'efface rien.
-- =============================================================================

-- Conditions, lots et états de lot : aucune ligne ne se modifie ni ne
-- s'efface. Corriger, c'est ajouter une ligne.
create or replace function public.pilotage_ligne_immuable()
returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $$
begin
  raise exception '% : ligne non modifiable — une correction s''ajoute en nouvelle ligne, rien ne s''efface',
    tg_table_name using errcode = '0A000';
end;
$$;

comment on function public.pilotage_ligne_immuable() is
  'Déclencheur : refuse UPDATE et DELETE sur les tables versionnées du pilotage. Une correction est une nouvelle ligne.';

-- Coûts fixes : la seule écriture permise après coup est l'ANNULATION, une
-- fois, sans toucher au montant, au type, à la note ni à la trace de saisie.
create or replace function public.pilotage_cout_fixe_garde()
returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'un coût fixe ne s''efface pas : il s''annule, et reste visible' using errcode = '0A000';
  end if;
  if old.annule_le is not null then
    raise exception 'ce coût fixe est déjà annulé' using errcode = '0A000';
  end if;
  if new.annule_le is null
     or row(new.id, new.property_id, new.type_cout, new.montant_ht_cents, new.note,
            new.saisi_le, new.saisi_par, new.cle_saisie)
        is distinct from
        row(old.id, old.property_id, old.type_cout, old.montant_ht_cents, old.note,
            old.saisi_le, old.saisi_par, old.cle_saisie) then
    raise exception 'seule l''annulation d''un coût fixe est permise' using errcode = '0A000';
  end if;
  return new;
end;
$$;

comment on function public.pilotage_cout_fixe_garde() is
  'Déclencheur : un coût fixe ne s''efface pas et ne se réécrit pas ; seule son annulation (annule_le, annule_par, motif) est permise, une seule fois.';

revoke all on function public.pilotage_ligne_immuable() from public, anon, authenticated;
revoke all on function public.pilotage_cout_fixe_garde() from public, anon, authenticated;

-- =============================================================================
-- 3. PILOTAGE_CONDITIONS — conditions de commercialisation, versionnées.
-- =============================================================================
create table if not exists public.pilotage_conditions (
  id                      uuid primary key default gen_random_uuid(),
  property_id             uuid not null references public.properties (id) on delete restrict,
  -- La version qui s'applique à une date est celle dont la date d'effet est la
  -- plus récente sans la dépasser ; à date égale, la dernière saisie.
  date_effet              date not null,
  -- Un bien se vend en un seul bloc (villa) ou lot par lot (programme). Par
  -- lots, le prix et le statut se saisissent sur chaque lot.
  vente_par_lots          boolean not null,
  -- Ce que représente le prix saisi. Notion DISTINCTE de la base HT/TTC des
  -- honoraires : la grille HT d'un promoteur n'est pas un prix FAI, même quand
  -- on décide de la prendre comme prix affiché (question ouverte, docs/05).
  nature_prix             text not null
                            check (nature_prix in ('fai', 'ht_grille_promoteur')),
  prix_affiche_cents      bigint
                            check (prix_affiche_cents is null or prix_affiche_cents > 0),
  taux_commission_pct     numeric(6,4)
                            check (taux_commission_pct is null
                                   or (taux_commission_pct > 0 and taux_commission_pct < 100)),
  -- Base HT/TTC du taux de commission (des honoraires).
  base_honoraires         text not null
                            check (base_honoraires in ('TTC', 'HT', 'a_confirmer')),
  -- NULL : la part vient de la photographie économique du mandat, s'il existe.
  part_prodigio_pct       numeric(5,2)
                            check (part_prodigio_pct is null
                                   or (part_prodigio_pct >= 0 and part_prodigio_pct <= 100)),
  -- TVA appliquée aux honoraires, pour passer du TTC au HT.
  taux_tva_pct            numeric(5,2)
                            check (taux_tva_pct is null
                                   or (taux_tva_pct >= 0 and taux_tva_pct < 100)),
  statut_commercial       text
                            check (statut_commercial is null or statut_commercial in
                                   ('a_vendre', 'sous_offre', 'compromis_signe', 'vendu')),
  prix_vente_final_cents  bigint
                            check (prix_vente_final_cents is null or prix_vente_final_cents > 0),
  vendu_le                date,
  motif                   text not null check (btrim(motif) <> '' and length(motif) <= 2000),
  saisi_le                timestamptz not null default now(),
  -- Identifiant de l'auteur, gardé comme TRACE : pas de clé étrangère, pour
  -- qu'un journal immuable n'empêche jamais la suppression d'un compte.
  saisi_par               uuid,
  -- Par lots : rien de ce qui appartient aux lots au niveau du bien.
  -- En un bloc : un statut, toujours.
  constraint pilotage_conditions_bloc_ou_lots check (
    (vente_par_lots
       and prix_affiche_cents is null and statut_commercial is null
       and prix_vente_final_cents is null and vendu_le is null)
    or (not vente_par_lots and statut_commercial is not null)
  ),
  -- Le prix de vente final et la date de vente n'existent que pour un bien vendu.
  constraint pilotage_conditions_vente check (
    (prix_vente_final_cents is null and vendu_le is null) or statut_commercial = 'vendu'
  )
);

comment on table public.pilotage_conditions is
  'Conditions de commercialisation d''un bien, VERSIONNÉES (pilotage pub). Chaque changement est une nouvelle ligne (date d''effet, auteur, motif) ; le calcul prend celle en vigueur. Réservé aux administrateurs. Aucune ligne ne se modifie ni ne s''efface.';
comment on column public.pilotage_conditions.nature_prix is
  'fai : prix affiché frais d''agence inclus. ht_grille_promoteur : prix HT de la grille d''un promoteur, pris comme prix affiché (question ouverte, docs/05). Distinct de base_honoraires.';
comment on column public.pilotage_conditions.base_honoraires is
  'Base HT/TTC du taux de commission. La règle de calcul validée le 12/11/2026 suppose un taux TTC ; HT ou à confirmer : calcul non effectué.';
comment on column public.pilotage_conditions.part_prodigio_pct is
  'Part de Prodigio dans la commission. NULL : reprise de la photographie économique du mandat, si le bien en a un ; un écart entre les deux est signalé à l''écran.';

create index if not exists pilotage_conditions_bien_idx
  on public.pilotage_conditions (property_id, date_effet desc, saisi_le desc);

drop trigger if exists pilotage_conditions_immuable on public.pilotage_conditions;
create trigger pilotage_conditions_immuable
  before update or delete on public.pilotage_conditions
  for each row execute function public.pilotage_ligne_immuable();

-- =============================================================================
-- 4. PILOTAGE_LOTS / PILOTAGE_LOT_VERSIONS — les lots d'un programme.
--    Le numéro est l'identité du lot : il ne change pas. Tout le reste
--    (description, prix, statut, vente, retrait) vit dans des états
--    successifs ; l'état courant est le plus récent.
-- =============================================================================
create table if not exists public.pilotage_lots (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references public.properties (id) on delete restrict,
  numero       text not null check (btrim(numero) <> '' and length(numero) <= 40),
  cree_le      timestamptz not null default now(),
  cree_par     uuid,
  constraint pilotage_lots_numero_unique unique (property_id, numero)
);

comment on table public.pilotage_lots is
  'Lots d''un programme (pilotage pub) : identité immuable (bien + numéro). Les états successifs sont dans pilotage_lot_versions. Réservé aux administrateurs.';

create index if not exists pilotage_lots_bien_idx on public.pilotage_lots (property_id);

drop trigger if exists pilotage_lots_immuable on public.pilotage_lots;
create trigger pilotage_lots_immuable
  before update or delete on public.pilotage_lots
  for each row execute function public.pilotage_ligne_immuable();

create table if not exists public.pilotage_lot_versions (
  id                      uuid primary key default gen_random_uuid(),
  lot_id                  uuid not null references public.pilotage_lots (id) on delete restrict,
  description             text check (description is null or length(description) <= 500),
  prix_cents              bigint check (prix_cents is null or prix_cents > 0),
  statut_commercial       text not null
                            check (statut_commercial in
                                   ('a_vendre', 'sous_offre', 'compromis_signe', 'vendu')),
  prix_vente_final_cents  bigint
                            check (prix_vente_final_cents is null or prix_vente_final_cents > 0),
  vendu_le                date,
  -- Un lot retiré sort du pilotage (saisie erronée, lot sorti du programme)
  -- sans que rien ne s'efface. Il peut y revenir par un nouvel état.
  retire                  boolean not null default false,
  motif                   text not null check (btrim(motif) <> '' and length(motif) <= 2000),
  saisi_le                timestamptz not null default now(),
  saisi_par               uuid,
  constraint pilotage_lot_versions_vente check (
    (prix_vente_final_cents is null and vendu_le is null) or statut_commercial = 'vendu'
  )
);

comment on table public.pilotage_lot_versions is
  'États successifs d''un lot (description, prix, statut, vente, retrait). L''état courant est le plus récent. Aucune ligne ne se modifie ni ne s''efface. Réservé aux administrateurs.';

create index if not exists pilotage_lot_versions_lot_idx
  on public.pilotage_lot_versions (lot_id, saisi_le desc);

drop trigger if exists pilotage_lot_versions_immuable on public.pilotage_lot_versions;
create trigger pilotage_lot_versions_immuable
  before update or delete on public.pilotage_lot_versions
  for each row execute function public.pilotage_ligne_immuable();

-- =============================================================================
-- 5. PILOTAGE_COUTS_FIXES — coûts fixes d'un bien, en HT.
-- =============================================================================
create table if not exists public.pilotage_couts_fixes (
  id                 uuid primary key default gen_random_uuid(),
  property_id        uuid not null references public.properties (id) on delete restrict,
  type_cout          text not null
                       check (type_cout in ('production', 'montage', 'photos', 'autre')),
  montant_ht_cents   bigint not null check (montant_ht_cents > 0),
  note               text check (note is null or length(note) <= 2000),
  -- Notés d'office, jamais saisis : c'est la trace.
  saisi_le           timestamptz not null default now(),
  saisi_par          uuid,
  -- Une saisie envoyée deux fois (double clic, réseau qui reprend) ne compte
  -- qu'une fois : le formulaire porte une clé, la base la tient pour unique.
  cle_saisie         uuid,
  annule_le          timestamptz,
  annule_par         uuid,
  motif_annulation   text check (motif_annulation is null or length(motif_annulation) <= 2000),
  constraint pilotage_couts_fixes_cle_unique unique (cle_saisie),
  constraint pilotage_couts_fixes_annulation check (
    annule_le is not null or (annule_par is null and motif_annulation is null)
  )
);

comment on table public.pilotage_couts_fixes is
  'Coûts fixes d''un bien (tournage, montage, photos, autre), montant HT en centimes. Date et heure de saisie notées d''office. Une erreur s''ANNULE (la ligne reste, barrée, et sort des calculs) ; rien ne s''efface. Réservé aux administrateurs.';

create index if not exists pilotage_couts_fixes_bien_idx
  on public.pilotage_couts_fixes (property_id, saisi_le desc);

drop trigger if exists pilotage_couts_fixes_garde on public.pilotage_couts_fixes;
create trigger pilotage_couts_fixes_garde
  before update or delete on public.pilotage_couts_fixes
  for each row execute function public.pilotage_cout_fixe_garde();

-- =============================================================================
-- 6. ACCÈS — lecture réservée aux administrateurs ; aucune écriture directe.
--    Supabase accorde par défaut tous les droits aux rôles du schéma public :
--    on les retire explicitement, puis on ne rend que la lecture, filtrée.
-- =============================================================================
alter table public.pilotage_conditions   enable row level security;
alter table public.pilotage_lots         enable row level security;
alter table public.pilotage_lot_versions enable row level security;
alter table public.pilotage_couts_fixes  enable row level security;

revoke all on table public.pilotage_conditions   from anon, authenticated;
revoke all on table public.pilotage_lots         from anon, authenticated;
revoke all on table public.pilotage_lot_versions from anon, authenticated;
revoke all on table public.pilotage_couts_fixes  from anon, authenticated;

grant select on table public.pilotage_conditions   to authenticated;
grant select on table public.pilotage_lots         to authenticated;
grant select on table public.pilotage_lot_versions to authenticated;
grant select on table public.pilotage_couts_fixes  to authenticated;

drop policy if exists pilotage_conditions_lecture_admin on public.pilotage_conditions;
create policy pilotage_conditions_lecture_admin on public.pilotage_conditions
  for select to authenticated
  using (public.crm_has_role('administrateur'));

drop policy if exists pilotage_lots_lecture_admin on public.pilotage_lots;
create policy pilotage_lots_lecture_admin on public.pilotage_lots
  for select to authenticated
  using (public.crm_has_role('administrateur'));

drop policy if exists pilotage_lot_versions_lecture_admin on public.pilotage_lot_versions;
create policy pilotage_lot_versions_lecture_admin on public.pilotage_lot_versions
  for select to authenticated
  using (public.crm_has_role('administrateur'));

drop policy if exists pilotage_couts_fixes_lecture_admin on public.pilotage_couts_fixes;
create policy pilotage_couts_fixes_lecture_admin on public.pilotage_couts_fixes
  for select to authenticated
  using (public.crm_has_role('administrateur'));

-- =============================================================================
-- 7. ÉCRITURES — fonctions SECURITY DEFINER, administrateur seul, auditées.
-- =============================================================================

-- --- Nouvelle version des conditions d'un bien --------------------------------
create or replace function public.crm_pilotage_enregistrer_conditions(
  p_property_id            uuid,
  p_date_effet             date,
  p_vente_par_lots         boolean,
  p_nature_prix            text,
  p_prix_affiche_cents     bigint,
  p_taux_commission_pct    numeric,
  p_base_honoraires        text,
  p_part_prodigio_pct      numeric,
  p_taux_tva_pct           numeric,
  p_statut_commercial      text,
  p_prix_vente_final_cents bigint,
  p_vendu_le               date,
  p_motif                  text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
  v_id    uuid;
begin
  perform public.crm_require_role('administrateur');

  if p_property_id is null
     or not exists (select 1 from public.properties where id = p_property_id) then
    raise exception 'bien introuvable' using errcode = '22023';
  end if;
  if p_date_effet is null then
    raise exception 'date d''effet requise' using errcode = '22023';
  end if;
  if v_motif is null then
    raise exception 'motif requis : dites pourquoi ces conditions s''appliquent' using errcode = '22023';
  end if;
  if length(v_motif) > 2000 then
    raise exception 'motif trop long (2 000 caractères au plus)' using errcode = '22023';
  end if;
  if p_vente_par_lots is null then
    raise exception 'précisez si le bien se vend en un bloc ou par lots' using errcode = '22023';
  end if;
  if p_nature_prix is null or p_nature_prix not in ('fai', 'ht_grille_promoteur') then
    raise exception 'nature du prix invalide' using errcode = '22023';
  end if;
  if p_base_honoraires is null or p_base_honoraires not in ('TTC', 'HT', 'a_confirmer') then
    raise exception 'base des honoraires invalide' using errcode = '22023';
  end if;
  if p_prix_affiche_cents is not null and p_prix_affiche_cents <= 0 then
    raise exception 'le prix affiché doit être positif' using errcode = '22023';
  end if;
  if p_taux_commission_pct is not null
     and (p_taux_commission_pct <= 0 or p_taux_commission_pct >= 100
          or p_taux_commission_pct <> round(p_taux_commission_pct, 4)) then
    raise exception 'taux de commission invalide (entre 0 et 100 %%, 4 décimales au plus)' using errcode = '22023';
  end if;
  if p_part_prodigio_pct is not null
     and (p_part_prodigio_pct < 0 or p_part_prodigio_pct > 100
          or p_part_prodigio_pct <> round(p_part_prodigio_pct, 2)) then
    raise exception 'part de Prodigio invalide (entre 0 et 100 %%, 2 décimales au plus)' using errcode = '22023';
  end if;
  if p_taux_tva_pct is not null
     and (p_taux_tva_pct < 0 or p_taux_tva_pct >= 100
          or p_taux_tva_pct <> round(p_taux_tva_pct, 2)) then
    raise exception 'taux de TVA invalide (entre 0 et 100 %%, 2 décimales au plus)' using errcode = '22023';
  end if;
  if p_statut_commercial is not null
     and p_statut_commercial not in ('a_vendre', 'sous_offre', 'compromis_signe', 'vendu') then
    raise exception 'statut commercial invalide' using errcode = '22023';
  end if;
  if p_vente_par_lots then
    if p_prix_affiche_cents is not null or p_statut_commercial is not null
       or p_prix_vente_final_cents is not null or p_vendu_le is not null then
      raise exception 'vente par lots : le prix, le statut et la vente se saisissent lot par lot' using errcode = '22023';
    end if;
  elsif p_statut_commercial is null then
    raise exception 'statut commercial requis' using errcode = '22023';
  end if;
  if (p_prix_vente_final_cents is not null or p_vendu_le is not null)
     and p_statut_commercial is distinct from 'vendu' then
    raise exception 'le prix de vente final et la date de vente ne se saisissent que pour un bien vendu' using errcode = '22023';
  end if;
  if p_prix_vente_final_cents is not null and p_prix_vente_final_cents <= 0 then
    raise exception 'le prix de vente final doit être positif' using errcode = '22023';
  end if;

  insert into public.pilotage_conditions (
    property_id, date_effet, vente_par_lots, nature_prix, prix_affiche_cents,
    taux_commission_pct, base_honoraires, part_prodigio_pct, taux_tva_pct,
    statut_commercial, prix_vente_final_cents, vendu_le, motif, saisi_par
  ) values (
    p_property_id, p_date_effet, p_vente_par_lots, p_nature_prix, p_prix_affiche_cents,
    p_taux_commission_pct, p_base_honoraires, p_part_prodigio_pct, p_taux_tva_pct,
    p_statut_commercial, p_prix_vente_final_cents, p_vendu_le, v_motif, v_uid
  )
  returning id into v_id;

  -- Identifiants seulement : le journal est lisible par les managers.
  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'pilotage_conditions', v_id, 'pilotage_conditions_saisies',
          jsonb_build_object('property_id', p_property_id, 'date_effet', p_date_effet));

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

comment on function public.crm_pilotage_enregistrer_conditions(
  uuid, date, boolean, text, bigint, numeric, text, numeric, numeric, text, bigint, date, text) is
  'Ajoute une version des conditions de commercialisation d''un bien (pilotage pub). Administrateur seul. Rien n''est écrasé : la version en vigueur est la plus récente par date d''effet. Audit sans montant.';

-- --- Créer un lot, ou lui donner un nouvel état ---------------------------------
create or replace function public.crm_pilotage_enregistrer_lot(
  p_lot_id                 uuid,     -- NULL : nouveau lot
  p_property_id            uuid,     -- requis pour un nouveau lot
  p_numero                 text,     -- requis pour un nouveau lot ; immuable ensuite
  p_description            text,
  p_prix_cents             bigint,
  p_statut_commercial      text,
  p_prix_vente_final_cents bigint,
  p_vendu_le               date,
  p_retire                 boolean,
  p_motif                  text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid         uuid := auth.uid();
  v_motif       text := nullif(btrim(coalesce(p_motif, '')), '');
  v_numero      text := nullif(btrim(coalesce(p_numero, '')), '');
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_lot         public.pilotage_lots;
  v_version     uuid;
  v_nouveau     boolean := p_lot_id is null;
begin
  perform public.crm_require_role('administrateur');

  if v_motif is null then
    raise exception 'motif requis : dites pourquoi ce lot change' using errcode = '22023';
  end if;
  if length(v_motif) > 2000 then
    raise exception 'motif trop long (2 000 caractères au plus)' using errcode = '22023';
  end if;
  if v_description is not null and length(v_description) > 500 then
    raise exception 'description trop longue (500 caractères au plus)' using errcode = '22023';
  end if;
  if p_statut_commercial is null
     or p_statut_commercial not in ('a_vendre', 'sous_offre', 'compromis_signe', 'vendu') then
    raise exception 'statut commercial invalide' using errcode = '22023';
  end if;
  if p_prix_cents is not null and p_prix_cents <= 0 then
    raise exception 'le prix du lot doit être positif' using errcode = '22023';
  end if;
  if (p_prix_vente_final_cents is not null or p_vendu_le is not null)
     and p_statut_commercial <> 'vendu' then
    raise exception 'le prix de vente final et la date de vente ne se saisissent que pour un lot vendu' using errcode = '22023';
  end if;
  if p_prix_vente_final_cents is not null and p_prix_vente_final_cents <= 0 then
    raise exception 'le prix de vente final doit être positif' using errcode = '22023';
  end if;

  if v_nouveau then
    if p_property_id is null
       or not exists (select 1 from public.properties where id = p_property_id) then
      raise exception 'bien introuvable' using errcode = '22023';
    end if;
    if v_numero is null then
      raise exception 'numéro de lot requis' using errcode = '22023';
    end if;
    if length(v_numero) > 40 then
      raise exception 'numéro de lot trop long' using errcode = '22023';
    end if;
    if coalesce(p_retire, false) then
      raise exception 'un lot ne peut pas naître retiré' using errcode = '22023';
    end if;
    if exists (select 1 from public.pilotage_lots
               where property_id = p_property_id and numero = v_numero) then
      raise exception 'ce numéro de lot existe déjà pour ce bien' using errcode = '22023';
    end if;
    insert into public.pilotage_lots (property_id, numero, cree_par)
    values (p_property_id, v_numero, v_uid)
    returning * into v_lot;
  else
    select * into v_lot from public.pilotage_lots where id = p_lot_id;
    if v_lot.id is null then
      raise exception 'lot introuvable' using errcode = '22023';
    end if;
    if p_property_id is not null and p_property_id <> v_lot.property_id then
      raise exception 'ce lot appartient à un autre bien' using errcode = '22023';
    end if;
    if v_numero is not null and v_numero <> v_lot.numero then
      raise exception 'le numéro d''un lot ne change pas : retirez-le et créez le bon' using errcode = '22023';
    end if;
  end if;

  insert into public.pilotage_lot_versions (
    lot_id, description, prix_cents, statut_commercial, prix_vente_final_cents,
    vendu_le, retire, motif, saisi_par
  ) values (
    v_lot.id, v_description, p_prix_cents, p_statut_commercial, p_prix_vente_final_cents,
    p_vendu_le, coalesce(p_retire, false), v_motif, v_uid
  )
  returning id into v_version;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'pilotage_lot', v_lot.id,
          case when v_nouveau then 'pilotage_lot_cree' else 'pilotage_lot_modifie' end,
          jsonb_build_object('property_id', v_lot.property_id, 'numero', v_lot.numero,
                             'version_id', v_version));

  return jsonb_build_object('ok', true, 'lot_id', v_lot.id, 'version_id', v_version);
end;
$$;

comment on function public.crm_pilotage_enregistrer_lot(
  uuid, uuid, text, text, bigint, text, bigint, date, boolean, text) is
  'Crée un lot (numéro immuable) ou lui ajoute un nouvel état (pilotage pub). Administrateur seul. Rien n''est écrasé. Audit sans montant.';

-- --- Saisir un coût fixe --------------------------------------------------------
create or replace function public.crm_pilotage_saisir_cout_fixe(
  p_property_id      uuid,
  p_type_cout        text,
  p_montant_ht_cents bigint,
  p_note             text,
  p_cle_saisie       uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := auth.uid();
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_id   uuid;
begin
  perform public.crm_require_role('administrateur');

  if p_property_id is null
     or not exists (select 1 from public.properties where id = p_property_id) then
    raise exception 'bien introuvable' using errcode = '22023';
  end if;
  if p_type_cout is null or p_type_cout not in ('production', 'montage', 'photos', 'autre') then
    raise exception 'type de coût invalide' using errcode = '22023';
  end if;
  if p_montant_ht_cents is null or p_montant_ht_cents <= 0 then
    raise exception 'montant HT requis, positif' using errcode = '22023';
  end if;
  if v_note is not null and length(v_note) > 2000 then
    raise exception 'note trop longue (2 000 caractères au plus)' using errcode = '22023';
  end if;

  -- La même saisie reçue deux fois ne compte qu'une fois.
  if p_cle_saisie is not null then
    select id into v_id from public.pilotage_couts_fixes where cle_saisie = p_cle_saisie;
    if v_id is not null then
      return jsonb_build_object('ok', true, 'id', v_id, 'deja_enregistre', true);
    end if;
  end if;

  insert into public.pilotage_couts_fixes
    (property_id, type_cout, montant_ht_cents, note, saisi_par, cle_saisie)
  values
    (p_property_id, p_type_cout, p_montant_ht_cents, v_note, v_uid, p_cle_saisie)
  on conflict (cle_saisie) do nothing
  returning id into v_id;

  if v_id is null then
    -- Course entre deux envois identiques : l'autre a gagné, c'est la même saisie.
    select id into v_id from public.pilotage_couts_fixes where cle_saisie = p_cle_saisie;
    return jsonb_build_object('ok', true, 'id', v_id, 'deja_enregistre', true);
  end if;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'pilotage_cout_fixe', v_id, 'pilotage_cout_saisi',
          jsonb_build_object('property_id', p_property_id));

  return jsonb_build_object('ok', true, 'id', v_id, 'deja_enregistre', false);
end;
$$;

comment on function public.crm_pilotage_saisir_cout_fixe(uuid, text, bigint, text, uuid) is
  'Enregistre un coût fixe HT sur un bien (pilotage pub). Administrateur seul. Date et auteur notés d''office ; une clé de saisie rend le double envoi sans effet. Audit sans montant.';

-- --- Annuler un coût fixe -------------------------------------------------------
create or replace function public.crm_pilotage_annuler_cout_fixe(
  p_cout_id uuid,
  p_motif   text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
  v_cout  public.pilotage_couts_fixes;
begin
  perform public.crm_require_role('administrateur');

  if v_motif is not null and length(v_motif) > 2000 then
    raise exception 'motif trop long (2 000 caractères au plus)' using errcode = '22023';
  end if;

  select * into v_cout from public.pilotage_couts_fixes where id = p_cout_id for update;
  if v_cout.id is null then
    raise exception 'coût fixe introuvable' using errcode = '22023';
  end if;
  -- Un second clic sur « Annuler » n'est pas une erreur : c'est déjà fait.
  if v_cout.annule_le is not null then
    return jsonb_build_object('ok', true, 'id', v_cout.id, 'property_id', v_cout.property_id,
                              'deja_annule', true);
  end if;

  update public.pilotage_couts_fixes
     set annule_le = now(), annule_par = v_uid, motif_annulation = v_motif
   where id = v_cout.id;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'pilotage_cout_fixe', v_cout.id, 'pilotage_cout_annule',
          jsonb_build_object('property_id', v_cout.property_id));

  return jsonb_build_object('ok', true, 'id', v_cout.id, 'property_id', v_cout.property_id,
                            'deja_annule', false);
end;
$$;

comment on function public.crm_pilotage_annuler_cout_fixe(uuid, text) is
  'Annule un coût fixe (pilotage pub) : la ligne reste, barrée, avec la date d''annulation, et sort des calculs. Administrateur seul. Rien n''est effacé. Audit sans montant.';

-- --- Droits d'exécution ---------------------------------------------------------
-- Ni `public` ni `anon` ; `authenticated` seulement, chaque fonction
-- revérifiant le rôle administrateur en son sein.
revoke all on function public.crm_pilotage_enregistrer_conditions(
  uuid, date, boolean, text, bigint, numeric, text, numeric, numeric, text, bigint, date, text)
  from public, anon;
revoke all on function public.crm_pilotage_enregistrer_lot(
  uuid, uuid, text, text, bigint, text, bigint, date, boolean, text)
  from public, anon;
revoke all on function public.crm_pilotage_saisir_cout_fixe(uuid, text, bigint, text, uuid)
  from public, anon;
revoke all on function public.crm_pilotage_annuler_cout_fixe(uuid, text)
  from public, anon;

grant execute on function public.crm_pilotage_enregistrer_conditions(
  uuid, date, boolean, text, bigint, numeric, text, numeric, numeric, text, bigint, date, text)
  to authenticated;
grant execute on function public.crm_pilotage_enregistrer_lot(
  uuid, uuid, text, text, bigint, text, bigint, date, boolean, text)
  to authenticated;
grant execute on function public.crm_pilotage_saisir_cout_fixe(uuid, text, bigint, text, uuid)
  to authenticated;
grant execute on function public.crm_pilotage_annuler_cout_fixe(uuid, text)
  to authenticated;

commit;
