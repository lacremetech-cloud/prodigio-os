-- =============================================================================
-- RECETTE SQL DU JOURNAL DES CONVERSIONS META (migration
-- 20261128190000_conversions_meta_reparees), jouée sur le VRAI SQL.
--
-- Ce qui est vérifié, sur un décor fictif :
--  1. les droits : le dépôt public (sans session) peut tracer ; la question
--     « déjà partie ? » est réservée à un client connecté ;
--  2. sans session, seul le `Lead` d'une demande réelle, récente et pas encore
--     tracée s'écrit ; tout le reste est ignoré, sans erreur ;
--  3. avec une session, les sept motifs s'écrivent, un motif inconnu devient
--     « erreur » ; un compte hors de l'équipe (inscription libre) n'écrit
--     ni ne lit rien ;
--  4. « déjà partie ? » ne répond vrai que pour un envoi réel.
--
-- Se joue sur une base LOCALE montée par `scripts/replay-migrations.sh` :
--   psql -d prodigio -v ON_ERROR_STOP=1 -f scripts/conversions-meta.sql
-- Jouable aussi avec la règle `safeupdate` de la production émulée.
-- Refus sur une base non vierge ; une seule transaction annulée à la fin.
-- =============================================================================

begin;

do $$
begin
  if exists (select 1 from public.buyer_interests) or exists (select 1 from public.meta_conversion_log) then
    raise exception 'Base non vierge : ce script ne se joue que sur une base LOCALE (scripts/replay-migrations.sh).';
  end if;
end $$;

-- --- Le décor (fictif) ----------------------------------------------------------
-- Un commercial de l'équipe, et un compte inscrit de l'extérieur, sans adhésion.
insert into auth.users (id, email) values
  ('c0000000-0000-0000-0000-00000000000c', 'commercial@crm.test'),
  ('d0000000-0000-0000-0000-00000000000d', 'exterieur@crm.test');

insert into public.organization_memberships (user_id, organization_id, role, status)
select 'c0000000-0000-0000-0000-00000000000c', o.id, 'commercial', 'actif'
  from public.organizations o where o.slug = 'prodigio';

insert into public.organizations (id, slug, name, kind) values
  ('e0000000-0000-0000-0000-00000000000e', 'agence-essai', 'Agence essai', 'agence_partenaire');

insert into public.properties (id, organization_id, project_name, commercialization_origin, holder_organization_id)
select '10000000-0000-0000-0000-000000000001', o.id, 'Villa essai', 'partenaire_commercialisation',
       'e0000000-0000-0000-0000-00000000000e'
  from public.organizations o where o.slug = 'prodigio';

-- Une demande toute fraîche, une demande d'hier.
insert into public.buyer_interests (id, organization_id, property_id, funnel_version, idempotency_key,
                                    raw_answers, normalized_answers, created_at)
select v.id, o.id, '10000000-0000-0000-0000-000000000001', 'v1', v.cle, '{}'::jsonb, '{}'::jsonb, v.le
  from (values ('60000000-0000-0000-0000-000000000001'::uuid, 'cm-1', now()),
               ('60000000-0000-0000-0000-000000000002'::uuid, 'cm-2', now() - interval '1 day')) as v(id, cle, le),
       public.organizations o where o.slug = 'prodigio';

-- =============================================================================
\echo '--- 1. Droits'
-- =============================================================================
do $$
begin
  if not has_function_privilege('anon', 'public.crm_meta_conversion_log(text,text,uuid,text,text)', 'execute') then
    raise exception 'ÉCHEC : le dépôt public ne peut plus tracer son Lead';
  end if;
  if has_function_privilege('anon', 'public.crm_meta_conversion_deja_envoyee(text)', 'execute') then
    raise exception 'ÉCHEC : anon peut interroger le journal';
  end if;
  if not has_function_privilege('authenticated', 'public.crm_meta_conversion_deja_envoyee(text)', 'execute') then
    raise exception 'ÉCHEC : un client connecté ne peut pas savoir si une conversion est partie';
  end if;
  raise notice 'ok : droits';
end $$;

-- =============================================================================
\echo '--- 2. Sans session : le seul Lead d''une demande réelle, récente, pas encore tracée'
-- =============================================================================
set local role anon;
do $$
begin
  perform public.crm_meta_conversion_log('Lead', 'envoyee', '60000000-0000-0000-0000-000000000001', 'lead-1');
  -- Tout ce qui suit doit être ignoré.
  perform public.crm_meta_conversion_log('Lead', 'envoyee', '60000000-0000-0000-0000-000000000001', 'lead-1-bis');
  perform public.crm_meta_conversion_log('Lead', 'envoyee', '60000000-0000-0000-0000-000000000002', 'lead-2');
  perform public.crm_meta_conversion_log('Lead', 'envoyee', '60000000-0000-0000-0000-0000000000ff', 'lead-inconnu');
  perform public.crm_meta_conversion_log('Lead', 'envoyee', null, 'lead-sans-demande');
  perform public.crm_meta_conversion_log('CompleteRegistration', 'envoyee', '60000000-0000-0000-0000-000000000001', 'qualifie-1');
  perform public.crm_meta_conversion_log('Schedule', 'envoyee', null, 'visite-forgee');
end $$;
reset role;
do $$
declare n int; ids text;
begin
  select count(*), string_agg(event_id, ', ' order by event_id) into n, ids from public.meta_conversion_log;
  if n <> 1 or ids <> 'lead-1' then
    raise exception 'ÉCHEC : sans session, % ligne(s) écrite(s) : %', n, ids;
  end if;
  raise notice 'ok : sans session, une seule ligne — le Lead de la demande fraîche';
end $$;

-- =============================================================================
\echo '--- 3. Avec une session : les sept motifs, un motif inconnu devient « erreur »'
-- =============================================================================
set local role authenticated;
set local request.jwt.claim.sub = 'c0000000-0000-0000-0000-00000000000c';
do $$
begin
  perform public.crm_meta_conversion_log('CompleteRegistration', m, '60000000-0000-0000-0000-000000000002', 'qualifie-2-' || m)
     from unnest(array['envoyee', 'non_configure', 'hors_production', 'deja_envoyee', 'sans_correspondance', 'refus', 'erreur', 'inconnu']) as m;
end $$;
reset role;
do $$
declare v text;
begin
  select string_agg(event_id || '=' || resultat, ' ' order by event_id) into v
    from public.meta_conversion_log where event_name = 'CompleteRegistration';
  if v <> 'qualifie-2-deja_envoyee=deja_envoyee qualifie-2-envoyee=envoyee qualifie-2-erreur=erreur qualifie-2-hors_production=hors_production qualifie-2-inconnu=erreur qualifie-2-non_configure=non_configure qualifie-2-refus=refus qualifie-2-sans_correspondance=sans_correspondance' then
    raise exception 'ÉCHEC : motifs écrits = %', v;
  end if;
  raise notice 'ok : motifs';
end $$;

-- =============================================================================
\echo '--- 3 bis. Avec une session, mais hors de l''équipe : rien ne s''écrit, rien ne se lit'
-- =============================================================================
set local role authenticated;
set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-00000000000d';
do $$
begin
  perform public.crm_meta_conversion_log('CompleteRegistration', 'envoyee', '60000000-0000-0000-0000-000000000002', 'qualifie-forgee');
  perform public.crm_meta_conversion_log('Lead', 'envoyee', '60000000-0000-0000-0000-000000000001', 'lead-forgee');
  if public.crm_meta_conversion_deja_envoyee('qualifie-2-envoyee') then
    raise exception 'ÉCHEC : un compte extérieur interroge le journal';
  end if;
end $$;
reset role;
do $$
begin
  if exists (select 1 from public.meta_conversion_log where event_id in ('qualifie-forgee', 'lead-forgee')) then
    raise exception 'ÉCHEC : un compte extérieur a écrit au journal';
  end if;
  raise notice 'ok : un compte hors de l''équipe n''écrit ni ne lit rien';
end $$;

-- =============================================================================
\echo '--- 4. « Déjà partie ? » : vrai pour un envoi réel seulement'
-- =============================================================================
set local role authenticated;
set local request.jwt.claim.sub = 'c0000000-0000-0000-0000-00000000000c';
do $$
begin
  if not public.crm_meta_conversion_deja_envoyee('qualifie-2-envoyee') then
    raise exception 'ÉCHEC : un envoi réel n''est pas reconnu';
  end if;
  if public.crm_meta_conversion_deja_envoyee('qualifie-2-hors_production')
     or public.crm_meta_conversion_deja_envoyee('qualifie-2-refus')
     or public.crm_meta_conversion_deja_envoyee('jamais-vu')
     or public.crm_meta_conversion_deja_envoyee(null) then
    raise exception 'ÉCHEC : « déjà partie » pour une conversion qui n''est pas partie';
  end if;
  raise notice 'ok : déjà partie, seulement si envoyée';
end $$;
reset role;

-- =============================================================================
\echo '--- 5. La requête de contrôle (scripts/conversions-meta-controles.sql) compte ce qui précède'
-- =============================================================================
\set requete_controle `cat scripts/conversions-meta-controles.sql`
create temp table controle as :requete_controle
do $$
declare v text;
begin
  select string_agg(evenement || ' ' || mesure || '=' || valeur, ' | ' order by evenement, mesure) into v
    from controle where evenement in ('Lead', 'CompleteRegistration');
  if v <> 'CompleteRegistration journal · deja_envoyee=1 | CompleteRegistration journal · envoyee=1 | CompleteRegistration journal · erreur=2 | CompleteRegistration journal · hors_production=1 | CompleteRegistration journal · non_configure=1 | CompleteRegistration journal · refus=1 | CompleteRegistration journal · sans_correspondance=1 | Lead CRM · demandes reçues=2 | Lead journal · envoyee=1' then
    raise exception 'ÉCHEC : contrôle = %', v;
  end if;
  raise notice 'ok : le contrôle compte les demandes et le journal';
end $$;

\echo ''
\echo 'RECETTE RÉUSSIE — tout est annulé, la base reste vierge.'
rollback;
