-- TROIS CHOIX DANS LE FORMULAIRE, ET UNE NOUVELLE VALEUR : « plus_1m ».
--
-- Cinq tranches, c'etait cinq decisions a prendre debout dans la rue, sur un
-- telephone, avant meme d'avoir vu le bien. Trois suffisent a trier : pas de
-- projet, le bas de la fourchette, le reste. Le commercial affine ensuite, au
-- telephone, ou la question se pose mieux.
--
-- Les tranches 1–2 M, 2–3 M et plus de 3 M ne sont plus PROPOSEES, mais elles
-- restent ACCEPTEES : cinq dossiers portent deja « 1m_2m », et une contrainte
-- qui refuse l'historique casse toute ecriture sur ces lignes.
--
-- Verifie AVANT d'ecrire cette migration : la colonne n'a aucune valeur par
-- defaut et accepte NULL, donc elargir la contrainte ne peut rien rejeter.
-- C'est l'oubli exact qui a coute 65 depots le 14 octobre.

alter table public.buyer_interests
  drop constraint if exists buyer_interests_budget_choice_check;

alter table public.buyer_interests
  add constraint buyer_interests_budget_choice_check
  check (budget_choice is null or budget_choice in (
    'aucun_projet', '500k_1m', 'plus_1m',      -- proposes aujourd'hui
    '1m_2m', '2m_3m', 'plus_3m'                -- conserves pour l'historique
  ));

create or replace function public.buyer_choice_bounds(p_budget_choice text)
returns jsonb
language sql
immutable
set search_path to 'pg_catalog', 'pg_temp'
as $function$
  select jsonb_build_object(
    'min', case p_budget_choice
      when '500k_1m' then 50000000 when 'plus_1m' then 100000000
      when '1m_2m' then 100000000
      when '2m_3m' then 200000000 when 'plus_3m' then 300000000 else null end,
    'max', case p_budget_choice
      when '500k_1m' then 100000000 when 'plus_1m' then null
      when '1m_2m' then 200000000
      when '2m_3m' then 300000000 when 'plus_3m' then null else null end
  );
$function$;

-- `submit_buyer_interest` valide `budget_choice` contre une liste ecrite en
-- dur, et met NULL pour toute valeur absente — SANS erreur. Un depot avec
-- « plus_1m » serait donc enregistre sans budget, en silence : la pire des
-- pannes, celle qui ne se voit pas.
--
-- On reecrit la fonction a partir de sa propre definition, en ne changeant que
-- cette liste : aucune recopie manuelle de ses deux cents lignes. Le bloc LEVE
-- si le motif n'est pas trouve, pour qu'un echec ne passe jamais pour un
-- succes.
do $$
declare
  d text;
  avant constant text := '''aucun_projet'',''500k_1m'',''1m_2m'',''2m_3m'',''plus_3m''';
  apres constant text := '''aucun_projet'',''500k_1m'',''plus_1m'',''1m_2m'',''2m_3m'',''plus_3m''';
begin
  select pg_get_functiondef(p.oid) into d
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'submit_buyer_interest';

  if d is null then
    raise exception 'submit_buyer_interest introuvable';
  end if;
  if position(avant in d) = 0 then
    if position(apres in d) > 0 then
      return;  -- deja applique
    end if;
    raise exception 'la liste des budgets a change : correction a revoir a la main';
  end if;

  d := replace(d, avant, apres);
  execute d;
end $$;
