-- QUI RECOIT LES ALERTES PAR E-MAIL, ET QUI NE LES RECOIT PLUS.
--
-- L'agence lit les leads dans Slack. Recevoir les memes alertes par e-mail ne
-- lui apprend rien et noie sa boite : sur une journee de campagne, c'est des
-- dizaines de messages deja lus ailleurs. Les commerciaux, eux, n'ouvrent pas
-- Slack — l'e-mail reste le seul canal qu'ils relevent, et il ne bouge pas.
--
-- POURQUOI UN REGLAGE ET NON UNE EXCEPTION ECRITE EN DUR. Exclure une adresse
-- dans le corps de la fonction aurait marche aujourd'hui et serait devenu un
-- piege : invisible depuis le CRM, impossible a defaire sans rouvrir une
-- migration, et faux le jour ou quelqu'un d'autre veut le meme silence. Le
-- choix appartient a la personne, donc il vit sur son appartenance.
--
-- CE QUE CE REGLAGE NE TOUCHE PAS : l'acces au CRM, le role, les biens suivis,
-- et les notifications Slack. Il ne coupe QUE l'e-mail.
--
-- L'alerte INSTANTANEE, elle, a ses destinataires ecrits dans le scenario Make
-- « Prodigio — Nouveau lead ». L'adresse y a ete retiree le meme jour, a la
-- main. Les deux listes devront un jour venir d'ici ; tant que ce n'est pas
-- fait, retirer quelqu'un demande les deux gestes.
alter table public.organization_memberships
  add column if not exists recoit_alertes_email boolean not null default true;

comment on column public.organization_memberships.recoit_alertes_email is
  'Faux pour qui suit les leads ailleurs (Slack) et ne veut pas les recevoir '
  'une seconde fois par e-mail. N''affecte ni l''acces au CRM, ni le role, ni '
  'les biens suivis.';

-- `create or replace` et non `drop` : un `drop` detruirait les droits accordes
-- a `service_role` et le recapitulatif tomberait en silence a 8 h 30.
create or replace function public.crm_recap_recipients()
returns table(property_id uuid, project_name text, email text)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select p.id, p.project_name, u.email::text
  from public.properties p
  join public.organization_memberships m
    on m.organization_id = p.organization_id
   and m.status = 'actif'
   and m.recoit_alertes_email
  join auth.users u on u.id = m.user_id
  where u.email is not null
    and (
      m.role in ('administrateur', 'manager')
      or exists (
        select 1 from public.property_assignments pa
        where pa.property_id = p.id and pa.user_id = m.user_id
      )
    )

  union all

  select null::uuid, null::text, u.email::text
  from public.organization_memberships m
  join auth.users u on u.id = m.user_id
  where m.status = 'actif'
    and m.recoit_alertes_email
    and m.role in ('administrateur', 'manager')
    and u.email is not null;
$function$;

-- L'agence suit les leads dans Slack : on coupe son e-mail, et seulement le sien.
update public.organization_memberships m
set recoit_alertes_email = false
from auth.users u
where u.id = m.user_id
  and u.email = 'agence@indescale.com';
