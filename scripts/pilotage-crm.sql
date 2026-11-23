-- =============================================================================
-- RECETTE SQL DES CHIFFRES DU CRM (pilotage pub, étape 3b), jouée sur le VRAI SQL.
--
-- Ce que rendent les fonctions `crm_pilotage_crm_*` sur un décor fictif dont on
-- connaît chaque réponse : période sur la date d'arrivée (jour de Paris),
-- personnes archivées exclues, personnes comptées dans chaque bien et une fois
-- au total, étapes actuelles et atteintes (journal, anciennes clés traduites),
-- visites par leur demande, offres, provenance, responsables, et la pub de
-- chaque demande décidée à la lecture (identifiant connu, nom unique,
-- campagne, sinon non rattachée — un `utm_id` de campagne n'est pas une pub).
-- Et qui peut les lire : l'administrateur seul.
--
-- Se joue sur une base LOCALE montée par `scripts/replay-migrations.sh` :
--   psql -d prodigio -f scripts/pilotage-crm.sql
-- Jouable aussi avec la règle `safeupdate` de la production :
--   PGOPTIONS='-c session_preload_libraries=safeupdate' psql -d prodigio -f scripts/pilotage-crm.sql
--
-- Refus sur une base non vierge ; une seule transaction annulée à la fin.
-- Données fictives uniquement.
-- =============================================================================

begin;

do $$
begin
  if exists (select 1 from public.properties) or exists (select 1 from public.buyer_interests) then
    raise exception 'Base non vierge : ce script ne se joue que sur une base LOCALE (scripts/replay-migrations.sh).';
  end if;
end $$;

-- --- Le décor (fictif) ----------------------------------------------------------
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'admin@crm.test'),
  ('b0000000-0000-0000-0000-00000000000b', 'manager@crm.test'),
  ('c0000000-0000-0000-0000-00000000000c', 'commercial@crm.test');

insert into public.organizations (id, slug, name, kind) values
  ('e0000000-0000-0000-0000-00000000000e', 'agence-essai', 'Agence essai', 'agence_partenaire');

insert into public.organization_memberships (user_id, organization_id, role, status)
select u.id, o.id, u.role, 'actif'
  from (values ('a0000000-0000-0000-0000-00000000000a'::uuid, 'administrateur'),
               ('b0000000-0000-0000-0000-00000000000b'::uuid, 'manager'),
               ('c0000000-0000-0000-0000-00000000000c'::uuid, 'commercial')) as u(id, role),
       public.organizations o where o.slug = 'prodigio';

insert into public.properties (id, organization_id, project_name, commercialization_origin, holder_organization_id)
select v.id, o.id, v.nom, 'partenaire_commercialisation', 'e0000000-0000-0000-0000-00000000000e'
  from (values ('10000000-0000-0000-0000-000000000001'::uuid, 'Villa essai'),
               ('20000000-0000-0000-0000-000000000002'::uuid, 'Villa deux'),
               ('30000000-0000-0000-0000-000000000003'::uuid, 'Programme essai')) as v(id, nom),
       public.organizations o where o.slug = 'prodigio';

-- Les pubs connues de la lecture Meta : 111, 222, 333 (« Nom unique ») ; 444 et
-- 445 portent le même nom (« Doublon ») ; la campagne 903 est connue.
insert into public.pilotage_meta_pubs (ad_id, ad_name, campaign_id) values
  ('111', 'ESSAI | A | B | V1', '900'),
  ('222', 'ESSAI | C | D | V1', '901'),
  ('333', 'Nom unique', '902'),
  ('444', 'Doublon', '903'),
  ('445', 'Doublon', '903');

-- Les personnes : X (dossier envoyé, qualifiée) ; Y (vivier, non qualifiée,
-- passée par « à rappeler » puis une ancienne « visite ») ; Z (archivée) ; W (pas
-- intéressée après une offre, gros potentiel, un montant saisi pour son bien).
insert into public.contacts (id, first_name, last_name) values
  ('40000000-0000-0000-0000-0000000000a1', 'Fictif', 'X'),
  ('40000000-0000-0000-0000-0000000000a2', 'Fictif', 'Y'),
  ('40000000-0000-0000-0000-0000000000a3', 'Fictif', 'Z'),
  ('40000000-0000-0000-0000-0000000000a4', 'Fictif', 'W');

insert into public.buyer_profiles (id, organization_id, contact_id, pipeline_stage, qualification,
                                   qualification_reason, archive_le, offer_amount_cents, offer_property_id)
select v.id, o.id, v.contact, v.etape, v.qualif,
       case when v.qualif = 'non_qualifie' then 'Motif fictif' end, v.archive, v.montant, v.bien
  from (values
    ('50000000-0000-0000-0000-0000000000a1'::uuid, '40000000-0000-0000-0000-0000000000a1'::uuid, 'en_discussion', 'qualifie', null::timestamptz, null::bigint, null::uuid),
    ('50000000-0000-0000-0000-0000000000a2'::uuid, '40000000-0000-0000-0000-0000000000a2'::uuid, 'vivier', 'non_qualifie', null, null, null),
    ('50000000-0000-0000-0000-0000000000a3'::uuid, '40000000-0000-0000-0000-0000000000a3'::uuid, 'a_contacter', 'a_qualifier', now(), null, null),
    ('50000000-0000-0000-0000-0000000000a4'::uuid, '40000000-0000-0000-0000-0000000000a4'::uuid, 'pas_interesse', 'gros_potentiel', null, 12345600, '30000000-0000-0000-0000-000000000003'::uuid)
  ) as v(id, contact, etape, qualif, archive, montant, bien),
  public.organizations o where o.slug = 'prodigio';

-- Le journal : Y est passée par « à rappeler » puis « visite » (ancienne clé de
-- « visite planifiée ») ; W est passée par « offre en cours ».
insert into public.audit_events (entity_type, entity_id, event_type, old_value, new_value) values
  ('buyer_profile', '50000000-0000-0000-0000-0000000000a2', 'acquereur_traitement',
   '{"stage": "a_contacter", "qualification": "a_qualifier"}', '{"stage": "a_rappeler", "qualification": "a_qualifier"}'),
  ('buyer_profile', '50000000-0000-0000-0000-0000000000a2', 'acquereur_stade', '{"stage": "a_rappeler"}', '{"stage": "visite"}'),
  ('buyer_profile', '50000000-0000-0000-0000-0000000000a4', 'acquereur_stade', '{"stage": "en_discussion"}', '{"stage": "offre_en_cours"}');

-- Les demandes (jour de Paris entre parenthèses ; période : du 1er au 20/11) :
--  R1  X, Villa essai, 05/11, utm_content « 111 »                    → pub 111
--  R1b X, Villa essai, 20/10                                          → hors période
--  R2  X, Villa deux, 06/11, utm_id = campagne 900, utm_content 222
--      dans la première visite seulement                              → pub 222
--  R3  Y, Villa essai, 31/10 23 h 30 UTC (01/11 à Paris), nom unique  → pub 333
--  R4  Z (archivée), Villa essai, 07/11                               → exclue
--  R5  W, Programme essai, 08/11, nom « Doublon », campagne 903       → campagne 903
--  R6  sans personne, Villa deux, 09/11, sans trace                   → non rattachée
--  R7  Y, Villa essai, 20/11 23 h 30 UTC (21/11 à Paris)              → hors période
insert into public.buyer_interests (id, organization_id, buyer_profile_id, property_id, funnel_version,
                                    idempotency_key, raw_answers, normalized_answers, created_at,
                                    utm_source, utm_content, utm_campaign, origin_url, first_touch)
select v.id, o.id, v.personne, v.bien, 'v1', v.cle, '{}'::jsonb, '{}'::jsonb, v.le::timestamptz,
       v.source, v.contenu, v.campagne, v.url, v.premiere
  from (values
    ('60000000-0000-0000-0000-000000000001'::uuid, '50000000-0000-0000-0000-0000000000a1'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'crm-r1',  '2026-11-05T10:00:00Z', 'fb', '111', null, null, null::jsonb),
    ('60000000-0000-0000-0000-000000000011'::uuid, '50000000-0000-0000-0000-0000000000a1'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'crm-r1b', '2026-10-20T10:00:00Z', 'fb', '111', null, null, null::jsonb),
    ('60000000-0000-0000-0000-000000000002'::uuid, '50000000-0000-0000-0000-0000000000a1'::uuid, '20000000-0000-0000-0000-000000000002'::uuid, 'crm-r2',  '2026-11-06T10:00:00Z', 'ig', null, null,
       'https://go.test/bien/deux/interet?utm_id=900&utm_source=ig', '{"url": "https://go.test/bien/deux?utm_id=900&utm_content=222"}'::jsonb),
    ('60000000-0000-0000-0000-000000000003'::uuid, '50000000-0000-0000-0000-0000000000a2'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'crm-r3',  '2026-10-31T23:30:00Z', 'instagram', 'Nom unique', null, null, null::jsonb),
    ('60000000-0000-0000-0000-000000000004'::uuid, '50000000-0000-0000-0000-0000000000a3'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'crm-r4',  '2026-11-07T10:00:00Z', 'fb', '111', null, null, null::jsonb),
    ('60000000-0000-0000-0000-000000000005'::uuid, '50000000-0000-0000-0000-0000000000a4'::uuid, '30000000-0000-0000-0000-000000000003'::uuid, 'crm-r5',  '2026-11-08T10:00:00Z', '', 'Doublon', '903', null, null::jsonb),
    ('60000000-0000-0000-0000-000000000006'::uuid, null::uuid,                                     '20000000-0000-0000-0000-000000000002'::uuid, 'crm-r6',  '2026-11-09T10:00:00Z', null, null, null, null, null::jsonb),
    ('60000000-0000-0000-0000-000000000007'::uuid, '50000000-0000-0000-0000-0000000000a2'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'crm-r7',  '2026-11-20T23:30:00Z', 'fb', null, null, null, null::jsonb)
  ) as v(id, personne, bien, cle, le, source, contenu, campagne, url, premiere),
  public.organizations o where o.slug = 'prodigio';

-- Les visites : R1 à venir, R3 faite, R2 annulée.
insert into public.tasks (title, kind, status, due_at, buyer_profile_id, interest_id) values
  ('Visite', 'visite', 'a_faire', now() + interval '3 days', '50000000-0000-0000-0000-0000000000a1', '60000000-0000-0000-0000-000000000001'),
  ('Visite', 'visite', 'fait',    now() - interval '3 days', '50000000-0000-0000-0000-0000000000a2', '60000000-0000-0000-0000-000000000003'),
  ('Visite', 'visite', 'annule',  now() - interval '1 day',  '50000000-0000-0000-0000-0000000000a1', '60000000-0000-0000-0000-000000000002');

-- Les responsables : X est suivie par le commercial ; Y ne l'est plus.
insert into public.buyer_assignments (buyer_profile_id, user_id, responsibility, released_at) values
  ('50000000-0000-0000-0000-0000000000a1', 'c0000000-0000-0000-0000-00000000000c', 'commercial', null),
  ('50000000-0000-0000-0000-0000000000a2', 'c0000000-0000-0000-0000-00000000000c', 'commercial', now());

-- =============================================================================
\echo '--- 1. Droits : l''administrateur seul, jamais anon'
-- =============================================================================
do $$
declare f text;
begin
  foreach f in array array['public.crm_pilotage_crm_demandes_resolues(date,date)',
                           'public.crm_pilotage_crm_par_jour(date,date)',
                           'public.crm_pilotage_crm_cohorte(date,date)',
                           'public.crm_pilotage_crm_par_pub(date,date)',
                           'public.crm_pilotage_crm_debuts()'] loop
    if has_function_privilege('anon', f, 'execute') then raise exception 'ÉCHEC : anon exécute %', f; end if;
    if not has_function_privilege('authenticated', f, 'execute') then raise exception 'ÉCHEC : authenticated n''exécute pas %', f; end if;
  end loop;
  raise notice 'ok : fonctions réservées à l''administrateur, jamais anon';
end $$;

set local role authenticated;
set local request.jwt.claim.sub = 'b0000000-0000-0000-0000-00000000000b';
do $$
begin
  -- Le refus attendu est CELUI DU PILOTAGE (et non une autre erreur de droits).
  begin
    perform * from public.crm_pilotage_crm_cohorte('2026-11-01', '2026-11-20');
    raise exception 'ÉCHEC : un manager lit les chiffres du CRM du pilotage';
  exception when sqlstate '42501' then
    if sqlerrm <> 'pilotage réservé aux administrateurs' then raise exception 'ÉCHEC : refus inattendu : %', sqlerrm; end if;
  end;
  begin
    perform * from public.crm_pilotage_crm_par_pub('2026-11-01', '2026-11-20');
    raise exception 'ÉCHEC : un manager lit les chiffres par pub';
  exception when sqlstate '42501' then
    if sqlerrm <> 'pilotage réservé aux administrateurs' then raise exception 'ÉCHEC : refus inattendu : %', sqlerrm; end if;
  end;
  begin
    perform * from public.crm_pilotage_crm_debuts();
    raise exception 'ÉCHEC : un manager lit les premiers jours du CRM';
  exception when sqlstate '42501' then
    if sqlerrm <> 'pilotage réservé aux administrateurs' then raise exception 'ÉCHEC : refus inattendu : %', sqlerrm; end if;
  end;
  raise notice 'ok : manager refusé';
end $$;

set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000000a';

-- =============================================================================
\echo '--- 2. Les demandes par jour : jour de Paris, archivées et hors période exclues'
-- =============================================================================
do $$
declare r text;
begin
  select string_agg(left(property_id::text, 1) || ':' || jour || '=' || demandes, ' ' order by jour, property_id)
    into r
    from public.crm_pilotage_crm_par_jour('2026-11-01', '2026-11-20');
  if r is distinct from '1:2026-11-01=1 1:2026-11-05=1 2:2026-11-06=1 3:2026-11-08=1 2:2026-11-09=1' then
    raise exception 'ÉCHEC : demandes par jour = %', r;
  end if;
  raise notice 'ok : demandes par jour (31/10 23 h 30 UTC compte le 01/11 ; 20/11 23 h 30 UTC est hors période)';
end $$;

-- =============================================================================
\echo '--- 3. La cohorte : demandes, personnes, étapes, qualification, visites, offres'
-- =============================================================================
do $$
declare
  v1 jsonb; v2 jsonb; v3 jsonb; t jsonb;
begin
  select mesures into v1 from public.crm_pilotage_crm_cohorte('2026-11-01', '2026-11-20') where property_id = '10000000-0000-0000-0000-000000000001';
  select mesures into v2 from public.crm_pilotage_crm_cohorte('2026-11-01', '2026-11-20') where property_id = '20000000-0000-0000-0000-000000000002';
  select mesures into v3 from public.crm_pilotage_crm_cohorte('2026-11-01', '2026-11-20') where property_id = '30000000-0000-0000-0000-000000000003';
  select mesures into t  from public.crm_pilotage_crm_cohorte('2026-11-01', '2026-11-20') where property_id is null;

  -- Villa essai : R1 (X) et R3 (Y) ; R4 archivée ; R1b et R7 hors période.
  if (v1->>'demandes')::int <> 2 or (v1->>'personnes')::int <> 2 or (v1->>'demandes_archivees')::int <> 1 then
    raise exception 'ÉCHEC : Villa essai, demandes/personnes/archivées = % / % / %', v1->>'demandes', v1->>'personnes', v1->>'demandes_archivees';
  end if;
  if v1->'etapes' <> '{"en_discussion": 1, "vivier": 1}'::jsonb then
    raise exception 'ÉCHEC : Villa essai, étapes actuelles = %', v1->'etapes';
  end if;
  -- Étapes atteintes : tout le monde « à contacter » ; Y : à rappeler, visite
  -- planifiée (ancienne clé « visite »), vivier ; X : dossier envoyé.
  if v1->'atteintes' <> '{"a_contacter": 2, "a_rappeler": 1, "visite_planifiee": 1, "vivier": 1, "en_discussion": 1}'::jsonb then
    raise exception 'ÉCHEC : Villa essai, étapes atteintes = %', v1->'atteintes';
  end if;
  if v1->'qualification' <> '{"qualifie": 1, "non_qualifie": 1}'::jsonb then
    raise exception 'ÉCHEC : Villa essai, qualification = %', v1->'qualification';
  end if;
  if v1->'visites' <> '{"planifiees": 1, "a_venir": 1, "faites": 1, "annulees": 0}'::jsonb then
    raise exception 'ÉCHEC : Villa essai, visites = %', v1->'visites';
  end if;
  if v1->'offres' <> '{"personnes": 0, "montants": 0, "somme_cents": 0}'::jsonb then
    raise exception 'ÉCHEC : Villa essai, offres = %', v1->'offres';
  end if;
  if v1->'provenance' <> '{"fb": 1, "instagram": 1}'::jsonb then
    raise exception 'ÉCHEC : Villa essai, provenance = %', v1->'provenance';
  end if;
  if v1->'responsables' <> '{"c0000000-0000-0000-0000-00000000000c": 1, "": 1}'::jsonb then
    raise exception 'ÉCHEC : Villa essai, responsables = %', v1->'responsables';
  end if;
  if v1->'pub' <> '{"pub": 2, "campagne": 0, "aucun": 0}'::jsonb then
    raise exception 'ÉCHEC : Villa essai, rattachement aux pubs = %', v1->'pub';
  end if;

  -- Villa deux : R2 (X) et R6 (sans personne).
  if (v2->>'demandes')::int <> 2 or (v2->>'personnes')::int <> 1 or (v2->>'demandes_sans_personne')::int <> 1 then
    raise exception 'ÉCHEC : Villa deux, demandes/personnes/sans personne = % / % / %', v2->>'demandes', v2->>'personnes', v2->>'demandes_sans_personne';
  end if;
  if v2->'visites' <> '{"planifiees": 0, "a_venir": 0, "faites": 0, "annulees": 1}'::jsonb then
    raise exception 'ÉCHEC : Villa deux, visites = %', v2->'visites';
  end if;
  if v2->'pub' <> '{"pub": 1, "campagne": 0, "aucun": 1}'::jsonb then
    raise exception 'ÉCHEC : Villa deux, rattachement aux pubs = %', v2->'pub';
  end if;
  if v2->'provenance' <> '{"ig": 1, "": 1}'::jsonb then
    raise exception 'ÉCHEC : Villa deux, provenance = %', v2->'provenance';
  end if;

  -- Programme essai : R5 (W), passée par « offre en cours », un montant saisi.
  if v3->'offres' <> '{"personnes": 1, "montants": 1, "somme_cents": 12345600}'::jsonb then
    raise exception 'ÉCHEC : Programme essai, offres = %', v3->'offres';
  end if;
  if v3->'pub' <> '{"pub": 0, "campagne": 1, "aucun": 0}'::jsonb then
    raise exception 'ÉCHEC : Programme essai, rattachement aux pubs = %', v3->'pub';
  end if;

  -- Le total : des personnes DISTINCTES (X compte une fois, présente sur deux biens).
  if (t->>'demandes')::int <> 5 or (t->>'personnes')::int <> 3 or (t->>'demandes_archivees')::int <> 1 then
    raise exception 'ÉCHEC : total, demandes/personnes/archivées = % / % / %', t->>'demandes', t->>'personnes', t->>'demandes_archivees';
  end if;
  if t->'etapes' <> '{"en_discussion": 1, "vivier": 1, "pas_interesse": 1}'::jsonb then
    raise exception 'ÉCHEC : total, étapes actuelles = %', t->'etapes';
  end if;
  if t->'visites' <> '{"planifiees": 1, "a_venir": 1, "faites": 1, "annulees": 1}'::jsonb then
    raise exception 'ÉCHEC : total, visites = %', t->'visites';
  end if;
  raise notice 'ok : cohorte par bien et au total (personnes distinctes), étapes actuelles et atteintes, visites, offres, provenance, responsables';
end $$;

-- =============================================================================
\echo '--- 4. Par pub : identifiant connu, nom unique, campagne, non rattachée'
-- =============================================================================
do $$
declare r text;
begin
  select string_agg(left(property_id::text, 1) || ':' || niveau || ':' || coalesce(ad_id, campaign_id, '-')
                    || '=' || demandes || '/' || personnes || '/' || qualifies || '/' || visites || '/' || visites_faites || '/' || offres,
                    ' ' order by property_id, niveau, coalesce(ad_id, campaign_id, '-'))
    into r
    from public.crm_pilotage_crm_par_pub('2026-11-01', '2026-11-20');
  -- demandes / personnes / qualifiés / visites (non annulées) / visites faites / offres
  if r is distinct from '1:pub:111=1/1/1/1/0/0 1:pub:333=1/1/0/1/1/0 2:aucun:-=1/0/0/0/0/0 2:pub:222=1/1/1/0/0/0 3:campagne:903=1/1/1/0/0/1' then
    raise exception 'ÉCHEC : par pub = %', r;
  end if;
  raise notice 'ok : un utm_id de campagne n''est pas une pub ; utm_content de la première visite retrouvé ; nom ambigu ramené à sa campagne';
end $$;

-- =============================================================================
\echo '--- 5. Depuis quand le CRM reçoit des demandes : par bien et au total, archivées exclues'
-- =============================================================================
-- Une demande ANCIENNE de la personne archivée (Z), sur le Programme essai, le
-- 01/10 : elle ne doit pas faire commencer le CRM plus tôt.
reset role;
insert into public.buyer_interests (id, organization_id, buyer_profile_id, property_id, funnel_version,
                                    idempotency_key, raw_answers, normalized_answers, created_at)
select '60000000-0000-0000-0000-000000000008', o.id, '50000000-0000-0000-0000-0000000000a3',
       '30000000-0000-0000-0000-000000000003', 'v1', 'crm-r8', '{}'::jsonb, '{}'::jsonb, '2026-10-01T10:00:00Z'
  from public.organizations o where o.slug = 'prodigio';
set local role authenticated;

do $$
declare r text;
begin
  select string_agg(coalesce(left(property_id::text, 1), 'total') || ':' || premier_jour, ' ' order by property_id nulls last)
    into r
    from public.crm_pilotage_crm_debuts();
  -- Villa essai : R1b le 20/10 ; Villa deux : R2 le 06/11 (R6, sans personne, compte) ;
  -- Programme essai : R5 le 08/11 (pas le 01/10 de la personne archivée).
  if r is distinct from '1:2026-10-20 2:2026-11-06 3:2026-11-08 total:2026-10-20' then
    raise exception 'ÉCHEC : premiers jours du CRM = %', r;
  end if;
  raise notice 'ok : premier jour du CRM par bien et au total, toutes périodes confondues, personne archivée exclue';
end $$;

-- =============================================================================
\echo '--- 6. La requête de contrôle (scripts/pilotage-crm-controles.sql) donne les chiffres de la page'
-- =============================================================================
-- Toute la période, sur le décor ci-dessus : chaque ligne du contrôle, calculée
-- sur les tables, doit être celle que la page tire des fonctions. (Lancer la
-- recette depuis la racine du dépôt : le contrôle est relu tel quel.)
reset role;
\set requete_controle `cat scripts/pilotage-crm-controles.sql`
create temp table controle as :requete_controle

set local role authenticated;
create temp table page as
with c as (select * from public.crm_pilotage_crm_cohorte(null, (now() at time zone 'Europe/Paris')::date)),
pj as (select * from public.crm_pilotage_crm_par_jour(null, (now() at time zone 'Europe/Paris')::date)),
pp as (select * from public.crm_pilotage_crm_par_pub(null, (now() at time zone 'Europe/Paris')::date)),
db as (select * from public.crm_pilotage_crm_debuts()),
r (bloc, portee, mesure, valeur) as (
  select '01 demandes', c.property_id, 'demandes', (c.mesures->>'demandes')::numeric from c
  union all select '01 demandes', c.property_id, 'demandes sans personne', (c.mesures->>'demandes_sans_personne')::numeric from c
  union all select '01 demandes', c.property_id, 'demandes archivées écartées', (c.mesures->>'demandes_archivees')::numeric from c
  union all select '02 personnes', c.property_id, 'personnes', (c.mesures->>'personnes')::numeric from c
  union all select '03 par jour', pj.property_id, pj.jour::text, pj.demandes from pj
  union all select '04 qualification', c.property_id, e.key, e.value::text::numeric from c, jsonb_each(c.mesures->'qualification') e
  union all select '05 étape aujourd''hui', c.property_id, e.key, e.value::text::numeric from c, jsonb_each(c.mesures->'etapes') e
  union all select '06 étape atteinte', c.property_id, e.key, e.value::text::numeric from c, jsonb_each(c.mesures->'atteintes') e
  union all select '07 visites', c.property_id, 'à faire', (c.mesures->'visites'->>'planifiees')::numeric from c
  union all select '07 visites', c.property_id, 'à venir', (c.mesures->'visites'->>'a_venir')::numeric from c
  union all select '07 visites', c.property_id, 'faites', (c.mesures->'visites'->>'faites')::numeric from c
  union all select '07 visites', c.property_id, 'annulées', (c.mesures->'visites'->>'annulees')::numeric from c
  union all select '08 offres', c.property_id, 'personnes passées par offre en cours', (c.mesures->'offres'->>'personnes')::numeric from c
  union all select '08 offres', c.property_id, 'montants saisis', (c.mesures->'offres'->>'montants')::numeric from c
  union all select '08 offres', c.property_id, 'somme des montants (centimes)', (c.mesures->'offres'->>'somme_cents')::numeric from c
  union all select '09 provenance', c.property_id, case when e.key = '' then '(vide)' else e.key end, e.value::text::numeric
              from c, jsonb_each(c.mesures->'provenance') e
  union all select '10 responsable', c.property_id, case when e.key = '' then '(aucun)' else e.key end, e.value::text::numeric
              from c, jsonb_each(c.mesures->'responsables') e
  union all select '11 rattachement', c.property_id, 'pub', (c.mesures->'pub'->>'pub')::numeric from c
  union all select '11 rattachement', c.property_id, 'campagne seulement', (c.mesures->'pub'->>'campagne')::numeric from c
  union all select '11 rattachement', c.property_id, 'non rattachée', (c.mesures->'pub'->>'aucun')::numeric from c
  union all select '12 pub par pub', pp.property_id, l.ligne || ' · ' || m.nom, m.valeur
              from pp
              cross join lateral (select case pp.niveau when 'pub' then 'pub ' || pp.ad_id
                                                       when 'campagne' then 'campagne ' || pp.campaign_id
                                                       else 'non rattachée' end as ligne) l
              cross join lateral (values ('demandes', pp.demandes), ('personnes', pp.personnes), ('qualifiées', pp.qualifies),
                                         ('visites', pp.visites), ('dont faites', pp.visites_faites), ('offres', pp.offres)) m(nom, valeur)
  union all select '13 premier jour du CRM', db.property_id, db.premier_jour::text, 1 from db
)
select r.bloc,
       case when r.portee is null then 'TOTAL'
            else coalesce(nullif(btrim(pr.project_name), ''), nullif(btrim(pr.commercial_title), ''), r.portee::text) end as bien,
       r.mesure, r.valeur
  from r left join public.properties pr on pr.id = r.portee
 where r.valeur <> 0 and r.mesure is not null;

reset role;
do $$
declare n bigint; m bigint; e text;
begin
  select count(*) into n from controle;
  select count(*) into m from ((select * from controle except all select * from page)
                               union all (select * from page except all select * from controle)) x;
  if n = 0 or m <> 0 then
    select string_agg(format('%s | %s | %s | %s = %s', x.ou, x.bloc, x.bien, x.mesure, x.valeur), E'\n') into e from (
      (select 'contrôle seul' as ou, * from (select * from controle except all select * from page) a)
      union all
      (select 'page seule', * from (select * from page except all select * from controle) b)) x;
    raise exception 'ÉCHEC : le contrôle et la page diffèrent (% lignes)%', m, coalesce(E'\n' || e, '');
  end if;
  raise notice 'ok : les % lignes du contrôle sont celles de la page', n;
end $$;

reset role;

\echo ''
\echo 'RECETTE RÉUSSIE — tout est annulé, la base reste vierge.'
rollback;
