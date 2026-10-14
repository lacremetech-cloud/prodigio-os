-- Auto-affectation : un commercial prend un dossier libre
--
-- CE QUI NE MARCHAIT PAS. Antoine cliquait « M'attribuer ce lead » et recevait
-- « droits insuffisants ». La cause n'était pas un réglage mais une liste
-- écrite en dur : `crm_buyer_assign` exige `administrateur | manager | setter`,
-- et le rôle `commercial` a été créé APRÈS cette fonction, sans y être ajouté.
-- Les deux seules personnes qui traitent réellement les leads étaient donc les
-- seules à ne pas pouvoir se les attribuer.
--
-- POURQUOI UNE FONCTION SÉPARÉE plutôt que d'élargir l'ancienne. Ce sont deux
-- actes différents, et les confondre rouvrirait le problème sous une autre
-- forme :
--
--   • RÉAFFECTER — donner le dossier d'un commercial à un autre — est un acte
--     d'encadrement. Il reste dans `crm_buyer_assign`, fermé au commercial.
--   • PRENDRE un dossier que personne ne suit est un acte de travail. C'est
--     `crm_buyer_claim`, ouvert à qui traite les dossiers.
--
-- Élargir la première aurait donné aux commerciaux le pouvoir de se prendre
-- les dossiers les uns des autres en silence — exactement ce qu'il ne faut pas
-- entre deux associés qui se répartissent un portefeuille.

-- ---------------------------------------------------------------------------
-- 1. « commercial » devient une responsabilité possible sur un dossier
-- ---------------------------------------------------------------------------
-- La contrainte datait d'avant le rôle. Un commercial qui se serait attribué
-- un dossier aurait buté dessus, une fois le contrôle de rôle passé.
alter table public.buyer_assignments
  drop constraint if exists buyer_assignments_responsibility_check;

alter table public.buyer_assignments
  add constraint buyer_assignments_responsibility_check
  check (responsibility in ('setter','manager','agent_immobilier',
                            'responsable_marketing','commercial'));

-- ---------------------------------------------------------------------------
-- 2. Rendre un dossier ne l'efface pas
-- ---------------------------------------------------------------------------
-- Un commercial doit pouvoir rendre un dossier pris par erreur, sans quoi il
-- lui faudrait appeler l'agence. Mais supprimer la ligne effacerait le fait
-- qu'il l'a suivi — et ce fait éclaire les notes qu'il a laissées pendant ce
-- temps. La ligne est donc DATÉE comme rendue, jamais supprimée.
alter table public.buyer_assignments
  add column if not exists released_at timestamptz;

comment on column public.buyer_assignments.released_at is
  'Date à laquelle le responsable a rendu le dossier. NULL = affectation '
  'active. La ligne n''est jamais supprimée : qui a suivi ce dossier, et '
  'quand, reste lisible.';

-- L'unicité ne vaut plus que pour les affectations ACTIVES : la même personne
-- peut reprendre un dossier qu'elle avait rendu, sans que l'ancienne ligne ne
-- l'en empêche.
alter table public.buyer_assignments drop constraint if exists buyer_assignments_unique;

create unique index if not exists buyer_assignments_actif_uniq
  on public.buyer_assignments (buyer_profile_id, user_id)
  where released_at is null;

-- ---------------------------------------------------------------------------
-- 3. Prendre un dossier libre
-- ---------------------------------------------------------------------------
create or replace function public.crm_buyer_claim(p_buyer_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid       uuid := auth.uid();
  v_existant  uuid;
  v_nom       text;
begin
  if v_uid is null then
    raise exception 'authentification requise' using errcode = '28000';
  end if;

  -- Qui travaille les dossiers peut en prendre un. Le périmètre, lui, se
  -- vérifie dossier par dossier juste en dessous : le rôle dit ce qu'on a le
  -- droit de faire, jamais sur quoi.
  perform public.crm_require_role('administrateur', 'manager', 'setter',
                                  'agent_immobilier', 'commercial');

  if not exists (select 1 from public.buyer_profiles where id = p_buyer_profile_id) then
    raise exception 'dossier introuvable' using errcode = '22023';
  end if;

  -- Un commercial ne voit que les demandes des biens qu'il commercialise. On
  -- refuse ici plutôt que de laisser la RLS rendre un résultat vide, qui
  -- ressemblerait à un bogue.
  if not public.crm_buyer_profile_access(p_buyer_profile_id) then
    raise exception 'dossier hors de votre perimetre' using errcode = '42501';
  end if;

  -- CONCURRENCE. Deux commerciaux peuvent cliquer sur le même dossier dans la
  -- même seconde. Sans verrou, les deux liraient « personne ne le suit » et
  -- les deux s'inscriraient : le dossier aurait deux responsables, et chacun
  -- croirait l'avoir. Le verrou sur la ligne du dossier met les deux appels en
  -- file ; le second lit alors l'affectation du premier et repart avec.
  perform 1 from public.buyer_profiles where id = p_buyer_profile_id for update;

  -- Seules les affectations ACTIVES comptent. Une ligne rendue reste en base
  -- pour la traçabilité, elle ne bloque pas le dossier.
  select ba.user_id into v_existant
  from public.buyer_assignments ba
  where ba.buyer_profile_id = p_buyer_profile_id
    and ba.released_at is null
  order by ba.created_at
  limit 1;

  if v_existant is not null then
    select coalesce(nullif(btrim(m.display_name), ''), split_part(u.email, '@', 1))
      into v_nom
    from public.organization_memberships m
    join auth.users u on u.id = m.user_id
    where m.user_id = v_existant
    limit 1;

    -- Déjà le sien : on ne lève pas. Un double clic, ou deux onglets ouverts,
    -- ne sont pas une erreur à afficher.
    if v_existant = v_uid then
      return jsonb_build_object('ok', true, 'deja_le_votre', true,
                                'responsable_user_id', v_uid, 'responsable_nom', v_nom);
    end if;

    -- Le dossier d'un autre. Refus RENDU, pas levé : l'appelant doit pouvoir
    -- afficher qui le suit et rafraîchir sa liste. Une exception ne porterait
    -- que du texte.
    return jsonb_build_object('ok', false, 'raison', 'deja_attribue',
                              'responsable_user_id', v_existant,
                              'responsable_nom', v_nom);
  end if;

  -- Reprise : une ligne rendue par cette même personne existe peut-être. On la
  -- réactive plutôt que d'en créer une seconde, et son historique reste.
  update public.buyer_assignments
     set released_at = null, created_at = now(), assigned_by = v_uid
   where buyer_profile_id = p_buyer_profile_id and user_id = v_uid;

  if not found then
    insert into public.buyer_assignments (buyer_profile_id, user_id, responsibility, assigned_by)
    values (p_buyer_profile_id, v_uid,
            case when public.crm_has_role('commercial') then 'commercial' else 'setter' end,
            v_uid);
  end if;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'buyer_profile', p_buyer_profile_id, 'acquereur_affectation',
          jsonb_build_object('user_id', v_uid, 'mode', 'auto_attribution'));

  return jsonb_build_object('ok', true, 'responsable_user_id', v_uid);
end;
$function$;

comment on function public.crm_buyer_claim(uuid) is
  'Prendre un dossier acquéreur SANS responsable, pour soi. Ne réaffecte '
  'jamais : un dossier déjà suivi rend un refus nommant son responsable. La '
  'réaffectation reste dans crm_buyer_assign, fermée au commercial.';

-- ---------------------------------------------------------------------------
-- 4. Rendre un dossier qu'on a pris
-- ---------------------------------------------------------------------------
create or replace function public.crm_buyer_release(p_buyer_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'authentification requise' using errcode = '28000';
  end if;
  perform public.crm_require_role('administrateur', 'manager', 'setter',
                                  'agent_immobilier', 'commercial');

  -- UPDATE et non DELETE : voir le commentaire de `released_at`.
  update public.buyer_assignments
     set released_at = now()
   where buyer_profile_id = p_buyer_profile_id
     and user_id = v_uid
     and released_at is null;

  if not found then
    return jsonb_build_object('ok', false, 'raison', 'pas_le_votre');
  end if;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, event_type, new_value)
  values (v_uid, 'buyer_profile', p_buyer_profile_id, 'acquereur_affectation',
          jsonb_build_object('user_id', v_uid, 'mode', 'liberation'));

  return jsonb_build_object('ok', true);
end;
$function$;

comment on function public.crm_buyer_release(uuid) is
  'Rendre un dossier qu''on suit soi-même. La ligne d''affectation n''est '
  'jamais supprimée : elle est datée comme rendue, et reste lisible.';

revoke all on function public.crm_buyer_claim(uuid) from public, anon;
revoke all on function public.crm_buyer_release(uuid) from public, anon;
grant execute on function public.crm_buyer_claim(uuid) to authenticated;
grant execute on function public.crm_buyer_release(uuid) to authenticated;

-- NOTE D'APPLICATION. Appliquée instruction par instruction : l'outillage
-- utilisé ici expire sur `drop policy` et sur les suppressions (voir la note
-- identique dans 20261014120000_nom_affichable_des_membres.sql). Le fichier
-- reste rejouable tel quel par la CLI Supabase.
