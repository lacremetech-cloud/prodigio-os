-- DEUX TYPES D'ÉVÉNEMENTS ÉCRITS PAR DES RPC, MAIS JAMAIS DÉCLARÉS.
--
-- `crm_property_set_buyer_form` journalise 'formulaire_acquereur' et
-- `crm_property_set_workspace` journalise 'bien_espace_travail'. Ni l'un ni
-- l'autre ne figurait dans la contrainte : l'insertion d'audit échouait, et
-- comme elle est dans la même transaction que la mise à jour, TOUT était
-- annulé. L'écran rendait « l'enregistrement n'a pas abouti », sans dire
-- pourquoi.
--
-- Le premier a éclaté le 28 octobre en configurant le formulaire du bien
-- « Les Airelles aux 2 Alpes ». Le second n'avait jamais été déclenché :
-- personne n'avait encore renseigné l'espace de travail d'un bien. On le
-- corrige maintenant plutôt que d'attendre qu'il morde à son tour.
--
-- La contrainte est seulement ÉLARGIE : aucune valeur existante n'est retirée,
-- donc aucune ligne d'audit déjà écrite ne devient invalide.
--
-- LEÇON, pour la prochaine RPC qui journalisera quelque chose : un type
-- d'événement s'ajoute À LA CONTRAINTE en même temps qu'il s'écrit dans la
-- fonction. Les deux vivent dans des migrations différentes, donc rien ne le
-- rappelle — sauf une panne, trois semaines plus tard, chez l'utilisateur.

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
    -- Ajouts du 28 octobre.
    'formulaire_acquereur',
    'bien_espace_travail'
  ]::text[])
);
