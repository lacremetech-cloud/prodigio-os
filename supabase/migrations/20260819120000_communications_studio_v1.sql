-- =============================================================================
-- Studio Communications & Workflows — V1 (mode BROUILLON)
--
-- Portée STRICTEMENT additive et minimale. Cette migration :
--   • n'ajoute AUCUNE table (aucun doublon de `contacts`, `privacy_records`,
--     `communication_messages`, `communication_outbox`, `communication_templates`
--     ni `communication_suppressions`) ;
--   • ne modifie AUCUNE migration historique (les fichiers antérieurs restent
--     intacts ; seuls des objets sont ajoutés ou redéfinis ici) ;
--   • ne crée AUCUN déclencheur, AUCUN cron, AUCUN moteur d'exécution ;
--   • ne touche NI aux six événements transactionnels déjà couverts, NI à leurs
--     déclencheurs, NI à la politique d'éligibilité, NI au dispatcher.
--
-- Ce qu'elle apporte :
--   1. Un modèle d'automatisation PERSONNALISÉE strictement de brouillon :
--      le statut `actif` devient IMPOSSIBLE au niveau de la CONTRAINTE, pas
--      seulement au niveau applicatif. Aucune automatisation personnalisée ne
--      peut donc être exécutée, ni reliée au runtime réel.
--   2. Un cycle de revue explicite : brouillon → prêt pour revue → suspendu →
--      archivé.
--   3. L'épinglage d'une VERSION de modèle sur une automatisation brouillon.
--   4. Un catalogue de CONDITIONS déclaratives, déterministes et validé en base.
--   5. L'alignement des droits sur le modèle d'accès documenté : administrateur
--      ET manager gèrent modèles et workflows ; la levée d'opposition reste
--      réservée à l'administrateur.
--
-- ⚠️ Les SIX automatisations transactionnelles existantes ne sont PAS des lignes
-- de `communication_automations` : elles sont portées par les déclencheurs SQL
-- de la migration 20260818120000 et décrites par le catalogue TypeScript
-- `src/modules/communications/events.ts`. Le studio les présente en LECTURE
-- SEULE à partir de cette source unique — aucune ligne n'est dupliquée.
-- =============================================================================
begin;

-- =============================================================================
-- 1. GARDE-FOU — refuser la migration si une automatisation ACTIVE existe.
--    On ne restreint jamais un statut sans avoir vérifié qu'aucune donnée
--    existante ne devient invalide.
-- =============================================================================
do $$
declare v_active integer;
begin
  select count(*) into v_active
  from public.communication_automations where status = 'actif';

  if v_active > 0 then
    raise exception
      'migration refusée : % automatisation(s) active(s). Le studio V1 n''autorise que des brouillons ; suspendez-les avant d''appliquer.',
      v_active
      using errcode = '22023';
  end if;
end $$;

-- =============================================================================
-- 2. AUTOMATISATIONS PERSONNALISÉES — brouillon uniquement, par CONTRAINTE.
-- =============================================================================

-- Version de modèle ÉPINGLÉE (facultative). `null` = « version active au moment
-- de l'exécution » ; un entier = photographie explicite d'une version précise.
-- Aucune exécution n'a lieu en V1 : ce champ prépare la V1.1 sans l'ouvrir.
alter table public.communication_automations
  add column if not exists template_version integer
    check (template_version is null or template_version >= 1);

comment on column public.communication_automations.template_version is
  'Version de modèle épinglée pour cette automatisation brouillon. NULL = version active à l''exécution. Aucune exécution n''existe en V1.';

-- Le statut `actif` est RETIRÉ du domaine : une automatisation personnalisée ne
-- peut pas être activée, même par un administrateur, même en contournant
-- l'application. C'est la garantie la plus forte contre une exécution réelle.
alter table public.communication_automations
  drop constraint if exists communication_automations_status_check;

alter table public.communication_automations
  add constraint communication_automations_status_check
    check (status in ('brouillon', 'pret_pour_revue', 'en_pause', 'archive'));

comment on table public.communication_automations is
  'Automatisations PERSONNALISÉES, en BROUILLON exclusivement (brouillon / prêt pour revue / suspendu / archivé). Le statut `actif` est interdit par contrainte : aucune automatisation personnalisée ne peut s''exécuter ni être reliée au runtime en V1. Les six automatisations SYSTÈME (transactionnelles) ne figurent PAS dans cette table : elles sont portées par les déclencheurs SQL et le catalogue d''événements, et restent en lecture seule.';

comment on column public.communication_automations.conditions is
  'Conditions DÉCLARATIVES et DÉTERMINISTES, validées par `comm_automation_conditions_valid`. Jamais de code arbitraire, jamais de donnée personnelle.';

-- =============================================================================
-- 3. CATALOGUE DE CONDITIONS — déclaratif, déterministe, validé en base.
--    Une condition est un couple `clé → valeur` issu d'un catalogue FERMÉ.
--    Aucune expression, aucun code, aucune PII.
-- =============================================================================
create or replace function public.comm_automation_conditions_valid(p_conditions jsonb)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select
    p_conditions is null
    or (
      jsonb_typeof(p_conditions) = 'object'
      and not exists (
        select 1 from jsonb_each(p_conditions) as e(key, value)
        where key not in (
                'segment',              -- segment du bien (cible premium / hors cible)
                'stade',                -- stade du pipeline de l'opportunité
                'canal_autorise',       -- canal explicitement autorisé par le choix RGPD
                'categorie',            -- transactionnel / marketing
                'source',               -- source d'attribution de la soumission
                'sans_opposition',      -- aucune opposition active pour le canal
                'sans_message_recent'   -- aucun message du même modèle récemment préparé
              )
           or jsonb_typeof(value) not in ('string', 'boolean', 'number')
      )
    );
$$;

comment on function public.comm_automation_conditions_valid(jsonb) is
  'HELPER INTERNE — valide qu''un objet de conditions n''utilise que des clés du catalogue fermé et des valeurs scalaires. Déterministe : aucune expression, aucun code, aucune donnée personnelle.';

revoke all on function public.comm_automation_conditions_valid(jsonb) from public, anon, authenticated;

alter table public.communication_automations
  drop constraint if exists communication_automations_conditions_declaratives;

alter table public.communication_automations
  add constraint communication_automations_conditions_declaratives
    check (public.comm_automation_conditions_valid(conditions));

-- =============================================================================
-- 4. ÉCRITURE DES AUTOMATISATIONS — brouillon forcé, activation impossible.
--    L'ancienne signature est remplacée (ajout de `p_template_version`) afin
--    d'éviter toute surcharge ambiguë côté PostgREST.
-- =============================================================================
drop function if exists public.crm_comm_upsert_automation(
  text, text, text, text, text, integer, jsonb, jsonb, text);

create or replace function public.crm_comm_upsert_automation(
  p_automation_key text,
  p_name text,
  p_trigger_event text,
  p_template_key text,
  p_channel text,
  p_delay_minutes integer default 0,
  p_conditions jsonb default '{}'::jsonb,
  p_exit_rules jsonb default '{}'::jsonb,
  p_notes text default null,
  p_template_version integer default null)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_version integer;
  v_id uuid;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  -- Modèle d'accès documenté : administrateur ET manager pilotent les workflows.
  if not public.comm_can_manage() then
    raise exception 'droits insuffisants sur les automatisations' using errcode = '42501';
  end if;
  if p_automation_key !~ '^[a-z0-9_]{3,64}$' then
    raise exception 'clé d''automatisation invalide' using errcode = '22023';
  end if;
  if not public.comm_automation_conditions_valid(p_conditions) then
    raise exception 'conditions non déclaratives ou hors catalogue' using errcode = '22023';
  end if;
  if p_template_version is not null and p_template_version < 1 then
    raise exception 'version de modèle invalide' using errcode = '22023';
  end if;

  v_org := coalesce(public.crm_current_operator_org(), public.comm_operator_org());
  if v_org is null then raise exception 'organisation introuvable' using errcode = '22023'; end if;

  -- Une version épinglée doit EXISTER : on ne prépare jamais un brouillon qui
  -- référence une version de modèle inexistante.
  if p_template_version is not null and not exists (
    select 1 from public.communication_templates
    where organization_id = v_org
      and template_key = p_template_key
      and version = p_template_version
  ) then
    raise exception 'version de modèle introuvable pour cette clé' using errcode = '22023';
  end if;

  -- Nouvelle VERSION d'automatisation : on n'écrase jamais une version existante.
  select coalesce(max(version), 0) + 1 into v_version
  from public.communication_automations
  where organization_id = v_org and automation_key = p_automation_key;

  insert into public.communication_automations (
    organization_id, automation_key, version, name, trigger_event, conditions,
    delay_minutes, template_key, template_version, channel, exit_rules, notes,
    status, created_by, updated_by)
  values (
    v_org, p_automation_key, v_version, p_name, p_trigger_event,
    coalesce(p_conditions, '{}'::jsonb), coalesce(p_delay_minutes, 0),
    p_template_key, p_template_version, p_channel,
    coalesce(p_exit_rules, '{}'::jsonb), p_notes,
    -- Statut FORCÉ : une automatisation naît toujours en brouillon.
    'brouillon', v_uid, v_uid)
  returning id into v_id;

  -- L'audit ne porte que des identifiants et des clés techniques : aucune PII.
  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'communication_automation', v_id,
          case when v_version = 1 then 'automatisation_creee' else 'automatisation_maj' end,
          jsonb_build_object('automation_key', p_automation_key, 'version', v_version,
                             'trigger_event', p_trigger_event, 'status', 'brouillon'));

  return jsonb_build_object('ok', true, 'id', v_id, 'version', v_version, 'status', 'brouillon');
end;
$$;

comment on function public.crm_comm_upsert_automation(text, text, text, text, text, integer, jsonb, jsonb, text, integer) is
  'Crée une nouvelle VERSION d''automatisation PERSONNALISÉE, toujours en `brouillon`. Administrateur ou manager. Aucune activation possible : le statut `actif` n''existe plus dans le domaine.';

-- Transitions de statut : `actif` est refusé explicitement, avec un message
-- lisible, en plus du refus par contrainte.
create or replace function public.crm_comm_set_automation_status(p_automation_id uuid, p_status text)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_old text; v_key text;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.comm_can_manage() then
    raise exception 'droits insuffisants sur les automatisations' using errcode = '42501';
  end if;

  if p_status = 'actif' then
    raise exception 'une automatisation personnalisée ne peut pas être activée en V1 : elle reste un brouillon, sans exécution ni runtime'
      using errcode = '42501';
  end if;
  if p_status not in ('brouillon', 'pret_pour_revue', 'en_pause', 'archive') then
    raise exception 'statut inconnu' using errcode = '22023';
  end if;

  select status, automation_key into v_old, v_key
  from public.communication_automations where id = p_automation_id;
  if v_old is null then raise exception 'automatisation introuvable' using errcode = '22023'; end if;

  update public.communication_automations
  set status = p_status, updated_by = v_uid where id = p_automation_id;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, old_value, new_value)
  values (v_uid, 'communication_automation', p_automation_id, 'automatisation_statut',
          jsonb_build_object('status', v_old), jsonb_build_object('status', p_status));

  return jsonb_build_object('ok', true, 'status', p_status);
end;
$$;

comment on function public.crm_comm_set_automation_status(uuid, text) is
  'Fait évoluer une automatisation PERSONNALISÉE entre brouillon, prêt pour revue, suspendu et archivé. Le statut `actif` est refusé (42501) : aucune exécution n''est possible en V1.';

-- =============================================================================
-- 5. SURFACE EXECUTE — révocation systématique puis octroi explicite.
--    Même convention que 20260817120000 et 20260818120000.
-- =============================================================================
do $$
declare
  fn text;
  actions text[] := array[
    'public.crm_comm_upsert_automation(text, text, text, text, text, integer, jsonb, jsonb, text, integer)',
    'public.crm_comm_set_automation_status(uuid, text)'
  ];
begin
  foreach fn in array actions loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end $$;

commit;
