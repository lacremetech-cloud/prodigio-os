-- ARCHIVER UN ACQUÉREUR — RÉSERVÉ À L'ADMINISTRATEUR.
--
-- Le besoin : sortir des listes ce qui les pollue — les fiches de test, les
-- mauvais numéros, celui qui déclare n'avoir jamais rien demandé, et les
-- doublons comme Hugues Monchamps qui occupe deux fiches.
--
-- POURQUOI ARCHIVER ET NON SUPPRIMER. Un `delete` sur `buyer_profiles` ferait
-- exactement l'inverse du résultat recherché, dans les deux sens :
--   - il DÉTRUIRAIT en cascade tout l'historique d'appels (`activities`), les
--     tâches, les critères de recherche et l'attribution — le travail de JC et
--     d'Antoine ;
--   - il CONSERVERAIT les données personnelles, parce que `buyer_interests`
--     porte le nom, l'e-mail et le téléphone en colonnes directes et que sa
--     clé étrangère est en `set null`, pas en cascade.
-- On perdrait donc l'utile et on garderait le sensible. L'archivage ne détruit
-- rien et se défait d'un geste.
--
-- L'effacement définitif — celui qu'impose une demande au titre du droit à
-- l'effacement — est un autre travail, avec d'autres garanties. Il n'est PAS
-- dans cette migration.
--
-- LE DROIT EST PLUS STRICT QUE `crm_can_decide()`, qui inclut les managers.
-- Ici c'est `administrateur` seul : ni manager, ni setter, ni commercial, ni
-- agent immobilier. Et le contrôle est en BASE, pas seulement dans l'écran :
-- masquer un bouton n'est pas un droit.

alter table public.buyer_profiles
  add column if not exists archive_le    timestamptz,
  add column if not exists archive_par   uuid,
  add column if not exists archive_motif text;

comment on column public.buyer_profiles.archive_le is
  'Date d''archivage. NULL = fiche active. Les listes et les compteurs ne '
  'retiennent que les fiches dont cette colonne est NULL.';

-- La liste filtre sur cette colonne à chaque chargement : l'index partiel ne
-- porte que les fiches actives, qui sont la quasi-totalité.
create index if not exists buyer_profiles_actifs_idx
  on public.buyer_profiles (last_interest_at desc)
  where archive_le is null;

-- --------------------------------------------------------------------------
-- Les deux types d'événements d'audit, DÉCLARÉS EN MÊME TEMPS qu'ils sont
-- écrits. C'est la leçon du 28 octobre : deux RPC journalisaient des types
-- absents de la contrainte, l'insertion d'audit échouait, et comme elle
-- partage la transaction de la mise à jour, tout était annulé sans que l'écran
-- puisse dire pourquoi.
-- --------------------------------------------------------------------------
alter table public.audit_events drop constraint audit_events_event_type_check;

alter table public.audit_events add constraint audit_events_event_type_check check (
  event_type = any (array[
    'creation', 'changement_stade', 'changement_segment', 'changement_affectation',
    'changement_permission', 'resolution_doublon', 'resultat_commercial',
    'invitation_creee', 'invitation_renvoyee', 'invitation_revoquee',
    'invitation_acceptee', 'changement_role', 'activation_membre',
    'desactivation_membre', 'calendrier_connecte', 'calendrier_deconnecte',
    'estimation_planifiee', 'estimation_replanifiee', 'estimation_annulee',
    'estimation_resultat', 'estimation_realisee', 'decision_eligibilite',
    'regle_economique_maj', 'mandat_brouillon', 'mandat_propose', 'mandat_signe',
    'mandat_refuse', 'mandat_expire', 'mandat_annule', 'document_ajoute',
    'document_remplace', 'document_supprime', 'bien_cree', 'bien_identite',
    'bien_positionnement', 'bien_statut', 'bien_responsable', 'bien_media_ajoute',
    'bien_media_supprime', 'bien_media_principal', 'bien_document_ajoute',
    'bien_document_supprime', 'bien_production_maj', 'bien_pret',
    'bien_public_config', 'bien_public_media_ajoute', 'bien_public_media_supprime',
    'bien_public_hero', 'bien_public_valide', 'bien_public_statut', 'bien_publie',
    'bien_depublie', 'acquereur_interet_statut', 'acquereur_profil_cree',
    'acquereur_interet_rattache', 'acquereur_stade', 'acquereur_qualification',
    'acquereur_affectation', 'acquereur_criteres', 'acquereur_offre',
    'acquereur_resultat', 'acquereur_traitement', 'communication_planifiee',
    'communication_preparee', 'communication_envoyee', 'communication_livree',
    'communication_echec', 'communication_bloquee', 'communication_annulee',
    'communication_rejouee', 'communication_statut', 'modele_cree', 'modele_maj',
    'modele_statut', 'automatisation_creee', 'automatisation_maj',
    'automatisation_statut', 'opposition_ajoutee', 'opposition_levee',
    'formulaire_acquereur', 'bien_espace_travail',
    -- Ajouts du 29 octobre.
    'acquereur_archive', 'acquereur_desarchive'
  ]::text[])
);

-- --------------------------------------------------------------------------
-- ARCHIVER
-- --------------------------------------------------------------------------
create or replace function public.crm_buyer_archive(
  p_buyer_profile_id uuid,
  p_motif text default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid   uuid := auth.uid();
  v_motif text := nullif(btrim(p_motif), '');
  v_deja  timestamptz;
begin
  if v_uid is null then
    raise exception 'authentification requise' using errcode = '28000';
  end if;

  -- Volontairement plus strict que `crm_can_decide()` : un manager ne retire
  -- pas une fiche des listes de son équipe.
  if not public.crm_has_role('administrateur') then
    raise exception 'seul un administrateur peut archiver un contact'
      using errcode = '42501';
  end if;

  select archive_le into v_deja
  from public.buyer_profiles where id = p_buyer_profile_id;

  if not found then
    raise exception 'contact introuvable' using errcode = '22023';
  end if;

  -- Rejouer l'appel ne crée pas un second événement et n'écrase pas la date
  -- d'origine : qui a archivé, et quand, reste ce qui s'est passé la première
  -- fois.
  if v_deja is not null then
    return jsonb_build_object('ok', true, 'deja_archive', true);
  end if;

  update public.buyer_profiles
     set archive_le = now(), archive_par = v_uid, archive_motif = v_motif,
         updated_at = now()
   where id = p_buyer_profile_id;

  insert into public.audit_events
    (actor_user_id, entity_type, entity_id, event_type, new_value)
  values
    (v_uid, 'buyer_profile', p_buyer_profile_id, 'acquereur_archive',
     jsonb_build_object('motif', v_motif));

  return jsonb_build_object('ok', true, 'deja_archive', false);
end;
$function$;

-- --------------------------------------------------------------------------
-- DÉSARCHIVER — la porte de sortie, sans laquelle l'archivage serait une
-- suppression déguisée.
-- --------------------------------------------------------------------------
create or replace function public.crm_buyer_desarchive(p_buyer_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid  uuid := auth.uid();
  v_deja timestamptz;
begin
  if v_uid is null then
    raise exception 'authentification requise' using errcode = '28000';
  end if;
  if not public.crm_has_role('administrateur') then
    raise exception 'seul un administrateur peut rétablir un contact'
      using errcode = '42501';
  end if;

  select archive_le into v_deja
  from public.buyer_profiles where id = p_buyer_profile_id;
  if not found then
    raise exception 'contact introuvable' using errcode = '22023';
  end if;
  if v_deja is null then
    return jsonb_build_object('ok', true, 'deja_actif', true);
  end if;

  update public.buyer_profiles
     set archive_le = null, archive_par = null, archive_motif = null,
         updated_at = now()
   where id = p_buyer_profile_id;

  insert into public.audit_events
    (actor_user_id, entity_type, entity_id, event_type, new_value)
  values
    (v_uid, 'buyer_profile', p_buyer_profile_id, 'acquereur_desarchive', '{}'::jsonb);

  return jsonb_build_object('ok', true, 'deja_actif', false);
end;
$function$;

revoke all on function public.crm_buyer_archive(uuid, text) from public, anon;
revoke all on function public.crm_buyer_desarchive(uuid) from public, anon;
grant execute on function public.crm_buyer_archive(uuid, text) to authenticated;
grant execute on function public.crm_buyer_desarchive(uuid) to authenticated;
