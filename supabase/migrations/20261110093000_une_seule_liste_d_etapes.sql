-- Une seule liste d'étapes, et quatre fonctions qui la lisent.
--
-- POURQUOI CETTE MIGRATION EXISTE : la liste des étapes valides était recopiée
-- dans quatre fonctions. En ajoutant « R1 planifié » et « Offre en cours », je
-- n'en ai mis à jour qu'une — celle que j'ai ensuite testée, ce qui m'a donné
-- une confirmation parfaitement trompeuse. Le glisser-déposer marchait, le
-- panneau « Enregistrer et suivant » refusait la même étape avec « etape
-- inconnue ». L'utilisateur l'a découvert à ma place.
--
-- Quatre copies d'une même vérité, c'est trois occasions de l'oublier. La
-- liste vit désormais dans `crm_etapes_acquereur()`, et les fonctions
-- l'interrogent au lieu de la réciter.
--
-- La contrainte de `buyer_profiles` garde sa liste en clair : une contrainte
-- doit rester lisible dans un dump et ne pas dépendre d'une fonction pour être
-- restaurée. Elle reste donc le second endroit — mais deux valent mieux que
-- cinq, et le test d'intégrité ci-dessous vérifie qu'elles s'accordent.

create or replace function public.crm_etapes_acquereur()
returns text[]
language sql
immutable
set search_path to 'public', 'pg_temp'
as $function$
  -- L'ORDRE EST CELUI DES COLONNES, lu de gauche à droite par le commercial.
  select array[
    'a_contacter',
    'a_rappeler',
    'r1_planifie',
    'en_discussion',
    'visite_planifiee',
    'offre_en_cours',
    'pas_interesse',
    'vivier',
    'mauvais_numero'
  ];
$function$;

comment on function public.crm_etapes_acquereur() is
  'Les étapes valides du pipeline acquéreur, dans l''ordre des colonnes. '
  'Seule source de vérité pour les fonctions d''écriture : ne pas recopier '
  'cette liste ailleurs, c''est précisément ce qui a produit le défaut du '
  '10/11/2026.';

grant execute on function public.crm_etapes_acquereur() to authenticated, service_role;

-- Les quatre fonctions d'écriture interrogent la liste au lieu de la réciter.
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
      and p.prosrc ~ $re$v_stage not in \(\s*'a_contacter'$re$
  loop
    v_def := regexp_replace(
      r.def,
      $re$v_stage not in \(\s*'a_contacter'\s*,\s*'a_rappeler'\s*,\s*'r1_planifie'\s*,\s*'en_discussion'\s*,\s*'visite_planifiee'\s*,\s*'offre_en_cours'\s*,\s*'pas_interesse'\s*,\s*'vivier'\s*,\s*'mauvais_numero'\s*\)$re$,
      $new$not (v_stage = any (public.crm_etapes_acquereur()))$new$,
      'g');
    execute v_def;
    v_faites := v_faites + 1;
    raise notice 'branchee sur la liste unique : %', r.proname;
  end loop;

  if v_faites <> 4 then
    raise exception
      'attendu 4 fonctions a brancher, % trouvee(s) — migration annulee', v_faites;
  end if;
end
$migration$;

-- Intégrité : la contrainte et la fonction doivent dire la même chose.
do $controle$
declare
  v_manquantes text[];
begin
  select array_agg(e) into v_manquantes
  from unnest(public.crm_etapes_acquereur()) as e
  where not exists (
    select 1 from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'buyer_profiles'
      and con.conname = 'buyer_profiles_pipeline_stage_check'
      and pg_get_constraintdef(con.oid) like '%''' || e || '''%'
  );

  if v_manquantes is not null then
    raise exception
      'la contrainte de buyer_profiles ignore ces etapes : %', v_manquantes;
  end if;
end
$controle$;
