-- =============================================================================
-- Pilotage pub — étape 3b, suite : le taux de passage sur les MÊMES personnes.
--
-- Relevé à la recette du 28/11/2026 (docs/05, n° 45). Le taux de passage
-- « A → B » divisait les personnes ayant atteint B par celles ayant atteint A :
-- deux groupes différents. Une personne arrivée en visite sans passer par
-- « dossier envoyé » le faussait, et il pouvait dépasser 100 %.
--
-- La cohorte rend désormais, par bien et au total, les personnes passées par
-- les DEUX étapes de chaque passage suivi :
--   « dossier envoyé » (en_discussion) → « visite planifiée »,
--   « visite planifiée » → « offre en cours ».
-- Taux = passées par les deux ÷ passées par l'étape de départ. « Passée par »
-- suit la définition de l'étape atteinte (docs/33 § 9.2) : l'étape actuelle ou
-- toute étape portée par un événement de la personne au journal.
--
-- STRICTEMENT LIMITÉE : `crm_pilotage_crm_cohorte` remplacée (même signature,
-- même SECURITY INVOKER, même contrôle du rôle administrateur), avec une clé
-- de plus (`passages`) ; tout le reste est inchangé. Aucune table, aucune
-- colonne, aucune donnée touchée ; aucune écriture.
-- =============================================================================

begin;

set local lock_timeout = '2s';

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
           -- Toute étape portée par un événement de la personne : celle d'où
           -- elle part (old_value) comme celle où elle arrive (new_value),
           -- quel que soit le type d'événement.
           array(select public.crm_etape_v2(s.etape)
                   from public.audit_events ae
                  cross join lateral (values (ae.new_value ->> 'stage'), (ae.old_value ->> 'stage')) as s(etape)
                  where ae.entity_type = 'buyer_profile'
                    and ae.entity_id = pb.personne
                    and s.etape is not null) as journal,
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
           -- Les passages, sur les MÊMES personnes : passées par l'étape de
           -- départ ET par l'étape d'arrivée.
           count(*) filter (where 'en_discussion' = any (pp.journal || pp.etape)
                              and 'visite_planifiee' = any (pp.journal || pp.etape)) as dossier_visite,
           count(*) filter (where 'visite_planifiee' = any (pp.journal || pp.etape)
                              and 'offre_en_cours' = any (pp.journal || pp.etape)) as visite_offre,
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
           'pub', jsonb_build_object('pub', dm.pub, 'campagne', dm.campagne, 'aucun', dm.aucun),
           'passages', jsonb_build_object(
             'en_discussion>visite_planifiee', coalesce(pe.dossier_visite, 0),
             'visite_planifiee>offre_en_cours', coalesce(pe.visite_offre, 0))
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

-- DROITS : ceux de la migration 20261123170000, rappelés (administrateur seul,
-- contrôlé dans la fonction ; jamais anon).
revoke all on function public.crm_pilotage_crm_cohorte(date, date) from public, anon;
grant execute on function public.crm_pilotage_crm_cohorte(date, date) to authenticated;

commit;
