-- =============================================================================
-- CONVERSIONS META — ÉTAPE 4, PR 2 « NOUVEAUX SIGNAUX », EN ESSAI.
-- =============================================================================
-- Décidé par Victor le 28/11/2026 : « 1. OUi go » (les paliers, en essai,
-- envoyés seulement aux trois conditions de docs/27), « 3. ok » (les noms :
-- LeadQualifie, Contact, SubmitApplication, LeadBudgetAuMoins500k / 1M / 2M /
-- 3M).
--
-- EN ESSAI, RIEN NE PART chez Meta : le journal note ce qui serait parti. Il
-- lui faut donc :
--
--   1. UN MOTIF DE PLUS, `simulee`, dans la contrainte et dans la fonction ;
--
--   2. LES PALIERS À LA PORTE ÉTROITE. Ils naissent au dépôt du formulaire,
--      sans session, comme le `Lead` : sans session, la fonction accepte
--      désormais le `Lead` ET les quatre paliers d'une demande réelle, arrivée
--      il y a moins de quinze minutes — chacun une seule fois. Rien d'autre.
--      Avec une session : un membre de l'équipe seulement, comme depuis
--      20261128190000 ;
--
--   3. `crm_meta_conversion_deja_simulee(event_id)` : vrai si ce signal a
--      déjà été essayé (« simulee ») ou envoyé. En essai, un même signal ne
--      s'essaie qu'une fois ; un essai ne compte pas comme un envoi, si bien
--      qu'au passage à l'envoi réel, il partira. Membre de l'équipe
--      seulement ; un booléen.
--
-- STRICTEMENT LIMITÉE : la contrainte du journal réécrite en sur-ensemble
-- strict, une fonction remplacée (même signature, mêmes droits), une
-- fonction ajoutée. Aucune ligne du journal touchée. Rejouable.
-- =============================================================================

begin;

set local lock_timeout = '2s';

-- -----------------------------------------------------------------------------
-- 1. Les motifs : sur-ensemble strict de 20261128190000.
-- -----------------------------------------------------------------------------
alter table public.meta_conversion_log drop constraint if exists meta_conversion_log_resultat_check;

alter table public.meta_conversion_log add constraint meta_conversion_log_resultat_check check (
  resultat in ('envoyee', 'non_configure', 'sans_correspondance', 'refus', 'erreur',
               'hors_production', 'deja_envoyee',
               -- Ajout du 28 novembre (étape 4, « nouveaux signaux », en essai).
               'simulee')
);

-- -----------------------------------------------------------------------------
-- 2. La trace : même signature ; la porte étroite laisse passer les paliers.
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
  -- SANS SESSION (le dépôt public du formulaire) : le `Lead` et les paliers
  -- d'une demande réelle, toute récente, chacun une seule fois. Rien d'autre.
  if auth.uid() is null then
    if p_event_name is null
       or not (p_event_name = any (array['Lead', 'LeadBudgetAuMoins500k', 'LeadBudgetAuMoins1M',
                                         'LeadBudgetAuMoins2M', 'LeadBudgetAuMoins3M']))
       or p_interest_id is null
       or not exists (select 1 from public.buyer_interests i
                       where i.id = p_interest_id
                         and i.created_at > now() - interval '15 minutes')
       or exists (select 1 from public.meta_conversion_log l
                   where l.interest_id = p_interest_id and l.event_name = p_event_name) then
      return;
    end if;
  -- AVEC UNE SESSION : un membre de l'équipe seulement (adhésion active).
  elsif not public.crm_has_access() then
    return;
  end if;

  insert into public.meta_conversion_log (interest_id, event_name, event_id, resultat, detail)
  values (p_interest_id, p_event_name, p_event_id,
          case when p_resultat in ('envoyee', 'non_configure', 'sans_correspondance', 'refus', 'erreur',
                                   'hors_production', 'deja_envoyee', 'simulee')
               then p_resultat else 'erreur' end,
          left(coalesce(p_detail, ''), 500));
exception when others then
  -- LE JOURNAL NE DOIT JAMAIS FAIRE ÉCHOUER CE QU'IL OBSERVE.
  return;
end;
$function$;

comment on function public.crm_meta_conversion_log(text, text, uuid, text, text) is
  'Trace le résultat d''un envoi (ou d''un essai) de conversion Meta. Sans session (dépôt public), n''accepte que le Lead et les paliers de budget d''une demande réelle de moins de quinze minutes, chacun une fois ; avec une session, un membre de l''équipe seulement. Ne lève jamais.';

revoke all on function public.crm_meta_conversion_log(text, text, uuid, text, text) from public;
grant execute on function public.crm_meta_conversion_log(text, text, uuid, text, text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. Déjà essayé (ou parti) ? Un booléen, rien d'autre.
-- -----------------------------------------------------------------------------
create or replace function public.crm_meta_conversion_deja_simulee(p_event_id text)
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
                  where l.event_id = p_event_id and l.resultat in ('simulee', 'envoyee'));
$$;

comment on function public.crm_meta_conversion_deja_simulee(text) is
  'Vrai si un signal Meta de cet identifiant a déjà été essayé (« simulee ») ou envoyé. Membre de l''équipe seulement (faux sinon) ; ne rend qu''un booléen.';

revoke all on function public.crm_meta_conversion_deja_simulee(text) from public, anon;
grant execute on function public.crm_meta_conversion_deja_simulee(text) to authenticated;

commit;
