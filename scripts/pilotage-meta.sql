\set ON_ERROR_STOP on
\timing off

-- =============================================================================
-- RECETTE SQL DE LA LECTURE META (pilotage pub, étape 2), jouée sur le VRAI SQL.
--
-- Qui peut écrire les chiffres Meta (le rôle de service seul), ce que la base
-- garantit (une lecture à la fois, remplacement par période sans doublon,
-- contrôle calculé en base, journal figé), les règles de rattachement
-- (administrateur seul, retrait sans effacement) et l'identifiant de pub des
-- demandes (extraction, insertion jamais bloquée, remplissage sans écraser).
--
-- Se joue sur une base LOCALE montée par `scripts/replay-migrations.sh` :
--   psql -d prodigio -f scripts/pilotage-meta.sql
--
-- Mêmes sécurités que `pilotage-donnees.sql` : refus sur une base non vierge,
-- une seule transaction annulée à la fin. Données fictives uniquement.
-- =============================================================================

begin;

do $$
begin
  if exists (select 1 from public.properties)
     or exists (select 1 from public.pilotage_meta_synchros) then
    raise exception 'Base non vierge : ce script ne se joue que sur une base LOCALE (scripts/replay-migrations.sh).';
  end if;
end $$;

-- Chez Supabase, le rôle de service a les droits de table par défaut ; le
-- harnais local ne les donne qu'aux fonctions. On les accorde le temps de la
-- recette (annulés avec tout le reste au ROLLBACK final).
grant select, insert, update, delete on all tables in schema public to service_role;

-- --- Le décor (fictif) ----------------------------------------------------------
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'admin@meta.test'),
  ('b0000000-0000-0000-0000-00000000000b', 'manager@meta.test');

insert into public.organizations (id, slug, name, kind) values
  ('e0000000-0000-0000-0000-00000000000e', 'agence-essai', 'Agence essai', 'agence_partenaire');

insert into public.organization_memberships (user_id, organization_id, role, status)
select u.id, o.id, u.role, 'actif'
  from (values ('a0000000-0000-0000-0000-00000000000a'::uuid, 'administrateur'),
               ('b0000000-0000-0000-0000-00000000000b'::uuid, 'manager')) as u(id, role),
       public.organizations o where o.slug = 'prodigio';

insert into public.properties (id, organization_id, project_name, commercialization_origin, holder_organization_id)
select v.id, o.id, v.nom, 'partenaire_commercialisation', 'e0000000-0000-0000-0000-00000000000e'
  from (values ('10000000-0000-0000-0000-000000000001'::uuid, 'Villa essai'),
               ('20000000-0000-0000-0000-000000000002'::uuid, 'Programme essai')) as v(id, nom),
       public.organizations o where o.slug = 'prodigio';

-- =============================================================================
\echo '--- 1. Les chiffres Meta ne s''écrivent que par le rôle de service'
-- =============================================================================
do $$
declare f text;
begin
  foreach f in array array[
    'public.crm_pilotage_meta_synchro_demarrer(text,uuid)',
    'public.crm_pilotage_meta_remplacer_tranche(uuid,date,date,jsonb,jsonb)',
    'public.crm_pilotage_meta_enregistrer_pubs(uuid,jsonb)',
    'public.crm_pilotage_meta_remplacer_couverture(uuid,jsonb)',
    'public.crm_pilotage_meta_synchro_terminer(uuid,text,text,integer,text,jsonb)'
  ] loop
    if has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute') then
      raise exception 'ÉCHEC : % est exécutable par un client', f;
    end if;
    if not has_function_privilege('service_role', f, 'execute') then
      raise exception 'ÉCHEC : le rôle de service ne peut pas exécuter %', f;
    end if;
  end loop;
  foreach f in array array['public.crm_pilotage_meta_ajouter_regle(text,text,text,uuid[],text)',
                           'public.crm_pilotage_meta_retirer_regle(uuid,text)',
                           'public.crm_pilotage_meta_totaux(date,date)'] loop
    if has_function_privilege('anon', f, 'execute') then raise exception 'ÉCHEC : anon exécute %', f; end if;
    if not has_function_privilege('authenticated', f, 'execute') then raise exception 'ÉCHEC : authenticated n''exécute pas %', f; end if;
  end loop;
  foreach f in array array['public.pilotage_extraire_meta_ad_id(text,text,text)',
                           'public.pilotage_buyer_interest_meta_ad_id()',
                           'public.pilotage_meta_synchro_garde()',
                           'public.pilotage_meta_regle_garde()'] loop
    if has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute') then
      raise exception 'ÉCHEC : l''aide interne % est exécutable par un client', f;
    end if;
  end loop;
  foreach f in array array['public.pilotage_meta_synchros', 'public.pilotage_meta_controles',
                           'public.pilotage_meta_insights', 'public.pilotage_meta_pubs',
                           'public.pilotage_meta_couverture', 'public.pilotage_meta_regles'] loop
    if has_table_privilege('anon', f, 'select') then raise exception 'ÉCHEC : anon lit %', f; end if;
    if has_table_privilege('authenticated', f, 'insert') or has_table_privilege('authenticated', f, 'update')
       or has_table_privilege('authenticated', f, 'delete') then
      raise exception 'ÉCHEC : authenticated écrit directement dans %', f;
    end if;
    if not (select relrowsecurity from pg_class where oid = f::regclass) then
      raise exception 'ÉCHEC : RLS inactive sur %', f;
    end if;
  end loop;
  raise notice 'ok : écriture par le rôle de service seul, lecture filtrée, aides internes fermées';
end $$;

-- =============================================================================
\echo '--- 2. Une lecture à la fois ; une lecture plantée ne bloque pas à vie'
-- =============================================================================
set local role service_role;

create temporary table recette (cle text primary key, valeur text) on commit drop;

do $$
declare r jsonb; r2 jsonb;
begin
  r := public.crm_pilotage_meta_synchro_demarrer('matin', null);
  if not (r->>'ok')::boolean or r->>'couvert_jusqu_au' is not null then
    raise exception 'ÉCHEC : premier démarrage : %', r;
  end if;
  insert into recette values ('synchro', r->>'synchro_id');

  r2 := public.crm_pilotage_meta_synchro_demarrer('manuel', 'a0000000-0000-0000-0000-00000000000a');
  if (r2->>'ok')::boolean or not (r2->>'occupe')::boolean then
    raise exception 'ÉCHEC : deux lectures en même temps : %', r2;
  end if;
  raise notice 'ok : une seule lecture à la fois';
end $$;

-- =============================================================================
\echo '--- 3. Remplacement par période : ni doublon, ni reste ; contrôle calculé en base'
-- =============================================================================
do $$
declare
  v_id uuid := (select valeur::uuid from recette where cle = 'synchro');
  r jsonb;
  n integer;
  c record;
begin
  r := public.crm_pilotage_meta_remplacer_tranche(v_id, '2026-11-01', '2026-11-02',
    '[{"jour":"2026-11-01","ad_id":"111","ad_name":"VERDUN | TERRASSE | VIDEO | V1","campaign_id":"90001","campaign_name":"PRODIGIO | VERDUN | LEADS","depense_cents":1234,"impressions":1000,"clics":20,"clics_lien":12,"leads":2},
      {"jour":"2026-11-01","ad_id":"222","ad_name":"ANCIENNE","campaign_id":"90002","campaign_name":"ESSAI","depense_cents":500,"impressions":300,"leads":0},
      {"jour":"2026-11-02","ad_id":"111","ad_name":"VERDUN | TERRASSE | VIDEO | V1","campaign_id":"90001","campaign_name":"PRODIGIO | VERDUN | LEADS","depense_cents":1000,"impressions":800,"leads":1}]'::jsonb,
    '[{"jour":"2026-11-01","depense_compte_cents":1734},{"jour":"2026-11-02","depense_compte_cents":1000}]'::jsonb);
  if (r->>'lignes')::int <> 3 then raise exception 'ÉCHEC : 3 lignes attendues : %', r; end if;

  -- Meta corrige le 1er novembre : la pub 222 a disparu, la 111 a changé.
  r := public.crm_pilotage_meta_remplacer_tranche(v_id, '2026-11-01', '2026-11-01',
    '[{"jour":"2026-11-01","ad_id":"111","ad_name":"VERDUN | TERRASSE | VIDEO | V1","campaign_id":"90001","campaign_name":"PRODIGIO | VERDUN | LEADS","depense_cents":1300,"impressions":1100,"leads":3},
      {"jour":"2026-11-01","ad_id":"111","ad_name":"doublon","campaign_id":"90001","depense_cents":9999}]'::jsonb,
    '[{"jour":"2026-11-01","depense_compte_cents":1305}]'::jsonb);

  select count(*) into n from public.pilotage_meta_insights where jour = '2026-11-01';
  if n <> 1 then raise exception 'ÉCHEC : 1 ligne attendue le 1er novembre, % trouvées', n; end if;
  select count(*) into n from public.pilotage_meta_insights where jour = '2026-11-02';
  if n <> 1 then raise exception 'ÉCHEC : le 2 novembre ne devait pas être touché (% lignes)', n; end if;

  select * into c from public.pilotage_meta_controles where jour = '2026-11-01';
  if c.depense_pubs_cents <> 1300 or c.depense_compte_cents <> 1305 or c.pubs <> 1 then
    raise exception 'ÉCHEC : contrôle du 1er novembre : %', row_to_json(c);
  end if;

  if (select couvert_jusqu_au from public.pilotage_meta_synchros where id = v_id) <> '2026-11-02' then
    raise exception 'ÉCHEC : la lecture n''a pas retenu jusqu''où elle est allée';
  end if;

  begin
    perform public.crm_pilotage_meta_remplacer_tranche(v_id, '2026-11-01', '2026-11-01',
      '[{"jour":"2026-11-05","ad_id":"111","depense_cents":1}]'::jsonb, '[]'::jsonb);
    raise exception 'ÉCHEC : une ligne hors période a été acceptée';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.crm_pilotage_meta_remplacer_tranche(v_id, '2026-01-01', '2026-03-01', '[]'::jsonb, '[]'::jsonb);
    raise exception 'ÉCHEC : une période de deux mois a été acceptée';
  exception when sqlstate '22023' then null;
  end;
  raise notice 'ok : remplacement sans doublon ni reste, contrôle calculé en base, refus hors période';
end $$;

-- =============================================================================
\echo '--- 4. Pubs, couverture, fin de lecture : le journal se fige'
-- =============================================================================
do $$
declare
  v_id uuid := (select valeur::uuid from recette where cle = 'synchro');
  n integer;
begin
  n := public.crm_pilotage_meta_enregistrer_pubs(v_id,
    '[{"ad_id":"111","ad_name":"VERDUN | TERRASSE | VIDEO | V1","campaign_id":"90001","statut":"ACTIVE","lien_apercu":"https://fb.me/exemple"},
      {"ad_id":"333","ad_name":"lien douteux","statut":"PAUSED","lien_apercu":"javascript:alert(1)"},
      {"ad_id":"pas-un-id","ad_name":"ignorée"}]'::jsonb);
  if n <> 2 then raise exception 'ÉCHEC : 2 pubs attendues, % enregistrées', n; end if;
  if (select lien_apercu from public.pilotage_meta_pubs where ad_id = '333') is not null then
    raise exception 'ÉCHEC : un lien d''aperçu non https a été gardé';
  end if;

  n := public.crm_pilotage_meta_remplacer_couverture(v_id,
    '[{"periode":"7_derniers_jours","property_id":null,"couverture":900,"impressions":1900,"pubs":2},
      {"periode":"7_derniers_jours","property_id":"10000000-0000-0000-0000-000000000001","couverture":700,"impressions":1100,"pubs":1},
      {"periode":"toute_la_periode","property_id":"10000000-0000-0000-0000-000000000001","couverture":null,"pubs":140,"raison":"trop de pubs"}]'::jsonb);
  if n <> 3 then raise exception 'ÉCHEC : 3 lignes de couverture attendues'; end if;

  perform public.crm_pilotage_meta_synchro_terminer(v_id, 'reussie', null, 12, 'EUR', '{"tranches":1}'::jsonb);
  begin
    perform public.crm_pilotage_meta_synchro_terminer(v_id, 'echec', 'x', 0, 'EUR', null);
    raise exception 'ÉCHEC : une lecture terminée a été terminée deux fois';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.crm_pilotage_meta_remplacer_tranche(v_id, '2026-11-01', '2026-11-01', '[]'::jsonb, '[]'::jsonb);
    raise exception 'ÉCHEC : une lecture terminée a encore écrit';
  exception when sqlstate '22023' then null;
  end;
  raise notice 'ok : pubs (liens https seuls), couverture, fin de lecture';
end $$;

reset role;
do $$ begin
  update public.pilotage_meta_synchros set erreur = 'réécrit';
  raise exception 'ÉCHEC : un journal terminé a été réécrit';
exception when sqlstate '0A000' then null;
end $$;
do $$ begin
  delete from public.pilotage_meta_synchros;
  raise exception 'ÉCHEC : le journal a été effacé';
exception when sqlstate '0A000' then null;
end $$;

-- Une lecture restée « en cours » trop longtemps est close au démarrage suivant.
set local role service_role;
do $$
declare r jsonb;
begin
  r := public.crm_pilotage_meta_synchro_demarrer('matin', null);
  insert into recette values ('plantee', r->>'synchro_id');
end $$;
reset role;
-- On vieillit la lecture en cours à la main (elle est encore « en_cours », donc modifiable).
update public.pilotage_meta_synchros set demarree_le = now() - interval '1 hour'
 where id = (select valeur::uuid from recette where cle = 'plantee');
set local role service_role;
do $$
declare r jsonb;
begin
  r := public.crm_pilotage_meta_synchro_demarrer('matin', null);
  if not (r->>'ok')::boolean then raise exception 'ÉCHEC : une lecture plantée bloque encore : %', r; end if;
  if r->>'couvert_jusqu_au' <> '2026-11-02' then
    raise exception 'ÉCHEC : la reprise ne repart pas du dernier jour couvert : %', r;
  end if;
  if (select statut from public.pilotage_meta_synchros where id = (select valeur::uuid from recette where cle = 'plantee')) <> 'echec' then
    raise exception 'ÉCHEC : la lecture plantée n''a pas été close';
  end if;
  perform public.crm_pilotage_meta_synchro_terminer((r->>'synchro_id')::uuid, 'reussie', null, 0, 'EUR', null);
  raise notice 'ok : lecture plantée close, reprise depuis le dernier jour couvert';
end $$;
reset role;

-- =============================================================================
\echo '--- 5. Les règles de rattachement : administrateur seul, retirées sans effacement'
-- =============================================================================
set local role authenticated;
set local request.jwt.claim.sub = 'b0000000-0000-0000-0000-00000000000b';
do $$ begin
  perform public.crm_pilotage_meta_ajouter_regle('jeton', 'VERDUN', 'biens',
    array['10000000-0000-0000-0000-000000000001']::uuid[], null);
  raise exception 'ÉCHEC : un manager a créé une règle';
exception when sqlstate '42501' then raise notice 'ok : manager refusé';
end $$;
do $$
declare n integer;
begin
  select (select count(*) from public.pilotage_meta_insights) + (select count(*) from public.pilotage_meta_synchros) into n;
  if n <> 0 then raise exception 'ÉCHEC : le manager lit % lignes Meta', n; end if;
  if exists (select 1 from public.crm_pilotage_meta_totaux(null, null)) then
    raise exception 'ÉCHEC : le manager lit des totaux Meta';
  end if;
  raise notice 'ok : manager, zéro ligne et zéro total';
end $$;

set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000000a';
do $$
declare r jsonb; v_regle uuid;
begin
  r := public.crm_pilotage_meta_ajouter_regle('jeton', '  Verdùn ', 'biens',
    array['10000000-0000-0000-0000-000000000001']::uuid[], 'Convention');
  if r->>'valeur' <> 'VERDUN' then raise exception 'ÉCHEC : jeton mal normalisé : %', r; end if;
  v_regle := (r->>'id')::uuid;

  begin
    perform public.crm_pilotage_meta_ajouter_regle('jeton', 'verdun', 'hors_portefeuille', null, null);
    raise exception 'ÉCHEC : deux règles en vigueur pour le même jeton';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.crm_pilotage_meta_ajouter_regle('campagne', 'PRODIGIO 123', 'hors_portefeuille', null, null);
    raise exception 'ÉCHEC : un identifiant de campagne non numérique a été accepté';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.crm_pilotage_meta_ajouter_regle('jeton', 'CASSIS', 'biens', '{}'::uuid[], null);
    raise exception 'ÉCHEC : une règle « biens » sans bien a été acceptée';
  exception when sqlstate '22023' then null;
  end;

  -- Un groupe : deux biens, répartis au prorata du prix (calculé à la lecture).
  perform public.crm_pilotage_meta_ajouter_regle('jeton', 'CASSIS', 'biens',
    array['10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002']::uuid[], null);
  -- Un ancien bien : hors portefeuille, par exception de campagne.
  perform public.crm_pilotage_meta_ajouter_regle('campagne', '90002', 'hors_portefeuille', null, 'Ancien bien');

  r := public.crm_pilotage_meta_retirer_regle(v_regle, 'Remplacée');
  r := public.crm_pilotage_meta_retirer_regle(v_regle, 'Remplacée');
  if not (r->>'deja_retiree')::boolean then raise exception 'ÉCHEC : second retrait : %', r; end if;
  -- Retirée, la valeur se réutilise.
  perform public.crm_pilotage_meta_ajouter_regle('jeton', 'VERDUN', 'biens',
    array['10000000-0000-0000-0000-000000000001']::uuid[], 'Nouvelle version');

  if (select count(*) from public.pilotage_meta_regles) <> 4 then
    raise exception 'ÉCHEC : 4 règles attendues (dont une retirée)';
  end if;
  if not exists (select 1 from public.crm_pilotage_meta_totaux(null, null) where ad_id = '111' and depense_cents = 2300) then
    raise exception 'ÉCHEC : totaux par pub';
  end if;
  raise notice 'ok : règles normalisées, uniques, retirées sans effacement ; totaux lisibles par l''administrateur';
end $$;

reset role;
do $$ begin
  delete from public.pilotage_meta_regles;
  raise exception 'ÉCHEC : une règle a été effacée';
exception when sqlstate '0A000' then null;
end $$;
do $$ begin
  update public.pilotage_meta_regles set valeur = 'AUTRE' where retiree_le is null;
  raise exception 'ÉCHEC : une règle a été réécrite';
exception when sqlstate '0A000' then null;
end $$;

do $$
declare n integer;
begin
  select count(*) into n from public.audit_events e,
         lateral jsonb_object_keys(coalesce(e.new_value, '{}'::jsonb)) as k(cle)
   where e.entity_type = 'pilotage_meta_regle' and k.cle <> 'type_regle';
  if n <> 0 then raise exception 'ÉCHEC : le journal d''audit porte autre chose que le type de règle'; end if;
  if (select count(*) from public.audit_events where entity_type = 'pilotage_meta_regle') <> 5 then
    raise exception 'ÉCHEC : 5 événements de règle attendus (4 ajouts, 1 retrait)';
  end if;
  raise notice 'ok : règles auditées, sans contenu';
end $$;

-- =============================================================================
\echo '--- 6. L''identifiant de pub des demandes : extraction, insertion, remplissage'
-- =============================================================================
do $$
begin
  if public.pilotage_extraire_meta_ad_id('https://x.test/f?lang=fr&utm_id=120252600381260565&utm_source=meta', null, null)
     is distinct from '120252600381260565' then
    raise exception 'ÉCHEC : utm_id de l''adresse du formulaire';
  end if;
  if public.pilotage_extraire_meta_ad_id('https://x.test/f?utm_source=meta', 'https://landing.test/?utm_id=98765', null)
     is distinct from '98765' then
    raise exception 'ÉCHEC : utm_id de la première visite';
  end if;
  if public.pilotage_extraire_meta_ad_id(null, null, '120252600381260565') is distinct from '120252600381260565' then
    raise exception 'ÉCHEC : utm_content numérique';
  end if;
  if public.pilotage_extraire_meta_ad_id('https://x.test/?utm_id=cassis-v1', null, 'Video - Terrasse - v3') is not null then
    raise exception 'ÉCHEC : un utm_id ou un utm_content non numérique a été pris pour une pub';
  end if;
  if public.pilotage_extraire_meta_ad_id('https://x.test/?xutm_id=123456', null, null) is not null then
    raise exception 'ÉCHEC : un paramètre voisin a été pris pour utm_id';
  end if;
  raise notice 'ok : extraction (formulaire, puis première visite, puis utm_content numérique)';
end $$;

insert into public.contacts (id, first_name, last_name, phone, email)
values ('44444444-4444-4444-4444-444444444444', 'Essai', 'Fictif', '+33600000000', 'essai@meta.test');
insert into public.buyer_profiles (id, organization_id, contact_id, pipeline_stage, qualification, qualification_status)
select '66666666-6666-6666-6666-666666666666', o.id, '44444444-4444-4444-4444-444444444444',
       'a_contacter', 'a_qualifier', 'non_qualifie'
  from public.organizations o where o.slug = 'prodigio';

-- Insertion normale : le déclencheur pose l'identifiant.
insert into public.buyer_interests (id, organization_id, buyer_profile_id, contact_id, property_id,
                                   funnel_version, idempotency_key, raw_answers, normalized_answers, origin_url)
select '77777777-7777-7777-7777-000000000001', o.id, '66666666-6666-6666-6666-666666666666',
       '44444444-4444-4444-4444-444444444444', '10000000-0000-0000-0000-000000000001',
       'v1', 'meta-1', '{}'::jsonb, '{}'::jsonb, 'https://go.test/bien/x/interet?utm_id=55555&utm_source=meta'
  from public.organizations o where o.slug = 'prodigio';

-- Une première visite mal formée (un tableau JSON) ne bloque PAS le dépôt.
insert into public.buyer_interests (id, organization_id, buyer_profile_id, contact_id, property_id,
                                   funnel_version, idempotency_key, raw_answers, normalized_answers, first_touch)
select '77777777-7777-7777-7777-000000000002', o.id, '66666666-6666-6666-6666-666666666666',
       '44444444-4444-4444-4444-444444444444', '10000000-0000-0000-0000-000000000001',
       'v1', 'meta-2', '{}'::jsonb, '{}'::jsonb, '["pas", "un", "objet"]'::jsonb
  from public.organizations o where o.slug = 'prodigio';

-- Un identifiant déjà posé n'est jamais remplacé.
insert into public.buyer_interests (id, organization_id, buyer_profile_id, contact_id, property_id,
                                   funnel_version, idempotency_key, raw_answers, normalized_answers, origin_url, meta_ad_id)
select '77777777-7777-7777-7777-000000000003', o.id, '66666666-6666-6666-6666-666666666666',
       '44444444-4444-4444-4444-444444444444', '10000000-0000-0000-0000-000000000001',
       'v1', 'meta-3', '{}'::jsonb, '{}'::jsonb, 'https://go.test/?utm_id=11111', '22222'
  from public.organizations o where o.slug = 'prodigio';

do $$
begin
  if (select meta_ad_id from public.buyer_interests where id = '77777777-7777-7777-7777-000000000001') is distinct from '55555' then
    raise exception 'ÉCHEC : l''insertion n''a pas posé l''identifiant de pub';
  end if;
  if (select meta_ad_id from public.buyer_interests where id = '77777777-7777-7777-7777-000000000002') is not null then
    raise exception 'ÉCHEC : identifiant inventé pour une demande sans pub';
  end if;
  if (select meta_ad_id from public.buyer_interests where id = '77777777-7777-7777-7777-000000000003') is distinct from '22222' then
    raise exception 'ÉCHEC : un identifiant déjà posé a été remplacé';
  end if;
  raise notice 'ok : insertion posée, jamais bloquée, jamais écrasante';
end $$;

-- Le remplissage des anciennes lignes, rejoué tel que la migration l'écrit :
-- une « ancienne » demande, sans identifiant, datée d'il y a un mois.
alter table public.buyer_interests disable trigger buyer_interests_meta_ad_id;
insert into public.buyer_interests (id, organization_id, buyer_profile_id, contact_id, property_id,
                                   funnel_version, idempotency_key, raw_answers, normalized_answers,
                                   utm_content, created_at, updated_at)
select '77777777-7777-7777-7777-000000000004', o.id, '66666666-6666-6666-6666-666666666666',
       '44444444-4444-4444-4444-444444444444', '10000000-0000-0000-0000-000000000001',
       'v1', 'meta-4', '{}'::jsonb, '{}'::jsonb, '120252600381260565',
       now() - interval '30 days', now() - interval '30 days'
  from public.organizations o where o.slug = 'prodigio';
alter table public.buyer_interests enable trigger buyer_interests_meta_ad_id;

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

do $$
declare r record;
begin
  select meta_ad_id, updated_at < now() - interval '29 days' as date_intacte into r
    from public.buyer_interests where id = '77777777-7777-7777-7777-000000000004';
  if r.meta_ad_id is distinct from '120252600381260565' then
    raise exception 'ÉCHEC : l''ancienne ligne n''a pas été remplie';
  end if;
  if not r.date_intacte then
    raise exception 'ÉCHEC : le remplissage a modifié la date de mise à jour de la demande';
  end if;
  if (select meta_ad_id from public.buyer_interests where id = '77777777-7777-7777-7777-000000000003') is distinct from '22222' then
    raise exception 'ÉCHEC : le remplissage a écrasé un identifiant existant';
  end if;
  raise notice 'ok : anciennes lignes remplies sans écraser, date de mise à jour intacte';
end $$;

\echo ''
\echo 'RECETTE RÉUSSIE — tout est annulé, la base reste vierge.'
rollback;
