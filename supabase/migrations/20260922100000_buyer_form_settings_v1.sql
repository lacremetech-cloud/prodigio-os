-- =============================================================================
-- Réglages du formulaire acquéreur — brochure, domaines autorisés, pilotage
-- =============================================================================
-- Complète `20260922090000_buyer_universal_form_v1.sql`. Tout est ADDITIF.
--
-- Principe directeur : **régler le formulaire ne publie jamais la vitrine.**
-- Poser un slug, activer la collecte, définir la brochure et autoriser des
-- domaines sont des gestes d'exploitation. Publier la page Prodigio reste une
-- décision distincte, avec ses propres critères et sa propre fonction.
-- =============================================================================

-- --- 1. Destination de la brochure et domaines autorisés ---------------------
alter table public.property_public_config
  add column if not exists buyer_form_brochure_url text;

alter table public.property_public_config
  add column if not exists buyer_form_allowed_origins text[] not null default '{}';

comment on column public.property_public_config.buyer_form_brochure_url is
  'Destination de la brochure remise APRÈS une soumission valide. Jamais exposée avant : la route publique n''en révèle que la disponibilité, pas l''adresse.';

comment on column public.property_public_config.buyer_form_allowed_origins is
  'Origines (schéma + hôte) autorisées à embarquer le formulaire en iframe. Vide = aucune intégration tierce permise, la route reste accessible en direct. Sert à composer `frame-ancestors` — jamais une liste de confiance pour autre chose.';

-- --- 2. Pilotage depuis le cockpit -------------------------------------------
-- Une seule fonction pour les quatre réglages, afin qu'un slug ne puisse pas
-- être posé sans que l'auteur soit tracé. Chaque paramètre à NULL laisse la
-- valeur en place (mise à jour partielle), SAUF le statut qui est explicite.
create or replace function public.crm_property_set_buyer_form(
  p_property_id uuid,
  p_slug text default null,
  p_status text default null,
  p_brochure_url text default null,
  p_allowed_origins text[] default null
)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := auth.uid();
  v_slug text;
  v_row  public.property_public_config%rowtype;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode = '28000'; end if;
  if not public.crm_property_access(p_property_id) then
    raise exception 'droits insuffisants sur ce bien' using errcode = '42501';
  end if;
  -- Ouvrir la collecte de demandes engage l'organisation : décision réservée.
  if p_status is not null and not public.crm_can_decide() then
    raise exception 'seul un administrateur ou un manager active le formulaire' using errcode = '42501';
  end if;
  if p_status is not null and p_status not in ('inactif', 'actif') then
    raise exception 'statut de formulaire invalide' using errcode = '22023';
  end if;

  if p_slug is not null then
    v_slug := public.normalize_public_slug(p_slug);
    if v_slug is null then
      raise exception 'identifiant public invalide' using errcode = '22023';
    end if;
    -- Un slug appartient à un seul bien : deux formulaires ne se recouvrent pas.
    if exists (
      select 1 from public.property_public_config c
      where lower(c.slug) = v_slug and c.property_id <> p_property_id
    ) then
      raise exception 'cet identifiant public est déjà utilisé' using errcode = '23505';
    end if;
  end if;

  -- La brochure doit être une adresse http(s) : ni javascript:, ni data:.
  if p_brochure_url is not null and btrim(p_brochure_url) <> ''
     and btrim(p_brochure_url) !~* '^https?://[^[:space:]]+$' then
    raise exception 'adresse de brochure invalide' using errcode = '22023';
  end if;

  -- La ligne peut ne pas exister : un bien partenaire naît sans configuration
  -- publique. On la crée en BROUILLON — jamais publiée par ce geste.
  insert into public.property_public_config (property_id, publication_status, updated_by)
  values (p_property_id, 'brouillon', v_uid)
  on conflict (property_id) do nothing;

  update public.property_public_config set
    slug = coalesce(v_slug, slug),
    buyer_form_status = coalesce(p_status, buyer_form_status),
    buyer_form_brochure_url = case
      when p_brochure_url is null then buyer_form_brochure_url
      when btrim(p_brochure_url) = '' then null
      else btrim(p_brochure_url) end,
    buyer_form_allowed_origins = coalesce(p_allowed_origins, buyer_form_allowed_origins),
    updated_by = v_uid
  where property_id = p_property_id
  returning * into v_row;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'property', p_property_id, 'formulaire_acquereur',
          jsonb_build_object(
            'slug', v_row.slug,
            'buyer_form_status', v_row.buyer_form_status,
            'brochure_definie', v_row.buyer_form_brochure_url is not null,
            'origines_autorisees', coalesce(array_length(v_row.buyer_form_allowed_origins, 1), 0),
            -- On consigne que la publication n'a PAS bougé : le lecteur du
            -- journal doit pouvoir le constater sans recouper.
            'publication_status', v_row.publication_status));

  return jsonb_build_object(
    'ok', true,
    'slug', v_row.slug,
    'buyer_form_status', v_row.buyer_form_status,
    'publication_status', v_row.publication_status);
end;
$$;

comment on function public.crm_property_set_buyer_form(uuid, text, text, text, text[]) is
  'Règle le formulaire acquéreur d''un bien : identifiant public, activation, brochure, domaines autorisés. Ne publie JAMAIS la vitrine — la configuration est créée en brouillon si elle n''existe pas, et `publication_status` n''est jamais touché. Activer la collecte est réservé aux décisionnaires.';

revoke all on function public.crm_property_set_buyer_form(uuid, text, text, text, text[]) from public, anon;
grant execute on function public.crm_property_set_buyer_form(uuid, text, text, text, text[]) to authenticated;

-- --- 3. Contexte public MINIMAL du formulaire --------------------------------
-- Une route de formulaire ne doit rien révéler du bien tant que la vitrine
-- n'est pas publiée : ni nom, ni prix, ni adresse, ni contenu non validé. Cette
-- fonction ne renvoie donc que ce qui sert à AFFICHER le formulaire, et le nom
-- public uniquement lorsque le bien est effectivement publié.
create or replace function public.buyer_form_context(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when c.property_id is null then null
    when coalesce(c.buyer_form_status, 'inactif') <> 'actif'
         and c.publication_status <> 'publie' then null
    else jsonb_build_object(
      'slug', c.slug,
      -- Nom révélé UNIQUEMENT si la vitrine est publiée. Sinon, la page reste
      -- volontairement anonyme : le visiteur vient d'une annonce qui, elle,
      -- présente déjà le bien.
      'public_name', case when c.publication_status = 'publie' then c.public_name end,
      'published', c.publication_status = 'publie',
      -- Disponibilité de la brochure, jamais son adresse.
      'brochure_available', c.buyer_form_brochure_url is not null,
      'allowed_origins', to_jsonb(coalesce(c.buyer_form_allowed_origins, '{}')))
  end
  from public.property_public_config c
  where lower(c.slug) = public.normalize_public_slug(p_slug)
  limit 1;
$$;

comment on function public.buyer_form_context(text) is
  'Contexte MINIMAL nécessaire pour afficher le formulaire acquéreur. Renvoie NULL si le slug est inconnu, ou si le formulaire est inactif et la vitrine non publiée. Ne divulgue ni prix, ni adresse, ni contenu non validé ; le nom public n''apparaît que si la vitrine est publiée, et l''adresse de la brochure jamais.';

revoke all on function public.buyer_form_context(text) from public;
grant execute on function public.buyer_form_context(text) to anon, authenticated;

-- --- 4. Brochure remise APRÈS une soumission valide --------------------------
-- L'adresse n'est délivrée que contre un intérêt réellement enregistré : elle
-- ne peut pas être obtenue en devinant un slug.
create or replace function public.buyer_form_brochure(p_slug text, p_interest_id uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.buyer_form_brochure_url
  from public.property_public_config c
  join public.buyer_interests i
    on i.property_id = c.property_id and i.id = p_interest_id
  where lower(c.slug) = public.normalize_public_slug(p_slug)
    and (coalesce(c.buyer_form_status, 'inactif') = 'actif' or c.publication_status = 'publie')
  limit 1;
$$;

comment on function public.buyer_form_brochure(text, uuid) is
  'Adresse de la brochure, délivrée UNIQUEMENT contre un intérêt réellement enregistré pour ce bien. Deviner un slug ne suffit pas : il faut l''identifiant d''un dépôt existant, renvoyé par submit_buyer_interest à son auteur.';

revoke all on function public.buyer_form_brochure(text, uuid) from public;
grant execute on function public.buyer_form_brochure(text, uuid) to anon, authenticated;
