-- =============================================================================
-- CONTRÔLES DU « BUDGET DÉCLARÉ » DE LA PAGE PILOTAGE — LECTURE SEULE.
--
-- Une seule requête, qui ne fait que LIRE et COMPTER : elle recalcule, sur les
-- tables, les nombres de la section « Le budget déclaré » de l'onglet d'un
-- bien, sans passer par la fonction `crm_pilotage_crm_budget` de la page.
-- Aucune ligne d'acquéreur n'en sort : des nombres par bien, par pub et par
-- réponse de budget.
--
-- USAGE
--  1. Sur la page, noter les bornes de la période (comme pour
--     `scripts/pilotage-crm-controles.sql`), et les mettre dans `p`.
--  2. Lancer, puis comparer (docs/33 § 10.4) :
--     - bloc 15 : par bien, et « TOTAL » (personnes distinctes), le tableau
--       « par réponse » : demandes, personnes, qualifiées ;
--     - bloc 16 : le tableau « pub par pub » : demandes par réponse. La page
--       en tire « ont répondu » (tout sauf « sans réponse ») et « dans la
--       cible » (les réponses dont le bas atteint la cible du bien).
--     Les réponses sont écrites par leur clé : aucun_projet (« Pas de
--     projet »), 500k_1m, plus_1m, 1m_2m, 2m_3m, plus_3m ; une mesure absente
--     vaut 0.
--
-- LES DÉFINITIONS (les mêmes qu'à l'écran)
--  - les demandes de la période : jour d'arrivée à Paris, personnes archivées
--    écartées ; la pub d'une demande se décide comme dans
--    `scripts/pilotage-crm-controles.sql` (copie de ses lignes, à garder
--    identique) ;
--  - la réponse RETENUE d'une demande : le budget corrigé par l'équipe sur la
--    personne (`buyer_profiles.budget_choice_corrige`), sinon la réponse
--    déclarée (`buyer_interests.budget_choice`) ;
--  - la réponse d'une PERSONNE, dans chaque bien, chaque pub et au total : sa
--    correction, sinon la réponse de sa demande la plus récente qui en porte
--    une ; elle y compte une fois ;
--  - qualifiée : « qualifié » ou « gros potentiel », aujourd'hui.
-- =============================================================================

with
-- ↓ LA PÉRIODE DE LA PAGE : du … au … (jours de Paris). Ici, « toute la période ».
p (debut, fin) as (values (date '1970-01-01', (now() at time zone 'Europe/Paris')::date)),

demandes as (
  select bi.id,
         bi.property_id,
         bi.buyer_profile_id as personne,
         bi.created_at,
         coalesce(bp.archive_le is not null, false) as archivee,
         bi.budget_choice as declaree,
         bp.budget_choice_corrige as corrige,
         coalesce(bp.qualification in ('qualifie', 'gros_potentiel'), false) as qualifiee,
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

-- La pub de chaque demande : copie de `scripts/pilotage-crm-controles.sql`.
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

-- Chaque demande, dans le bien, dans sa pub et au total, avec sa réponse retenue.
g as (
  select x.regroupement, x.portee, x.ligne,
         r.id, r.personne, r.created_at, r.declaree, r.corrige, r.qualifiee,
         coalesce(r.corrige, r.declaree) as retenue
    from rattachees r
   cross join lateral (values
     ('bien'::text, r.property_id, ''::text),
     ('pub'::text, r.property_id,
      case when r.pub is not null then 'pub ' || r.pub
           when r.campagne is not null then 'campagne ' || r.campagne
           else 'non rattachée' end),
     ('total'::text, null::uuid, ''::text)
   ) as x(regroupement, portee, ligne)
),

-- La réponse de chaque personne, dans chaque regroupement : sa correction,
-- sinon celle de sa demande la plus récente qui en porte une.
personnes as (
  select distinct on (g.regroupement, g.portee, g.ligne, g.personne)
         g.regroupement, g.portee, g.ligne, g.personne, g.qualifiee,
         coalesce(g.corrige, g.declaree) as reponse
    from g
   where g.personne is not null
   order by g.regroupement, g.portee, g.ligne, g.personne, g.declaree is null, g.created_at desc, g.id desc
),

resultats (bloc, portee, mesure, valeur) as (
  -- 15 · Par réponse, pour chaque bien et au total (personnes distinctes).
  select '15 budget par réponse', g.portee, coalesce(g.retenue, '(sans réponse)') || ' · demandes', count(*)::numeric
    from g where g.regroupement in ('bien', 'total') group by g.regroupement, g.portee, g.retenue
  union all
  select '15 budget par réponse', x.portee, coalesce(x.reponse, '(sans réponse)') || ' · personnes', count(*)
    from personnes x where x.regroupement in ('bien', 'total') group by x.regroupement, x.portee, x.reponse
  union all
  select '15 budget par réponse', x.portee, coalesce(x.reponse, '(sans réponse)') || ' · qualifiées',
         count(*) filter (where x.qualifiee)
    from personnes x where x.regroupement in ('bien', 'total') group by x.regroupement, x.portee, x.reponse
  union all
  -- 16 · Pub par pub (onglet d'un bien) : par réponse.
  select '16 budget par pub', g.portee, g.ligne || ' · ' || coalesce(g.retenue, '(sans réponse)') || ' · demandes', count(*)
    from g where g.regroupement = 'pub' group by g.portee, g.ligne, g.retenue
  union all
  select '16 budget par pub', x.portee, x.ligne || ' · ' || coalesce(x.reponse, '(sans réponse)') || ' · personnes', count(*)
    from personnes x where x.regroupement = 'pub' group by x.portee, x.ligne, x.reponse
  union all
  select '16 budget par pub', x.portee, x.ligne || ' · ' || coalesce(x.reponse, '(sans réponse)') || ' · qualifiées',
         count(*) filter (where x.qualifiee)
    from personnes x where x.regroupement = 'pub' group by x.portee, x.ligne, x.reponse
)
select r.bloc,
       case when r.portee is null then 'TOTAL' else coalesce(nullif(btrim(pr.project_name), ''), nullif(btrim(pr.commercial_title), ''), r.portee::text) end as bien,
       r.mesure,
       r.valeur
  from resultats r
  left join public.properties pr on pr.id = r.portee
 where r.valeur <> 0
 order by r.bloc, r.portee is null, bien, r.mesure;
