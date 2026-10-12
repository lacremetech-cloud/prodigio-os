-- =============================================================================
-- Photo de profil d'un membre
-- =============================================================================
--
-- L'avatar n'était que des initiales sur un aplat. Une photo appartient à la
-- fiche du membre, pas au code : la coder en dur dans un composant obligerait à
-- un déploiement pour chaque arrivée dans l'équipe, et ferait vivre une
-- correspondance « e-mail → fichier » dans le code source.
--
-- `avatar_url` accepte une URL absolue (stockage Supabase, CDN) comme un chemin
-- servi par l'application. La valeur n'est jamais insérée en HTML : le
-- composant la pose dans l'attribut `src` d'une balise `img`.
--
-- Aucune donnée sensible : c'est la photo que le membre accepte de montrer à
-- son équipe, et la fonction ci-dessous est réservée à sa propre organisation.
--
-- La lecture passe par une fonction DÉDIÉE plutôt que par un élargissement de
-- `crm_list_members` : changer le type de retour de celle-ci imposerait un
-- `drop function`, donc une fenêtre pendant laquelle toute page qui l'appelle
-- échoue. L'ajout est purement additif — rien de ce qui existe ne bouge.

alter table public.organization_memberships
  add column if not exists avatar_url text;

create or replace function public.crm_list_member_avatars()
returns table (user_id uuid, avatar_url text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.user_id, m.avatar_url
  from public.organization_memberships m
  where public.crm_has_access()
    and m.avatar_url is not null
    and m.organization_id in (
      select organization_id from public.organization_memberships
      where user_id = auth.uid() and status = 'actif'
    );
$$;

revoke all on function public.crm_list_member_avatars() from public;
grant execute on function public.crm_list_member_avatars() to authenticated;
