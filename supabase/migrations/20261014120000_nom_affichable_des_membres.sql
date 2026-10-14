-- Nom affichable d'un membre.
--
-- Jusqu'ici, un membre s'affichait par la partie gauche de son e-mail :
-- « casteljc69 », « adelombares ». Lisible pour personne, et le menu
-- d'attribution devient illisible des que deux commerciaux se repartissent les
-- memes dossiers — ce qui est exactement ce qui vient d'arriver.
--
-- Le nom vit sur l'APPARTENANCE et non sur le compte : la meme personne peut
-- appartenir a deux organisations et s'y nommer differemment, et c'est
-- l'organisation qui decide comment ses membres s'appellent chez elle.
--
-- Facultatif : sans nom, l'affichage retombe sur l'e-mail, comme avant.

alter table public.organization_memberships
  add column if not exists display_name text;

comment on column public.organization_memberships.display_name is
  'Nom court affiche partout ou ce membre apparait (responsable, auteur, '
  'alertes). A defaut, la partie gauche de l''e-mail.';

-- Vide plutot que chaine blanche : une chaine d'espaces afficherait un nom
-- invisible, ce qui est pire que pas de nom du tout.
alter table public.organization_memberships
  drop constraint if exists organization_memberships_display_name_non_vide;

alter table public.organization_memberships
  add constraint organization_memberships_display_name_non_vide
  check (display_name is null or length(btrim(display_name)) > 0);

-- Pourquoi une SECONDE fonction plutot qu'une modification de la premiere :
-- changer le type de retour d'une fonction impose de la supprimer d'abord, et
-- `drop function` n'a pas pu etre execute depuis l'outillage utilise ici (il
-- expire sans rien appliquer, comme les suppressions de lignes). Plutot que de
-- forcer, on ajoute. `crm_list_members` reste en place, n'est plus appelee par
-- l'application, et pourra etre supprimee lors d'un passage par la CLI.
create or replace function public.crm_list_members_v2()
returns table(
  user_id uuid,
  email text,
  role text,
  organization_id uuid,
  status text,
  display_name text
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select m.user_id, u.email::text, m.role, m.organization_id, m.status, m.display_name
  from public.organization_memberships m
  join auth.users u on u.id = m.user_id
  where public.crm_has_access()
    and m.organization_id in (
      select organization_id from public.organization_memberships
      where user_id = auth.uid() and status = 'actif');
$function$;

-- Memes droits que la fonction qu'elle remplace : retires a tout le monde,
-- rendus aux seuls roles qui les avaient.
revoke all on function public.crm_list_members_v2() from public, anon;
grant execute on function public.crm_list_members_v2() to authenticated, service_role;
