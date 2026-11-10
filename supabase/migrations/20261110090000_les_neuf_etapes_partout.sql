-- Les neuf étapes, dans TOUTES les portes d'écriture.
--
-- Hier j'ai ajouté « R1 planifié » et « Offre en cours » : la contrainte de
-- `buyer_profiles` et `crm_buyer_set_stage` les acceptent. J'ai vérifié cette
-- porte-là, et j'en ai conclu que le travail était fait.
--
-- Il y en a quatre autres. Trois portaient encore la liste de sept :
--
--   • crm_buyer_enregistrer        — le panneau « Enregistrer et suivant »
--   • crm_buyer_record_treatment   — l'ancien chemin de traitement
--   • crm_buyer_set_interest_stage — le déplacement depuis une manifestation
--
-- Résultat observé en production : le glisser-déposer du Kanban fonctionnait
-- (il passe par `crm_buyer_set_stage`), mais passer un dossier de « En
-- discussion » à « R1 planifié » depuis le panneau échouait sur « etape
-- inconnue ». Deux chemins, une seule liste à jour.
--
-- `crm_etape_v2` n'est PAS concernée : elle traduit l'ancien vocabulaire vers
-- le nouveau et laisse passer tout le reste (`else p`). Les deux nouvelles
-- valeurs la traversent déjà sans rien changer.
--
-- La réécriture est faite depuis `pg_get_functiondef`, en ne remplaçant que la
-- liste : retranscrire trois fonctions longues à la main, c'est trois
-- occasions d'introduire une faute ailleurs. `create or replace` conserve les
-- droits — un `drop` emporterait `service_role` avec lui.
--
-- Le garde-fou final fait échouer la migration si le compte ne tombe pas sur
-- trois : mieux vaut ne rien appliquer que d'en corriger deux et le croire.

do $migration$
declare
  r record;
  v_def text;
  v_faites int := 0;
begin
  for r in
    select p.oid, p.proname, pg_get_functiondef(p.oid) as def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosrc ~ $re$'a_contacter'\s*,\s*'a_rappeler'\s*,\s*'en_discussion'\s*,\s*'visite_planifiee'\s*,\s*'vivier'\s*,\s*'pas_interesse'\s*,\s*'mauvais_numero'$re$
  loop
    v_def := regexp_replace(
      r.def,
      $re$'a_contacter'\s*,\s*'a_rappeler'\s*,\s*'en_discussion'\s*,\s*'visite_planifiee'\s*,\s*'vivier'\s*,\s*'pas_interesse'\s*,\s*'mauvais_numero'$re$,
      $new$'a_contacter','a_rappeler','r1_planifie','en_discussion','visite_planifiee','offre_en_cours','pas_interesse','vivier','mauvais_numero'$new$,
      'g');
    execute v_def;
    v_faites := v_faites + 1;
    raise notice 'etapes elargies : %', r.proname;
  end loop;

  if v_faites <> 3 then
    raise exception
      'attendu 3 fonctions a elargir, % trouvee(s) — migration annulee', v_faites;
  end if;
end
$migration$;
