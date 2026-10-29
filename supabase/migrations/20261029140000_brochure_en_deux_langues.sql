-- LA BROCHURE EXISTE EN DEUX LANGUES, LE RÉGLAGE N'EN PORTAIT QU'UNE.
--
-- Après l'envoi du formulaire, c'est Prodigio OS qui dit au site vers quelle
-- adresse rediriger le visiteur, et le site — par sécurité — n'accepte que sa
-- propre origine. Une seule colonne `buyer_form_brochure_url` ne peut donc pas
-- servir à la fois `/brochure/` et `/en/brochure/` : l'anglophone recevait
-- l'adresse française.
--
-- Les publicités 9 à 12 des Airelles visent le Royaume-Uni, les Pays-Bas et
-- l'Europe de l'Est et pointent sur la version anglaise de la landing. Un
-- parcours anglais qui se termine sur une brochure française, c'est le clic
-- payé puis perdu à la dernière seconde.
--
-- AUCUNE COUPURE. Chaque fonction est remplacée par une version dont le
-- paramètre de langue porte une valeur PAR DÉFAUT : le code déjà déployé
-- appelle avec ses anciens arguments, obtient 'fr', et se comporte exactement
-- comme avant. On peut donc appliquer cette migration avant de livrer le code.
--
-- REPLI SUR LE FRANÇAIS, DÉLIBÉRÉ. Quand l'adresse anglaise n'est pas
-- renseignée — c'est le cas des deux villas de Cassis, qui n'ont pas de
-- version anglaise — on renvoie l'adresse française plutôt que rien. Une
-- brochure dans la mauvaise langue reste une brochure ; `null` serait une
-- promesse non tenue, et la personne a rempli le formulaire pour ça.

alter table public.property_public_config
  add column if not exists buyer_form_brochure_url_en text;

comment on column public.property_public_config.buyer_form_brochure_url_en is
  'Adresse de la brochure servie aux parcours anglais. Vide = on sert '
  'l''adresse française : une brochure dans la mauvaise langue vaut mieux '
  'qu''aucune brochure.';

-- --------------------------------------------------------------------------
-- 1. L'adresse renvoyée au site après l'envoi du formulaire.
-- --------------------------------------------------------------------------
drop function if exists public.buyer_form_brochure(text, uuid);

create or replace function public.buyer_form_brochure(
  p_slug text,
  p_interest_id uuid,
  p_langue text default 'fr'
) returns text
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select case
           when lower(coalesce(p_langue, 'fr')) = 'en'
             then coalesce(nullif(btrim(c.buyer_form_brochure_url_en), ''),
                           c.buyer_form_brochure_url)
           else c.buyer_form_brochure_url
         end
  from public.property_public_config c
  join public.buyer_interests i
    on i.property_id = c.property_id and i.id = p_interest_id
  where lower(c.slug) = public.normalize_public_slug(p_slug)
    and (coalesce(c.buyer_form_status, 'inactif') = 'actif' or c.publication_status = 'publie')
  limit 1;
$function$;

-- --------------------------------------------------------------------------
-- 2. La cible du lien court `brochure.prodigio.fr/<slug>` — celui du SMS.
--
-- C'est ce qui permet de ne JAMAIS écrire l'adresse de la vitrine dans un SMS :
-- un SMS parti ne se corrige pas, et la vitrine des Airelles vient justement
-- de déménager de `.vercel.app` vers `prodigio.fr`. Le lien court a survécu ;
-- l'adresse directe aurait été morte dans tous les messages déjà reçus.
-- --------------------------------------------------------------------------
drop function if exists public.brochure_cible(text);

create or replace function public.brochure_cible(
  p_slug text,
  p_langue text default 'fr'
) returns table(property_id uuid, brochure_url text)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select c.property_id,
         case
           when lower(coalesce(p_langue, 'fr')) = 'en'
             then coalesce(nullif(btrim(c.buyer_form_brochure_url_en), ''),
                           c.buyer_form_brochure_url)
           else c.buyer_form_brochure_url
         end
  from public.property_public_config c
  where (c.brochure_slug = p_slug or c.slug = p_slug)
    and c.buyer_form_brochure_url is not null
  order by (c.brochure_slug = p_slug) desc
  limit 1;
$function$;

-- --------------------------------------------------------------------------
-- 3. Le réglage, pour que l'adresse anglaise se saisisse depuis l'écran et
--    non à la main en base.
-- --------------------------------------------------------------------------
drop function if exists public.crm_property_set_buyer_form(uuid, text, text, text, text[]);

create or replace function public.crm_property_set_buyer_form(
  p_property_id uuid,
  p_slug text default null,
  p_status text default null,
  p_brochure_url text default null,
  p_allowed_origins text[] default null,
  p_brochure_url_en text default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
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
  -- La règle vaut pour les DEUX langues — une adresse anglaise non validée
  -- serait exactement la même porte ouverte.
  if p_brochure_url is not null and btrim(p_brochure_url) <> ''
     and btrim(p_brochure_url) !~* '^https?://[^[:space:]]+$' then
    raise exception 'adresse de brochure invalide' using errcode = '22023';
  end if;
  if p_brochure_url_en is not null and btrim(p_brochure_url_en) <> ''
     and btrim(p_brochure_url_en) !~* '^https?://[^[:space:]]+$' then
    raise exception 'adresse de brochure anglaise invalide' using errcode = '22023';
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
    buyer_form_brochure_url_en = case
      when p_brochure_url_en is null then buyer_form_brochure_url_en
      when btrim(p_brochure_url_en) = '' then null
      else btrim(p_brochure_url_en) end,
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
            'brochure_en_definie', v_row.buyer_form_brochure_url_en is not null,
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
$function$;

-- LES DROITS SONT REPOSÉS À L'IDENTIQUE : un `drop` les emporte avec la
-- fonction, et les privilèges par défaut de Supabase ne les rendent pas.
--
-- `service_role` est le piège de cette migration. Les trois fonctions en
-- portaient un droit EXPLICITE, et `brochure_cible` est appelée par la route
-- du lien court avec le client admin — donc sous ce rôle. L'oublier aurait
-- fait répondre « Brochure introuvable » à TOUS les liens de TOUS les SMS,
-- ceux déjà partis compris, sans rien casser d'autre qui l'aurait signalé.
revoke all on function public.buyer_form_brochure(text, uuid, text) from public;
grant execute on function public.buyer_form_brochure(text, uuid, text)
  to anon, authenticated, service_role;

revoke all on function public.brochure_cible(text, text) from public, anon, authenticated;
grant execute on function public.brochure_cible(text, text) to service_role;

revoke all on function public.crm_property_set_buyer_form(uuid, text, text, text, text[], text)
  from public, anon;
grant execute on function public.crm_property_set_buyer_form(uuid, text, text, text, text[], text)
  to authenticated, service_role;
