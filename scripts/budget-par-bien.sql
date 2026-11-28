-- =============================================================================
-- RECETTE SQL DU BUDGET DU FORMULAIRE PAR BIEN (migration 20261128150000),
-- jouée sur le VRAI SQL.
--
-- Ce qui est vérifié, sur un décor fictif dont on connaît chaque réponse :
--  1. qui peut quoi : l'administrateur seul règle et lit ; le visiteur (anon)
--     ne lit que les tranches en vigueur, par `buyer_form_budget` ;
--  2. la saisie : une version par enregistrement, la règle des tranches et de
--     la cible, le motif, le journal sans montant ;
--  3. rien ne se réécrit, rien ne s'efface ; la contrainte tient même hors de
--     la fonction ;
--  4. le formulaire public : la version en vigueur aujourd'hui, pas une
--     version à venir ; rien pour un bien fermé ou un slug inconnu ;
--  5. Pilotage pub : les demandes, personnes et qualifiées par réponse
--     retenue (correction de l'équipe, sinon déclaration), par bien, par pub
--     et au total ;
--  6. la requête de contrôle (`scripts/budget-par-bien-controles.sql`) rend
--     exactement les chiffres de la page.
--
-- Se joue sur une base LOCALE montée par `scripts/replay-migrations.sh`, depuis
-- la racine du dépôt :
--   psql -d prodigio -v ON_ERROR_STOP=1 -f scripts/budget-par-bien.sql
-- Jouable aussi avec la règle `safeupdate` de la production :
--   PGOPTIONS='-c session_preload_libraries=safeupdate' psql -d prodigio -v ON_ERROR_STOP=1 -f scripts/budget-par-bien.sql
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
               ('30000000-0000-0000-0000-000000000003'::uuid, 'Programme essai'),
               ('40000000-0000-0000-0000-000000000004'::uuid, 'Sans réglage')) as v(id, nom),
       public.organizations o where o.slug = 'prodigio';

-- Le formulaire : actif pour la villa ; fermé mais vitrine publiée pour la
-- villa deux ; fermé et non publié pour le programme ; actif sans réglage pour
-- le dernier.
insert into public.property_public_config (property_id, slug, buyer_form_status, publication_status) values
  ('10000000-0000-0000-0000-000000000001', 'villa-essai', 'actif', 'brouillon'),
  ('20000000-0000-0000-0000-000000000002', 'villa-deux', 'inactif', 'publie'),
  ('30000000-0000-0000-0000-000000000003', 'programme-essai', 'inactif', 'brouillon'),
  ('40000000-0000-0000-0000-000000000004', 'sans-reglage', 'actif', 'brouillon');

-- Les pubs connues de la lecture Meta : 111, 222 ; la campagne 903 (par 444).
insert into public.pilotage_meta_pubs (ad_id, ad_name, campaign_id) values
  ('111', 'ESSAI | A | V1', '900'),
  ('222', 'ESSAI | B | V1', '901'),
  ('444', 'ESSAI | C | V1', '903');

-- Les personnes : X qualifiée ; Y non qualifiée, budget CORRIGÉ en « plus d'1 M€ » ;
-- Z archivée ; W gros potentiel ; V à qualifier.
insert into public.contacts (id, first_name, last_name) values
  ('70000000-0000-0000-0000-0000000000a1', 'Fictif', 'X'),
  ('70000000-0000-0000-0000-0000000000a2', 'Fictif', 'Y'),
  ('70000000-0000-0000-0000-0000000000a3', 'Fictif', 'Z'),
  ('70000000-0000-0000-0000-0000000000a4', 'Fictif', 'W'),
  ('70000000-0000-0000-0000-0000000000a5', 'Fictif', 'V');

insert into public.buyer_profiles (id, organization_id, contact_id, pipeline_stage, qualification,
                                   qualification_reason, archive_le, budget_choice_corrige)
select v.id, o.id, v.contact, 'a_contacter', v.qualif,
       case when v.qualif = 'non_qualifie' then 'Motif fictif' end, v.archive, v.corrige
  from (values
    ('50000000-0000-0000-0000-0000000000a1'::uuid, '70000000-0000-0000-0000-0000000000a1'::uuid, 'qualifie',       null::timestamptz, null::text),
    ('50000000-0000-0000-0000-0000000000a2'::uuid, '70000000-0000-0000-0000-0000000000a2'::uuid, 'non_qualifie',   null, 'plus_1m'),
    ('50000000-0000-0000-0000-0000000000a3'::uuid, '70000000-0000-0000-0000-0000000000a3'::uuid, 'qualifie',       now(), null),
    ('50000000-0000-0000-0000-0000000000a4'::uuid, '70000000-0000-0000-0000-0000000000a4'::uuid, 'gros_potentiel', null, null),
    ('50000000-0000-0000-0000-0000000000a5'::uuid, '70000000-0000-0000-0000-0000000000a5'::uuid, 'a_qualifier',    null, null)
  ) as v(id, contact, qualif, archive, corrige),
  public.organizations o where o.slug = 'prodigio';

-- Les demandes (période des chiffres attendus : du 01/11 au 20/11) :
--  R1  X, villa, 05/11, pub 111, « 500 000 € – 1 M€ »
--  R2  X, villa, 10/11, pub 111, « plus d'1 M€ »        → X compte sous « plus d'1 M€ »
--  R3  Y, villa, 06/11, pub 222, « 500 000 € – 1 M€ »   → retenue : la correction
--  R4  Z (archivée), villa, 07/11, pub 111              → écartée
--  R5  W, villa, 08/11, sans trace, sans réponse
--  R6  W, villa deux, 09/11, pub 111, « pas de projet »
--  R7  V, villa, 11/11, campagne 903, « pas de projet »
--  R8  sans personne, villa, 12/11, pub 222, « 1 – 2 M€ »
--  R9  X, villa, 25/11, « 2 – 3 M€ »                     → hors période
--  R10 V, villa, 12/11, pub 111, sans réponse            → V compte sous « pas de projet » pour la villa
insert into public.buyer_interests (id, organization_id, buyer_profile_id, property_id, funnel_version,
                                    idempotency_key, raw_answers, normalized_answers, created_at,
                                    utm_content, utm_campaign, budget_choice)
select v.id, o.id, v.personne, v.bien, 'v1', v.cle, '{}'::jsonb, '{}'::jsonb, v.le::timestamptz,
       v.contenu, v.campagne, v.budget
  from (values
    ('60000000-0000-0000-0000-000000000001'::uuid, '50000000-0000-0000-0000-0000000000a1'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'b-r1',  '2026-11-05T10:00:00Z', '111', null, '500k_1m'),
    ('60000000-0000-0000-0000-000000000002'::uuid, '50000000-0000-0000-0000-0000000000a1'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'b-r2',  '2026-11-10T10:00:00Z', '111', null, 'plus_1m'),
    ('60000000-0000-0000-0000-000000000003'::uuid, '50000000-0000-0000-0000-0000000000a2'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'b-r3',  '2026-11-06T10:00:00Z', '222', null, '500k_1m'),
    ('60000000-0000-0000-0000-000000000004'::uuid, '50000000-0000-0000-0000-0000000000a3'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'b-r4',  '2026-11-07T10:00:00Z', '111', null, 'plus_3m'),
    ('60000000-0000-0000-0000-000000000005'::uuid, '50000000-0000-0000-0000-0000000000a4'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'b-r5',  '2026-11-08T10:00:00Z', null,  null, null),
    ('60000000-0000-0000-0000-000000000006'::uuid, '50000000-0000-0000-0000-0000000000a4'::uuid, '20000000-0000-0000-0000-000000000002'::uuid, 'b-r6',  '2026-11-09T10:00:00Z', '111', null, 'aucun_projet'),
    ('60000000-0000-0000-0000-000000000007'::uuid, '50000000-0000-0000-0000-0000000000a5'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'b-r7',  '2026-11-11T10:00:00Z', null,  '903', 'aucun_projet'),
    ('60000000-0000-0000-0000-000000000008'::uuid, null::uuid,                                     '10000000-0000-0000-0000-000000000001'::uuid, 'b-r8',  '2026-11-12T10:00:00Z', '222', null, '1m_2m'),
    ('60000000-0000-0000-0000-000000000009'::uuid, '50000000-0000-0000-0000-0000000000a1'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'b-r9',  '2026-11-25T10:00:00Z', null,  null, '2m_3m'),
    ('60000000-0000-0000-0000-000000000010'::uuid, '50000000-0000-0000-0000-0000000000a5'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'b-r10', '2026-11-12T11:00:00Z', '111', null, null)
  ) as v(id, personne, bien, cle, le, contenu, campagne, budget),
  public.organizations o where o.slug = 'prodigio';

-- =============================================================================
\echo '--- 1. Droits : l''administrateur règle et lit ; anon ne lit que les tranches'
-- =============================================================================
do $$
begin
  if has_function_privilege('anon', 'public.crm_pilotage_enregistrer_budget(uuid,date,text[],bigint,text)', 'execute') then
    raise exception 'ÉCHEC : anon peut enregistrer un budget';
  end if;
  if has_function_privilege('anon', 'public.crm_pilotage_crm_budget(date,date)', 'execute') then
    raise exception 'ÉCHEC : anon peut lire les chiffres du budget';
  end if;
  if not has_function_privilege('anon', 'public.buyer_form_budget(text)', 'execute') then
    raise exception 'ÉCHEC : le formulaire public ne peut pas lire ses tranches';
  end if;
  if has_table_privilege('anon', 'public.pilotage_budget_formulaire', 'select') then
    raise exception 'ÉCHEC : anon peut lire la table des réglages';
  end if;
  if has_table_privilege('authenticated', 'public.pilotage_budget_formulaire', 'insert')
     or has_table_privilege('authenticated', 'public.pilotage_budget_formulaire', 'update')
     or has_table_privilege('authenticated', 'public.pilotage_budget_formulaire', 'delete') then
    raise exception 'ÉCHEC : un client connecté peut écrire dans la table des réglages';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.pilotage_budget_formulaire'::regclass) then
    raise exception 'ÉCHEC : RLS inactive sur la table des réglages';
  end if;
  raise notice 'ok : droits';
end $$;

set local role authenticated;

-- =============================================================================
\echo '--- 2. La saisie : administrateur seul, règle tenue, journal sans montant'
-- =============================================================================
set local request.jwt.claim.sub = 'c0000000-0000-0000-0000-00000000000c';
do $$
begin
  begin
    perform public.crm_pilotage_enregistrer_budget('10000000-0000-0000-0000-000000000001', date '2026-11-01',
                                                   array['500k_1m', 'plus_1m'], 100000000, 'Essai');
    raise exception 'ÉCHEC : un commercial enregistre un budget';
  exception when sqlstate '42501' then null;
  end;
  begin
    perform * from public.crm_pilotage_crm_budget(date '2026-11-01', date '2026-11-20');
    raise exception 'ÉCHEC : un commercial lit les chiffres du budget';
  exception when sqlstate '42501' then null;
  end;
  if exists (select 1 from public.pilotage_budget_formulaire) then
    raise exception 'ÉCHEC : un commercial voit des réglages';
  end if;
  raise notice 'ok : commercial refusé';
end $$;

set local request.jwt.claim.sub = 'b0000000-0000-0000-0000-00000000000b';
do $$
begin
  begin
    perform public.crm_pilotage_enregistrer_budget('10000000-0000-0000-0000-000000000001', date '2026-11-01',
                                                   array['500k_1m', 'plus_1m'], 100000000, 'Essai');
    raise exception 'ÉCHEC : un manager enregistre un budget';
  exception when sqlstate '42501' then null;
  end;
  raise notice 'ok : manager refusé';
end $$;

set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000000a';
do $$
declare r jsonb; j jsonb; e text;
begin
  -- Les refus de la règle, chacun avec sa phrase.
  foreach e in array array[
    'tranches:{500k_1m}|cible:50000000',
    'tranches:{plus_1m,500k_1m}|cible:50000000',
    'tranches:{500k_1m,2m_3m,plus_3m}|cible:50000000',
    'tranches:{500k_1m,plus_1m}|cible:200000000',
    'tranches:{aucun_projet,plus_1m}|cible:100000000'
  ] loop
    begin
      perform public.crm_pilotage_enregistrer_budget(
        '10000000-0000-0000-0000-000000000001', date '2026-11-01',
        split_part(split_part(e, '|', 1), ':', 2)::text[], split_part(split_part(e, '|', 2), ':', 2)::bigint, 'Essai');
      raise exception 'ÉCHEC : réglage accepté : %', e;
    exception when sqlstate '22023' then null;
    end;
  end loop;
  begin
    perform public.crm_pilotage_enregistrer_budget('10000000-0000-0000-0000-000000000001', date '2026-11-01',
                                                   array['500k_1m', 'plus_1m'], 100000000, '   ');
    raise exception 'ÉCHEC : réglage sans motif accepté';
  exception when sqlstate '22023' then null;
  end;

  -- La villa : une version passée, une d'aujourd'hui, une à venir.
  perform public.crm_pilotage_enregistrer_budget('10000000-0000-0000-0000-000000000001', date '2026-11-01',
                                                 array['500k_1m', 'plus_1m'], 50000000, 'Lancement fictif');
  perform public.crm_pilotage_enregistrer_budget('10000000-0000-0000-0000-000000000001',
                                                 (now() at time zone 'Europe/Paris')::date,
                                                 array['500k_1m', 'plus_1m'], 100000000, 'Seuil fictif');
  perform public.crm_pilotage_enregistrer_budget('10000000-0000-0000-0000-000000000001',
                                                 (now() at time zone 'Europe/Paris')::date + 30,
                                                 array['1m_2m', '2m_3m', 'plus_3m'], 200000000, 'À venir, fictif');
  perform public.crm_pilotage_enregistrer_budget('20000000-0000-0000-0000-000000000002', date '2026-11-01',
                                                 array['1m_2m', '2m_3m', 'plus_3m'], 200000000, 'Fictif');
  r := public.crm_pilotage_enregistrer_budget('30000000-0000-0000-0000-000000000003', date '2026-11-01',
                                              array['plus_3m'], 300000000, 'Fictif');
  if (r ->> 'ok')::boolean is not true or r ->> 'id' is null then raise exception 'ÉCHEC : réponse = %', r; end if;

  if (select count(*) from public.pilotage_budget_formulaire) <> 5 then
    raise exception 'ÉCHEC : % versions au lieu de 5', (select count(*) from public.pilotage_budget_formulaire);
  end if;

  -- Le journal : identifiants et date d'effet seulement.
  select ae.new_value into j from public.audit_events ae
   where ae.entity_type = 'pilotage_budget' and ae.entity_id = (r ->> 'id')::uuid and ae.event_type = 'pilotage_budget_saisi';
  if j is null then raise exception 'ÉCHEC : saisie absente du journal'; end if;
  if (select array_agg(k order by k) from jsonb_object_keys(j) k) <> array['date_effet', 'property_id'] then
    raise exception 'ÉCHEC : le journal porte autre chose que des identifiants : %', j;
  end if;
  raise notice 'ok : saisies, refus et journal';
end $$;

-- =============================================================================
\echo '--- 3. Rien ne se réécrit, rien ne s''efface ; la règle tient hors de la fonction'
-- =============================================================================
reset role;
do $$
begin
  begin
    update public.pilotage_budget_formulaire set motif = 'réécrit' where true;
    raise exception 'ÉCHEC : une version se réécrit';
  exception when sqlstate '0A000' then null;
  end;
  begin
    delete from public.pilotage_budget_formulaire where true;
    raise exception 'ÉCHEC : une version s''efface';
  exception when sqlstate '0A000' then null;
  end;
  begin
    insert into public.pilotage_budget_formulaire (property_id, date_effet, tranches, cible_min_cents, motif)
    values ('10000000-0000-0000-0000-000000000001', date '2026-11-02', array['500k_1m'], 50000000, 'Direct');
    raise exception 'ÉCHEC : une liste sans tranche ouverte entre par la porte de service';
  exception when check_violation then null;
  end;
  raise notice 'ok : immuable, et contrainte tenue';
end $$;

-- =============================================================================
\echo '--- 4. Le formulaire public : la version en vigueur, rien d''autre'
-- =============================================================================
set local role anon;
do $$
declare t text[];
begin
  t := public.buyer_form_budget('villa-essai');
  if t is distinct from array['500k_1m', 'plus_1m'] then
    raise exception 'ÉCHEC : villa-essai rend % (attendu la version d''aujourd''hui, pas celle à venir)', t;
  end if;
  t := public.buyer_form_budget('  Villa-Deux ');
  if t is distinct from array['1m_2m', '2m_3m', 'plus_3m'] then
    raise exception 'ÉCHEC : villa-deux (vitrine publiée) rend %', t;
  end if;
  if public.buyer_form_budget('programme-essai') is not null then
    raise exception 'ÉCHEC : un formulaire fermé, vitrine non publiée, rend ses tranches';
  end if;
  if public.buyer_form_budget('sans-reglage') is not null then
    raise exception 'ÉCHEC : un bien sans réglage rend des tranches';
  end if;
  if public.buyer_form_budget('inconnu') is not null then
    raise exception 'ÉCHEC : un slug inconnu rend des tranches';
  end if;
  begin
    perform 1 from public.pilotage_budget_formulaire;
    raise exception 'ÉCHEC : anon lit la table des réglages';
  exception when insufficient_privilege then null;
  end;
  raise notice 'ok : le formulaire public lit ses seules tranches en vigueur';
end $$;

-- =============================================================================
\echo '--- 5. Pilotage pub : par réponse retenue, par bien, par pub, au total'
-- =============================================================================
reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000000a';
do $$
declare v text; attendu text;
begin
  select string_agg(x.ligne, ' ' order by x.ligne)
    into v
    from (select format('%s:%s:%s:%s=%s/%s/%s', b.regroupement,
                        coalesce(pr.project_name, '-'),
                        case b.niveau when 'pub' then 'pub ' || b.ad_id when 'campagne' then 'campagne ' || b.campaign_id
                                      when 'aucun' then 'aucune' else '-' end,
                        coalesce(b.reponse, 'sans'), b.demandes, b.personnes, b.qualifies) as ligne
            from public.crm_pilotage_crm_budget(date '2026-11-01', date '2026-11-20') b
            left join public.properties pr on pr.id = b.property_id) x;

  attendu := array_to_string(array(select x from unnest(array[
    -- La villa : X sous « plus d'1 M€ » (sa demande la plus récente), Y sous
    -- sa correction, W sans réponse, V sous « pas de projet » (sa demande la
    -- plus récente QUI A UNE RÉPONSE) ; R8 sans personne.
    'bien:Villa essai:-:500k_1m=1/0/0',
    'bien:Villa essai:-:plus_1m=2/2/1',
    'bien:Villa essai:-:1m_2m=1/0/0',
    'bien:Villa essai:-:aucun_projet=1/1/0',
    'bien:Villa essai:-:sans=2/1/1',
    'bien:Villa deux:-:aucun_projet=1/1/1',
    -- Pub par pub : dans la pub 111, V n'a qu'une demande, sans réponse.
    'pub:Villa essai:pub 111:500k_1m=1/0/0',
    'pub:Villa essai:pub 111:plus_1m=1/1/1',
    'pub:Villa essai:pub 111:sans=1/1/0',
    'pub:Villa essai:pub 222:plus_1m=1/1/0',
    'pub:Villa essai:pub 222:1m_2m=1/0/0',
    'pub:Villa essai:campagne 903:aucun_projet=1/1/0',
    'pub:Villa essai:aucune:sans=1/1/1',
    'pub:Villa deux:pub 111:aucun_projet=1/1/1',
    -- Au total, W compte sous « pas de projet » (villa deux, sa plus récente).
    'total:-:-:500k_1m=1/0/0',
    'total:-:-:plus_1m=2/2/1',
    'total:-:-:1m_2m=1/0/0',
    'total:-:-:aucun_projet=2/2/1',
    'total:-:-:sans=2/0/0'
  ]) as x order by 1), ' ');

  if v is distinct from attendu then
    raise exception E'ÉCHEC : budget par réponse\n  obtenu  : %\n  attendu : %', v, attendu;
  end if;
  raise notice 'ok : chiffres du budget conformes au décor';
end $$;

-- =============================================================================
\echo '--- 6. La requête de contrôle (scripts/budget-par-bien-controles.sql) donne les chiffres de la page'
-- =============================================================================
-- Toute la période : chaque ligne du contrôle, calculée sur les tables, doit
-- être celle que la page tire de la fonction. (Lancer la recette depuis la
-- racine du dépôt : le contrôle est relu tel quel.)
reset role;
\set requete_controle `cat scripts/budget-par-bien-controles.sql`
create temp table controle as :requete_controle

set local role authenticated;
create temp table page as
with b as (select * from public.crm_pilotage_crm_budget(null, (now() at time zone 'Europe/Paris')::date)),
r (bloc, portee, mesure, valeur) as (
  select case when b.regroupement = 'pub' then '16 budget par pub' else '15 budget par réponse' end,
         b.property_id,
         case when b.regroupement = 'pub'
              then (case b.niveau when 'pub' then 'pub ' || b.ad_id when 'campagne' then 'campagne ' || b.campaign_id
                                  else 'non rattachée' end) || ' · '
              else '' end || coalesce(b.reponse, '(sans réponse)') || ' · ' || m.nom,
         m.valeur
    from b
   cross join lateral (values ('demandes', b.demandes), ('personnes', b.personnes), ('qualifiées', b.qualifies)) as m(nom, valeur)
)
select r.bloc,
       case when r.portee is null then 'TOTAL'
            else coalesce(nullif(btrim(pr.project_name), ''), nullif(btrim(pr.commercial_title), ''), r.portee::text) end as bien,
       r.mesure, r.valeur::numeric
  from r left join public.properties pr on pr.id = r.portee
 where r.valeur <> 0;

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
