-- Reprise : une personne, une qualification, une étape
--
-- CE QUI N'ALLAIT PAS. La qualification et l'étape vivaient sur la
-- MANIFESTATION — une ligne par personne ET par bien. Éric Patalano, intéressé
-- par Jean Jaurès et par Verdun, apparaissait donc deux fois dans le pipeline,
-- et le qualifier sur l'une ne le qualifiait pas sur l'autre. Antoine
-- requalifiait un dossier déjà qualifié.
--
-- Une deuxième couche existait déjà sur la personne, jamais branchée : les
-- seize profils portaient `qualification_status = 'non_qualifie'`, la valeur
-- par défaut d'une colonne que personne n'écrivait. Basculer naïvement dessus
-- aurait déclaré non qualifiés seize acquéreurs d'un coup.
--
-- CE QUE FAIT CETTE REPRISE. La qualification et l'étape remontent sur la
-- PERSONNE, avec le vocabulaire arrêté avec l'agence. Les colonnes des
-- manifestations sont FIGÉES, jamais vidées : ce qui avait été posé par bien,
-- avec son auteur et sa date, reste lisible.
--
-- RIEN N'EST DÉDUIT. Une valeur par défaut n'est pas un jugement : seules les
-- qualifications portant un auteur ET une date sont remontées. Les autres
-- restent « à qualifier », ce qu'elles ont toujours été. Trois personnes sur
-- seize avaient été réellement jugées.

-- ---------------------------------------------------------------------------
-- 1. La qualification, portée par la personne
-- ---------------------------------------------------------------------------
alter table public.buyer_profiles
  add column if not exists qualification text not null default 'a_qualifier',
  add column if not exists qualification_reason text,
  add column if not exists qualification_by uuid references auth.users(id),
  add column if not exists qualification_at timestamptz;

comment on column public.buyer_profiles.qualification is
  'Ce qu''on pense du potentiel de la PERSONNE : a_qualifier, qualifie, '
  'gros_potentiel, non_qualifie. Portée par la personne et non par la '
  'manifestation : qualifier quelqu''un sur une villa le qualifie partout. '
  'Distincte de l''étape, qui dit où en est le traitement.';

alter table public.buyer_profiles
  drop constraint if exists buyer_profiles_qualification_check;
alter table public.buyer_profiles
  add constraint buyer_profiles_qualification_check
  check (qualification in ('a_qualifier','qualifie','gros_potentiel','non_qualifie'));

-- Écarter quelqu'un sans dire pourquoi n'apprend rien à celui qui rouvrira le
-- dossier dans six mois.
alter table public.buyer_profiles
  drop constraint if exists buyer_profiles_qualification_motif_check;
alter table public.buyer_profiles
  add constraint buyer_profiles_qualification_motif_check
  check (qualification <> 'non_qualifie' or qualification_reason is not null);

-- ---------------------------------------------------------------------------
-- 2. Remontée des seuls jugements RÉELS
-- ---------------------------------------------------------------------------
-- `qualification_at is not null and qualification_by is not null` est le filtre
-- qui sépare un jugement d'un défaut. « en_reflexion » n'existe pas dans le
-- nouveau vocabulaire : sa seule occurrence a été tranchée par l'agence en
-- « qualifie », sur la foi de la note d'appel de Jean-Charles qui dit
-- « projet réel et mobilisé ».
with humain as (
  select bi.buyer_profile_id,
         case bi.qualification when 'en_reflexion' then 'qualifie' else bi.qualification end as valeur,
         bi.qualification_reason, bi.qualification_by, bi.qualification_at,
         row_number() over (partition by bi.buyer_profile_id order by bi.qualification_at desc) as rang
  from public.buyer_interests bi
  where bi.qualification_at is not null
    and bi.qualification_by is not null
    and bi.qualification <> 'a_qualifier'
)
update public.buyer_profiles p
   set qualification = h.valeur,
       qualification_reason = h.qualification_reason,
       qualification_by = h.qualification_by,
       qualification_at = h.qualification_at
  from humain h
 where h.buyer_profile_id = p.id and h.rang = 1;

-- ---------------------------------------------------------------------------
-- 3. L'étape, dans le nouveau vocabulaire
-- ---------------------------------------------------------------------------
-- Sept valeurs. « Écarté » a été retiré en cours de route : à l'écran, il
-- faisait doublon avec « pas intéressé », et un pipeline qui finit sur trois
-- colonnes négatives décourage celui qui le regarde toute la journée. Sortir
-- quelqu'un de la file active est désormais une conséquence de « non
-- qualifié », pas une case où on le range.
alter table public.buyer_profiles drop constraint if exists buyer_profiles_pipeline_stage_check;

update public.buyer_profiles
   set pipeline_stage = case pipeline_stage
         when 'nouveau' then 'a_contacter'
         when 'visite'  then 'visite_planifiee'
         when 'perdu'   then 'pas_interesse'
         when 'gagne'   then 'en_discussion'
         when 'offre'   then 'en_discussion'
         else pipeline_stage end
 where pipeline_stage in ('nouveau','visite','perdu','gagne','offre');

alter table public.buyer_profiles
  add constraint buyer_profiles_pipeline_stage_check
  check (pipeline_stage in ('a_contacter','a_rappeler','en_discussion',
                            'visite_planifiee','vivier','pas_interesse','mauvais_numero'));

comment on column public.buyer_profiles.pipeline_stage is
  'Où en est le TRAITEMENT de la personne. Sept valeurs, une seule à la fois. '
  'Portée par la personne et non par la manifestation : on appelle quelqu''un '
  'une fois, même s''il s''intéresse à deux villas. Distincte de la '
  'qualification, qui juge son potentiel, et de l''issue commerciale, qui '
  'appartient au bien.';

-- ---------------------------------------------------------------------------
-- 4. Ce qui est figé, et pourquoi on ne le vide pas
-- ---------------------------------------------------------------------------
comment on column public.buyer_interests.qualification is
  'FIGÉ — historique. La qualification vit désormais sur la personne '
  '(buyer_profiles.qualification). Cette colonne conserve ce qui avait été '
  'posé par bien, avec son auteur et sa date, pour la traçabilité de la '
  'reprise du 14/10/2026. Aucun écran ne la lit plus.';

comment on column public.buyer_interests.pipeline_stage is
  'FIGÉ — historique. L''étape de traitement vit désormais sur la personne '
  '(buyer_profiles.pipeline_stage), avec le nouveau vocabulaire en sept '
  'valeurs. Cette colonne conserve l''ancien vocabulaire tel qu''il était au '
  '14/10/2026. Aucun écran ne la lit plus.';

-- NOTE D'APPLICATION. Deux copies restaurables ont été prises avant la
-- reprise : `sauvegarde_20261014` (15 h) et `sauvegarde_avant_migration`
-- (juste avant). La seconde existe parce qu'Antoine et Jean-Charles ont
-- continué à travailler entre les deux — trois personnes, trois
-- manifestations, quatre activités, une tâche et cinq affectations de plus.
-- Vérifié après reprise : aucun motif écrasé, aucune ancienne colonne
-- modifiée, aucune personne redescendue en « à contacter ».
