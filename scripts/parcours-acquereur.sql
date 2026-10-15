\set ON_ERROR_STOP on
\timing off

-- =============================================================================
-- LE PARCOURS COMPLET D'UN TRAITEMENT ACQUÉREUR, joué sur le VRAI SQL.
--
--   message vocal laissé → rappel demain → qualification → enregistrer
--
-- puis relecture de ce que voient la fiche, la liste, le pipeline et les
-- tâches, comme après un rechargement de page.
--
-- Il se joue sur une base LOCALE, montée par `scripts/replay-migrations.sh`.
-- Il n'atteint JAMAIS un projet distant et n'utilise que des données fictives.
-- Sa raison d'être : les règles de traitement vivent en base, dans une
-- fonction `SECURITY DEFINER`. Aucun test unitaire du dépôt ne peut les
-- attraper — et c'est exactement là qu'est passée la bogue qui faisait
-- ressusciter un dossier écarté par un simple appel sans réponse.
--
--   PGHOST=127.0.0.1 PGUSER=... bash scripts/replay-migrations.sh
--   psql -d prodigio -f scripts/parcours-acquereur.sql
-- =============================================================================

-- Table rase : le parcours doit pouvoir se rejouer autant de fois qu'on veut.
truncate public.activities, public.tasks, public.buyer_interests,
         public.buyer_profiles, public.contacts, public.properties,
         public.organization_memberships cascade;
delete from public.organizations where id = '33333333-3333-3333-3333-333333333333';

-- --- Le décor ---------------------------------------------------------------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'jc@prodigio.test'),
  ('22222222-2222-2222-2222-222222222222', 'antoine@prodigio.test')
on conflict (id) do nothing;

-- L'organisation est déjà posée par le harnais local : on la réutilise.
insert into public.organizations (id, name, slug) values
  ('33333333-3333-3333-3333-333333333333', 'Prodigio essai', 'prodigio-essai')
on conflict (id) do nothing;

insert into public.organization_memberships (user_id, organization_id, role, status, display_name)
values ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'administrateur', 'actif', 'JC'),
       ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', 'administrateur', 'actif', 'Antoine');

insert into public.contacts (id, first_name, last_name, phone, email)
values ('44444444-4444-4444-4444-444444444444', 'Sabah', 'Matez',
        '+33612345678', 'sabah@example.test');

-- Bien en commercialisation partenaire : le chemin le plus court vers un
-- bien valide, la cohérence mandat/opportunité n'étant pas le sujet ici.
insert into public.properties (id, organization_id, project_name, commercial_title,
                               commercialization_origin, holder_organization_id)
values ('55555555-5555-5555-5555-555555555555', '33333333-3333-3333-3333-333333333333',
        'Villa Verdun', 'Villa Verdun',
        'partenaire_commercialisation', '33333333-3333-3333-3333-333333333333');

insert into public.buyer_profiles (id, organization_id, contact_id, pipeline_stage, qualification, qualification_status)
values ('66666666-6666-6666-6666-666666666666', '33333333-3333-3333-3333-333333333333',
        '44444444-4444-4444-4444-444444444444', 'a_contacter', 'a_qualifier', 'non_qualifie');

insert into public.buyer_interests (id, organization_id, buyer_profile_id, contact_id, property_id,
                                   funnel_version, idempotency_key, raw_answers, normalized_answers)
values ('77777777-7777-7777-7777-777777777777', '33333333-3333-3333-3333-333333333333',
        '66666666-6666-6666-6666-666666666666', '44444444-4444-4444-4444-444444444444',
        '55555555-5555-5555-5555-555555555555', 'v1', 'parcours-1', '{}'::jsonb, '{}'::jsonb);

-- --- JC prend l'appel -------------------------------------------------------
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

\echo ''
\echo '--- 1. Message vocal laissé + rappel demain + qualification, UNE sauvegarde'
select public.crm_buyer_enregistrer(
  p_buyer_profile_id     => '66666666-6666-6666-6666-666666666666',
  -- Activité GÉNÉRALE : l'échange ne portait pas sur un bien en particulier.
  p_interest_id          => null,
  p_activite             => 'message_vocal',
  -- Daté d'HIER : on note souvent un appel après coup. C'est précisément ce
  -- que la date modifiable doit préserver.
  p_occurred_at          => now() - interval '1 day',
  p_note                 => 'Messagerie. Rappeler avant son déplacement à Nîmes.',
  p_qualification        => 'gros_potentiel',
  p_qualification_reason => null,
  p_stage                => null,
  p_next_action_kind     => 'rappel',
  p_next_action_at       => date_trunc('day', now()) + interval '1 day 10 hours',
  p_next_action_title    => 'Rappeler',
  -- Le rappel revient à Antoine, titulaire du dossier, sans réattribuer
  -- le dossier entier.
  p_next_action_assignee => '22222222-2222-2222-2222-222222222222',
  p_complete_task_id     => null
) as resultat;

\echo ''
\echo '--- 2. Ce que voit la FICHE (activité, date réelle vs date de saisie)'
select a.type, a.outcome, a.body,
       (a.occurred_at::date = (now() - interval '1 day')::date) as datee_hier,
       (a.created_at::date = now()::date)                       as saisie_aujourdhui,
       (select display_name from public.organization_memberships m where m.user_id = a.author_user_id) as auteur
  from public.activities a
 where a.buyer_profile_id = '66666666-6666-6666-6666-666666666666';

\echo ''
\echo '--- 3. Ce que voient la LISTE et le PIPELINE (une étape, une qualification)'
select pipeline_stage, qualification, qualification_reason,
       (qualification_at is not null) as horodatee
  from public.buyer_profiles where id = '66666666-6666-6666-6666-666666666666';

\echo ''
\echo '--- 4. Ce que voient les TÂCHES (échéance, responsable)'
select t.title, t.kind, t.status, to_char(t.due_at, 'YYYY-MM-DD HH24:MI') as echeance,
       (select display_name from public.organization_memberships m where m.user_id = t.assignee_user_id) as responsable,
       (select display_name from public.organization_memberships m where m.user_id = t.author_user_id)   as auteur
  from public.tasks t where t.buyer_profile_id = '66666666-6666-6666-6666-666666666666';

\echo ''
\echo '--- 5. Deuxième traitement : le rappel est soldé, pas dupliqué'
select public.crm_buyer_enregistrer(
  p_buyer_profile_id     => '66666666-6666-6666-6666-666666666666',
  -- Une visite se cale sur un bien PRÉCIS : ici on le donne.
  p_interest_id          => '77777777-7777-7777-7777-777777777777',
  p_activite             => 'appel_echange',
  p_occurred_at          => now(),
  p_note                 => 'Échange. Visite calée.',
  p_qualification        => null,
  p_qualification_reason => null,
  p_stage                => 'visite_planifiee',
  p_next_action_kind     => 'visite',
  p_next_action_at       => now() + interval '3 days',
  p_next_action_title    => 'Visite',
  p_next_action_assignee => null,
  p_complete_task_id     => (select id from public.tasks
                              where buyer_profile_id = '66666666-6666-6666-6666-666666666666'
                                and kind = 'rappel' limit 1)
);

select t.title, t.kind, t.status, (t.completed_at is not null) as soldee
  from public.tasks t where t.buyer_profile_id = '66666666-6666-6666-6666-666666666666'
 order by t.kind;

\echo ''
\echo '--- 6. Les deux règles qui avaient été prises en défaut'
\echo '    (a) un appel sans réponse ne ressuscite pas un dossier écarté'
update public.buyer_profiles
   set qualification = 'non_qualifie', qualification_reason = 'Autre', pipeline_stage = 'a_contacter'
 where id = '66666666-6666-6666-6666-666666666666';
select public.crm_buyer_enregistrer(
  '66666666-6666-6666-6666-666666666666', null, 'appel_sans_reponse', now(), null,
  null, null, null, null, null, null, null, null);
select pipeline_stage, qualification from public.buyer_profiles
 where id = '66666666-6666-6666-6666-666666666666';

\echo '    (b) deux rappels d''intitulés DIFFÉRENTS ne fusionnent pas'
update public.buyer_profiles set qualification = 'qualifie', qualification_reason = null
 where id = '66666666-6666-6666-6666-666666666666';
select public.crm_buyer_enregistrer(
  '66666666-6666-6666-6666-666666666666', null, null, null, null, null, null, null,
  'rappel', now() + interval '2 days', 'Rappeler avant Nîmes', null, null);
select public.crm_buyer_enregistrer(
  '66666666-6666-6666-6666-666666666666', null, null, null, null, null, null, null,
  'rappel', now() + interval '10 days', 'Rappeler pour la visite', null, null);
select count(*) as rappels_ouverts from public.tasks
 where buyer_profile_id = '66666666-6666-6666-6666-666666666666'
   and kind = 'rappel' and status = 'a_faire';

\echo ''
\echo '--- 7. « Mauvais numéro » touche le NUMÉRO, pas la qualification'
select public.crm_buyer_enregistrer(
  '66666666-6666-6666-6666-666666666666', null, 'appel_sans_reponse', now(), null,
  null, null, 'mauvais_numero', null, null, null, null, null);
select p.pipeline_stage, p.qualification, c.phone_status
  from public.buyer_profiles p join public.contacts c on c.id = p.contact_id
 where p.id = '66666666-6666-6666-6666-666666666666';

\echo ''
\echo '--- 8. Une activité datée dans le futur est refusée'
do $$
begin
  perform public.crm_buyer_enregistrer(
    '66666666-6666-6666-6666-666666666666', null, 'note', now() + interval '2 days',
    'Note du futur', null, null, null, null, null, null, null, null);
  raise exception 'ÉCHEC : la date future a été acceptée';
exception when sqlstate '22023' then
  raise notice 'OK : refusée (%)', sqlerrm;
end $$;

\echo ''
\echo '--- 9. Écarter sans motif est refusé'
do $$
begin
  perform public.crm_buyer_enregistrer(
    '66666666-6666-6666-6666-666666666666', null, null, null, null,
    'non_qualifie', null, null, null, null, null, null, null);
  raise exception 'ÉCHEC : un dossier a été écarté sans motif';
exception when sqlstate '22023' then
  raise notice 'OK : refusé (%)', sqlerrm;
end $$;

\echo ''
\echo '--- 10. Rien n''a été perdu : toutes les activités sont là, dans l''ordre réel'
select to_char(occurred_at, 'YYYY-MM-DD HH24:MI') as quand, type, outcome, left(coalesce(body,''), 40) as note
  from public.activities where buyer_profile_id = '66666666-6666-6666-6666-666666666666'
 order by occurred_at;

\echo ''
\echo '--- 11. Un seul appel qui parle de DEUX villas : UNE activité, générale'
insert into public.properties (id, organization_id, project_name, commercial_title,
                               commercialization_origin, holder_organization_id)
values ('88888888-8888-8888-8888-888888888888', '33333333-3333-3333-3333-333333333333',
        'Villa Jean Jaurès', 'Villa Jean Jaurès',
        'partenaire_commercialisation', '33333333-3333-3333-3333-333333333333');
insert into public.buyer_interests (id, organization_id, buyer_profile_id, contact_id, property_id,
                                   funnel_version, idempotency_key, raw_answers, normalized_answers)
values ('99999999-9999-9999-9999-999999999999', '33333333-3333-3333-3333-333333333333',
        '66666666-6666-6666-6666-666666666666', '44444444-4444-4444-4444-444444444444',
        '88888888-8888-8888-8888-888888888888', 'v1', 'parcours-2', '{}'::jsonb, '{}'::jsonb);

select public.crm_buyer_enregistrer(
  '66666666-6666-6666-6666-666666666666', null, 'appel_echange', now(),
  'Un seul appel : il hésite entre Verdun et Jean Jaurès.',
  null, null, null, null, null, null, null, null);

select count(*) as activites_pour_cet_appel,
       bool_and(interest_id is null) as rattachee_a_la_personne
  from public.activities
 where buyer_profile_id = '66666666-6666-6666-6666-666666666666'
   and body like 'Un seul appel%';

\echo ''
\echo '--- 12. Une VISITE sans bien est refusée ; avec un bien elle passe'
do $$
begin
  perform public.crm_buyer_enregistrer(
    '66666666-6666-6666-6666-666666666666', null, null, null, null, null, null, null,
    'visite', now() + interval '5 days', 'Visite', null, null);
  raise exception 'ÉCHEC : une visite a été enregistrée sans bien';
exception when sqlstate '22023' then
  raise notice 'OK : refusée (%)', sqlerrm;
end $$;

select (public.crm_buyer_enregistrer(
  '66666666-6666-6666-6666-666666666666', '99999999-9999-9999-9999-999999999999',
  null, null, null, null, null, null,
  'visite', now() + interval '5 days', 'Visite Jean Jaurès', null, null) ->> 'ok') as visite_avec_bien;

\echo ''
\echo '--- 13. Le responsable réellement ENREGISTRÉ est renvoyé, pas celui demandé'
select (public.crm_buyer_enregistrer(
  '66666666-6666-6666-6666-666666666666', null, null, null, null, null, null, null,
  'tache', now() + interval '4 days', 'Envoyer le plan de masse',
  '22222222-2222-2222-2222-222222222222', null) ->> 'next_action_assignee')
  = '22222222-2222-2222-2222-222222222222' as responsable_confirme;

\echo ''
\echo '--- 14. Un projet qui n''appartient pas au dossier est refusé'
do $$
declare v_autre uuid;
begin
  insert into public.contacts (id, first_name, last_name)
       values (gen_random_uuid(), 'Autre', 'Personne') returning id into v_autre;
  perform public.crm_buyer_enregistrer(
    '66666666-6666-6666-6666-666666666666', gen_random_uuid(), 'note', now(),
    'Rattachement impossible', null, null, null, null, null, null, null, null);
  raise exception 'ÉCHEC : un projet étranger a été accepté';
exception when sqlstate '22023' then
  raise notice 'OK : refusé (%)', sqlerrm;
end $$;
