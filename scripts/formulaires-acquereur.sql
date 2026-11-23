-- =============================================================================
-- RECETTE SQL : les formulaires « Offre », « Résultat commercial » et
-- « Rouvrir » de la fiche acquéreur, sur les neuf étapes du pipeline
-- (migration 20261123200000_formulaires_acquereur_neuf_etapes).
--
-- Sur une base LOCALE vierge, après `scripts/replay-migrations.sh` :
--   psql -h /var/run/postgresql -p 55432 -U postgres -d prodigio \
--        -v ON_ERROR_STOP=1 -f scripts/formulaires-acquereur.sql
-- Données fictives uniquement ; tout est annulé à la fin (rollback).
-- =============================================================================

begin;

do $$
begin
  if exists (select 1 from public.properties) or exists (select 1 from public.buyer_profiles) then
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
select '10000000-0000-0000-0000-000000000001', o.id, 'Villa essai', 'partenaire_commercialisation',
       'e0000000-0000-0000-0000-00000000000e'
  from public.organizations o where o.slug = 'prodigio';

insert into public.contacts (id, first_name, last_name) values
  ('40000000-0000-0000-0000-0000000000a1', 'Fictif', 'X'),
  ('40000000-0000-0000-0000-0000000000a2', 'Fictif', 'Y'),
  ('40000000-0000-0000-0000-0000000000a3', 'Fictif', 'Z');

-- X : visite planifiée (fera une offre, puis sera gagnée) ; Y : à rappeler
-- (sera perdue, puis rouverte) ; Z : en discussion (témoin des refus).
insert into public.buyer_profiles (id, organization_id, contact_id, pipeline_stage)
select v.id, o.id, v.contact, v.etape
  from (values
    ('50000000-0000-0000-0000-0000000000a1'::uuid, '40000000-0000-0000-0000-0000000000a1'::uuid, 'visite_planifiee'),
    ('50000000-0000-0000-0000-0000000000a2'::uuid, '40000000-0000-0000-0000-0000000000a2'::uuid, 'a_rappeler'),
    ('50000000-0000-0000-0000-0000000000a3'::uuid, '40000000-0000-0000-0000-0000000000a3'::uuid, 'en_discussion')
  ) as v(id, contact, etape),
  public.organizations o where o.slug = 'prodigio';

-- =============================================================================
\echo '--- 1. Aucune fonction acquéreur n''écrit une étape hors des neuf'
-- =============================================================================
do $$
declare r text;
begin
  select string_agg(p.proname || ' → ' || m[1], ', ' order by p.proname)
    into r
    from pg_proc p
    cross join lateral regexp_matches(p.prosrc, 'pipeline_stage\s*=\s*''([a-z_]+)''', 'g') as m
   where p.pronamespace = 'public'::regnamespace
     and p.proname like 'crm\_buyer\_%'
     and not (m[1] = any (public.crm_etapes_acquereur()));
  if r is not null then
    raise exception 'ÉCHEC : étape hors du pipeline écrite par %', r;
  end if;
  raise notice 'ok : toutes les étapes écrites par les fonctions acquéreur sont parmi les neuf';
end $$;

-- =============================================================================
\echo '--- 2. Droits : un client connecté, jamais anon'
-- =============================================================================
do $$
declare f text;
begin
  foreach f in array array['public.crm_buyer_record_offer(uuid,uuid,bigint,text)',
                           'public.crm_buyer_record_outcome(uuid,text,text)',
                           'public.crm_buyer_reopen(uuid,text)'] loop
    if has_function_privilege('anon', f, 'execute') then raise exception 'ÉCHEC : anon exécute %', f; end if;
    if not has_function_privilege('authenticated', f, 'execute') then raise exception 'ÉCHEC : authenticated n''exécute pas %', f; end if;
    if not has_function_privilege('service_role', f, 'execute') then raise exception 'ÉCHEC : service_role n''exécute pas %', f; end if;
  end loop;
  raise notice 'ok : droits conservés';
end $$;

set local role authenticated;

-- =============================================================================
\echo '--- 3. Offre → « Offre en cours », montant et bien notés, journal complet'
-- =============================================================================
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000000a';
do $$
declare r jsonb; bp record; n int; j jsonb;
begin
  r := public.crm_buyer_record_offer('50000000-0000-0000-0000-0000000000a1',
                                     '10000000-0000-0000-0000-000000000001', 123456700, 'Offre fictive');
  if r ->> 'stage' is distinct from 'offre_en_cours' then raise exception 'ÉCHEC : réponse = %', r; end if;
  select pipeline_stage, offer_property_id, offer_amount_cents, offer_recorded_at into bp
    from public.buyer_profiles where id = '50000000-0000-0000-0000-0000000000a1';
  if bp.pipeline_stage <> 'offre_en_cours' or bp.offer_amount_cents <> 123456700
     or bp.offer_property_id <> '10000000-0000-0000-0000-000000000001' or bp.offer_recorded_at is null then
    raise exception 'ÉCHEC : dossier après l''offre = %', row_to_json(bp);
  end if;
  select count(*) into n from public.activities
   where buyer_profile_id = '50000000-0000-0000-0000-0000000000a1' and body = 'Offre fictive';
  if n <> 1 then raise exception 'ÉCHEC : commentaire de l''offre absent'; end if;
  select new_value into j from public.audit_events
   where entity_id = '50000000-0000-0000-0000-0000000000a1' and event_type = 'acquereur_offre';
  if j ->> 'stage' is distinct from 'offre_en_cours' or (j ->> 'amount_cents')::bigint <> 123456700 then
    raise exception 'ÉCHEC : journal de l''offre = %', j;
  end if;
  raise notice 'ok : offre enregistrée, dossier en « offre en cours »';
end $$;

-- =============================================================================
\echo '--- 4. Résultat : gagné garde la colonne ; perdu → « Pas intéressé »'
-- =============================================================================
-- Un commercial n'enregistre pas de résultat.
set local request.jwt.claim.sub = 'c0000000-0000-0000-0000-00000000000c';
do $$
begin
  begin
    perform public.crm_buyer_record_outcome('50000000-0000-0000-0000-0000000000a3', 'gagne', null);
    raise exception 'ÉCHEC : un commercial enregistre un résultat';
  exception when sqlstate '42501' then null;
  end;
  raise notice 'ok : commercial refusé';
end $$;

set local request.jwt.claim.sub = 'b0000000-0000-0000-0000-00000000000b';
do $$
declare r jsonb; bp record; j jsonb;
begin
  r := public.crm_buyer_record_outcome('50000000-0000-0000-0000-0000000000a1', 'gagne', null);
  select pipeline_stage, outcome, outcome_recorded_at into bp
    from public.buyer_profiles where id = '50000000-0000-0000-0000-0000000000a1';
  if bp.pipeline_stage <> 'offre_en_cours' or bp.outcome <> 'gagne' or bp.outcome_recorded_at is null then
    raise exception 'ÉCHEC : gagné = %', row_to_json(bp);
  end if;
  select new_value into j from public.audit_events
   where entity_id = '50000000-0000-0000-0000-0000000000a1' and event_type = 'acquereur_resultat';
  if j ->> 'outcome' <> 'gagne' or j ->> 'stage' <> 'offre_en_cours' then raise exception 'ÉCHEC : journal gagné = %', j; end if;

  begin
    perform public.crm_buyer_record_outcome('50000000-0000-0000-0000-0000000000a2', 'perdu', '  ');
    raise exception 'ÉCHEC : perdu sans motif accepté';
  exception when sqlstate '22023' then null;
  end;

  r := public.crm_buyer_record_outcome('50000000-0000-0000-0000-0000000000a2', 'perdu', 'Motif fictif');
  if r ->> 'stage' <> 'pas_interesse' then raise exception 'ÉCHEC : réponse perdu = %', r; end if;
  select pipeline_stage, outcome, outcome_reason into bp
    from public.buyer_profiles where id = '50000000-0000-0000-0000-0000000000a2';
  if bp.pipeline_stage <> 'pas_interesse' or bp.outcome <> 'perdu' or bp.outcome_reason <> 'Motif fictif' then
    raise exception 'ÉCHEC : perdu = %', row_to_json(bp);
  end if;
  raise notice 'ok : gagné noté sans déplacer la carte ; perdu en « pas intéressé », motif exigé';
end $$;

-- =============================================================================
\echo '--- 5. Rouvrir → « À rappeler », résultat effacé, motif exigé'
-- =============================================================================
do $$
declare r jsonb; bp record; j jsonb;
begin
  begin
    perform public.crm_buyer_reopen('50000000-0000-0000-0000-0000000000a2', '');
    raise exception 'ÉCHEC : réouverture sans motif acceptée';
  exception when sqlstate '22023' then null;
  end;

  r := public.crm_buyer_reopen('50000000-0000-0000-0000-0000000000a2', 'Motif fictif');
  if r ->> 'stage' <> 'a_rappeler' then raise exception 'ÉCHEC : réponse = %', r; end if;
  select pipeline_stage, outcome, outcome_reason, outcome_recorded_at into bp
    from public.buyer_profiles where id = '50000000-0000-0000-0000-0000000000a2';
  if bp.pipeline_stage <> 'a_rappeler' or bp.outcome is not null or bp.outcome_reason is not null
     or bp.outcome_recorded_at is not null then
    raise exception 'ÉCHEC : dossier rouvert = %', row_to_json(bp);
  end if;
  select new_value into j from public.audit_events
   where entity_id = '50000000-0000-0000-0000-0000000000a2' and event_type = 'acquereur_stade'
   order by created_at desc limit 1;
  if j ->> 'stage' <> 'a_rappeler' or (j ->> 'reopened')::boolean is not true then
    raise exception 'ÉCHEC : journal de réouverture = %', j;
  end if;
  raise notice 'ok : dossier rouvert en « à rappeler »';
end $$;

-- =============================================================================
\echo '--- 6. Rien d''autre n''a bougé'
-- =============================================================================
do $$
declare e text;
begin
  select pipeline_stage into e from public.buyer_profiles where id = '50000000-0000-0000-0000-0000000000a3';
  if e <> 'en_discussion' then raise exception 'ÉCHEC : le témoin a changé d''étape (%)', e; end if;
  raise notice 'ok : le dossier témoin est intact';
end $$;

reset role;

\echo ''
\echo 'RECETTE RÉUSSIE — tout est annulé, la base reste vierge.'
rollback;
