\set ON_ERROR_STOP on
\timing off

-- =============================================================================
-- RECETTE SQL DES DONNÉES DU PILOTAGE PUB (étape 1), jouée sur le VRAI SQL.
--
-- Conditions versionnées, lots d'un programme, coûts fixes : qui peut écrire,
-- qui peut lire, et ce que la base refuse quoi qu'il arrive (réécrire,
-- effacer, compter deux fois la même saisie, mettre un montant au journal).
--
-- Se joue sur une base LOCALE montée par `scripts/replay-migrations.sh` :
--   psql -d prodigio -f scripts/pilotage-donnees.sql
--
-- DEUX SÉCURITÉS, parce que les aperçus Vercel écrivent dans la base de
-- production et qu'un script lancé au mauvais endroit ne doit rien y laisser :
--   1. il refuse de tourner sur une base qui contient déjà un bien ;
--   2. tout se joue dans UNE transaction, annulée à la fin (ROLLBACK).
-- Données fictives uniquement. Toute assertion fausse arrête le script.
-- =============================================================================

begin;

do $$
begin
  if exists (select 1 from public.properties)
     or exists (select 1 from public.pilotage_conditions) then
    raise exception 'Base non vierge : ce script ne se joue que sur une base LOCALE (scripts/replay-migrations.sh).';
  end if;
end $$;

-- --- Le décor (fictif) ----------------------------------------------------------
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'admin@pilotage.test'),
  ('b0000000-0000-0000-0000-00000000000b', 'manager@pilotage.test'),
  ('c0000000-0000-0000-0000-00000000000c', 'commercial@pilotage.test'),
  ('d0000000-0000-0000-0000-00000000000d', 'setter@pilotage.test');

insert into public.organizations (id, slug, name, kind) values
  ('e0000000-0000-0000-0000-00000000000e', 'agence-essai', 'Agence essai', 'agence_partenaire');

insert into public.organization_memberships (user_id, organization_id, role, status)
select u.id, o.id, u.role, 'actif'
  from (values
          ('a0000000-0000-0000-0000-00000000000a'::uuid, 'administrateur'),
          ('b0000000-0000-0000-0000-00000000000b'::uuid, 'manager'),
          ('c0000000-0000-0000-0000-00000000000c'::uuid, 'commercial'),
          ('d0000000-0000-0000-0000-00000000000d'::uuid, 'setter')) as u(id, role),
       public.organizations o
 where o.slug = 'prodigio';

insert into public.properties (id, organization_id, project_name, commercialization_origin,
                               holder_organization_id)
select v.id, o.id, v.nom, 'partenaire_commercialisation', 'e0000000-0000-0000-0000-00000000000e'
  from (values
          ('10000000-0000-0000-0000-000000000001'::uuid, 'Villa essai'),
          ('20000000-0000-0000-0000-000000000002'::uuid, 'Programme essai')) as v(id, nom),
       public.organizations o
 where o.slug = 'prodigio';

-- Le commercial a le bien dans son périmètre : il voit ses acquéreurs, mais
-- ne doit RIEN voir du pilotage.
insert into public.property_assignments (property_id, user_id)
values ('10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-00000000000c');

-- =============================================================================
\echo '--- 1. Les droits d''exécution et de table'
-- =============================================================================
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.crm_pilotage_enregistrer_conditions(uuid,date,boolean,text,bigint,numeric,text,numeric,numeric,text,bigint,date,text)',
    'public.crm_pilotage_enregistrer_lot(uuid,uuid,text,text,bigint,text,bigint,date,boolean,text)',
    'public.crm_pilotage_saisir_cout_fixe(uuid,text,bigint,text,uuid)',
    'public.crm_pilotage_annuler_cout_fixe(uuid,text)'
  ] loop
    if has_function_privilege('anon', f, 'execute') then
      raise exception 'ÉCHEC : anon peut exécuter %', f;
    end if;
    if not has_function_privilege('authenticated', f, 'execute') then
      raise exception 'ÉCHEC : authenticated ne peut pas exécuter %', f;
    end if;
  end loop;

  foreach f in array array['public.pilotage_ligne_immuable()', 'public.pilotage_cout_fixe_garde()'] loop
    if has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute') then
      raise exception 'ÉCHEC : le déclencheur interne % est exécutable par un client', f;
    end if;
  end loop;

  foreach f in array array['public.pilotage_conditions', 'public.pilotage_lots',
                           'public.pilotage_lot_versions', 'public.pilotage_couts_fixes'] loop
    if has_table_privilege('anon', f, 'select') then
      raise exception 'ÉCHEC : anon lit %', f;
    end if;
    if has_table_privilege('authenticated', f, 'insert')
       or has_table_privilege('authenticated', f, 'update')
       or has_table_privilege('authenticated', f, 'delete') then
      raise exception 'ÉCHEC : authenticated peut écrire directement dans %', f;
    end if;
    if not (select relrowsecurity from pg_class where oid = f::regclass) then
      raise exception 'ÉCHEC : RLS inactive sur %', f;
    end if;
  end loop;
  raise notice 'ok : anon sans droit, aucune écriture directe, RLS active';
end $$;

-- =============================================================================
\echo '--- 2. Un manager, un setter, un commercial : refusés à l''écriture'
-- =============================================================================
set local role authenticated;

set local request.jwt.claim.sub = 'b0000000-0000-0000-0000-00000000000b';
do $$ begin
  perform public.crm_pilotage_saisir_cout_fixe('10000000-0000-0000-0000-000000000001', 'photos', 50000, null, null);
  raise exception 'ÉCHEC : un manager a saisi un coût fixe';
exception when sqlstate '42501' then raise notice 'ok : manager refusé';
end $$;

set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-00000000000d';
do $$ begin
  perform public.crm_pilotage_enregistrer_conditions(
    '10000000-0000-0000-0000-000000000001', current_date, false, 'fai', 145000000,
    3.75, 'TTC', 70, 20, 'a_vendre', null, null, 'essai');
  raise exception 'ÉCHEC : un setter a saisi des conditions';
exception when sqlstate '42501' then raise notice 'ok : setter refusé';
end $$;

set local request.jwt.claim.sub = 'c0000000-0000-0000-0000-00000000000c';
do $$ begin
  perform public.crm_pilotage_enregistrer_lot(
    null, '20000000-0000-0000-0000-000000000002', '5', null, 48000000, 'a_vendre', null, null, false, 'essai');
  raise exception 'ÉCHEC : un commercial a créé un lot';
exception when sqlstate '42501' then raise notice 'ok : commercial refusé';
end $$;

-- Sans session du tout.
set local request.jwt.claim.sub = '';
do $$ begin
  perform public.crm_pilotage_annuler_cout_fixe(gen_random_uuid(), null);
  raise exception 'ÉCHEC : un appel sans session a été accepté';
exception when sqlstate '28000' then raise notice 'ok : sans session refusé';
end $$;

-- =============================================================================
\echo '--- 3. L''administrateur saisit les conditions (bloc, puis par lots)'
-- =============================================================================
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000000a';

do $$
declare r jsonb;
begin
  r := public.crm_pilotage_enregistrer_conditions(
    '10000000-0000-0000-0000-000000000001', date '2026-11-12', false, 'fai', 140000000,
    3.75, 'TTC', 70, 20, 'a_vendre', null, null, 'Saisie initiale');
  if not coalesce((r->>'ok')::boolean, false) then raise exception 'ÉCHEC : %', r; end if;

  -- Correction le même jour : une NOUVELLE ligne, l'ancienne reste.
  r := public.crm_pilotage_enregistrer_conditions(
    '10000000-0000-0000-0000-000000000001', date '2026-11-12', false, 'fai', 145000000,
    3.75, 'TTC', 70, 20, 'a_vendre', null, null, 'Prix corrigé');
  -- Une version à venir : enregistrée, pas encore en vigueur.
  r := public.crm_pilotage_enregistrer_conditions(
    '10000000-0000-0000-0000-000000000001', date '2027-01-01', false, 'fai', 135000000,
    3.75, 'TTC', 70, 20, 'a_vendre', null, null, 'Baisse de prix prévue');

  r := public.crm_pilotage_enregistrer_conditions(
    '20000000-0000-0000-0000-000000000002', date '2026-11-12', true, 'ht_grille_promoteur', null,
    3.75, 'TTC', 50, 20, null, null, null, 'Saisie initiale');
  raise notice 'ok : quatre versions enregistrées';
end $$;

do $$
declare n integer;
begin
  select count(*) into n from public.pilotage_conditions
   where property_id = '10000000-0000-0000-0000-000000000001';
  if n <> 3 then raise exception 'ÉCHEC : 3 versions attendues, % trouvées', n; end if;
  raise notice 'ok : l''administrateur lit les trois versions de la villa';
end $$;

-- Ce que la base refuse, avec un message, sans rien écrire.
do $$
declare
  cas record;
begin
  for cas in
    select * from (values
      ('motif vide',              false, 'fai', 145000000::bigint, 3.75::numeric, 'TTC', 'a_vendre', null::bigint, '   '),
      ('statut manquant (bloc)',  false, 'fai', 145000000,         3.75,          'TTC', null,       null,         'x'),
      ('prix au niveau du bien (lots)', true, 'fai', 145000000,    3.75,          'TTC', null,       null,         'x'),
      ('prix final sans vente',   false, 'fai', 145000000,         3.75,          'TTC', 'a_vendre', 140000000,    'x'),
      ('taux à 5 décimales',      false, 'fai', 145000000,         3.75001,       'TTC', 'a_vendre', null,         'x'),
      ('taux nul',                false, 'fai', 145000000,         0,             'TTC', 'a_vendre', null,         'x'),
      ('base inconnue',           false, 'fai', 145000000,         3.75,          'HTT', 'a_vendre', null,         'x'),
      ('nature inconnue',         false, 'net', 145000000,         3.75,          'TTC', 'a_vendre', null,         'x'),
      ('prix négatif',            false, 'fai', -1,                3.75,          'TTC', 'a_vendre', null,         'x')
    ) as t(libelle, lots, nature, prix, taux, base, statut, final, motif)
  loop
    begin
      perform public.crm_pilotage_enregistrer_conditions(
        '10000000-0000-0000-0000-000000000001', date '2026-11-12', cas.lots, cas.nature, cas.prix,
        cas.taux, cas.base, 70, 20, cas.statut, cas.final, null, cas.motif);
      raise exception 'ÉCHEC : « % » aurait dû être refusé', cas.libelle;
    exception when sqlstate '22023' then
      null;
    end;
  end loop;
  raise notice 'ok : neuf saisies invalides refusées';
end $$;

-- =============================================================================
\echo '--- 4. Les lots du programme'
-- =============================================================================
do $$
declare
  r jsonb;
  v_lot uuid;
  n integer;
begin
  r := public.crm_pilotage_enregistrer_lot(
    null, '20000000-0000-0000-0000-000000000002', '5', 'T2', 48000000, 'a_vendre', null, null, false, 'Grille du promoteur');
  v_lot := (r->>'lot_id')::uuid;
  perform public.crm_pilotage_enregistrer_lot(
    null, '20000000-0000-0000-0000-000000000002', '13', 'Duplex', 121000000, 'a_vendre', null, null, false, 'Grille du promoteur');

  -- Le même numéro deux fois : refusé.
  begin
    perform public.crm_pilotage_enregistrer_lot(
      null, '20000000-0000-0000-0000-000000000002', '5', null, 48000000, 'a_vendre', null, null, false, 'doublon');
    raise exception 'ÉCHEC : numéro de lot en double accepté';
  exception when sqlstate '22023' then null;
  end;

  -- Le numéro ne change pas.
  begin
    perform public.crm_pilotage_enregistrer_lot(
      v_lot, null, '6', 'T2', 48000000, 'a_vendre', null, null, false, 'renuméroter');
    raise exception 'ÉCHEC : un lot a changé de numéro';
  exception when sqlstate '22023' then null;
  end;

  -- Vendu : nouvel état, l'ancien reste.
  perform public.crm_pilotage_enregistrer_lot(
    v_lot, null, null, 'T2', 48000000, 'vendu', 47000000, date '2026-12-15', false, 'Acte signé');
  select count(*) into n from public.pilotage_lot_versions where lot_id = v_lot;
  if n <> 2 then raise exception 'ÉCHEC : 2 états attendus pour le lot 5, % trouvés', n; end if;

  -- Retirer un lot ne l'efface pas.
  perform public.crm_pilotage_enregistrer_lot(
    v_lot, null, null, 'T2', 48000000, 'vendu', 47000000, date '2026-12-15', true, 'Saisi par erreur');
  select count(*) into n from public.pilotage_lots where id = v_lot;
  if n <> 1 then raise exception 'ÉCHEC : le lot retiré a disparu'; end if;
  raise notice 'ok : lots créés, doublon et renumérotation refusés, vente et retrait tracés';
end $$;

-- =============================================================================
\echo '--- 5. Les coûts fixes : saisie, double envoi, annulation'
-- =============================================================================
do $$
declare
  r1 jsonb;
  r2 jsonb;
  v_cle uuid := gen_random_uuid();
  n integer;
begin
  r1 := public.crm_pilotage_saisir_cout_fixe(
    '10000000-0000-0000-0000-000000000001', 'production', 350000, 'Tournage du 10 novembre', v_cle);
  -- Le même formulaire envoyé deux fois.
  r2 := public.crm_pilotage_saisir_cout_fixe(
    '10000000-0000-0000-0000-000000000001', 'production', 350000, 'Tournage du 10 novembre', v_cle);
  if r1->>'id' <> r2->>'id' or not (r2->>'deja_enregistre')::boolean then
    raise exception 'ÉCHEC : le double envoi a créé deux coûts (%, %)', r1, r2;
  end if;
  select count(*) into n from public.pilotage_couts_fixes;
  if n <> 1 then raise exception 'ÉCHEC : 1 coût attendu, % trouvés', n; end if;

  -- Montant nul ou type inconnu : refusés.
  begin
    perform public.crm_pilotage_saisir_cout_fixe('10000000-0000-0000-0000-000000000001', 'photos', 0, null, null);
    raise exception 'ÉCHEC : montant nul accepté';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.crm_pilotage_saisir_cout_fixe('10000000-0000-0000-0000-000000000001', 'drone', 1000, null, null);
    raise exception 'ÉCHEC : type inconnu accepté';
  exception when sqlstate '22023' then null;
  end;

  -- Annuler : la ligne reste, datée ; un second clic n'est pas une erreur.
  r1 := public.crm_pilotage_annuler_cout_fixe((r1->>'id')::uuid, 'Facture en double');
  r2 := public.crm_pilotage_annuler_cout_fixe((r1->>'id')::uuid, 'Facture en double');
  if not (r2->>'deja_annule')::boolean then raise exception 'ÉCHEC : second clic sur Annuler : %', r2; end if;
  select count(*) into n from public.pilotage_couts_fixes
   where annule_le is not null and annule_par = 'a0000000-0000-0000-0000-00000000000a'
     and motif_annulation = 'Facture en double' and montant_ht_cents = 350000;
  if n <> 1 then raise exception 'ÉCHEC : annulation mal tracée'; end if;
  raise notice 'ok : double envoi compté une fois, annulation tracée et rejouable';
end $$;

-- =============================================================================
\echo '--- 6. Les autres rôles ne lisent rien du pilotage'
-- =============================================================================
set local request.jwt.claim.sub = 'b0000000-0000-0000-0000-00000000000b';
do $$
declare n integer;
begin
  select (select count(*) from public.pilotage_conditions)
       + (select count(*) from public.pilotage_lots)
       + (select count(*) from public.pilotage_lot_versions)
       + (select count(*) from public.pilotage_couts_fixes) into n;
  if n <> 0 then raise exception 'ÉCHEC : le manager lit % lignes du pilotage', n; end if;
  raise notice 'ok : manager, zéro ligne';
end $$;

set local request.jwt.claim.sub = 'c0000000-0000-0000-0000-00000000000c';
do $$
declare n integer;
begin
  select (select count(*) from public.pilotage_conditions)
       + (select count(*) from public.pilotage_couts_fixes) into n;
  if n <> 0 then raise exception 'ÉCHEC : le commercial lit % lignes du pilotage', n; end if;
  raise notice 'ok : commercial, zéro ligne';
end $$;

-- Écrire en direct, même en connaissant la table : refusé.
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000000a';
do $$ begin
  insert into public.pilotage_couts_fixes (property_id, type_cout, montant_ht_cents)
  values ('10000000-0000-0000-0000-000000000001', 'autre', 100);
  raise exception 'ÉCHEC : insertion directe acceptée';
exception when insufficient_privilege then raise notice 'ok : insertion directe refusée, même à l''administrateur';
end $$;

-- =============================================================================
\echo '--- 7. Rien ne se réécrit, rien ne s''efface — même pour le propriétaire'
-- =============================================================================
reset role;

do $$ begin
  update public.pilotage_conditions set motif = 'réécrit';
  raise exception 'ÉCHEC : une version de conditions a été réécrite';
exception when sqlstate '0A000' then null;
end $$;
do $$ begin
  delete from public.pilotage_conditions;
  raise exception 'ÉCHEC : une version de conditions a été effacée';
exception when sqlstate '0A000' then null;
end $$;
do $$ begin
  update public.pilotage_lots set numero = '99';
  raise exception 'ÉCHEC : un lot a été renuméroté en direct';
exception when sqlstate '0A000' then null;
end $$;
do $$ begin
  delete from public.pilotage_lot_versions;
  raise exception 'ÉCHEC : un état de lot a été effacé';
exception when sqlstate '0A000' then null;
end $$;
do $$ begin
  update public.pilotage_couts_fixes set montant_ht_cents = 1;
  raise exception 'ÉCHEC : un montant de coût a été réécrit';
exception when sqlstate '0A000' then null;
end $$;
do $$ begin
  delete from public.pilotage_couts_fixes;
  raise exception 'ÉCHEC : un coût fixe a été effacé';
exception when sqlstate '0A000' then null;
end $$;
do $$ begin
  delete from public.properties where id = '10000000-0000-0000-0000-000000000001';
  raise exception 'ÉCHEC : un bien porteur d''historique a été supprimé';
exception when foreign_key_violation then null;
end $$;
\echo '    ok : réécriture, effacement et suppression du bien refusés'

-- =============================================================================
\echo '--- 8. Le journal d''audit : un événement par écriture, aucun montant'
-- =============================================================================
do $$
declare
  n_evt integer;
  n_fuite integer;
begin
  select count(*) into n_evt from public.audit_events where entity_type like 'pilotage_%';
  -- 4 versions de conditions + 2 lots créés + 2 états de lot + 1 coût + 1 annulation.
  if n_evt <> 10 then raise exception 'ÉCHEC : 10 événements attendus, % trouvés', n_evt; end if;

  select count(*) into n_fuite
    from public.audit_events e,
         lateral jsonb_object_keys(coalesce(e.new_value, '{}'::jsonb)) as k(cle)
   where e.entity_type like 'pilotage_%'
     and k.cle not in ('property_id', 'date_effet', 'numero', 'version_id');
  if n_fuite <> 0 then raise exception 'ÉCHEC : % clés inattendues au journal du pilotage', n_fuite; end if;

  if exists (select 1 from public.audit_events
              where entity_type like 'pilotage_%' and (old_value is not null or metadata is not null)) then
    raise exception 'ÉCHEC : ancienne valeur ou métadonnées au journal du pilotage';
  end if;
  raise notice 'ok : 10 événements, identifiants seulement';
end $$;

select entity_type, event_type, count(*)
  from public.audit_events where entity_type like 'pilotage_%'
 group by 1, 2 order by 1, 2;

\echo ''
\echo 'RECETTE RÉUSSIE — tout est annulé, la base reste vierge.'
rollback;
