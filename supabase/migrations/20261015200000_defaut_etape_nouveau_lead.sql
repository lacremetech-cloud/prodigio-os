-- LES NOUVEAUX LEADS ETAIENT REJETES. PLUS AUCUN N'ARRIVAIT.
--
-- CE QUI S'EST PASSE. La migration `20261014190000_une_personne_une_qualification`
-- a traduit les etapes existantes et resserre la contrainte de
-- `buyer_profiles.pipeline_stage` sur les sept valeurs actuelles. Elle n'a pas
-- touche a la VALEUR PAR DEFAUT de la colonne, restee 'nouveau' — une valeur
-- que la nouvelle contrainte refuse.
--
-- `buyer_attach_interest` cree le dossier acquereur SANS preciser l'etape : la
-- valeur par defaut s'appliquait, la contrainte la rejetait, et comme tout
-- `submit_buyer_interest` tient dans une seule transaction, TOUT etait annule —
-- la manifestation, le contact, la trace RGPD. Le visiteur lisait « Une erreur
-- est survenue. Merci de reessayer. » et rien n'etait conserve nulle part.
--
-- POURQUOI CA N'A PAS SAUTE AUX YEUX. Le defaut ne frappe que les CONTACTS
-- NOUVEAUX : quand la personne existait deja, la fonction retrouvait son
-- dossier et n'inserait rien. Les depots d'un visiteur deja connu passaient
-- donc normalement, et le compteur de leads ne tombait pas a zero d'un coup.
--
-- CE QUE CELA A COUTE. Entre l'application de la migration, le 15 octobre vers
-- 12 h 18 (heure de Paris), et ce correctif le meme jour vers 21 h 30, tout
-- visiteur inconnu ayant rempli le formulaire a ete perdu. Ces depots n'ont
-- laisse AUCUNE trace exploitable : la transaction etait annulee avant la
-- premiere ecriture. Ils ne sont pas recuperables.

alter table public.buyer_profiles
  alter column pipeline_stage set default 'a_contacter';

-- La valeur par defaut n'est qu'un filet. L'etape et la qualification sont
-- desormais posees EXPLICITEMENT a la creation du dossier : une contrainte qui
-- bouge ne doit plus pouvoir faire perdre un lead en silence. Le reste de la
-- fonction est inchange, a l'identique de `20260803120000_buyers_crm_v1`.
create or replace function public.buyer_attach_interest(p_interest_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_i public.buyer_interests;
  v_profile_id uuid;
  v_created boolean := false;
  v_org uuid;
  v_bounds jsonb;
  v_criteria_source text;
  v_property_type text;
  v_property_city text;
begin
  select * into v_i from public.buyer_interests where id = p_interest_id;
  if v_i.id is null then
    raise exception 'intérêt introuvable' using errcode = '22023';
  end if;
  if v_i.contact_id is null then
    return null;
  end if;

  v_org := coalesce(v_i.organization_id, public.crm_current_operator_org());

  select id into v_profile_id from public.buyer_profiles where contact_id = v_i.contact_id;

  if v_profile_id is null then
    insert into public.buyer_profiles (
      organization_id, contact_id, origin_funnel_key,
      pipeline_stage, qualification,
      first_touch, last_touch,
      utm_source, utm_medium, utm_campaign, utm_term, utm_content,
      created_by)
    values (
      v_org, v_i.contact_id, v_i.funnel_key,
      'a_contacter', 'a_qualifier',
      v_i.first_touch, v_i.last_touch,
      v_i.utm_source, v_i.utm_medium, v_i.utm_campaign, v_i.utm_term, v_i.utm_content,
      auth.uid())
    on conflict (contact_id) do nothing
    returning id into v_profile_id;

    if v_profile_id is null then
      select id into v_profile_id from public.buyer_profiles where contact_id = v_i.contact_id;
    else
      v_created := true;
    end if;
  end if;

  if v_profile_id is null then return null; end if;

  update public.buyer_interests set buyer_profile_id = v_profile_id where id = p_interest_id;

  update public.buyer_profiles bp set
    interest_count = (
      select count(*) from public.buyer_interests bi where bi.buyer_profile_id = v_profile_id),
    first_interest_at = (
      select min(bi.created_at) from public.buyer_interests bi where bi.buyer_profile_id = v_profile_id),
    last_interest_at = (
      select max(bi.created_at) from public.buyer_interests bi where bi.buyer_profile_id = v_profile_id),
    best_overall_score = (
      select max(bi.overall_score) from public.buyer_interests bi where bi.buyer_profile_id = v_profile_id),
    recommended_priority = (
      select case
        when bool_or(bi.priority = 'prioritaire') then 'prioritaire'
        when bool_or(bi.priority = 'a_qualifier') then 'a_qualifier'
        when bool_or(bi.priority = 'a_suivre') then 'a_suivre'
        else null end
      from public.buyer_interests bi where bi.buyer_profile_id = v_profile_id),
    last_touch = coalesce(v_i.last_touch, bp.last_touch)
  where bp.id = v_profile_id;

  select source into v_criteria_source
    from public.buyer_search_criteria where buyer_profile_id = v_profile_id;

  if v_criteria_source is null or v_criteria_source = 'funnel' then
    v_bounds := public.buyer_band_bounds(v_i.budget_band);
    select p.property_type, lower(btrim(coalesce(p.location_city, '')))
      into v_property_type, v_property_city
      from public.properties p where p.id = v_i.property_id;
    v_property_city := nullif(v_property_city, '');

    insert into public.buyer_search_criteria as c (
      buyer_profile_id, property_types, locations,
      budget_min_cents, budget_max_cents,
      purchase_horizon, financing, project_nature, decision_mode, source)
    values (
      v_profile_id,
      case when v_property_type is null then '{}'::text[] else array[v_property_type] end,
      case when v_property_city is null then '{}'::text[] else array[v_property_city] end,
      (v_bounds->>'min')::bigint, (v_bounds->>'max')::bigint,
      v_i.purchase_horizon, v_i.financing, v_i.project_nature, v_i.decision_mode,
      'funnel')
    on conflict (buyer_profile_id) do update set
      property_types = (
        select coalesce(array_agg(distinct t), '{}'::text[])
        from unnest(c.property_types || case when v_property_type is null
                    then '{}'::text[] else array[v_property_type] end) as t
        where t is not null and t <> ''),
      locations = (
        select coalesce(array_agg(distinct l), '{}'::text[])
        from unnest(c.locations || case when v_property_city is null
                    then '{}'::text[] else array[v_property_city] end) as l
        where l is not null and l <> ''),
      budget_min_cents = case
        when c.budget_min_cents is null or (v_bounds->>'min')::bigint is null then null
        else least(c.budget_min_cents, (v_bounds->>'min')::bigint) end,
      budget_max_cents = case
        when c.budget_max_cents is null or (v_bounds->>'max')::bigint is null then null
        else greatest(c.budget_max_cents, (v_bounds->>'max')::bigint) end,
      purchase_horizon = coalesce(v_i.purchase_horizon, c.purchase_horizon),
      financing = coalesce(v_i.financing, c.financing),
      project_nature = coalesce(v_i.project_nature, c.project_nature),
      decision_mode = coalesce(v_i.decision_mode, c.decision_mode);
  end if;

  if v_created then
    insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
    values (auth.uid(), 'buyer_profile', v_profile_id, 'acquereur_profil_cree',
            jsonb_build_object('contact_id', v_i.contact_id, 'property_id', v_i.property_id));
  else
    insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
    values (auth.uid(), 'buyer_profile', v_profile_id, 'acquereur_interet_rattache',
            jsonb_build_object('interest_id', p_interest_id, 'property_id', v_i.property_id));
  end if;

  return v_profile_id;
end;
$$;

-- Helper interne : aucun droit pour les roles publics.
revoke all on function public.buyer_attach_interest(uuid) from public, anon, authenticated;
