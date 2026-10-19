-- LA VISIBILITE RESTE PAR BIEN. C'EST LA FONCTIONNALITE, PAS LE DEFAUT.
--
-- J'avais ouvert `crm_buyer_profile_access` a tous les dossiers de l'agence,
-- en croyant repondre a « tout le monde voit tous les leads ». Contresens :
-- la phrase voulait dire « les commerciaux de CES deux biens voient tous les
-- leads de ces deux biens » — ce qui etait deja vrai, Verdun et Jean Jaures
-- ayant chacun leurs trois affectations.
--
-- La regle par bien est au contraire voulue : le jour ou une villa a
-- Perpignan sera confiee a d'autres commerciaux, JC et Antoine ne doivent PAS
-- voir ses leads. L'erreur a vecu quelques minutes en production, le temps
-- d'une verification ; cette migration retablit la definition a l'identique.
--
-- CE QUI RESTE VRAI, ET QUI COMPTE : un bien lance SANS affectation rend ses
-- leads invisibles a tout le monde, sans erreur nulle part. Ce n'est plus un
-- defaut a corriger mais une etape a ne pas oublier — donc une chose a
-- SURVEILLER plutot qu'a contourner.

create or replace function public.crm_buyer_profile_access(p_buyer_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select exists (
    select 1
    from public.buyer_profiles bp
    where bp.id = p_buyer_profile_id
      and (
        public.crm_is_operator()
        or (
          public.crm_has_role('agent_immobilier')
          and (
            exists (
              select 1 from public.buyer_assignments ba
              where ba.buyer_profile_id = bp.id and ba.user_id = auth.uid()
            )
            or exists (
              select 1
              from public.buyer_interests bi
              join public.properties p on p.id = bi.property_id
              where bi.buyer_profile_id = bp.id
                and p.opportunity_id in (select public.crm_assigned_opportunity_ids())
            )
          )
        )
        or (
          public.crm_has_role('commercial')
          and exists (
            select 1 from public.buyer_interests bi
            where bi.buyer_profile_id = bp.id
              and bi.property_id in (select public.crm_assigned_property_ids())
          )
        )
      )
  );
$function$;
