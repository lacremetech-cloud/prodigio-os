-- =============================================================================
-- Biens sans mandat Prodigio — seconde porte d'entrée de la Fabrique
-- =============================================================================
-- CONTEXTE MÉTIER
-- Jusqu'ici, un bien n'existait QUE parce qu'un mandat Prodigio avait été signé
-- (`crm_handoff_create_property`). Ce chemin reste la voie principale.
--
-- Il existe un second cas, réel et légitime : un **partenaire marchand de biens,
-- lui-même agent immobilier, propriétaire de ses biens**. Il n'y a alors AUCUN
-- mandat de vente à confier — Prodigio l'assiste en commercialisation (création,
-- landings, campagnes) et lui transmet les acquéreurs générés.
--
-- Ce n'est pas un contournement du modèle : c'est une porte d'entrée distincte,
-- explicitement tracée par `commercialization_origin`. Un bien entré par mandat
-- reste un bien entré par mandat.
--
-- ⚠️ Cette migration n'invente AUCUN fait contractuel. Elle ne crée ni mandat
-- fictif, ni opportunité de complaisance : elle reconnaît qu'un bien peut
-- exister sans l'un ni l'autre.
--
-- STRICTEMENT ADDITIVE
--   - Deux contraintes NOT NULL retirées (élargissement, jamais restriction).
--   - Une colonne ajoutée, avec défaut : les lignes existantes conservent leur
--     sémantique actuelle (`mandat_prodigio`).
--   - Une fonction de création ajoutée.
--   - Une fonction d'accès ÉLARGIE d'une branche (l'agent de l'organisation
--     porteuse). Aucune branche existante n'est retirée ni modifiée.
--   - Une politique RLS élargie de la même branche.
-- Aucune migration historique n'est touchée.
-- =============================================================================

-- --- 1. Un bien peut exister sans mandat ni opportunité ----------------------
alter table public.properties alter column mandate_id drop not null;
alter table public.properties alter column opportunity_id drop not null;

-- Les index uniques de PostgreSQL considèrent chaque NULL comme distinct : les
-- biens partenaires (mandate_id NULL) cohabitent donc sans conflit, tandis que
-- l'unicité « un bien par mandat » reste garantie pour les biens sous mandat.

-- --- 2. Tracer la porte d'entrée --------------------------------------------
alter table public.properties
  add column if not exists commercialization_origin text not null default 'mandat_prodigio';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'properties_commercialization_origin_check'
  ) then
    alter table public.properties
      add constraint properties_commercialization_origin_check
      check (commercialization_origin in ('mandat_prodigio', 'bien_partenaire'));
  end if;
end $$;

comment on column public.properties.commercialization_origin is
  'Porte d''entrée du bien dans la Fabrique. `mandat_prodigio` : issu d''un mandat signé (crm_handoff_create_property), avec opportunité et mandat renseignés. `bien_partenaire` : bien détenu par une organisation partenaire qui le commercialise elle-même, sans mandat Prodigio — opportunity_id et mandate_id sont alors nuls.';

-- Invariant : un bien issu d'un mandat garde ses deux références ; un bien
-- partenaire n'en a aucune. On n'autorise pas les états intermédiaires.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'properties_origin_coherence_check'
  ) then
    alter table public.properties
      add constraint properties_origin_coherence_check
      check (
        (commercialization_origin = 'mandat_prodigio'
           and opportunity_id is not null and mandate_id is not null)
        or
        (commercialization_origin = 'bien_partenaire'
           and opportunity_id is null and mandate_id is null)
      );
  end if;
end $$;

-- --- 3. Création officielle d'un bien partenaire -----------------------------
create or replace function public.crm_property_create_partner(
  p_holder_organization_id uuid,
  p_project_name text
)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_name text := nullif(btrim(p_project_name), '');
  v_id uuid;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.crm_can_decide() then
    raise exception 'droits insuffisants pour créer un bien' using errcode = '42501';
  end if;
  if v_name is null then
    raise exception 'nom de projet requis' using errcode = '22023';
  end if;
  if p_holder_organization_id is null then
    raise exception 'organisation porteuse requise' using errcode = '22023';
  end if;
  if not exists (select 1 from public.organizations where id = p_holder_organization_id) then
    raise exception 'organisation porteuse introuvable' using errcode = '22023';
  end if;

  -- Idempotence par (organisation porteuse, nom de projet) : rejouer l'appel ne
  -- crée jamais un second bien pour la même villa.
  select id into v_id from public.properties
   where commercialization_origin = 'bien_partenaire'
     and holder_organization_id = p_holder_organization_id
     and lower(btrim(project_name)) = lower(v_name)
   limit 1;
  if v_id is not null then
    return jsonb_build_object('ok', true, 'id', v_id, 'already', true);
  end if;

  v_org := public.crm_current_operator_org();

  insert into public.properties
    (organization_id, opportunity_id, mandate_id, holder_organization_id,
     status, created_by, project_name, commercialization_origin)
  values
    (v_org, null, null, p_holder_organization_id,
     'preparation_a_lancer', v_uid, v_name, 'bien_partenaire')
  returning id into v_id;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'property', v_id, 'bien_cree',
          jsonb_build_object('origine', 'bien_partenaire',
                             'holder_organization_id', p_holder_organization_id));

  return jsonb_build_object('ok', true, 'id', v_id, 'already', false);
end;
$$;

comment on function public.crm_property_create_partner(uuid, text) is
  'Crée un bien détenu par une organisation partenaire, SANS mandat ni opportunité (commercialization_origin = bien_partenaire). Réservée aux décisionnaires. Idempotente par (organisation porteuse, nom de projet). Le bien naît en brouillon : preparation_a_lancer, jamais publié.';

revoke all on function public.crm_property_create_partner(uuid, text) from public, anon;
grant execute on function public.crm_property_create_partner(uuid, text) to authenticated;

-- --- 4. Accès : l'agent de l'organisation porteuse voit son bien -------------
-- Branche AJOUTÉE. Les deux branches existantes (opérateur Prodigio, agent
-- affecté au dossier d'origine) sont reprises à l'identique.
create or replace function public.crm_property_access(p_property_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.properties p
    where p.id = p_property_id
      and (
        public.crm_is_operator()
        or (public.crm_has_role('agent_immobilier')
            and p.opportunity_id in (select public.crm_assigned_opportunity_ids()))
        or (public.crm_has_role('agent_immobilier')
            and p.holder_organization_id is not null
            and exists (
              select 1 from public.organization_memberships m
              where m.organization_id = p.holder_organization_id
                and m.user_id = auth.uid()
            ))
      )
  );
$$;

comment on function public.crm_property_access(uuid) is
  'Vrai si l''utilisateur courant peut accéder au bien : opérateur Prodigio ; agent affecté au dossier d''origine ; ou agent membre de l''organisation porteuse du bien. Aucun accès global implicite.';

revoke all on function public.crm_property_access(uuid) from public;
grant execute on function public.crm_property_access(uuid) to authenticated;

-- --- 5. RLS de `properties` : même élargissement -----------------------------
drop policy if exists properties_read on public.properties;
create policy properties_read on public.properties
  for select to authenticated
  using (
    public.crm_is_operator()
    or (public.crm_has_role('agent_immobilier')
        and opportunity_id in (select public.crm_assigned_opportunity_ids()))
    or (public.crm_has_role('agent_immobilier')
        and holder_organization_id is not null
        and exists (
          select 1 from public.organization_memberships m
          where m.organization_id = properties.holder_organization_id
            and m.user_id = auth.uid()
        ))
  );
