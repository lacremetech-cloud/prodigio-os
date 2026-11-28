-- =============================================================================
-- CONTRÔLE DES CONVERSIONS META — LECTURE SEULE.
--
-- Une seule requête, qui ne fait que LIRE et COMPTER : semaine par semaine
-- (du lundi au dimanche, à Paris), les FAITS du CRM qui doivent produire une
-- conversion, en face de ce que le journal des envois en a gardé. Aucune
-- ligne d'acquéreur n'en sort : des nombres par semaine et par événement.
--
-- USAGE : mettre dans `p` la période voulue, lancer, et lire par événement :
--  - Lead                 : demandes reçues ↔ journal « Lead » ;
--  - CompleteRegistration : entrées « en discussion » (journal d'audit, de
--                           toute autre étape vers « en discussion ») ↔
--                           journal « CompleteRegistration » ;
--  - Schedule             : entrées « visite planifiée » et visites inscrites
--                           à l'agenda (tâches « visite ») ↔ journal
--                           « Schedule ».
-- Le journal dit pour chaque ligne si la conversion est partie (« envoyee »)
-- ou pourquoi elle n'est pas partie : non_configure, hors_production (un
-- aperçu), deja_envoyee, sans_correspondance (ni e-mail, ni téléphone, ni
-- fbclid), refus (Meta a refusé), erreur.
--
-- À LIRE AVEC SES LIMITES : une entrée « en discussion » d'une personne sans
-- demande ne peut rien envoyer ; une visite inscrite et une entrée en visite
-- le même jour ne font qu'une conversion ; avant la PR « réparer » de
-- l'étape 4, le panneau de traitement n'envoyait rien (docs/27).
-- =============================================================================

with
-- ↓ LA PÉRIODE (jours de Paris).
p (debut, fin) as (values (date '2026-10-01', (now() at time zone 'Europe/Paris')::date)),

faits (semaine, evenement, mesure, valeur) as (
  select date_trunc('week', bi.created_at at time zone 'Europe/Paris')::date, 'Lead', 'CRM · demandes reçues', count(*)
    from public.buyer_interests bi cross join p
   where (bi.created_at at time zone 'Europe/Paris')::date between p.debut and p.fin
   group by 1
  union all
  select date_trunc('week', ae.created_at at time zone 'Europe/Paris')::date, 'CompleteRegistration',
         'CRM · entrées en discussion', count(*)
    from public.audit_events ae cross join p
   where ae.entity_type = 'buyer_profile'
     and public.crm_etape_v2(ae.new_value ->> 'stage') = 'en_discussion'
     and public.crm_etape_v2(ae.old_value ->> 'stage') is distinct from 'en_discussion'
     and (ae.created_at at time zone 'Europe/Paris')::date between p.debut and p.fin
   group by 1
  union all
  select date_trunc('week', ae.created_at at time zone 'Europe/Paris')::date, 'Schedule',
         'CRM · entrées en visite planifiée', count(*)
    from public.audit_events ae cross join p
   where ae.entity_type = 'buyer_profile'
     and public.crm_etape_v2(ae.new_value ->> 'stage') = 'visite_planifiee'
     and public.crm_etape_v2(ae.old_value ->> 'stage') is distinct from 'visite_planifiee'
     and (ae.created_at at time zone 'Europe/Paris')::date between p.debut and p.fin
   group by 1
  union all
  select date_trunc('week', t.created_at at time zone 'Europe/Paris')::date, 'Schedule',
         'CRM · visites inscrites à l''agenda', count(*)
    from public.tasks t cross join p
   where t.kind = 'visite'
     and (t.created_at at time zone 'Europe/Paris')::date between p.debut and p.fin
   group by 1
  union all
  select date_trunc('week', l.created_at at time zone 'Europe/Paris')::date, l.event_name,
         'journal · ' || l.resultat, count(*)
    from public.meta_conversion_log l cross join p
   where l.event_name in ('Lead', 'CompleteRegistration', 'Schedule')
     and (l.created_at at time zone 'Europe/Paris')::date between p.debut and p.fin
   group by 1, 2, l.resultat
)
select f.semaine, f.evenement, f.mesure, f.valeur
  from faits f
 order by f.semaine desc, f.evenement, f.mesure;
