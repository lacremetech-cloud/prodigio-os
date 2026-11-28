-- =============================================================================
-- LE BUDGET DU FORMULAIRE, BIEN PAR BIEN — et sa lecture dans Pilotage pub.
-- =============================================================================
-- Demande de Victor du 28/11/2026 : « à chaque bien, ça va plus ou moins
-- dépendre ». Un chalet à 4 M€ ne pose pas la même question qu'un programme
-- à 500 000 €, et un bon lead ne se juge pas au même seuil.
--
--   1. pilotage_budget_formulaire — par bien, VERSIONNÉ comme les conditions
--      (date d'effet, auteur, motif ; rien ne s'efface, rien ne se réécrit) :
--        - les TRANCHES de budget que son formulaire propose, prises dans
--          l'échelle commune (`buyer_choice_bounds`) ; « Non, je n'ai pas de
--          projet » est toujours proposé, en premier, et n'en fait pas partie ;
--        - la CIBLE : le budget minimum d'une demande « dans la cible ».
--   2. buyer_form_budget(slug) — ce que le formulaire PUBLIC lit : les seules
--      tranches en vigueur aujourd'hui (jour de Paris). Jamais la cible. Sans
--      réglage, NULL : le formulaire garde ses réponses d'aujourd'hui.
--   3. crm_pilotage_crm_budget(début, fin) — pour Pilotage pub, EN NOMBRES
--      SEULEMENT : demandes, personnes et personnes qualifiées par réponse de
--      budget, par bien, par pub et au total.
--
-- LE BUDGET RESTE DANS LE SITE. Rien de cette migration n'est envoyé à Meta :
-- un événement fondé sur un budget déclaré est une information financière au
-- sens des conditions des Outils Meta Business (section 1.h), quel que soit
-- son nom (docs/33 § 10).
--
-- RÉSERVÉ AUX ADMINISTRATEURS, comme tout le pilotage : lecture filtrée par
-- `crm_has_role('administrateur')`, écriture par une fonction SECURITY DEFINER
-- qui revérifie le rôle et trace la saisie au journal — sans montant (le
-- journal est lisible par les managers) : identifiants et date d'effet.
--
-- STRICTEMENT ADDITIVE : une table nouvelle, quatre fonctions nouvelles, et les
-- deux listes fermées du journal d'audit RÉÉCRITES EN ENTIER en sur-ensemble
-- strict (reprise intégrale de 20261112170000, deux valeurs ajoutées ; un test
-- relit toutes les migrations et le vérifie). Aucune table existante modifiée,
-- aucune donnée insérée ni réécrite : les réglages se saisissent dans
-- l'application. Le dépôt est public, et les aperçus Vercel écrivent dans la
-- base de production.
-- =============================================================================

begin;

set local lock_timeout = '2s';

-- =============================================================================
-- 1. AUDIT — les deux listes fermées, RÉÉCRITES EN ENTIER.
--    Reprise intégrale de 20261112170000_pilotage_lecture_meta, puis ajout.
-- =============================================================================
alter table public.audit_events drop constraint if exists audit_events_entity_type_check;

alter table public.audit_events add constraint audit_events_entity_type_check check (
  entity_type = any (array[
    'opportunity', 'contact', 'membership', 'organization', 'invitation',
    'calendar_connection', 'estimation_appointment', 'estimation_report',
    'mandate', 'economic_rule', 'document', 'property',
    'buyer_interest', 'buyer_profile',
    'communication_message', 'communication_template', 'communication_automation',
    'communication_suppression',
    'pilotage_conditions', 'pilotage_lot', 'pilotage_cout_fixe',
    'pilotage_meta_regle',
    -- Ajout du 28 novembre (budget du formulaire par bien).
    'pilotage_budget'
  ]::text[])
);

alter table public.audit_events drop constraint if exists audit_events_event_type_check;

alter table public.audit_events add constraint audit_events_event_type_check check (
  event_type = any (array[
    'creation', 'changement_stade', 'changement_segment', 'changement_affectation',
    'changement_permission', 'resolution_doublon', 'resultat_commercial',
    'invitation_creee', 'invitation_renvoyee', 'invitation_revoquee',
    'invitation_acceptee', 'changement_role', 'activation_membre',
    'desactivation_membre', 'calendrier_connecte', 'calendrier_deconnecte',
    'estimation_planifiee', 'estimation_replanifiee', 'estimation_annulee',
    'estimation_resultat', 'estimation_realisee', 'decision_eligibilite',
    'regle_economique_maj', 'mandat_brouillon', 'mandat_propose', 'mandat_signe',
    'mandat_refuse', 'mandat_expire', 'mandat_annule', 'document_ajoute',
    'document_remplace', 'document_supprime', 'bien_cree', 'bien_identite',
    'bien_positionnement', 'bien_statut', 'bien_responsable', 'bien_media_ajoute',
    'bien_media_supprime', 'bien_media_principal', 'bien_document_ajoute',
    'bien_document_supprime', 'bien_production_maj', 'bien_pret',
    'bien_public_config', 'bien_public_media_ajoute', 'bien_public_media_supprime',
    'bien_public_hero', 'bien_public_valide', 'bien_public_statut', 'bien_publie',
    'bien_depublie', 'acquereur_interet_statut', 'acquereur_profil_cree',
    'acquereur_interet_rattache', 'acquereur_stade', 'acquereur_qualification',
    'acquereur_affectation', 'acquereur_criteres', 'acquereur_offre',
    'acquereur_resultat', 'acquereur_traitement', 'communication_planifiee',
    'communication_preparee', 'communication_envoyee', 'communication_livree',
    'communication_echec', 'communication_bloquee', 'communication_annulee',
    'communication_rejouee', 'communication_statut', 'modele_cree', 'modele_maj',
    'modele_statut', 'automatisation_creee', 'automatisation_maj',
    'automatisation_statut', 'opposition_ajoutee', 'opposition_levee',
    'formulaire_acquereur', 'bien_espace_travail',
    'acquereur_archive', 'acquereur_desarchive',
    'acquereur_budget',
    'pilotage_conditions_saisies',
    'pilotage_lot_cree', 'pilotage_lot_modifie',
    'pilotage_cout_saisi', 'pilotage_cout_annule',
    'pilotage_regle_ajoutee', 'pilotage_regle_retiree',
    -- Ajout du 28 novembre (budget du formulaire par bien).
    'pilotage_budget_saisi'
  ]::text[])
);

-- =============================================================================
-- 2. LA RÈGLE D'UN RÉGLAGE, écrite une fois et tenue deux fois : par la
--    contrainte de la table, et par la fonction de saisie qui en tire sa
--    phrase. NULL : le réglage est valable ; sinon, ce qui ne va pas.
--
--    Les tranches se suivent sans trou ni chevauchement, de la plus basse à
--    la plus haute, et la dernière est OUVERTE (« plus de … ») : sans elle, un
--    acheteur au-dessus de la dernière borne n'aurait aucune réponse juste.
--    La cible est la borne basse d'une tranche proposée : une demande est
--    dans la cible si la borne basse de sa réponse l'atteint, et le
--    formulaire doit permettre de le dire.
-- =============================================================================
create or replace function public.pilotage_budget_erreur(p_tranches text[], p_cible_min_cents bigint)
returns text
language plpgsql
immutable
set search_path = pg_catalog, pg_temp
as $$
declare
  v_connues constant text[] := array['500k_1m', 'plus_1m', '1m_2m', '2m_3m', 'plus_3m'];
  v_t       text;
  v_bornes  jsonb;
  v_min     bigint;
  v_max     bigint;
  v_fin     bigint;
  v_premier boolean := true;
  v_ouverte boolean := false;
  v_cible   boolean := false;
begin
  if p_tranches is null or cardinality(p_tranches) = 0 then
    return 'choisissez au moins une tranche de budget';
  end if;
  if cardinality(p_tranches) > 4 then
    return 'quatre tranches de budget au plus';
  end if;
  if array_position(p_tranches, null) is not null then
    return 'tranche de budget invalide';
  end if;
  if (select count(distinct x) from unnest(p_tranches) as x) <> cardinality(p_tranches) then
    return 'une tranche de budget est proposée deux fois';
  end if;

  foreach v_t in array p_tranches loop
    if not (v_t = any (v_connues)) then
      return 'tranche de budget inconnue';
    end if;
    if v_ouverte then
      return 'la tranche « plus de … » ferme la liste : rien ne vient après elle';
    end if;
    v_bornes := public.buyer_choice_bounds(v_t);
    v_min := (v_bornes ->> 'min')::bigint;
    v_max := (v_bornes ->> 'max')::bigint;
    if not v_premier and v_min is distinct from v_fin then
      return 'les tranches doivent se suivre, sans trou ni chevauchement, de la plus basse à la plus haute';
    end if;
    if v_min = p_cible_min_cents then
      v_cible := true;
    end if;
    v_fin := v_max;
    v_ouverte := v_max is null;
    v_premier := false;
  end loop;

  if not v_ouverte then
    return 'la dernière tranche doit être ouverte (« plus de … ») : sinon les budgets au-dessus n''ont pas de réponse';
  end if;
  if p_cible_min_cents is null then
    return 'choisissez la cible';
  end if;
  if not v_cible then
    return 'la cible doit être le bas d''une des tranches proposées';
  end if;
  return null;
end;
$$;

comment on function public.pilotage_budget_erreur(text[], bigint) is
  'Règle d''un réglage de budget du formulaire (pilotage) : tranches connues, contiguës, croissantes, la dernière ouverte ; cible = borne basse d''une tranche proposée. NULL si valable, sinon la phrase à afficher.';

-- Aucun client ne l'appelle : la contrainte et la fonction de saisie s'en
-- servent avec les droits du propriétaire.
revoke all on function public.pilotage_budget_erreur(text[], bigint) from public, anon, authenticated;

-- =============================================================================
-- 3. PILOTAGE_BUDGET_FORMULAIRE — le budget du formulaire d'un bien, versionné.
-- =============================================================================
create table if not exists public.pilotage_budget_formulaire (
  id               uuid primary key default gen_random_uuid(),
  property_id      uuid not null references public.properties (id) on delete restrict,
  -- La version qui s'applique un jour donné : la plus récente par date d'effet
  -- sans dépasser ce jour ; à date égale, la dernière saisie.
  date_effet       date not null,
  -- Les tranches proposées par le formulaire, de la plus basse à la plus
  -- haute. « Non, je n'ai pas de projet » est proposé en plus, toujours.
  tranches         text[] not null,
  -- Le budget minimum d'une demande dans la cible, en centimes : la borne
  -- basse d'une des tranches proposées.
  cible_min_cents  bigint not null check (cible_min_cents > 0),
  motif            text not null check (btrim(motif) <> '' and length(motif) <= 2000),
  saisi_le         timestamptz not null default now(),
  -- Identifiant de l'auteur, gardé comme TRACE : pas de clé étrangère, pour
  -- qu'un journal immuable n'empêche jamais la suppression d'un compte.
  saisi_par        uuid,
  constraint pilotage_budget_formulaire_regle check (
    public.pilotage_budget_erreur(tranches, cible_min_cents) is null
  )
);

comment on table public.pilotage_budget_formulaire is
  'Budget du formulaire d''un bien (pilotage pub), VERSIONNÉ : les tranches proposées et la cible (budget minimum d''une demande dans la cible). Chaque changement est une nouvelle ligne (date d''effet, auteur, motif). Réservé aux administrateurs ; le formulaire public ne lit que les tranches, par buyer_form_budget. Rien n''est envoyé à Meta.';
comment on column public.pilotage_budget_formulaire.tranches is
  'Tranches de budget proposées, de la plus basse à la plus haute, prises dans l''échelle commune (buyer_choice_bounds). « Non, je n''ai pas de projet » est toujours proposé en plus.';
comment on column public.pilotage_budget_formulaire.cible_min_cents is
  'Budget minimum d''une demande dans la cible (centimes) : la borne basse d''une tranche proposée. Une demande est dans la cible si la borne basse de sa réponse l''atteint.';

create index if not exists pilotage_budget_formulaire_bien_idx
  on public.pilotage_budget_formulaire (property_id, date_effet desc, saisi_le desc);

drop trigger if exists pilotage_budget_formulaire_immuable on public.pilotage_budget_formulaire;
create trigger pilotage_budget_formulaire_immuable
  before update or delete on public.pilotage_budget_formulaire
  for each row execute function public.pilotage_ligne_immuable();

alter table public.pilotage_budget_formulaire enable row level security;

revoke all on table public.pilotage_budget_formulaire from anon, authenticated;
grant select on table public.pilotage_budget_formulaire to authenticated;

drop policy if exists pilotage_budget_formulaire_lecture_admin on public.pilotage_budget_formulaire;
create policy pilotage_budget_formulaire_lecture_admin on public.pilotage_budget_formulaire
  for select to authenticated
  using (public.crm_has_role('administrateur'));

-- =============================================================================
-- 4. ÉCRITURE — une nouvelle version, administrateur seul, auditée.
-- =============================================================================
create or replace function public.crm_pilotage_enregistrer_budget(
  p_property_id     uuid,
  p_date_effet      date,
  p_tranches        text[],
  p_cible_min_cents bigint,
  p_motif           text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_motif  text := nullif(btrim(coalesce(p_motif, '')), '');
  v_erreur text;
  v_id     uuid;
begin
  perform public.crm_require_role('administrateur');

  if p_property_id is null
     or not exists (select 1 from public.properties where id = p_property_id) then
    raise exception 'bien introuvable' using errcode = '22023';
  end if;
  if p_date_effet is null then
    raise exception 'date d''effet requise' using errcode = '22023';
  end if;
  if v_motif is null then
    raise exception 'motif requis : dites pourquoi ce budget s''applique' using errcode = '22023';
  end if;
  if length(v_motif) > 2000 then
    raise exception 'motif trop long (2 000 caractères au plus)' using errcode = '22023';
  end if;
  v_erreur := public.pilotage_budget_erreur(p_tranches, p_cible_min_cents);
  if v_erreur is not null then
    raise exception '%', v_erreur using errcode = '22023';
  end if;

  insert into public.pilotage_budget_formulaire
    (property_id, date_effet, tranches, cible_min_cents, motif, saisi_par)
  values
    (p_property_id, p_date_effet, p_tranches, p_cible_min_cents, v_motif, v_uid)
  returning id into v_id;

  -- Identifiants seulement : le journal est lisible par les managers.
  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'pilotage_budget', v_id, 'pilotage_budget_saisi',
          jsonb_build_object('property_id', p_property_id, 'date_effet', p_date_effet));

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

comment on function public.crm_pilotage_enregistrer_budget(uuid, date, text[], bigint, text) is
  'Ajoute une version du budget du formulaire d''un bien (tranches proposées et cible). Administrateur seul. Rien n''est écrasé : la version en vigueur est la plus récente par date d''effet. Audit sans montant.';

revoke all on function public.crm_pilotage_enregistrer_budget(uuid, date, text[], bigint, text) from public, anon;
grant execute on function public.crm_pilotage_enregistrer_budget(uuid, date, text[], bigint, text) to authenticated;

-- =============================================================================
-- 5. LECTURE PUBLIQUE — les tranches que le formulaire propose aujourd'hui.
--    Mêmes conditions que `buyer_form_context` (formulaire actif ou vitrine
--    publiée). Jamais la cible, jamais l'historique. NULL sans réglage : le
--    formulaire garde ses réponses d'aujourd'hui.
-- =============================================================================
create or replace function public.buyer_form_budget(p_slug text)
returns text[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select v.tranches
    from public.property_public_config c
    cross join lateral (
      select b.tranches
        from public.pilotage_budget_formulaire b
       where b.property_id = c.property_id
         and b.date_effet <= (now() at time zone 'Europe/Paris')::date
       order by b.date_effet desc, b.saisi_le desc, b.id desc
       limit 1
    ) v
   where lower(c.slug) = public.normalize_public_slug(p_slug)
     and (coalesce(c.buyer_form_status, 'inactif') = 'actif' or c.publication_status = 'publie')
   limit 1;
$$;

comment on function public.buyer_form_budget(text) is
  'Les tranches de budget que le formulaire acquéreur propose aujourd''hui pour ce bien (version en vigueur, jour de Paris). NULL sans réglage, si le slug est inconnu, ou si le formulaire est inactif et la vitrine non publiée. Ne divulgue ni la cible ni l''historique.';

revoke all on function public.buyer_form_budget(text) from public;
grant execute on function public.buyer_form_budget(text) to anon, authenticated;

-- =============================================================================
-- 6. PILOTAGE PUB — les demandes par réponse de budget, EN NOMBRES SEULEMENT.
--
--    LES DÉFINITIONS (reprises à l'écran et dans docs/33 § 10) :
--     - les demandes de la période, résolues comme partout ailleurs dans la
--       page (`crm_pilotage_crm_demandes_resolues` : jour d'arrivée à Paris,
--       pub ou campagne, personnes archivées exclues) ;
--     - la réponse RETENUE d'une demande : le budget corrigé par l'équipe sur
--       la personne (`buyer_profiles.budget_choice_corrige`), sinon celui
--       que la demande a déclaré (`buyer_interests.budget_choice`) ; NULL :
--       sans réponse ;
--     - la réponse d'une PERSONNE, dans chaque regroupement : sa correction,
--       sinon la réponse de sa demande la plus récente qui en porte une —
--       la règle de la fiche acquéreur, restreinte au regroupement ; chaque
--       personne compte donc une seule fois par regroupement ;
--     - qualifiée : « qualifié » ou « gros potentiel », comme partout ;
--     - trois regroupements : `bien`, `pub` (pub, campagne seule, ou non
--       rattachée), `total` (tous les biens, personnes distinctes).
--    La cible n'est PAS lue ici : la page la prend dans le réglage en vigueur.
-- =============================================================================
create or replace function public.crm_pilotage_crm_budget(p_debut date, p_fin date)
returns table (
  regroupement  text,
  property_id   uuid,
  niveau        text,
  ad_id         text,
  campaign_id   text,
  reponse       text,
  demandes      integer,
  personnes     integer,
  qualifies     integer
)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
begin
  -- `crm_require_role` n'est pas exécutable par un client : la fonction
  -- s'exécute avec les droits de l'appelant (la RLS s'applique), d'où ce
  -- contrôle explicite, par `crm_has_role`.
  if not public.crm_has_role('administrateur') then
    raise exception 'pilotage réservé aux administrateurs' using errcode = '42501';
  end if;
  return query
  with a as materialized (
    select * from public.crm_pilotage_crm_demandes_resolues(p_debut, p_fin) x where not x.archivee
  ),
  -- La réponse déclarée et l'heure d'arrivée de chaque demande de la période,
  -- lues une fois, par identifiant.
  r as materialized (
    select bi.id, bi.budget_choice, bi.created_at
      from public.buyer_interests bi
     where bi.id in (select x.demande from a x)
  ),
  -- Chaque personne, lue une fois : sa correction et sa qualification.
  profils as materialized (
    select bp.id as personne,
           bp.budget_choice_corrige as corrige,
           coalesce(bp.qualification in ('qualifie', 'gros_potentiel'), false) as qualifiee
      from public.buyer_profiles bp
     where bp.id in (select x.personne from a x where x.personne is not null)
  ),
  -- Chaque demande, dans ses trois regroupements.
  g as materialized (
    select k.regroupement, k.property_id, k.niveau, k.ad_id, k.campaign_id,
           a.demande, a.personne, r.created_at,
           r.budget_choice as declaree,
           coalesce(pr.corrige, r.budget_choice) as retenue,
           coalesce(pr.qualifiee, false) as qualifiee
      from a
      join r on r.id = a.demande
      left join profils pr on pr.personne = a.personne
      cross join lateral (values
        ('bien'::text, a.property_id, null::text, null::text, null::text),
        ('pub'::text, a.property_id, a.niveau, a.ad_id, a.campaign_id),
        ('total'::text, null::uuid, null::text, null::text, null::text)
      ) as k (regroupement, property_id, niveau, ad_id, campaign_id)
  ),
  -- La demande qui donne sa réponse à la personne, dans chaque regroupement :
  -- la plus récente qui porte une réponse (la correction s'applique à toutes).
  rangees as (
    select g.*,
           row_number() over (
             partition by g.regroupement, g.property_id, g.niveau, g.ad_id, g.campaign_id, g.personne
             order by (g.declaree is null), g.created_at desc, g.demande desc
           ) as rang
      from g
  )
  select x.regroupement, x.property_id, x.niveau, x.ad_id, x.campaign_id, x.retenue,
         count(*)::integer,
         count(*) filter (where x.personne is not null and x.rang = 1)::integer,
         count(*) filter (where x.personne is not null and x.rang = 1 and x.qualifiee)::integer
    from rangees x
   group by x.regroupement, x.property_id, x.niveau, x.ad_id, x.campaign_id, x.retenue;
end;
$$;

comment on function public.crm_pilotage_crm_budget(date, date) is
  'Pilotage pub : demandes, personnes et personnes qualifiées par réponse de budget retenue (correction de l''équipe, sinon réponse déclarée), par bien, par pub et au total. Nombres seulement. Administrateur seul.';

revoke all on function public.crm_pilotage_crm_budget(date, date) from public, anon;
grant execute on function public.crm_pilotage_crm_budget(date, date) to authenticated;

commit;
