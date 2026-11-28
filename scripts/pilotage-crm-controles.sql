-- =============================================================================
-- CONTRÔLES DES CHIFFRES DU CRM DE LA PAGE PILOTAGE (étape 3b) — LECTURE SEULE.
--
-- Une seule requête, qui ne fait que LIRE et COMPTER : elle recalcule chaque
-- chiffre du CRM de la page directement sur les tables, sans passer par les
-- fonctions `crm_pilotage_crm_*` de la page. Aucune ligne d'acquéreur n'en
-- sort : ni nom, ni téléphone, ni e-mail, ni adresse — des nombres par bien.
--
-- USAGE
--  1. Sur la page, choisir « Dates au choix » (du … au …), ou noter les
--     bornes de la période proposée (« toute la période » : du 1970-01-01 à
--     aujourd'hui ; « 30 derniers jours » : de J-30 à hier, etc.).
--  2. Mettre les deux mêmes dates dans `p`, ci-dessous (jours de Paris).
--  3. Lancer, puis comparer bloc par bloc (docs/33 § 9.4). Le résultat a une
--     ligne par bloc, bien et mesure ; « TOTAL » compte les personnes
--     DISTINCTES (une personne qui a demandé deux biens compte dans chacun,
--     une fois au total). Une mesure absente vaut 0.
--
-- LES DÉFINITIONS (les mêmes qu'à l'écran)
--  - une DEMANDE compte le jour de son arrivée (`buyer_interests.created_at`,
--    jour de Paris) ; les demandes d'une personne ARCHIVÉE sont écartées
--    (comptées à part, bloc 01) ;
--  - l'étape et la qualification sont celles de la PERSONNE, aujourd'hui
--    (`buyer_profiles.pipeline_stage`, `.qualification`), anciennes clés
--    d'étape traduites par `crm_etape_v2` ;
--  - une étape ATTEINTE : l'actuelle, ou toute étape portée par un événement
--    de la personne au journal (`audit_events`, entity_type 'buyer_profile',
--    clé `stage` de `new_value` ou de `old_value`, quel que soit le type), et
--    « à contacter » pour toute personne arrivée ;
--  - une VISITE : une tâche `kind = 'visite'` rattachée à une demande comptée
--    (`tasks.interest_id`) ; « à faire » = statut 'a_faire', « à venir » =
--    à faire et prévue à partir de maintenant, « faite » = 'fait' ;
--  - une OFFRE : une personne qui a atteint « offre en cours » ; les montants
--    saisis (`buyer_profiles.offer_amount_cents`) comptent pour le bien de
--    l'offre (`offer_property_id`) ;
--  - la PUB d'une demande : le premier identifiant CONNU de la lecture Meta
--    parmi `meta_ad_id`, `utm_content` (colonne, adresse du formulaire,
--    première visite) et `utm_id` (adresse, première visite) ; sinon le nom
--    exact d'une pub, s'il n'est porté que par une seule ; sinon la première
--    campagne connue parmi `utm_campaign` (colonne, adresses) et `utm_id` ;
--    sinon « non rattachée » ;
--  - le RESPONSABLE : l'affectation active de la personne
--    (`buyer_assignments`, `released_at` vide) — pas l'équipe du bien.
-- =============================================================================

with
-- ↓ LA PÉRIODE DE LA PAGE : du … au … (jours de Paris). Ici, « toute la période ».
p (debut, fin) as (values (date '1970-01-01', (now() at time zone 'Europe/Paris')::date)),

demandes as (
  select bi.id,
         bi.property_id,
         bi.buyer_profile_id as personne,
         (bi.created_at at time zone 'Europe/Paris')::date as jour,
         coalesce(bp.archive_le is not null, false) as archivee,
         lower(nullif(btrim(bi.utm_source), '')) as source,
         bi.meta_ad_id,
         btrim(bi.utm_content) as utm_content,
         btrim(bi.utm_campaign) as utm_campaign,
         bi.origin_url as adresse,
         case when jsonb_typeof(bi.first_touch) = 'object' then bi.first_touch ->> 'url' end as premiere
    from public.buyer_interests bi
    left join public.buyer_profiles bp on bp.id = bi.buyer_profile_id
   cross join p
   where (bi.created_at at time zone 'Europe/Paris')::date between p.debut and p.fin
),
actives as (select * from demandes where not archivee),

-- Les personnes de chaque portée : chaque bien demandé, et le total (NULL).
pers as (
  select distinct a.property_id as portee, a.personne from actives a where a.personne is not null
  union
  select distinct null::uuid, a.personne from actives a where a.personne is not null
),
profil as (
  select x.portee, x.personne, public.crm_etape_v2(bp.pipeline_stage) as etape, bp.qualification,
         bp.offer_amount_cents, bp.offer_property_id
    from pers x
    join public.buyer_profiles bp on bp.id = x.personne
),
atteinte as (
  select x.portee, x.personne, x.etape from profil x
  union
  select x.portee, x.personne, public.crm_etape_v2(s.etape)
    from pers x
    join public.audit_events ae
      on ae.entity_type = 'buyer_profile' and ae.entity_id = x.personne
   cross join lateral (values (ae.new_value ->> 'stage'), (ae.old_value ->> 'stage')) as s(etape)
   where s.etape is not null
  union
  select x.portee, x.personne, 'a_contacter' from pers x
),

-- La pub de chaque demande (voir les définitions).
pubs_connues as (
  select ad_id from public.pilotage_meta_pubs
  union
  select ad_id from public.pilotage_meta_insights
),
campagnes_connues as (
  select campaign_id from public.pilotage_meta_pubs where campaign_id is not null
  union
  select campaign_id from public.pilotage_meta_insights where campaign_id is not null
),
noms_uniques as (
  select lower(btrim(ad_name)) as nom, min(ad_id) as ad_id
    from public.pilotage_meta_pubs
   where ad_name is not null
   group by 1
  having count(*) = 1
),
rattachees as (
  select a.*,
         coalesce(
           (select c.v
              from (values (1, a.meta_ad_id),
                           (2, a.utm_content),
                           (3, substring(a.adresse from '[?&]utm_content=([^&#]*)')),
                           (4, substring(a.premiere from '[?&]utm_content=([^&#]*)')),
                           (5, substring(a.adresse from '[?&]utm_id=([^&#]*)')),
                           (6, substring(a.premiere from '[?&]utm_id=([^&#]*)'))) as c(rang, v)
             where c.v in (select ad_id from pubs_connues)
             order by c.rang limit 1),
           (select n.ad_id from noms_uniques n where n.nom = lower(a.utm_content))) as pub,
         (select c.v
            from (values (1, a.utm_campaign),
                         (2, substring(a.adresse from '[?&]utm_campaign=([^&#]*)')),
                         (3, substring(a.premiere from '[?&]utm_campaign=([^&#]*)')),
                         (4, substring(a.adresse from '[?&]utm_id=([^&#]*)')),
                         (5, substring(a.premiere from '[?&]utm_id=([^&#]*)'))) as c(rang, v)
           where c.v in (select campaign_id from campagnes_connues)
           order by c.rang limit 1) as campagne
    from actives a
),
par_pub as (
  select r.*,
         case when r.pub is not null then 'pub ' || r.pub
              when r.campagne is not null then 'campagne ' || r.campagne
              else 'non rattachée' end as ligne
    from rattachees r
),
visites as (
  select a.property_id, a.personne, t.status, t.due_at, a.id as demande
    from public.tasks t
    join actives a on a.id = t.interest_id
   where t.kind = 'visite'
),

resultats (bloc, portee, mesure, valeur) as (
  -- 01 · Demandes reçues (tuile) : des DEMANDES ; archivées écartées à part.
  select '01 demandes', a.property_id, 'demandes', count(*)::numeric
    from actives a group by grouping sets ((a.property_id), ())
  union all
  select '01 demandes', a.property_id, 'demandes sans personne', count(*)
    from actives a where a.personne is null group by grouping sets ((a.property_id), ())
  union all
  select '01 demandes', d.property_id, 'demandes archivées écartées', count(*)
    from demandes d where d.archivee group by grouping sets ((d.property_id), ())
  union all
  -- 02 · … et leurs PERSONNES (distinctes au total).
  select '02 personnes', x.portee, 'personnes', count(*) from pers x group by x.portee
  union all
  -- 03 · Graphique « Demandes reçues » : par bien et par jour d'arrivée.
  select '03 par jour', a.property_id, a.jour::text, count(*) from actives a group by a.property_id, a.jour
  union all
  -- 04 · Qualification (personnes, aujourd'hui) ; la tuile « Personnes
  --      qualifiées » = qualifie + gros_potentiel.
  select '04 qualification', x.portee, x.qualification, count(*) from profil x group by x.portee, x.qualification
  union all
  -- 05 · Étapes, aujourd'hui (personnes).
  select '05 étape aujourd''hui', x.portee, x.etape, count(*) from profil x group by x.portee, x.etape
  union all
  -- 06 · Étapes atteintes au moins une fois (personnes). Part = atteinte ÷
  --      personnes (bloc 02) ; passage = atteinte de l'étape d'arrivée ÷
  --      atteinte de l'étape de départ.
  select '06 étape atteinte', x.portee, x.etape, count(distinct x.personne) from atteinte x where x.etape is not null group by x.portee, x.etape
  union all
  -- 07 · Visites : à faire, dont à venir, faites, annulées. La tuile
  --      « Visites » = à faire + faites.
  select '07 visites', v.property_id, 'à faire', count(*) filter (where v.status = 'a_faire')
    from visites v group by grouping sets ((v.property_id), ())
  union all
  select '07 visites', v.property_id, 'à venir', count(*) filter (where v.status = 'a_faire' and v.due_at >= now())
    from visites v group by grouping sets ((v.property_id), ())
  union all
  select '07 visites', v.property_id, 'faites', count(*) filter (where v.status = 'fait')
    from visites v group by grouping sets ((v.property_id), ())
  union all
  select '07 visites', v.property_id, 'annulées', count(*) filter (where v.status = 'annule')
    from visites v group by grouping sets ((v.property_id), ())
  union all
  -- 08 · Offres : personnes passées par « offre en cours » ; montants saisis
  --      pour ce bien (nombre, somme en centimes).
  select '08 offres', x.portee, 'personnes passées par offre en cours', count(distinct x.personne)
    from atteinte x where x.etape = 'offre_en_cours' group by x.portee
  union all
  select '08 offres', x.portee, 'montants saisis', count(*)
    from profil x where x.offer_amount_cents is not null and (x.portee is null or x.offer_property_id = x.portee) group by x.portee
  union all
  select '08 offres', x.portee, 'somme des montants (centimes)', sum(x.offer_amount_cents)
    from profil x where x.offer_amount_cents is not null and (x.portee is null or x.offer_property_id = x.portee) group by x.portee
  union all
  -- 09 · Provenance (demandes) : `utm_source` tel quel (la page regroupe
  --      fb/facebook, ig/instagram ; vide = « non renseignée »).
  select '09 provenance', a.property_id, coalesce(a.source, '(vide)'), count(*)
    from actives a group by grouping sets ((a.property_id, coalesce(a.source, '(vide)')), (coalesce(a.source, '(vide)')))
  union all
  -- 10 · Responsable du dossier (personnes) : identifiant du membre de
  --      l'équipe (le premier, s'il y en a plusieurs), ou aucun.
  select '10 responsable', y.portee, y.membre, count(*)
    from (select x.portee,
                 coalesce((select min(ba.user_id::text) from public.buyer_assignments ba
                            where ba.buyer_profile_id = x.personne and ba.released_at is null), '(aucun)') as membre
            from pers x) y
   group by y.portee, y.membre
  union all
  -- 11 · Meta et CRM : demandes reliées à une pub ; à campagne seulement ;
  --      non rattachées.
  select '11 rattachement', y.property_id, y.niveau, count(*)
    from (select r.property_id,
                 case when r.pub is not null then 'pub' when r.campagne is not null then 'campagne seulement'
                      else 'non rattachée' end as niveau
            from rattachees r) y
   group by grouping sets ((y.property_id, y.niveau), (y.niveau))
  union all
  -- 12 · Pub par pub (onglet d'un bien) : demandes, personnes, qualifiées,
  --      visites (à faire + faites), dont faites, offres.
  select '12 pub par pub', q.property_id, q.ligne || ' · demandes', count(*) from par_pub q group by 2, 3
  union all
  select '12 pub par pub', q.property_id, q.ligne || ' · personnes', count(distinct q.personne) from par_pub q group by 2, 3
  union all
  select '12 pub par pub', q.property_id, q.ligne || ' · qualifiées',
         count(distinct q.personne) filter (where bp.qualification in ('qualifie', 'gros_potentiel'))
    from par_pub q left join public.buyer_profiles bp on bp.id = q.personne group by 2, 3
  union all
  select '12 pub par pub', q.property_id, q.ligne || ' · visites',
         count(v.demande) filter (where v.status <> 'annule')
    from par_pub q left join visites v on v.demande = q.id group by 2, 3
  union all
  select '12 pub par pub', q.property_id, q.ligne || ' · dont faites',
         count(v.demande) filter (where v.status = 'fait')
    from par_pub q left join visites v on v.demande = q.id group by 2, 3
  union all
  select '12 pub par pub', q.property_id, q.ligne || ' · offres',
         count(distinct q.personne) filter (where exists (
           select 1 from atteinte x where x.personne = q.personne and x.etape = 'offre_en_cours'))
    from par_pub q group by 2, 3
  union all
  -- 13 · Mêmes jours : le jour de la première demande reçue (toutes périodes,
  --      personnes archivées exclues). Les coûts et les leads Meta de la page
  --      comptent à partir de ce jour, s'il est plus tardif que le début de
  --      la période (bloc « Mêmes jours » à l'écran).
  select '13 premier jour du CRM', bi.property_id, min((bi.created_at at time zone 'Europe/Paris')::date)::text, 1
    from public.buyer_interests bi
    left join public.buyer_profiles bp on bp.id = bi.buyer_profile_id
   where bp.archive_le is null
   group by grouping sets ((bi.property_id), ())
)
select r.bloc,
       case when r.portee is null then 'TOTAL' else coalesce(nullif(btrim(pr.project_name), ''), nullif(btrim(pr.commercial_title), ''), r.portee::text) end as bien,
       r.mesure,
       r.valeur
  from resultats r
  left join public.properties pr on pr.id = r.portee
 where r.valeur <> 0 and r.mesure is not null
 order by r.bloc, r.portee is null, bien, r.mesure;
