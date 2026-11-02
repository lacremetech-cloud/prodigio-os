-- CORRIGER UN BUDGET MAL DÉCLARÉ, DEPUIS LA FICHE.
--
-- Le cas est arrivé le 2 novembre sur Yves GUENIN : il avait coché
-- « 500 000 € – 1 M€ » alors que son projet était au-dessus du million. Il a
-- fallu écrire en base à la main, parce qu'AUCUNE fonction n'écrivait
-- `budget_choice` après l'envoi du formulaire. Ce n'est ni tenable ni
-- raisonnable : quelqu'un se trompe de case, ou dit au téléphone autre chose
-- que ce qu'il a coché à 23 h sur son portable.
--
-- ON N'ÉCRASE PAS LA DÉCLARATION, ON AJOUTE LA CORRECTION.
-- `buyer_interests.budget_choice` reste ce que la personne a RÉPONDU : c'est
-- une preuve, horodatée, et la colonne s'appelle « Budget déclaré ». Écraser
-- cette valeur rendrait la correction indiscernable d'une déclaration — trois
-- semaines plus tard, personne ne saurait plus qui a dit quoi.
-- La correction vit donc à côté, et c'est ELLE que lisent partout les écrans,
-- les filtres et les récapitulatifs. Les deux sont visibles sur la fiche.
--
-- ELLE VIT SUR LA PERSONNE, PAS SUR LA MANIFESTATION.
-- C'est la direction prise par la reprise du 14 octobre, qui a déplacé l'étape
-- et la qualification de la manifestation vers la personne : « qualifier
-- quelqu'un sur une villa le qualifie partout ». Un budget est de la même
-- nature — il décrit la personne, pas la villa qu'elle regarde. Quelqu'un qui
-- s'intéresse à deux biens n'a pas deux budgets, et devoir le corriger deux
-- fois serait une invitation à la contradiction.
--
-- QUI PEUT LE FAIRE : `crm_buyer_can_operate`, exactement la même porte que
-- changer l'étape, qualifier ou enregistrer un échange. Les commerciaux y sont
-- — c'était la demande, et c'est cohérent : celui qui a eu la personne au
-- téléphone est celui qui sait.

alter table public.buyer_profiles
  add column if not exists budget_choice_corrige text,
  add column if not exists budget_corrige_par    uuid,
  add column if not exists budget_corrige_le     timestamptz,
  add column if not exists budget_corrige_motif  text;

comment on column public.buyer_profiles.budget_choice_corrige is
  'Budget retenu par l''équipe quand la réponse au formulaire est fausse. '
  'NULL = aucune correction, on s''en tient à la déclaration. Les écrans, les '
  'filtres et les récapitulatifs lisent cette valeur en priorité ; '
  'buyer_interests.budget_choice garde la déclaration d''origine, intacte.';

-- Les mêmes valeurs que le formulaire, plus les trois tranches retirées que
-- cinq dossiers portent encore : corriger VERS une tranche historique n'aurait
-- pas de sens, mais la contrainte doit accepter ce qui existe déjà.
alter table public.buyer_profiles
  drop constraint if exists buyer_profiles_budget_choice_corrige_check;
alter table public.buyer_profiles
  add constraint buyer_profiles_budget_choice_corrige_check check (
    budget_choice_corrige is null or budget_choice_corrige = any (array[
      'aucun_projet', '500k_1m', 'plus_1m', '1m_2m', '2m_3m', 'plus_3m'
    ]::text[])
  );

-- --------------------------------------------------------------------------
-- Le type d'événement, DÉCLARÉ EN MÊME TEMPS qu'il est écrit.
-- C'est la leçon du 28 octobre : une RPC journalisait un type absent de la
-- contrainte, l'insertion d'audit échouait, et comme elle partage la
-- transaction de la mise à jour, tout était annulé sans que l'écran sache dire
-- pourquoi.
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
    'acquereur_archive', 'acquereur_desarchive',
    -- Ajout du 2 novembre.
    'acquereur_budget'
  ]::text[])
);

-- --------------------------------------------------------------------------
-- POSER OU RETIRER LA CORRECTION.
-- `p_budget_choice` à NULL retire la correction : on revient à la déclaration.
-- C'est la porte de sortie — sans elle, une correction posée par erreur serait
-- définitive.
-- --------------------------------------------------------------------------
create or replace function public.crm_buyer_set_budget(
  p_buyer_profile_id uuid,
  p_budget_choice text default null,
  p_motif text default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid     uuid := auth.uid();
  v_choix   text := nullif(btrim(coalesce(p_budget_choice, '')), '');
  v_motif   text := nullif(btrim(left(coalesce(p_motif, ''), 2000)), '');
  v_avant   text;
  v_declare text;
begin
  if v_uid is null then
    raise exception 'authentification requise' using errcode = '28000';
  end if;
  -- La MÊME porte que changer l'étape ou qualifier : le commercial qui a eu la
  -- personne au téléphone est celui qui sait que la case est fausse.
  if not public.crm_buyer_can_operate(p_buyer_profile_id) then
    raise exception 'droits insuffisants sur ce dossier acquéreur' using errcode = '42501';
  end if;

  if v_choix is not null and v_choix not in
     ('aucun_projet', '500k_1m', 'plus_1m', '1m_2m', '2m_3m', 'plus_3m') then
    raise exception 'tranche de budget invalide' using errcode = '22023';
  end if;

  select budget_choice_corrige into v_avant
  from public.buyer_profiles where id = p_buyer_profile_id;
  if not found then
    raise exception 'dossier introuvable' using errcode = '22023';
  end if;

  /* La déclaration d'origine, pour l'écrire dans le journal : c'est elle que
     l'on voudra retrouver quand quelqu'un demandera « mais il avait dit
     quoi, lui ? ». La plus récente qui existe — un dépôt peut n'en porter
     aucune. */
  select i.budget_choice into v_declare
  from public.buyer_interests i
  where i.buyer_profile_id = p_buyer_profile_id and i.budget_choice is not null
  order by i.created_at desc
  limit 1;

  update public.buyer_profiles set
    budget_choice_corrige = v_choix,
    budget_corrige_par    = case when v_choix is null then null else v_uid end,
    budget_corrige_le     = case when v_choix is null then null else now() end,
    budget_corrige_motif  = case when v_choix is null then null else v_motif end,
    updated_at            = now()
  where id = p_buyer_profile_id;

  insert into public.audit_events
    (actor_user_id, entity_type, entity_id, event_type, old_value, new_value)
  values
    (v_uid, 'buyer_profile', p_buyer_profile_id, 'acquereur_budget',
     jsonb_build_object('correction', v_avant),
     jsonb_build_object('correction', v_choix, 'declare', v_declare, 'motif', v_motif));

  return jsonb_build_object('ok', true, 'correction', v_choix, 'declare', v_declare);
end;
$function$;

revoke all on function public.crm_buyer_set_budget(uuid, text, text) from public, anon;
grant execute on function public.crm_buyer_set_budget(uuid, text, text) to authenticated;
