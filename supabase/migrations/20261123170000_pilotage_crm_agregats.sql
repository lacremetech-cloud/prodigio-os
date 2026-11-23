-- =============================================================================
-- Pilotage pub — étape 3b : ce que le CRM sait, par bien et par période,
-- EN NOMBRES SEULEMENT.
--
-- Cinq fonctions de LECTURE, réservées à l'administrateur : elles ne rendent
-- que des comptes. Aucune ligne d'acquéreur ne sort de la base — ni nom, ni
-- téléphone, ni e-mail, ni adresse de formulaire.
--
-- LES DÉFINITIONS (reprises à l'écran et dans docs/33 § 9) :
--  - la période se mesure sur la DATE D'ARRIVÉE de la demande
--    (`buyer_interests.created_at`, jour de Paris) ;
--  - une personne ARCHIVÉE (`buyer_profiles.archive_le` : faux numéro, test,
--    doublon) est exclue, comme dans les listes du CRM ; ses demandes sont
--    comptées à part ;
--  - l'étape et la qualification sont celles de la PERSONNE
--    (`buyer_profiles.pipeline_stage`, `.qualification`) ; une personne qui a
--    des demandes sur deux biens compte dans chacun, une fois au total ;
--  - « étape atteinte » : l'étape actuelle, plus toute étape passée selon le
--    journal (`audit_events`, 'acquereur_stade' et 'acquereur_traitement'),
--    anciennes clés traduites par `crm_etape_v2` ; « à contacter » pour tous ;
--  - une visite est une tâche `kind = 'visite'` rattachée à une demande de la
--    période (`tasks.interest_id`) ;
--  - une offre : une personne arrivée à « offre en cours », et les montants
--    saisis (`buyer_profiles.offer_*`) pour ce bien ;
--  - la pub d'une demande se décide à la lecture : le premier identifiant
--    CONNU de la lecture Meta parmi `meta_ad_id`, `utm_content` (colonne, puis
--    adresse du formulaire, puis première visite) et `utm_id` ; sinon le nom
--    exact d'une pub ; sinon une campagne connue ; sinon « non rattachée ».
--    `meta_ad_id` n'est pas réécrit : aux Airelles, `utm_id` porte
--    l'identifiant de la CAMPAGNE, que la lecture reconnaît comme tel ;
--  - les coûts et l'écart avec Meta comparent les MÊMES JOURS : la dépense et
--    les leads Meta ne comptent qu'à partir de la première demande reçue dans
--    le CRM pour le bien (`crm_pilotage_crm_debuts`).
--
-- VOLUME : chaque table n'est lue qu'une fois par appel (la RLS s'applique à
-- chaque ligne lue) ; la période filtre l'horodatage avant la RLS. Essayé sur
-- dix fois le volume du CRM de novembre 2026, loin des 8 secondes de l'API.
--
-- STRICTEMENT ADDITIVE : des fonctions nouvelles, aucune table, aucune colonne,
-- aucune donnée touchée. Aucune écriture (safeupdate n'a rien à refuser).
-- =============================================================================

begin;

set local lock_timeout = '2s';

-- -----------------------------------------------------------------------------
-- 1. Les demandes de la période, résolues : bien, personne, jour, pub ou
--    campagne, provenance. Usage interne des fonctions ci-dessous — mais
--    réservé lui aussi à l'administrateur.
-- -----------------------------------------------------------------------------
create or replace function public.crm_pilotage_crm_demandes_resolues(p_debut date, p_fin date)
returns table (
  demande       uuid,
  property_id   uuid,
  personne      uuid,
  archivee      boolean,
  jour          date,
  niveau        text,
  ad_id         text,
  campaign_id   text,
  provenance    text
)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
begin
  -- `crm_require_role` n'est pas exécutable par un client : la fonction
  -- s'exécute avec les droits de l'appelant (la RLS s'applique), d'où ce
  -- contrôle explicite, par `crm_has_role`.
  if not public.crm_has_role('administrateur') then
    raise exception 'pilotage réservé aux administrateurs' using errcode = '42501';
  end if;
  return query
  with pubs_connues as (
    select p.ad_id from public.pilotage_meta_pubs p
    union
    select i.ad_id from public.pilotage_meta_insights i
  ),
  campagnes_connues as (
    select i.campaign_id from public.pilotage_meta_insights i where i.campaign_id is not null
    union
    select p.campaign_id from public.pilotage_meta_pubs p where p.campaign_id is not null
  ),
  -- Un nom de pub ne vaut que s'il est porté par UNE seule pub.
  noms_uniques as (
    select lower(btrim(p.ad_name)) as nom, min(p.ad_id) as ad_id
      from public.pilotage_meta_pubs p
     where p.ad_name is not null
     group by lower(btrim(p.ad_name))
    having count(*) = 1
  ),
  -- Les demandes, lues une fois. Les paramètres des adresses (formulaire et
  -- première visite) sont lus tels quels : ils ne servent qu'à reconnaître des
  -- identifiants numériques.
  demandes as materialized (
    select bi.id,
           bi.property_id,
           bi.buyer_profile_id,
           coalesce(bp.archive_le is not null, false) as archivee,
           (bi.created_at at time zone 'Europe/Paris')::date as jour,
           bi.meta_ad_id,
           btrim(bi.utm_content) as utm_content,
           btrim(bi.utm_campaign) as utm_campaign,
           lower(nullif(btrim(bi.utm_source), '')) as provenance,
           nullif(substring(bi.origin_url from '[?&]utm_content=([^&#]*)'), '') as adresse_content,
           nullif(substring(bi.origin_url from '[?&]utm_campaign=([^&#]*)'), '') as adresse_campaign,
           nullif(substring(bi.origin_url from '[?&]utm_id=([^&#]*)'), '') as adresse_id,
           nullif(substring(u.premiere from '[?&]utm_content=([^&#]*)'), '') as premiere_content,
           nullif(substring(u.premiere from '[?&]utm_campaign=([^&#]*)'), '') as premiere_campaign,
           nullif(substring(u.premiere from '[?&]utm_id=([^&#]*)'), '') as premiere_id
      from public.buyer_interests bi
      left join public.buyer_profiles bp on bp.id = bi.buyer_profile_id
      cross join lateral (
        select case when jsonb_typeof(bi.first_touch) = 'object' then bi.first_touch ->> 'url' end as premiere
      ) u
     -- Jour de Paris entre p_debut et p_fin, écrit sur l'horodatage lui-même.
     where bi.created_at >= (coalesce(p_debut, '1970-01-01'::date)::timestamp at time zone 'Europe/Paris')
       and bi.created_at <  ((p_fin + 1)::timestamp at time zone 'Europe/Paris')
  ),
  -- Le premier identifiant de pub CONNU, dans l'ordre des sources.
  par_identifiant as (
    select distinct on (d.id) d.id, c.v as ad_id
      from demandes d
      cross join lateral (values (1, d.meta_ad_id),
                                 (2, d.utm_content),
                                 (3, d.adresse_content),
                                 (4, d.premiere_content),
                                 (5, d.adresse_id),
                                 (6, d.premiere_id)) as c(rang, v)
      join pubs_connues k on k.ad_id = c.v
     order by d.id, c.rang
  ),
  par_nom as (
    select d.id, n.ad_id
      from demandes d
      join noms_uniques n on n.nom = lower(d.utm_content)
  ),
  -- Sinon, la première campagne CONNUE.
  par_campagne as (
    select distinct on (d.id) d.id, c.v as campaign_id
      from demandes d
      cross join lateral (values (1, d.utm_campaign),
                                 (2, d.adresse_campaign),
                                 (3, d.premiere_campaign),
                                 (4, d.adresse_id),
                                 (5, d.premiere_id)) as c(rang, v)
      join campagnes_connues k on k.campaign_id = c.v
     order by d.id, c.rang
  )
  select d.id,
         d.property_id,
         d.buyer_profile_id,
         d.archivee,
         d.jour,
         case when coalesce(pi.ad_id, pn.ad_id) is not null then 'pub'
              when pc.campaign_id is not null then 'campagne'
              else 'aucun' end,
         coalesce(pi.ad_id, pn.ad_id),
         case when coalesce(pi.ad_id, pn.ad_id) is null then pc.campaign_id end,
         d.provenance
    from demandes d
    left join par_identifiant pi on pi.id = d.id
    left join par_nom pn on pn.id = d.id
    left join par_campagne pc on pc.id = d.id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Les demandes reçues, par bien et par jour (personnes archivées exclues).
--    Le rattachement aux pubs n'y sert pas : lecture directe.
-- -----------------------------------------------------------------------------
create or replace function public.crm_pilotage_crm_par_jour(p_debut date, p_fin date)
returns table (property_id uuid, jour date, demandes integer)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
begin
  -- `crm_require_role` n'est pas exécutable par un client : la fonction
  -- s'exécute avec les droits de l'appelant (la RLS s'applique), d'où ce
  -- contrôle explicite, par `crm_has_role`.
  if not public.crm_has_role('administrateur') then
    raise exception 'pilotage réservé aux administrateurs' using errcode = '42501';
  end if;
  return query
  select bi.property_id, (bi.created_at at time zone 'Europe/Paris')::date, count(*)::integer
    from public.buyer_interests bi
    left join public.buyer_profiles bp on bp.id = bi.buyer_profile_id
   where bi.created_at >= (coalesce(p_debut, '1970-01-01'::date)::timestamp at time zone 'Europe/Paris')
     and bi.created_at <  ((p_fin + 1)::timestamp at time zone 'Europe/Paris')
     and bp.archive_le is null
   group by 1, 2;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. La cohorte de la période : par bien, et au total (property_id NULL), en
--    personnes distinctes. Un objet de comptes par ligne.
-- -----------------------------------------------------------------------------
create or replace function public.crm_pilotage_crm_cohorte(p_debut date, p_fin date)
returns table (property_id uuid, mesures jsonb)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
begin
  -- `crm_require_role` n'est pas exécutable par un client : la fonction
  -- s'exécute avec les droits de l'appelant (la RLS s'applique), d'où ce
  -- contrôle explicite, par `crm_has_role`.
  if not public.crm_has_role('administrateur') then
    raise exception 'pilotage réservé aux administrateurs' using errcode = '42501';
  end if;
  return query
  with d as materialized (
    select * from public.crm_pilotage_crm_demandes_resolues(p_debut, p_fin)
  ),
  actives as materialized (
    select * from d where not d.archivee
  ),
  -- Les comptes de DEMANDES : par bien, et au total (property_id NULL).
  demandes as (
    select a.property_id as portee,
           count(*) as demandes,
           count(*) filter (where a.personne is null) as sans_personne,
           count(*) filter (where a.niveau = 'pub') as pub,
           count(*) filter (where a.niveau = 'campagne') as campagne,
           count(*) filter (where a.niveau = 'aucun') as aucun
      from actives a
     group by grouping sets ((a.property_id), ())
  ),
  archivees as (
    select x.property_id as portee, count(*) as n
      from d x
     where x.archivee
     group by grouping sets ((x.property_id), ())
  ),
  provenances as (
    select s.portee, jsonb_object_agg(s.source, s.n) as comptes
      from (select a.property_id as portee, coalesce(a.provenance, '') as source, count(*) as n
              from actives a
             group by grouping sets ((a.property_id, coalesce(a.provenance, '')), (coalesce(a.provenance, '')))) s
     group by s.portee
  ),
  visites as (
    select a.property_id as portee,
           count(*) filter (where t.status = 'a_faire') as planifiees,
           count(*) filter (where t.status = 'a_faire' and t.due_at >= now()) as a_venir,
           count(*) filter (where t.status = 'fait') as faites,
           count(*) filter (where t.status = 'annule') as annulees
      from public.tasks t
      join actives a on a.demande = t.interest_id
     where t.kind = 'visite'
     group by grouping sets ((a.property_id), ())
  ),
  -- Chaque personne de la cohorte, lue UNE fois : ses biens de la période, son
  -- étape, sa qualification, son offre, les étapes de son journal, son
  -- responsable (affectation active de la personne).
  profils as materialized (
    select pb.personne,
           pb.biens,
           public.crm_etape_v2(bp.pipeline_stage) as etape,
           bp.qualification,
           bp.offer_amount_cents,
           bp.offer_property_id,
           array(select public.crm_etape_v2(ae.new_value ->> 'stage')
                   from public.audit_events ae
                  where ae.entity_type = 'buyer_profile'
                    and ae.entity_id = pb.personne
                    and ae.event_type in ('acquereur_stade', 'acquereur_traitement')
                    and ae.new_value ? 'stage') as journal,
           (select min(ba.user_id::text)
              from public.buyer_assignments ba
             where ba.buyer_profile_id = pb.personne
               and ba.released_at is null) as membre
      from (select a.personne, array_agg(distinct a.property_id) as biens
              from actives a
             where a.personne is not null
             group by a.personne) pb
      join public.buyer_profiles bp on bp.id = pb.personne
  ),
  -- Une ligne par personne et par portée : chacun de ses biens, et le total (NULL).
  pp as materialized (
    select u.portee, pr.*
      from profils pr
      cross join lateral unnest(pr.biens || array[null::uuid]) as u(portee)
  ),
  personnes as (
    select pp.portee,
           count(*) as personnes,
           -- « Atteinte » : l'étape actuelle, ou une étape du journal.
           count(*) filter (where 'offre_en_cours' = any (pp.journal || pp.etape)) as offres,
           count(*) filter (where pp.offer_amount_cents is not null
                              and (pp.portee is null or pp.offer_property_id = pp.portee)) as montants,
           coalesce(sum(pp.offer_amount_cents) filter (where pp.offer_amount_cents is not null
                                                      and (pp.portee is null or pp.offer_property_id = pp.portee)), 0) as somme_cents
      from pp
     group by pp.portee
  ),
  etapes as (
    select e.portee, jsonb_object_agg(e.etape, e.n) as comptes
      from (select pp.portee, pp.etape, count(*) as n from pp group by 1, 2) e
     group by e.portee
  ),
  -- Les étapes atteintes : l'actuelle, le journal, et « à contacter » pour tous.
  atteintes as (
    select e.portee, jsonb_object_agg(e.etape, e.n) as comptes
      from (select pp.portee, x.etape, count(*) as n
              from pp
              cross join lateral (select distinct y
                                    from unnest(pp.journal || pp.etape || 'a_contacter'::text) as y
                                   where y is not null) as x(etape)
             group by 1, 2) e
     group by e.portee
  ),
  qualifications as (
    select q.portee, jsonb_object_agg(q.qualification, q.n) as comptes
      from (select pp.portee, pp.qualification, count(*) as n from pp group by 1, 2) q
     group by q.portee
  ),
  responsables as (
    select r.portee, jsonb_object_agg(r.membre, r.n) as comptes
      from (select pp.portee, coalesce(pp.membre, '') as membre, count(*) as n from pp group by 1, 2) r
     group by r.portee
  )
  select dm.portee,
         jsonb_build_object(
           'demandes', dm.demandes,
           'demandes_sans_personne', dm.sans_personne,
           'demandes_archivees', coalesce(ar.n, 0),
           'personnes', coalesce(pe.personnes, 0),
           'etapes', coalesce(et.comptes, '{}'::jsonb),
           'atteintes', coalesce(att.comptes, '{}'::jsonb),
           'qualification', coalesce(ql.comptes, '{}'::jsonb),
           'visites', jsonb_build_object(
             'planifiees', coalesce(vi.planifiees, 0),
             'a_venir', coalesce(vi.a_venir, 0),
             'faites', coalesce(vi.faites, 0),
             'annulees', coalesce(vi.annulees, 0)),
           'offres', jsonb_build_object(
             'personnes', coalesce(pe.offres, 0),
             'montants', coalesce(pe.montants, 0),
             'somme_cents', coalesce(pe.somme_cents, 0)),
           'provenance', coalesce(pv.comptes, '{}'::jsonb),
           'responsables', coalesce(rs.comptes, '{}'::jsonb),
           'pub', jsonb_build_object('pub', dm.pub, 'campagne', dm.campagne, 'aucun', dm.aucun)
         )
    from demandes dm
    left join archivees ar on ar.portee is not distinct from dm.portee
    left join personnes pe on pe.portee is not distinct from dm.portee
    left join etapes et on et.portee is not distinct from dm.portee
    left join atteintes att on att.portee is not distinct from dm.portee
    left join qualifications ql on ql.portee is not distinct from dm.portee
    left join visites vi on vi.portee is not distinct from dm.portee
    left join provenances pv on pv.portee is not distinct from dm.portee
    left join responsables rs on rs.portee is not distinct from dm.portee;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Par pub (ou campagne, ou « non rattachée »), pour chaque bien :
--    demandes, personnes, qualifiées, visites, visites faites, offres.
-- -----------------------------------------------------------------------------
create or replace function public.crm_pilotage_crm_par_pub(p_debut date, p_fin date)
returns table (
  property_id     uuid,
  niveau          text,
  ad_id           text,
  campaign_id     text,
  demandes        integer,
  personnes       integer,
  qualifies       integer,
  visites         integer,
  visites_faites  integer,
  offres          integer
)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
begin
  -- `crm_require_role` n'est pas exécutable par un client : la fonction
  -- s'exécute avec les droits de l'appelant (la RLS s'applique), d'où ce
  -- contrôle explicite, par `crm_has_role`.
  if not public.crm_has_role('administrateur') then
    raise exception 'pilotage réservé aux administrateurs' using errcode = '42501';
  end if;
  return query
  with a as materialized (
    select * from public.crm_pilotage_crm_demandes_resolues(p_debut, p_fin) d where not d.archivee
  ),
  -- Chaque personne, lue UNE fois.
  profils as materialized (
    select bp.id as personne,
           bp.qualification in ('qualifie', 'gros_potentiel') as qualifiee,
           public.crm_etape_v2(bp.pipeline_stage) = 'offre_en_cours' as en_offre
      from public.buyer_profiles bp
     where bp.id in (select x.personne from a x where x.personne is not null)
  ),
  -- Les personnes arrivées un jour à « offre en cours » : aujourd'hui, ou selon le journal.
  offres as (
    select pr.personne from profils pr where pr.en_offre
    union
    select ae.entity_id
      from public.audit_events ae
     where ae.entity_type = 'buyer_profile'
       and ae.event_type in ('acquereur_stade', 'acquereur_traitement')
       and ae.entity_id in (select pr.personne from profils pr)
       and public.crm_etape_v2(ae.new_value ->> 'stage') = 'offre_en_cours'
  ),
  -- Les visites de chaque demande : non annulées, et faites.
  visites as (
    select t.interest_id as demande,
           count(*) filter (where t.status <> 'annule') as visites,
           count(*) filter (where t.status = 'fait') as faites
      from public.tasks t
     where t.kind = 'visite'
       and t.interest_id in (select x.demande from a x)
     group by t.interest_id
  )
  select a.property_id,
         a.niveau,
         a.ad_id,
         a.campaign_id,
         count(*)::integer,
         count(distinct a.personne)::integer,
         count(distinct a.personne) filter (where pr.qualifiee)::integer,
         coalesce(sum(v.visites), 0)::integer,
         coalesce(sum(v.faites), 0)::integer,
         count(distinct a.personne) filter (where o.personne is not null)::integer
    from a
    left join profils pr on pr.personne = a.personne
    left join visites v on v.demande = a.demande
    left join offres o on o.personne = a.personne
   group by a.property_id, a.niveau, a.ad_id, a.campaign_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Depuis quand le CRM reçoit des demandes : par bien, et au total
--    (property_id NULL), le jour de Paris de la PREMIÈRE demande reçue
--    (personnes archivées exclues), toutes périodes confondues.
--    Les coûts et l'écart avec Meta ne comptent la dépense et les leads Meta
--    qu'à partir de ce jour : avant, les demandes n'arrivaient pas dans le CRM.
-- -----------------------------------------------------------------------------
create or replace function public.crm_pilotage_crm_debuts()
returns table (property_id uuid, premier_jour date)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
begin
  -- `crm_require_role` n'est pas exécutable par un client : la fonction
  -- s'exécute avec les droits de l'appelant (la RLS s'applique), d'où ce
  -- contrôle explicite, par `crm_has_role`.
  if not public.crm_has_role('administrateur') then
    raise exception 'pilotage réservé aux administrateurs' using errcode = '42501';
  end if;
  return query
  select bi.property_id, min((bi.created_at at time zone 'Europe/Paris')::date)
    from public.buyer_interests bi
    left join public.buyer_profiles bp on bp.id = bi.buyer_profile_id
   where bp.archive_le is null
   group by grouping sets ((bi.property_id), ());
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. DROITS : administrateur seul (contrôlé dans chaque fonction) ; jamais anon.
-- -----------------------------------------------------------------------------
revoke all on function public.crm_pilotage_crm_demandes_resolues(date, date) from public, anon;
revoke all on function public.crm_pilotage_crm_par_jour(date, date) from public, anon;
revoke all on function public.crm_pilotage_crm_cohorte(date, date) from public, anon;
revoke all on function public.crm_pilotage_crm_par_pub(date, date) from public, anon;
revoke all on function public.crm_pilotage_crm_debuts() from public, anon;

grant execute on function public.crm_pilotage_crm_demandes_resolues(date, date) to authenticated;
grant execute on function public.crm_pilotage_crm_par_jour(date, date) to authenticated;
grant execute on function public.crm_pilotage_crm_cohorte(date, date) to authenticated;
grant execute on function public.crm_pilotage_crm_par_pub(date, date) to authenticated;
grant execute on function public.crm_pilotage_crm_debuts() to authenticated;

commit;
