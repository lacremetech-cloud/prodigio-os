-- =============================================================================
-- Biens partenaires — correctifs d'invariants
-- =============================================================================
-- Migration CORRECTIVE de `properties_sans_mandat_v1`, déjà appliquée. Cette
-- dernière n'est ni modifiée, ni renommée, ni rejouée : les écarts sont corrigés
-- ici, de façon additive.
--
-- ÉCART 1 — Jeton d'origine
--   Appliqué : `bien_partenaire`. Attendu : `partenaire_commercialisation`.
--   Aucune ligne ne portait l'ancien jeton au moment de la correction (seul un
--   bien existe, en `mandat_prodigio`). La mise à jour est écrite malgré tout :
--   une migration doit être rejouable sur une base vierge ou intermédiaire.
--
-- ÉCART 2 — Organisation porteuse non obligatoire
--   La contrainte de cohérence n'exigeait pas `holder_organization_id` pour un
--   bien partenaire. Un tel bien pouvait donc exister sans organisation : ni
--   mandat, ni porteur. C'est précisément l'état que le modèle doit interdire.
--
-- ÉCART 3 — `ON DELETE SET NULL` sur l'organisation porteuse
--   Supprimer une organisation mettait `holder_organization_id` à NULL, ce qui
--   aurait silencieusement orphelin le bien — et, depuis l'écart 2 corrigé,
--   violé la contrainte. On passe en `RESTRICT` : une organisation qui porte
--   encore des biens ne se supprime pas.
-- =============================================================================

-- --- 1. Jeton d'origine ------------------------------------------------------
-- La contrainte est retirée avant la mise à jour des données, puis reposée
-- élargie : sans cela, l'UPDATE violerait la contrainte en vigueur.
alter table public.properties
  drop constraint if exists properties_origin_coherence_check;
alter table public.properties
  drop constraint if exists properties_commercialization_origin_check;

update public.properties
   set commercialization_origin = 'partenaire_commercialisation'
 where commercialization_origin = 'bien_partenaire';

alter table public.properties
  add constraint properties_commercialization_origin_check
  check (commercialization_origin in ('mandat_prodigio', 'partenaire_commercialisation'));

-- --- 2. Cohérence complète, organisation porteuse comprise -------------------
alter table public.properties
  add constraint properties_origin_coherence_check
  check (
    (commercialization_origin = 'mandat_prodigio'
       and opportunity_id is not null
       and mandate_id is not null)
    or
    (commercialization_origin = 'partenaire_commercialisation'
       and opportunity_id is null
       and mandate_id is null
       and holder_organization_id is not null)
  );

comment on column public.properties.commercialization_origin is
  'Porte d''entrée du bien dans la Fabrique. `mandat_prodigio` : issu d''un mandat signé (crm_handoff_create_property) — opportunité ET mandat renseignés. `partenaire_commercialisation` : bien détenu par une organisation partenaire qui le commercialise elle-même — ni opportunité ni mandat, mais organisation porteuse OBLIGATOIRE. Aucun bien ne peut exister sans l''un ou l''autre rattachement.';

-- --- 3. Une organisation qui porte des biens ne se supprime pas --------------
do $$
declare v_name text;
begin
  select conname into v_name from pg_constraint
   where conrelid = 'public.properties'::regclass and contype = 'f'
     and pg_get_constraintdef(oid) ilike '%holder_organization_id%';
  if v_name is not null then
    execute format('alter table public.properties drop constraint %I', v_name);
  end if;
end $$;

alter table public.properties
  add constraint properties_holder_organization_fkey
  foreign key (holder_organization_id) references public.organizations(id)
  on delete restrict;

-- --- 4. La fonction de création reprend le jeton corrigé ---------------------
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
  -- L'organisation est vérifiée EN BASE : le navigateur ne peut pas en imposer
  -- une qui n'existe pas, et la contrainte de cohérence la rend obligatoire.
  if not exists (select 1 from public.organizations where id = p_holder_organization_id) then
    raise exception 'organisation porteuse introuvable' using errcode = '22023';
  end if;

  -- Idempotence par (organisation porteuse, nom de projet) : rejouer l'appel ne
  -- crée jamais un second bien pour la même villa.
  select id into v_id from public.properties
   where commercialization_origin = 'partenaire_commercialisation'
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
     'preparation_a_lancer', v_uid, v_name, 'partenaire_commercialisation')
  returning id into v_id;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'property', v_id, 'bien_cree',
          jsonb_build_object('origine', 'partenaire_commercialisation',
                             'holder_organization_id', p_holder_organization_id));

  return jsonb_build_object('ok', true, 'id', v_id, 'already', false);
end;
$$;

comment on function public.crm_property_create_partner(uuid, text) is
  'Crée un bien détenu par une organisation partenaire, SANS mandat ni opportunité (commercialization_origin = partenaire_commercialisation). Organisation porteuse obligatoire et vérifiée en base. Réservée aux décisionnaires (crm_can_decide). Idempotente par (organisation porteuse, nom de projet). Le bien naît en brouillon : preparation_a_lancer, jamais publié, sans slug ni formulaire actif.';

revoke all on function public.crm_property_create_partner(uuid, text) from public, anon;
grant execute on function public.crm_property_create_partner(uuid, text) to authenticated;
