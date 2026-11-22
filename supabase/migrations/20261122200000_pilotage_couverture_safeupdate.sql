-- =============================================================================
-- Pilotage pub — correctif de l'étape 2 : la couverture s'écrit aussi en production.
--
-- LE BUG (lecture Meta du 22/11/2026, « Échec » à la fin) : en production,
-- Supabase charge l'extension `safeupdate` pour toute requête passée par l'API
-- (`session_preload_libraries` du rôle `authenticator`). Elle refuse un DELETE
-- ou un UPDATE sans WHERE — y compris à l'intérieur d'une fonction SECURITY
-- DEFINER. Or `crm_pilotage_meta_remplacer_couverture` vidait la table de
-- couverture par un `delete` sans WHERE : la lecture s'arrêtait là, après avoir
-- bien enregistré statistiques, contrôle et pubs. Une base PostgreSQL locale ne
-- charge pas safeupdate : la recette ne pouvait pas le voir.
--
-- LE CORRECTIF : la même fonction, à un mot près — `where true`, qui dit qu'on
-- remplace TOUTE la couverture exprès (c'est son rôle : une portée qui n'a plus
-- de pub doit disparaître) et que safeupdate accepte. Rien d'autre ne change :
-- mêmes arguments, même sécurité, mêmes droits (rôle de service seul).
--
-- STRICTEMENT SANS RISQUE : aucune table, aucune colonne, aucune donnée
-- touchée ; `create or replace` garde le propriétaire et les droits, rappelés
-- ci-dessous pour que le fichier se suffise. Rejouable.
--
-- Garde-fou : `src/modules/crm/sans-where.test.ts` relit toutes les fonctions
-- des migrations et refuse désormais tout DELETE ou UPDATE sans WHERE.
-- =============================================================================

begin;

-- Comme pour l'étape 2 : si un verrou n'est pas obtenu en deux secondes, la
-- migration s'arrête (rien n'est modifié) plutôt que de faire attendre l'API.
set local lock_timeout = '2s';

create or replace function public.crm_pilotage_meta_remplacer_couverture(
  p_synchro_id uuid,
  p_lignes     jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer;
begin
  if not exists (select 1 from public.pilotage_meta_synchros
                 where id = p_synchro_id and statut = 'en_cours') then
    raise exception 'lecture introuvable ou déjà terminée' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_lignes, '[]'::jsonb)) <> 'array' then
    raise exception 'couverture invalide' using errcode = '22023';
  end if;

  -- Toute la couverture est remplacée, exprès : `where true` (safeupdate
  -- refuse un DELETE sans WHERE quand l'appel vient de l'API).
  delete from public.pilotage_meta_couverture where true;
  insert into public.pilotage_meta_couverture
    (periode, property_id, couverture, impressions, date_debut, date_fin, pubs, raison, synchro_id)
  select x.periode, x.property_id, x.couverture, x.impressions, x.date_debut, x.date_fin,
         coalesce(x.pubs, 0), left(x.raison, 300), p_synchro_id
    from jsonb_to_recordset(coalesce(p_lignes, '[]'::jsonb)) as x(
           periode text, property_id uuid, couverture bigint, impressions bigint,
           date_debut date, date_fin date, pubs integer, raison text);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Les droits, inchangés : rôle de service SEUL.
revoke all on function public.crm_pilotage_meta_remplacer_couverture(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.crm_pilotage_meta_remplacer_couverture(uuid, jsonb) to service_role;

commit;
