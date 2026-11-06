-- LES MESSAGES SORTANTS APPARTIENNENT AU BIEN, PAS AU CODE.
--
-- Édouard ROWLANDSON (Cimalpes) prend les leads des 2 Alpes. En préparant son
-- arrivée, un défaut est apparu : le message WhatsApp du CRM n'est pas
-- seulement signé Jean-Charles, il est ÉCRIT POUR CASSIS —
--
--   « Je suis le propriétaire de la maison à Cassis […] ainsi qu'une seconde
--     maison située à 3 min seulement. »
--
-- Envoyé à un prospect des Airelles, il est faux à chaque ligne : ce n'est pas
-- une maison, pas à Cassis, il n'y a pas de seconde maison à trois minutes, et
-- la signature est la mauvaise personne. Le bouton est à un clic sur chaque
-- fiche, donc ce n'était qu'une question de jours.
--
-- QUI SIGNE : LE BIEN, PAS CELUI QUI CLIQUE. C'est déjà le cas aujourd'hui —
-- le message signe Jean-Charles même quand Antoine ou Nicolas appuie — et
-- c'est juste : le prospect doit rappeler celui qui suit le bien. On garde ce
-- principe plutôt que d'en inventer un second.
--
-- EN BASE ET NON EN DUR, parce que ces textes changent. Ils ont déjà changé
-- deux fois en trois semaines, et chaque fois il a fallu un déploiement. Avec
-- ces colonnes, l'équipe les modifie depuis la fiche du bien.
--
-- Le texte de Cassis est repris MOT POUR MOT depuis le code : cette migration
-- ne doit rien changer pour les deux villas, seulement déplacer d'où vient le
-- texte.

alter table public.property_public_config
  add column if not exists whatsapp_message   text,
  add column if not exists contact_signature  text;

comment on column public.property_public_config.whatsapp_message is
  'Message pré-écrit du bouton WhatsApp, pour CE bien. `[Prénom]` y est '
  'remplacé par le prénom du prospect ; sans prénom connu, la formule de '
  'politesse se referme proprement plutôt que de laisser un trou. '
  'Vide = le message historique de Cassis.';

comment on column public.property_public_config.contact_signature is
  'Qui signe le SMS et le premier e-mail automatiques de CE bien. Il n''y a '
  'personne de connecté au moment où ils partent : la signature ne peut donc '
  'venir que du bien. Vide = « JC & Antoine ».';

-- --------------------------------------------------------------------------
-- Les valeurs, posées ici plutôt qu'à la main : la migration est la trace.
-- --------------------------------------------------------------------------

-- Cassis — le texte EXISTANT, recopié sans y toucher.
update public.property_public_config set
  contact_signature = 'JC & Antoine',
  whatsapp_message = 'Bonjour,
Je suis le propriétaire de la maison à Cassis pour laquelle vous avez fait une demande d’information. Je me suis permis de vous envoyer un email intégrant la brochure de la maison qui vous intéresse ainsi qu’une seconde maison située à 3 min seulement.

N’hésitez pas à me rappeler quand vous le pourrez pour échanger et organiser une visite. Je me permettrai également de vous rappeler très prochainement.

Bien cordialement,
Jean-Charles Castellano
06 68 68 04 07'
where slug in ('villa-verdun', 'villa-jean-jaures');

-- Les Airelles — le texte d'Édouard. Il signe de son seul prénom dans le
-- corps du message : pas de bloc de signature, pas de numéro, c'est sa
-- conversation WhatsApp qui porte son identité.
update public.property_public_config set
  contact_signature = 'Édouard Rowlandson',
  whatsapp_message = 'Bonjour [Prénom], moi c’est Édouard, votre contact sur place pour le projet des appartements aux 2 Alpes. Vous avez normalement reçu la brochure, et je suis là pour répondre à toutes vos questions. Si vous voulez, on peut se programmer un petit échange de 10 minutes au téléphone. Qu’est-ce qui vous arrangerait le mieux, plutôt en journée ou en soirée ? Au plaisir d’échanger !'
where slug = 'les-airelles-aux-2-alpes';

-- --------------------------------------------------------------------------
-- Le réglage, pour que ces deux textes se modifient depuis l'écran du bien.
-- --------------------------------------------------------------------------
drop function if exists public.crm_property_set_buyer_form(uuid, text, text, text, text[], text);

create or replace function public.crm_property_set_buyer_form(
  p_property_id uuid,
  p_slug text default null,
  p_status text default null,
  p_brochure_url text default null,
  p_allowed_origins text[] default null,
  p_brochure_url_en text default null,
  p_whatsapp_message text default null,
  p_contact_signature text default null
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
    if exists (
      select 1 from public.property_public_config c
      where lower(c.slug) = v_slug and c.property_id <> p_property_id
    ) then
      raise exception 'cet identifiant public est déjà utilisé' using errcode = '23505';
    end if;
  end if;

  if p_brochure_url is not null and btrim(p_brochure_url) <> ''
     and btrim(p_brochure_url) !~* '^https?://[^[:space:]]+$' then
    raise exception 'adresse de brochure invalide' using errcode = '22023';
  end if;
  if p_brochure_url_en is not null and btrim(p_brochure_url_en) <> ''
     and btrim(p_brochure_url_en) !~* '^https?://[^[:space:]]+$' then
    raise exception 'adresse de brochure anglaise invalide' using errcode = '22023';
  end if;

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
    whatsapp_message = case
      when p_whatsapp_message is null then whatsapp_message
      when btrim(p_whatsapp_message) = '' then null
      else p_whatsapp_message end,
    contact_signature = case
      when p_contact_signature is null then contact_signature
      when btrim(p_contact_signature) = '' then null
      else btrim(p_contact_signature) end,
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
            'whatsapp_defini', v_row.whatsapp_message is not null,
            'signature', v_row.contact_signature,
            'origines_autorisees', coalesce(array_length(v_row.buyer_form_allowed_origins, 1), 0),
            'publication_status', v_row.publication_status));

  return jsonb_build_object(
    'ok', true,
    'slug', v_row.slug,
    'buyer_form_status', v_row.buyer_form_status,
    'publication_status', v_row.publication_status);
end;
$function$;

-- Les droits sont reposés : un `drop` les emporte. `service_role` en faisait
-- partie — c'est le piège déjà rencontré le 29 octobre sur `brochure_cible`.
revoke all on function
  public.crm_property_set_buyer_form(uuid, text, text, text, text[], text, text, text)
  from public, anon;
grant execute on function
  public.crm_property_set_buyer_form(uuid, text, text, text, text[], text, text, text)
  to authenticated, service_role;
