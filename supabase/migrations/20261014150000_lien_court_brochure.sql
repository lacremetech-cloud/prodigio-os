-- Lien court de brochure : brochure.prodigio.fr/<slug>
--
-- POURQUOI. Le SMS d'accusé portait l'adresse de déploiement de la vitrine
-- (`https://villa-verdun-cassis.vercel.app/dossier/`, 47 caractères). Trois
-- défauts : elle est longue, elle nomme un hébergeur plutôt que l'agence, et
-- elle change le jour où la vitrine déménage — or un SMS ne se corrige pas
-- après coup. Une personne rouvre son message trois mois plus tard, au moment
-- où elle se décide : le lien doit encore marcher.
--
-- Le lien court vit donc sur un domaine qui nous appartient, et la cible se
-- lit ici, en base. Déménager une vitrine devient une mise à jour d'une ligne,
-- sans toucher aux messages déjà partis.
--
-- CE QUE CE LIEN N'EST PAS. Ce n'est pas un secret. La brochure est déjà
-- publique : quiconque dépose le formulaire en reçoit l'adresse, et rien ne
-- l'empêche de la transmettre. La redirection n'ajoute donc aucune exposition.
-- Elle n'ajoute pas non plus de protection, et le commentaire est ici pour que
-- personne ne s'imagine le contraire en lisant le mot « confidentielle » sur
-- la page.

-- ---------------------------------------------------------------------------
-- 1. Les ouvertures
-- ---------------------------------------------------------------------------
-- Un acquéreur qui rouvre sa brochure un jeudi à 22 h est en train de se
-- décider. C'est le meilleur moment pour un rappel, et c'est la seule raison
-- d'enregistrer quoi que ce soit ici.
--
-- `buyer_interest_id` est déjà là, et restera vide tant que le lien ne portera
-- qu'un slug : rattacher une ouverture à UNE personne suppose un code propre à
-- chaque envoi. La colonne existe pour que ce jour-là, rien ne bouge d'autre.

create table if not exists public.brochure_opens (
  id                uuid primary key default gen_random_uuid(),
  occurred_at       timestamptz not null default now(),
  property_id       uuid not null references public.properties (id) on delete cascade,
  slug              text not null,
  buyer_interest_id uuid references public.buyer_interests (id) on delete set null,
  -- Diagnostic seulement : distinguer un vrai lecteur d'un robot resté au
  -- travers du filtre. Jamais affiché, jamais recoupé avec une personne.
  user_agent        text,
  referer           text
);

comment on table public.brochure_opens is
  'Ouverture d''une brochure via le lien court. Signal commercial : une '
  'réouverture tardive vaut un rappel. Les robots et préchargements de '
  'messagerie sont écartés en amont, par la route, jamais parfaitement.';

create index if not exists brochure_opens_property_idx
  on public.brochure_opens (property_id, occurred_at desc);

alter table public.brochure_opens enable row level security;

-- Lecture réservée aux membres de l'organisation propriétaire du bien. Aucune
-- écriture par ce chemin : seule la route serveur écrit, par le rôle service.
drop policy if exists brochure_opens_read on public.brochure_opens;
create policy brochure_opens_read on public.brochure_opens
  for select to authenticated
  using (
    exists (
      select 1
      from public.properties p
      join public.organization_memberships m
        on m.organization_id = p.organization_id
      where p.id = brochure_opens.property_id
        and m.user_id = auth.uid()
        and m.status = 'actif'
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Le code court, distinct du slug de la vitrine
-- ---------------------------------------------------------------------------
-- Le slug vitrine (`villa-jean-jaures`) est fait pour le référencement : il
-- porte les mots que les moteurs lisent, et il peut changer le jour où le bien
-- est repositionné. Le code du lien (`jean-jaures`), lui, est gravé dans des
-- SMS déjà reçus : il ne peut plus bouger. Deux usages, deux durées de vie,
-- donc deux colonnes — sinon un changement de référencement casserait des
-- messages envoyés des mois plus tôt.
--
-- Il reste facultatif : sans code, le slug vitrine fait l'affaire.

alter table public.property_public_config
  add column if not exists brochure_slug text;

comment on column public.property_public_config.brochure_slug is
  'Code court du lien de brochure (brochure.prodigio.fr/<code>). Distinct du '
  'slug vitrine, qui sert le référencement et peut changer sans casser un SMS '
  'déjà parti.';

alter table public.property_public_config
  drop constraint if exists property_public_config_brochure_slug_forme;

alter table public.property_public_config
  add constraint property_public_config_brochure_slug_forme
  check (brochure_slug is null or brochure_slug ~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$');

-- Deux biens ne peuvent pas se partager un code : la redirection n'aurait plus
-- de cible unique, et c'est une brochure qui partirait au mauvais acquéreur.
create unique index if not exists property_public_config_brochure_slug_uniq
  on public.property_public_config (brochure_slug)
  where brochure_slug is not null;

-- ---------------------------------------------------------------------------
-- 3. Résolution du code
-- ---------------------------------------------------------------------------
-- `buyer_form_context` ne renvoie volontairement PAS l'adresse de la brochure
-- (seulement sa disponibilité) : c'est une fonction ouverte à l'anonyme, et on
-- n'y fait pas sortir d'adresse. Celle-ci est réservée au rôle service, appelé
-- depuis la route de redirection, qui tourne sur notre serveur.

create or replace function public.brochure_cible(p_slug text)
returns table(property_id uuid, brochure_url text)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  -- Le code court d'abord, le slug vitrine ensuite : les deux restent servis,
  -- pour qu'aucun lien déjà distribué ne meure le jour où un code est posé.
  select c.property_id, c.buyer_form_brochure_url
  from public.property_public_config c
  where (c.brochure_slug = p_slug or c.slug = p_slug)
    and c.buyer_form_brochure_url is not null
  order by (c.brochure_slug = p_slug) desc
  limit 1;
$function$;

revoke all on function public.brochure_cible(text) from public, anon, authenticated;
grant execute on function public.brochure_cible(text) to service_role;

-- ---------------------------------------------------------------------------
-- 4. Les deux biens en service
-- ---------------------------------------------------------------------------
update public.property_public_config set brochure_slug = 'verdun'
  where slug = 'villa-verdun' and brochure_slug is null;

update public.property_public_config set brochure_slug = 'jean-jaures'
  where slug = 'villa-jean-jaures' and brochure_slug is null;

-- NOTE D'APPLICATION. Cette migration a été appliquée instruction par
-- instruction : l'outillage utilisé ici expire sur `drop policy`, comme sur
-- les suppressions de lignes et de fonctions (voir la note identique dans
-- 20261014120000_nom_affichable_des_membres.sql). Le fichier reste rejouable
-- tel quel par la CLI Supabase.
