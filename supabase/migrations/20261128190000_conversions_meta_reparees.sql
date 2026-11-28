-- =============================================================================
-- CONVERSIONS META — ÉTAPE 4, PR 1 « RÉPARER » : le journal des envois.
-- =============================================================================
-- Décidé par Victor le 28/11/2026 (« ok » au plan de l'étape 4 en trois PR :
-- « réparer les envois de « dossier envoyé » et « visite », et fermer le
-- journal des envois au public »).
--
--   1. LE JOURNAL N'EST PLUS OUVERT AU PUBLIC.
--      `crm_meta_conversion_log` était exécutable par `anon` (droit par défaut
--      du schéma) : n'importe qui, sans compte, pouvait y écrire des lignes.
--      Le dépôt public du formulaire en a besoin pour tracer son `Lead`, d'où
--      une porte ÉTROITE plutôt qu'un retrait sec : sans session, la fonction
--      n'accepte plus que le `Lead` d'une demande qui existe, arrivée il y a
--      moins de quinze minutes, et pas encore tracée. Tout autre appel sans
--      session est ignoré, sans erreur (le journal ne doit jamais faire
--      échouer ce qu'il observe). AVEC une session, il faut aussi être de
--      l'équipe (adhésion active, `crm_has_access`) : l'inscription libre est
--      ouverte dans Supabase Auth (relevé du 28/11/2026), et un compte créé de
--      l'extérieur ne doit rien écrire — surtout pas une fausse « envoyee »,
--      que la question « déjà partie ? » lirait.
--
--   2. DEUX MOTIFS DE PLUS, dans la contrainte et dans la fonction :
--        - `hors_production` : le fait a eu lieu, mais depuis un déploiement
--          qui n'est pas la production (un aperçu partage la base de
--          production) : rien n'est parti ;
--        - `deja_envoyee` : la même conversion est déjà partie (même
--          `event_id`). Meta ne dédoublonne qu'à 48 heures ; au-delà, un
--          dossier revenu « en discussion » aurait compté deux fois.
--
--   3. `crm_meta_conversion_deja_envoyee(event_id)` : vrai si une conversion
--      de cet identifiant est déjà partie. SECURITY DEFINER (le journal n'est
--      lisible que de l'encadrement, alors que c'est le commercial qui déplace
--      la carte) ; membre de l'équipe seulement ; ne rend qu'un booléen.
--
--   4. `menage_ponctuel_20261022()`, fonction de ménage posée à la main en
--      production le 22/10/2026 (absente du dépôt), était exécutable sans
--      compte : elle efface du journal les lignes de la vérification de mise
--      en service. Son exécution est retirée à tout client, si elle existe.
--      Elle n'est pas supprimée : la supprimer demande l'accord de Victor.
--
-- STRICTEMENT LIMITÉE : la contrainte du journal réécrite en sur-ensemble
-- strict (aucune valeur retirée), une fonction remplacée (même signature),
-- une fonction ajoutée, deux index, un droit retiré. Aucune ligne du journal
-- touchée. Rejouable.
-- =============================================================================

begin;

set local lock_timeout = '2s';

-- -----------------------------------------------------------------------------
-- 1. Les motifs : sur-ensemble strict de 20261019230000.
-- -----------------------------------------------------------------------------
alter table public.meta_conversion_log drop constraint if exists meta_conversion_log_resultat_check;

alter table public.meta_conversion_log add constraint meta_conversion_log_resultat_check check (
  resultat in ('envoyee', 'non_configure', 'sans_correspondance', 'refus', 'erreur',
               -- Ajout du 28 novembre (étape 4, « réparer »).
               'hors_production', 'deja_envoyee')
);

-- -----------------------------------------------------------------------------
-- 2. La trace d'un envoi : même signature, porte étroite sans session.
-- -----------------------------------------------------------------------------
create or replace function public.crm_meta_conversion_log(
  p_event_name text,
  p_resultat   text,
  p_interest_id uuid default null,
  p_event_id   text default null,
  p_detail     text default null
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  -- SANS SESSION (le dépôt public du formulaire) : le seul `Lead` d'une
  -- demande réelle, toute récente, pas encore tracée. Rien d'autre.
  if auth.uid() is null then
    if p_event_name is distinct from 'Lead'
       or p_interest_id is null
       or not exists (select 1 from public.buyer_interests i
                       where i.id = p_interest_id
                         and i.created_at > now() - interval '15 minutes')
       or exists (select 1 from public.meta_conversion_log l
                   where l.interest_id = p_interest_id and l.event_name = 'Lead') then
      return;
    end if;
  -- AVEC UNE SESSION : un membre de l'équipe seulement (adhésion active).
  elsif not public.crm_has_access() then
    return;
  end if;

  insert into public.meta_conversion_log (interest_id, event_name, event_id, resultat, detail)
  values (p_interest_id, p_event_name, p_event_id,
          case when p_resultat in ('envoyee', 'non_configure', 'sans_correspondance', 'refus', 'erreur',
                                   'hors_production', 'deja_envoyee')
               then p_resultat else 'erreur' end,
          left(coalesce(p_detail, ''), 500));
exception when others then
  -- LE JOURNAL NE DOIT JAMAIS FAIRE ÉCHOUER CE QU'IL OBSERVE. Une visite
  -- planifiée reste planifiée, même si sa trace ne s'écrit pas.
  return;
end;
$function$;

comment on function public.crm_meta_conversion_log(text, text, uuid, text, text) is
  'Trace le résultat d''un envoi de conversion Meta. Sans session (dépôt public), n''accepte que le Lead d''une demande réelle de moins de quinze minutes, pas encore tracée ; avec une session, un membre de l''équipe seulement. Ne lève jamais.';

-- Le dépôt public en a besoin (sans session) : le droit est donné à `anon`
-- explicitement, et la porte étroite ci-dessus en limite l'usage.
revoke all on function public.crm_meta_conversion_log(text, text, uuid, text, text) from public;
grant execute on function public.crm_meta_conversion_log(text, text, uuid, text, text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. Déjà partie ? Un booléen, rien d'autre.
-- -----------------------------------------------------------------------------
create or replace function public.crm_meta_conversion_deja_envoyee(p_event_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
     and public.crm_has_access()
     and p_event_id is not null
     and exists (select 1 from public.meta_conversion_log l
                  where l.event_id = p_event_id and l.resultat = 'envoyee');
$$;

comment on function public.crm_meta_conversion_deja_envoyee(text) is
  'Vrai si une conversion Meta de cet identifiant est déjà partie (journal « envoyee »). Membre de l''équipe seulement (faux sinon) ; ne rend qu''un booléen.';

revoke all on function public.crm_meta_conversion_deja_envoyee(text) from public, anon;
grant execute on function public.crm_meta_conversion_deja_envoyee(text) to authenticated;

-- Le journal se lit désormais par l'identifiant d'événement (déjà partie ?)
-- et par la demande (son Lead est-il tracé ?) : deux index les servent.
create index if not exists meta_conversion_log_evenement
  on public.meta_conversion_log (event_id)
  where event_id is not null;
create index if not exists meta_conversion_log_demande
  on public.meta_conversion_log (interest_id, event_name)
  where interest_id is not null;

-- -----------------------------------------------------------------------------
-- 4. La fonction de ménage du 22/10/2026 : plus aucun client ne l'exécute.
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.menage_ponctuel_20261022()') is not null then
    execute 'revoke all on function public.menage_ponctuel_20261022() from public, anon, authenticated';
  end if;
end $$;

commit;
