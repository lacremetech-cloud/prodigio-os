-- DEPLACER UNE CARTE ECHOUAIT DEPUIS LE 14 OCTOBRE.
--
-- `crm_buyer_set_interest_stage` ecrivait un evenement d'audit de type
-- « acquereur_etape ». La contrainte `audit_events_event_type_check`
-- n'autorise que « acquereur_stade » — la valeur canonique, celle que portent
-- toutes les autres fonctions, les types TypeScript, et `labels.ts` qui
-- l'affiche « Changement d'etape ».
--
-- La migration du 14/10 a introduit la faute une seule fois, a sa ligne 236 ;
-- trente lignes plus bas, la meme migration ecrit correctement
-- « acquereur_stade ». Une lettre pour une autre.
--
-- L'insertion d'audit se declenche a TOUT changement d'etape, et la fonction
-- n'avale pas l'erreur : la transaction entiere echouait. Donc, depuis cinq
-- jours :
--   • deplacer une carte dans le pipeline renvoyait au commercial le texte
--     brut de la contrainte PostgreSQL ;
--   • le selecteur d'etape de la fiche acquereur echouait pareil ;
--   • caler une visite affichait « la visite est enregistree, mais le dossier
--     n'a pas pu passer a l'etape Visite, deplacez-le a la main » — et le
--     deplacement a la main echouait aussi.
-- La trace le confirme : huit evenements « acquereur_stade », le dernier
-- date du 14 octobre.
--
-- On corrige la FONCTION, pas la contrainte : elargir la contrainte aurait
-- laisse passer une valeur que `labels.ts` ne sait pas nommer, et l'historique
-- aurait affiche un evenement sans libelle.

create or replace function public.crm_buyer_set_interest_stage(p_interest_id uuid, p_stage text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare v_uid uuid := auth.uid(); v_profile uuid; v_old text; v_stage text;
begin
  if v_uid is null then raise exception 'authentification requise' using errcode='28000'; end if;

  select i.buyer_profile_id into v_profile from public.buyer_interests i where i.id = p_interest_id;
  if v_profile is null then raise exception 'manifestation introuvable' using errcode='22023'; end if;
  if not public.crm_buyer_can_operate(v_profile) then
    raise exception 'droits insuffisants sur ce dossier acquereur' using errcode='42501';
  end if;

  -- DEPLACER UNE CARTE DEPLACE LA PERSONNE, pas une de ses manifestations.
  -- Avant la reprise, deplacer la carte « Verdun » d'Eric laissait sa carte
  -- « Jean Jaures » en arriere : deux cartes, deux etapes, un seul homme a
  -- rappeler. L'etape vit desormais sur lui.
  select p.pipeline_stage into v_old from public.buyer_profiles p where p.id = v_profile;
  v_stage := public.crm_etape_v2(p_stage);

  if v_stage not in ('a_contacter','a_rappeler','en_discussion',
                     'visite_planifiee','vivier','pas_interesse','mauvais_numero') then
    raise exception 'etape inconnue' using errcode='22023';
  end if;

  if v_stage is distinct from v_old then
    update public.buyer_profiles set pipeline_stage = v_stage where id = v_profile;
    -- « acquereur_stade », et non « acquereur_etape » : c'est la seule valeur
    -- que la contrainte accepte et que l'interface sait nommer.
    insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, old_value, new_value)
    values (v_uid, 'buyer_profile', v_profile, 'acquereur_stade',
            jsonb_build_object('stage', v_old),
            jsonb_build_object('stage', v_stage, 'interest_id', p_interest_id));
  end if;

  return jsonb_build_object('ok', true, 'stage', v_stage);
end;
$function$;
