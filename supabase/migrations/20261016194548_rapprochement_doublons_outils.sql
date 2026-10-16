-- OUTILS DE RAPPROCHEMENT DE PERSONNES.
--
-- Le dedoublonnage se fait aujourd'hui sur l'e-mail SEUL. Hugues Monchamps a
-- depose deux fois le 16 octobre, a trois minutes d'intervalle, avec le meme
-- mobile et DEUX adresses differentes — dont une adresse masquee Apple. Deux
-- fiches, donc deux appels pour la meme personne.
--
-- Ces deux fonctions servent a reconnaitre la personne sans jamais confondre
-- deux personnes distinctes.

-- Un mobile francais est PERSONNEL (+336, +337). Une ligne fixe est PARTAGEE :
-- un foyer, un bureau. Rapprocher deux depots sur un fixe fondrait un couple
-- en une seule fiche et ferait disparaitre un acquereur. On ne le fait pas.
create or replace function public.est_mobile_fr(p_phone text)
returns boolean
language sql
immutable
set search_path to 'pg_catalog', 'pg_temp'
as $function$
  select coalesce(p_phone ~ '^\+33[67][0-9]{8}$', false);
$function$;

comment on function public.est_mobile_fr(text) is
  'Vrai pour un MOBILE francais au format E.164 (+336…, +337…). Les lignes fixes sont exclues a dessein : elles sont partagees, les rapprocher fusionnerait des personnes distinctes.';

-- Empreinte d'un nom, insensible a l'ordre, a la casse et aux accents.
--
-- « Monchamps Hugues » et « Hugues Monchamps » sont la meme personne : le
-- formulaire ne force pas l'ordre, et les gens inversent. On compare donc des
-- ENSEMBLES de mots tries, pas des chaines.
--
-- Les doublons de mots sont ecrases : une saisie reelle du 16 octobre valait
-- « cyril Fallegger fallegger Cyril ».
create or replace function public.empreinte_nom(p_prenom text, p_nom text)
returns text
language sql
immutable
set search_path to 'pg_catalog', 'pg_temp'
as $function$
  select nullif(
    (select string_agg(mot, ' ' order by mot)
       from (
         select distinct mot
           from unnest(string_to_array(
             regexp_replace(
               translate(
                 lower(trim(coalesce(p_prenom,'') || ' ' || coalesce(p_nom,''))),
                 'àáâãäåçèéêëìíîïñòóôõöùúûüýÿœæ',
                 'aaaaaaceeeeiiiinooooouuuuyyoa'),
               '[^a-z0-9 ]+', ' ', 'g'),
             ' ')) as mot
          where length(mot) > 1      -- initiales ecartees : « J. Morin » ne doit
       ) mots                        -- pas suffire a identifier quelqu'un
    ), '');
$function$;

comment on function public.empreinte_nom(text, text) is
  'Empreinte d''un nom : minuscules, sans accents, mots tries et dedoublonnes, initiales (1 lettre) ecartees. Permet de reconnaitre « Monchamps Hugues » et « Hugues Monchamps » comme un seul et meme nom.';

-- Marque une fiche dont le mobile correspond a une autre SANS que le nom
-- concorde. On ne fusionne pas : c'est peut-etre un conjoint, un collegue, ou
-- un chiffre mal saisi. Un humain tranche.
alter table public.contacts
  add column if not exists doublon_probable_de uuid references public.contacts (id) on delete set null;

comment on column public.contacts.doublon_probable_de is
  'Renseigne quand le MOBILE correspond a un contact existant mais que le nom ne concorde pas. Signalement, jamais une fusion : conjoint, collegue ou faute de frappe sont indiscernables automatiquement.';

create index if not exists contacts_doublon_probable_idx
  on public.contacts (doublon_probable_de) where doublon_probable_de is not null;
