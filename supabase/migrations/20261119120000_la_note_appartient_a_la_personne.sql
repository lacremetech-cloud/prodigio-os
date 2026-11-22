-- ---------------------------------------------------------------------
-- LA NOTE APPARTIENT À LA PERSONNE, PAS À L'UN DE SES PROJETS
-- ---------------------------------------------------------------------
--
-- Le 19 novembre, une seule carte du pipeline affichait une note. Pas un
-- défaut d'affichage : la vue qui alimente les cartes,
-- `crm_buyer_interest_activity`, groupe par MANIFESTATION D'INTÉRÊT et écarte
-- d'emblée toute activité sans `interest_id`.
--
-- Ce que la base disait ce jour-là :
--
--   activités portant une note : 280, dont 269 sans interest_id
--   appels                     : 103, dont  92 sans interest_id
--   personnes ayant une note   : 122
--   manifestations en ayant une:   8
--
-- La vue de 2026-10-13 annonçait cette limite comme un reliquat d'historique
-- (« les activités antérieures n'ont pas de interest_id »). Un mois plus tard,
-- c'est la règle : les écrans de saisie consignent l'échange sur la PERSONNE.
-- Le vivier, celui qu'un commercial dépouille en cherchant quoi proposer à
-- qui, était donc intégralement muet.
--
-- On ne rattache rien après coup — inventer un projet pour un appel passé
-- avant qu'il existe serait pire que le silence. On agrège à l'étage où la
-- donnée se trouve réellement : la personne. C'est déjà là que vivent l'étape
-- et la qualification depuis la reprise du 14/10.
--
-- Conséquence assumée : quelqu'un qui suit deux biens voit la même dernière
-- note sur ses deux cartes. C'est exact — la note est la sienne, et non celle
-- d'un bien. Mieux vaut la lire deux fois que pas du tout.
--
-- `security_invoker` : lue avec les droits de l'appelant, la RLS des activités
-- s'applique comme partout ailleurs.
create or replace view public.crm_buyer_profile_activity
with (security_invoker = true) as
select
  a.buyer_profile_id,
  count(*) filter (where a.type in ('appel', 'tentative_appel')) as call_attempts,
  max(a.occurred_at) filter (where a.type in ('appel', 'tentative_appel')) as last_call_at,
  max(a.occurred_at) as last_activity_at,
  (array_agg(a.outcome order by a.occurred_at desc)
     filter (where a.type in ('appel','tentative_appel') and a.outcome is not null))[1] as last_call_outcome,
  (array_agg(a.body order by a.occurred_at desc)
     filter (where a.body is not null and btrim(a.body) <> ''))[1] as last_note,
  (array_agg(a.occurred_at order by a.occurred_at desc)
     filter (where a.body is not null and btrim(a.body) <> ''))[1] as last_note_at,
  (array_agg(a.author_user_id order by a.occurred_at desc)
     filter (where a.body is not null and btrim(a.body) <> ''))[1] as last_note_by
from public.activities a
where a.buyer_profile_id is not null
group by a.buyer_profile_id;

revoke all on public.crm_buyer_profile_activity from public;
revoke all on public.crm_buyer_profile_activity from anon;
grant select on public.crm_buyer_profile_activity to authenticated;
