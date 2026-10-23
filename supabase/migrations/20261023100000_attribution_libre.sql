-- ---------------------------------------------------------------------------
-- L'ATTRIBUTION EST LIBRE. ELLE NE L'ETAIT PAS ENCORE.
-- ---------------------------------------------------------------------------
-- « On avait dit que l'attribution etait libre et sans contrainte. » C'etait
-- vrai pour `crm_buyer_assign` depuis le 19 octobre, et faux pour
-- `crm_buyer_claim` : s'attribuer un dossier qu'un collegue suivait rendait un
-- refus, « Jean-Charles suit deja ce dossier ». Le commercial devait donc
-- demander, ou passer par le menu « Confier a... » en choisissant son propre
-- nom — un detour pour un geste quotidien.
--
-- La crainte d'origine — « deux associes se reprendraient leurs dossiers sans
-- que l'autre le sache » — ne correspond pas a cette agence : ils travaillent
-- ensemble sur les memes biens. Et elle est traitee autrement : la passation
-- est tracee, avec le nom de celui qui tenait le dossier avant.
--
-- Ce qui ne change PAS, et qui n'est pas une contrainte d'attribution :
--   • le perimetre. Un commercial n'agit que sur les dossiers des biens qui
--     lui sont confies. C'est une regle de visibilite, voulue, et elle reste.
--   • un dossier n'a qu'UN responsable. Prendre celui d'un collegue le lui
--     retire, ca ne cree pas un second responsable : la fiche en affiche un,
--     deux lignes actives ne voudraient rien dire.
--
-- Corrige aussi ici : la reactivation visait TOUTES les lignes du couple
-- (dossier, personne). L'index unique etant partiel, plusieurs lignes rendues
-- peuvent coexister ; les reactiver toutes aurait viole l'unicite. On n'en
-- reactive qu'une.
-- ---------------------------------------------------------------------------

create or replace function public.crm_buyer_claim(p_buyer_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid        uuid := auth.uid();
  v_precedent  uuid;
  v_nom        text;
begin
  if v_uid is null then
    raise exception 'authentification requise' using errcode = '28000';
  end if;

  perform public.crm_require_role('administrateur', 'manager', 'setter',
                                  'agent_immobilier', 'commercial');

  if not exists (select 1 from public.buyer_profiles where id = p_buyer_profile_id) then
    raise exception 'dossier introuvable' using errcode = '22023';
  end if;

  -- Le perimetre reste : un commercial n'agit que sur les biens qui lui sont
  -- confies. On refuse ici plutot que de laisser la RLS rendre un resultat
  -- vide, qui ressemblerait a un bogue.
  if not public.crm_buyer_profile_access(p_buyer_profile_id) then
    raise exception 'dossier hors de votre perimetre' using errcode = '42501';
  end if;

  -- CONCURRENCE. Deux commerciaux peuvent cliquer sur le meme dossier dans la
  -- meme seconde. Le verrou met les deux appels en file : le second passe
  -- apres le premier et repart avec le dossier, au lieu que les deux
  -- s'inscrivent en croyant chacun l'avoir.
  perform 1 from public.buyer_profiles where id = p_buyer_profile_id for update;

  select ba.user_id into v_precedent
    from public.buyer_assignments ba
   where ba.buyer_profile_id = p_buyer_profile_id
     and ba.released_at is null
     and ba.user_id <> v_uid
   order by ba.created_at
   limit 1;

  if v_precedent is not null then
    select coalesce(nullif(btrim(m.display_name), ''), split_part(u.email, '@', 1))
      into v_nom
      from public.organization_memberships m
      join auth.users u on u.id = m.user_id
     where m.user_id = v_precedent
     limit 1;

    -- On ne refuse plus : on passe la main.
    update public.buyer_assignments
       set released_at = now()
     where buyer_profile_id = p_buyer_profile_id
       and released_at is null
       and user_id <> v_uid;
  end if;

  -- Une seule ligne reactivee : l'unicite etant partielle, plusieurs lignes
  -- rendues peuvent exister pour ce couple. `nulls first` tombe sur la ligne
  -- deja active s'il y en a une, ce qui rend l'appel idempotent — un double
  -- clic ou deux onglets ne sont pas une erreur.
  update public.buyer_assignments
     set released_at = null, created_at = now(), assigned_by = v_uid
   where id = (
     select a.id
       from public.buyer_assignments a
      where a.buyer_profile_id = p_buyer_profile_id
        and a.user_id = v_uid
      order by a.released_at desc nulls first, a.created_at desc
      limit 1
   );

  if not found then
    insert into public.buyer_assignments (buyer_profile_id, user_id, responsibility, assigned_by)
    values (p_buyer_profile_id, v_uid,
            case when public.crm_has_role('commercial') then 'commercial' else 'setter' end,
            v_uid);
  end if;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'buyer_profile', p_buyer_profile_id, 'acquereur_affectation',
          jsonb_build_object('user_id', v_uid, 'mode', 'auto_attribution',
                             'responsable_precedent', v_precedent));

  return jsonb_build_object('ok', true,
                            'responsable_user_id', v_uid,
                            'responsable_precedent', v_precedent,
                            'responsable_precedent_nom', v_nom);
end;
$function$;

comment on function public.crm_buyer_claim(uuid) is
  'Prendre un dossier acquéreur pour soi. Ne refuse jamais : un dossier déjà '
  'suivi change de main, l''ancien responsable est relevé et nommé dans la '
  'trace d''audit. Le périmètre du commercial, lui, reste vérifié.';
