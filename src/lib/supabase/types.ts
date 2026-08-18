/**
 * Types Supabase (écrits à la main, alignés sur les migrations
 * `supabase/migrations/*.sql`).
 *
 * - Le funnel public n'interagit qu'avec la fonction `submit_mandate_funnel`.
 * - Le CRM interne (authentifié) lit les tables sous RLS et écrit UNIQUEMENT via
 *   les fonctions `crm_*` (SECURITY DEFINER). Aucune écriture directe de table.
 *
 * Une génération automatique (`supabase gen types`) pourra remplacer ce fichier ;
 * il reste ici la source de vérité typée du back-office.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/**
 * Résultat renvoyé par la fonction SQL `submit_mandate_funnel`.
 *
 * `accepted` reste l'accusé public neutre. `created` et `opportunity_id` sont
 * destinés au **serveur uniquement** (déclenchement d'une alerte Slack sans
 * doublon) : l'action Next ne les renvoie JAMAIS au navigateur. `created=true`
 * uniquement pour l'appel qui a réellement inséré la soumission ; `opportunity_id`
 * présent seulement dans ce cas. La neutralité (existence de contact) est préservée.
 */
export interface SubmitMandateFunnelResult {
  accepted: boolean;
  created?: boolean;
  opportunity_id?: string | null;
}

// --- Lignes des tables lues par le CRM (sous RLS) ----------------------------

export type ContactRow = {
  id: string;
  created_at: string;
  updated_at: string;
  kind: "personne_physique" | "personne_morale";
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  preferred_channel: "telephone" | "email" | "indifferent" | null;
  status: string;
}

export type OpportunityRow = {
  id: string;
  created_at: string;
  updated_at: string;
  pipeline_stage: string;
  segment: string;
  processing_status: "non_affecte" | "affecte" | "clos";
  source: string;
  property_type: string | null;
  location_city: string | null;
  location_postal_code: string | null;
  location_country: string | null;
  estimated_value_band: string | null;
  sale_horizon: string | null;
  mandate_situation: string | null;
  loss_reason: string | null;
  recommended_priority: string | null;
  compatibility_score: number | null;
  maturity_score: number | null;
  score_version: string | null;
  outcome: string | null;
  outcome_reason: string | null;
  outcome_recorded_by: string | null;
  outcome_recorded_at: string | null;
  segment_decided_by: string | null;
  segment_decided_at: string | null;
  segment_decision_reason: string | null;
  segment_is_derogation: boolean;
  // Décision d'ÉLIGIBILITÉ (distincte du segment) — voir migration estimation → mandat.
  eligibility_decision:
    | "parcours_premium_prodigio"
    | "agence_classique"
    | "non_retenu"
    | "a_completer"
    | null;
  eligibility_reason: string | null;
  eligibility_decided_by: string | null;
  eligibility_decided_at: string | null;
  eligibility_is_derogation: boolean;
  eligibility_derogation_reason: string | null;
  outcome_reason_code: string | null;
}

export type FunnelSubmissionRow = {
  id: string;
  created_at: string;
  funnel_key: string;
  funnel_version: string;
  landing: string | null;
  variant: string | null;
  property_type: string | null;
  location_city: string | null;
  location_postal_code: string | null;
  location_country: string | null;
  estimated_value_band: string | null;
  sale_horizon: string | null;
  mandate_situation: string | null;
  contact_first_name: string | null;
  contact_last_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_preference: string | null;
  contact_recall_preference: string | null;
  consent_given: boolean;
  consent_notice_version: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  fbclid: string | null;
  gclid: string | null;
  origin_url: string | null;
  referrer: string | null;
  first_touch: Json | null;
  last_touch: Json | null;
  processing_status: string;
  resolution: string | null;
  contact_id: string | null;
  opportunity_id: string | null;
  compatibility_score: number | null;
  maturity_score: number | null;
  operational_priority: string | null;
  public_appreciation: string | null;
  score_version: string | null;
  score_breakdown: Json | null;
  normalized_answers: Json | null;
  raw_answers: Json | null;
}

export type OpportunityContactRow = {
  id: string;
  created_at: string;
  opportunity_id: string;
  contact_id: string;
  role: string;
  is_primary: boolean;
}

export type OrganizationRow = {
  id: string;
  created_at: string;
  updated_at: string;
  slug: string;
  name: string;
  kind: "operateur_prodigio" | "agence_partenaire";
  status: "actif" | "suspendu";
}

export type OrganizationMembershipRow = {
  id: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  organization_id: string;
  role:
    | "administrateur"
    | "manager"
    | "setter"
    | "agent_immobilier"
    | "partenaire_lecture";
  status: "actif" | "suspendu";
}

export type CrmRoleToken =
  | "administrateur"
  | "manager"
  | "setter"
  | "agent_immobilier"
  | "partenaire_lecture";

export type OrganizationInvitationRow = {
  id: string;
  created_at: string;
  updated_at: string;
  organization_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: CrmRoleToken;
  status: "en_attente" | "acceptee" | "revoquee";
  invited_by: string | null;
  expires_at: string;
  sent_at: string | null;
  accepted_at: string | null;
  accepted_by: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  auth_user_id: string | null;
  metadata: Json | null;
};

/** Ligne renvoyée par `crm_list_team` (annuaire enrichi, admin only). */
export type TeamMemberRow = {
  user_id: string;
  email: string | null;
  role: CrmRoleToken;
  status: "actif" | "suspendu";
  organization_id: string;
  member_since: string;
  last_sign_in_at: string | null;
};

/** Ligne renvoyée par `crm_list_invitations` (statut effectif dérivé). */
export type InvitationListRow = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: CrmRoleToken;
  status: "en_attente" | "acceptee" | "revoquee" | "expiree";
  organization_id: string;
  created_at: string;
  expires_at: string;
  sent_at: string | null;
  accepted_at: string | null;
  revoked_at: string | null;
  invited_by: string | null;
};

/** Ligne renvoyée par `crm_my_pending_invitation` (écran d'acceptation). */
export type MyPendingInvitationRow = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: CrmRoleToken;
  organization_name: string;
  expires_at: string;
  status: "en_attente" | "acceptee" | "revoquee" | "expiree";
};

// --- Planification des estimations & Google Calendar (V1) --------------------

export type CalendarConnectionRow = {
  id: string;
  created_at: string;
  updated_at: string;
  organization_id: string;
  user_id: string;
  provider: "google";
  google_account_email: string | null;
  google_calendar_id: string | null;
  google_calendar_summary: string | null;
  scope: string | null;
  status: "connecte" | "deconnecte" | "erreur" | "revoque";
  last_error: string | null;
  connected_at: string | null;
  last_synced_at: string | null;
  metadata: Json | null;
};

/**
 * Jetons Google CHIFFRÉS au repos. Lue / écrite UNIQUEMENT côté serveur via le
 * client admin (rôle de service) — jamais exposée au navigateur ni sous RLS.
 */
export type CalendarCredentialRow = {
  connection_id: string;
  updated_at: string;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  token_type: string | null;
  scope: string | null;
  access_token_expires_at: string | null;
};

export type EstimationAppointmentStatus =
  | "planifie"
  | "confirme"
  | "realise"
  | "annule"
  | "absent"
  | "a_replanifier";

export type EstimationAppointmentRow = {
  id: string;
  created_at: string;
  updated_at: string;
  organization_id: string;
  opportunity_id: string;
  agent_user_id: string;
  created_by_user_id: string | null;
  starts_at: string;
  ends_at: string;
  timezone: string;
  address: string | null;
  owner_contact_id: string | null;
  owner_email: string | null;
  owner_name: string | null;
  status: EstimationAppointmentStatus;
  google_calendar_id: string | null;
  google_event_id: string | null;
  google_html_link: string | null;
  idempotency_key: string;
  cancelled_at: string | null;
  cancel_reason: string | null;
  internal_notes: string | null;
  metadata: Json | null;
};

/** Ligne renvoyée par `calendar_list_bookable_agents`. */
export type BookableAgentRow = {
  user_id: string;
  email: string | null;
  role: string;
  calendar_id: string | null;
  calendar_summary: string | null;
  status: string;
};

// --- Résultat d'estimation → décision d'éligibilité → mandat → bien (V1) -----

export type EstimationReportOutcome =
  | "realisee"
  | "proprietaire_absent"
  | "rdv_annule"
  | "estimation_impossible"
  | "nouveau_rdv_necessaire";

export type EstimationReportRow = {
  id: string;
  created_at: string;
  updated_at: string;
  organization_id: string;
  opportunity_id: string;
  appointment_id: string | null;
  outcome: EstimationReportOutcome;
  performed_at: string | null;
  performed_by: string | null;
  value_low_cents: number | null;
  value_recommended_cents: number | null;
  value_high_cents: number | null;
  owner_expected_cents: number | null;
  property_condition: string | null;
  strengths: string | null;
  risks: string | null;
  owner_project_summary: string | null;
  confidential_notes: string | null;
  agent_recommendation: string | null;
  next_action: string | null;
  next_action_at: string | null;
  created_by: string | null;
  updated_by: string | null;
};

export type EconomicRuleSetRow = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  segment: string;
  organization_id: string | null;
  effective_from: string;
  effective_to: string | null;
  fee_basis: "HT" | "TTC" | "a_confirmer";
  prodigio_share_pct: number | null;
  partner_share_pct: number | null;
  status: "actif" | "inactif";
  version: number;
  created_by: string | null;
  notes: string | null;
};

export type MandateStatus =
  | "brouillon"
  | "propose"
  | "en_attente_signature"
  | "signe"
  | "refuse"
  | "expire"
  | "annule";

export type MandateRow = {
  id: string;
  created_at: string;
  updated_at: string;
  organization_id: string;
  opportunity_id: string;
  holder_organization_id: string | null;
  mandate_type: string | null;
  is_exclusive: boolean | null;
  mandate_number: string | null;
  status: MandateStatus;
  proposed_at: string | null;
  signed_at: string | null;
  start_date: string | null;
  expires_at: string | null;
  end_reason_code: string | null;
  end_reason: string | null;
  economic_snapshot: Json | null;
  signed_document_id: string | null;
  created_by: string | null;
  last_modified_by: string | null;
};

export type MandateDocumentKind =
  | "mandat_propose"
  | "mandat_signe"
  | "estimation_avis_valeur"
  | "piece_interne";

export type MandateDocumentRow = {
  id: string;
  created_at: string;
  updated_at: string;
  organization_id: string;
  opportunity_id: string;
  mandate_id: string | null;
  kind: MandateDocumentKind;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  status: "actif" | "supprime";
  uploaded_by: string | null;
  deleted_by: string | null;
  deleted_at: string | null;
};

export type PropertyStatus =
  | "preparation_a_lancer"
  | "collecte_en_cours"
  | "strategie_en_cours"
  | "production_en_cours"
  | "validation_avant_lancement"
  | "pret_a_lancer"
  | "en_diffusion"
  | "suspendu"
  | "archive";

export type PropertyRow = {
  id: string;
  created_at: string;
  updated_at: string;
  organization_id: string;
  opportunity_id: string;
  mandate_id: string;
  holder_organization_id: string | null;
  status: PropertyStatus;
  created_by: string | null;
  // Identité (Fabrique de biens V1) — additive.
  project_name: string | null;
  commercial_title: string | null;
  property_type: string | null;
  address_line: string | null;
  location_city: string | null;
  location_postal_code: string | null;
  location_country: string | null;
  surface_m2: number | null;
  land_m2: number | null;
  rooms: number | null;
  bedrooms: number | null;
  year_built: number | null;
  arch_style: string | null;
  description: string | null;
  history: string | null;
  signature_detail: string | null;
  responsible_user_id: string | null;
  main_media_id: string | null;
  ready_at: string | null;
  ready_by: string | null;
  status_reason: string | null;
};

export type PropertyPositioningRow = {
  property_id: string;
  created_at: string;
  updated_at: string;
  central_promise: string | null;
  value_pillars: string | null;
  differentiators: string | null;
  emotional_details: string | null;
  ideal_buyer_profile: string | null;
  buyer_locations: string | null;
  buyer_motivation: string | null;
  target_zones: string | null;
  ad_angles: string | null;
  do_not_communicate: string | null;
  brand_name: string | null;
  validated: boolean;
  validated_by: string | null;
  validated_at: string | null;
  updated_by: string | null;
};

export type PropertyMediaKind =
  | "photo"
  | "video"
  | "drone"
  | "plan"
  | "rendu"
  | "couverture"
  | "autre";

export type PropertyMediaRightsStatus =
  | "a_verifier"
  | "libre"
  | "sous_licence"
  | "restreint";

export type PropertyMediaRow = {
  id: string;
  created_at: string;
  updated_at: string;
  organization_id: string;
  property_id: string;
  kind: PropertyMediaKind;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  title: string | null;
  rights_status: PropertyMediaRightsStatus;
  status: "actif" | "supprime";
  uploaded_by: string | null;
  deleted_by: string | null;
  deleted_at: string | null;
};

export type PropertyDocumentCategory =
  | "mandat"
  | "diagnostic"
  | "plan"
  | "titre"
  | "legal"
  | "copropriete"
  | "autorisation"
  | "libre";

export type PropertyDocumentRow = {
  id: string;
  created_at: string;
  updated_at: string;
  organization_id: string;
  property_id: string;
  category: PropertyDocumentCategory;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  doc_status: "a_valider" | "valide" | "obsolete";
  visibility: "interne" | "restreint";
  status: "actif" | "supprime";
  uploaded_by: string | null;
  deleted_by: string | null;
  deleted_at: string | null;
};

export type PropertyProductionKind =
  | "photographie"
  | "video"
  | "drone"
  | "redaction"
  | "positionnement"
  | "identite_visuelle"
  | "site_dedie"
  | "brochure"
  | "publicites"
  | "funnel_acquereur"
  | "validation_finale";

export type PropertyProductionStatus =
  | "a_faire"
  | "en_cours"
  | "en_revue"
  | "termine"
  | "valide"
  | "bloque";

export type PropertyProductionItemRow = {
  id: string;
  created_at: string;
  updated_at: string;
  organization_id: string;
  property_id: string;
  kind: PropertyProductionKind;
  status: PropertyProductionStatus;
  assignee_user_id: string | null;
  due_at: string | null;
  notes: string | null;
  deliverable_url: string | null;
  blocker: string | null;
  validated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
};

// --- Expérience publique & funnel acquéreur (V1) -----------------------------

export type PublicationStatus =
  | "brouillon"
  | "en_preparation"
  | "pret_a_publier"
  | "publie"
  | "depublie"
  | "archive";

export type PropertyPublicConfigRow = {
  property_id: string;
  created_at: string;
  updated_at: string;
  slug: string | null;
  public_name: string | null;
  tagline: string | null;
  intro: string | null;
  story: string | null;
  experience_text: string | null;
  architecture_text: string | null;
  pillars: string | null;
  highlighted_features: string | null;
  emotional_details: string | null;
  environment_text: string | null;
  sections_config: Json | null;
  hero_media_id: string | null;
  main_public_media_id: string | null;
  social_image_media_id: string | null;
  cta_label: string | null;
  show_price: boolean;
  price_label: string | null;
  public_location: string | null;
  reference_value_cents: number | null;
  seo_index: boolean;
  seo_title: string | null;
  seo_description: string | null;
  privacy_reviewed: boolean;
  validated: boolean;
  validated_by: string | null;
  validated_at: string | null;
  publication_status: PublicationStatus;
  published_snapshot_id: string | null;
  first_published_at: string | null;
  published_at: string | null;
  published_by: string | null;
  updated_by: string | null;
};

export type PropertyPublicMediaKind =
  | "photo"
  | "video"
  | "drone"
  | "rendu"
  | "plan"
  | "couverture";

export type PropertyPublicMediaRow = {
  id: string;
  created_at: string;
  updated_at: string;
  organization_id: string;
  property_id: string;
  source_media_id: string | null;
  kind: PropertyPublicMediaKind;
  storage_path: string;
  public_path: string | null;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  alt_text: string | null;
  caption: string | null;
  sort_order: number;
  approved: boolean;
  status: "actif" | "supprime";
  uploaded_by: string | null;
  deleted_by: string | null;
  deleted_at: string | null;
};

export type PropertyPublicSnapshotRow = {
  id: string;
  created_at: string;
  property_id: string;
  version: number;
  slug: string;
  seo_index: boolean;
  content: Json;
  published_by: string | null;
};

export type BuyerReviewStatus = "nouveau" | "consulte" | "traite";

export type BuyerInterestRow = {
  id: string;
  created_at: string;
  updated_at: string;
  organization_id: string;
  property_id: string;
  contact_id: string | null;
  funnel_key: string;
  funnel_version: string;
  idempotency_key: string;
  raw_answers: Json;
  normalized_answers: Json;
  project_nature: string | null;
  budget_band: string | null;
  financing: string | null;
  purchase_horizon: string | null;
  decision_mode: string | null;
  availability: string | null;
  residence_country: string | null;
  residence_area: string | null;
  contact_first_name: string | null;
  contact_last_name: string | null;
  contact_email: string | null;
  contact_email_raw: string | null;
  contact_phone: string | null;
  contact_phone_raw: string | null;
  contact_preference: string | null;
  contact_recall_preference: string | null;
  consent_given: boolean;
  consent_notice_version: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  fbclid: string | null;
  gclid: string | null;
  origin_url: string | null;
  referrer: string | null;
  first_touch: Json | null;
  last_touch: Json | null;
  user_agent: string | null;
  budget_score: number | null;
  maturity_score: number | null;
  financing_score: number | null;
  availability_score: number | null;
  overall_score: number | null;
  priority: string | null;
  score_version: string | null;
  score_breakdown: Json | null;
  review_status: BuyerReviewStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  resolution: "nouveau_contact" | "contact_existant" | null;
  /** Dossier acquéreur consolidé auquel cet intérêt est rattaché. */
  buyer_profile_id: string | null;
};

// --- CRM Acquéreurs ----------------------------------------------------------

/** Étape COMMERCIALE du pipeline acquéreur (distincte du pipeline Mandats). */
export type BuyerPipelineStage =
  | "nouveau"
  | "a_contacter"
  | "contact_en_cours"
  | "qualifie"
  | "bien_a_proposer"
  | "visite_a_planifier"
  | "visite_planifiee"
  | "suivi_apres_visite"
  | "offre_en_cours"
  | "acquereur_gagne"
  | "perdu";

/** Qualification validée par un HUMAIN (jamais déduite d'un score). */
export type BuyerQualificationStatus = "non_qualifie" | "en_cours" | "qualifie" | "ecarte";

/** Recommandation opérationnelle DÉRIVÉE des scores (≠ qualification humaine). */
export type BuyerRecommendedPriority = "prioritaire" | "a_qualifier" | "a_suivre";

export type BuyerOutcome = "gagne" | "perdu";

export type BuyerProfileRow = {
  id: string;
  created_at: string;
  updated_at: string;
  organization_id: string;
  contact_id: string;
  pipeline_stage: BuyerPipelineStage;
  qualification_status: BuyerQualificationStatus;
  qualification_reason: string | null;
  qualified_by: string | null;
  qualified_at: string | null;
  recommended_priority: BuyerRecommendedPriority | null;
  best_overall_score: number | null;
  interest_count: number;
  first_interest_at: string | null;
  last_interest_at: string | null;
  last_activity_at: string | null;
  origin_funnel_key: string | null;
  first_touch: Json | null;
  last_touch: Json | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  outcome: BuyerOutcome | null;
  outcome_reason: string | null;
  outcome_recorded_by: string | null;
  outcome_recorded_at: string | null;
  offer_amount_cents: number | null;
  offer_property_id: string | null;
  offer_recorded_by: string | null;
  offer_recorded_at: string | null;
  created_by: string | null;
};

export type BuyerSearchCriteriaRow = {
  buyer_profile_id: string;
  created_at: string;
  updated_at: string;
  property_types: string[];
  locations: string[];
  budget_min_cents: number | null;
  budget_max_cents: number | null;
  purchase_horizon: string | null;
  financing: string | null;
  project_nature: string | null;
  decision_mode: string | null;
  notes: string | null;
  /** `funnel` = amorcé automatiquement ; `humain` = affiné par l'équipe (verrou). */
  source: "funnel" | "humain";
  updated_by: string | null;
};

export type BuyerAssignmentRow = {
  id: string;
  created_at: string;
  buyer_profile_id: string;
  user_id: string;
  responsibility: "setter" | "manager" | "agent_immobilier" | "responsable_marketing";
  assigned_by: string | null;
};

/** Facteur de matching explicable (miroir des tokens SQL). */
export type BuyerMatchFactor = "budget" | "type_de_bien" | "localisation" | "disponibilite";

export type BuyerMatchItem = {
  property_id: string;
  name: string;
  slug: string | null;
  property_type: string | null;
  city: string | null;
  publication_status: string | null;
  score: number | null;
  evaluable_weight: number;
  positives: BuyerMatchFactor[];
  incompatibilities: BuyerMatchFactor[];
  missing: BuyerMatchFactor[];
};

/** Résultat versionné de `crm_buyer_property_matches` (recommandation, jamais décision). */
export type BuyerMatchResult = {
  version: string;
  criteria_source: "funnel" | "humain" | "absent";
  weights: Record<BuyerMatchFactor, number>;
  items: BuyerMatchItem[];
};

/** Résultat calculé en base par `crm_property_readiness` (source de vérité). */
export type PropertyReadinessChecks = {
  identity: boolean;
  positioning_validated: boolean;
  main_media: boolean;
  photos: boolean;
  mandate_document: boolean;
  deliverables: boolean;
  responsible: boolean;
};

export type PropertyReadiness = {
  ready: boolean;
  total: number;
  done: number;
  percent: number;
  blocked: boolean;
  checks: PropertyReadinessChecks;
};

export type OpportunityAssignmentRow = {
  id: string;
  created_at: string;
  opportunity_id: string;
  user_id: string;
  responsibility: "setter" | "manager" | "agent_immobilier" | "responsable_marketing";
  assigned_by: string | null;
}

export type ActivityRow = {
  id: string;
  created_at: string;
  occurred_at: string;
  /**
   * Rattachement à une opportunité de mandat. `null` pour une activité de
   * dossier acquéreur : exactement UN rattachement est renseigné (contrainte
   * `activities_owner_exactly_one` en base).
   */
  opportunity_id: string | null;
  buyer_profile_id: string | null;
  contact_id: string | null;
  author_user_id: string | null;
  type: "appel" | "tentative_appel" | "email" | "sms_whatsapp" | "rendez_vous" | "note" | "autre";
  outcome:
    | "sans_reponse"
    | "message_laisse"
    | "rappel_demande"
    | "contact_etabli"
    | "mauvais_numero"
    | null;
  body: string | null;
  metadata: Json | null;
}

export type TaskRow = {
  id: string;
  created_at: string;
  updated_at: string;
  /**
   * Rattachement à une opportunité de mandat. `null` pour une tâche de dossier
   * acquéreur : exactement UN rattachement est renseigné (contrainte
   * `tasks_owner_exactly_one` en base).
   */
  opportunity_id: string | null;
  buyer_profile_id: string | null;
  author_user_id: string | null;
  assignee_user_id: string | null;
  title: string;
  kind: "rappel" | "tache";
  status: "a_faire" | "fait" | "annule";
  due_at: string | null;
  completed_at: string | null;
}

export type AuditEventRow = {
  id: string;
  created_at: string;
  actor_user_id: string | null;
  entity_type:
    | "opportunity"
    | "contact"
    | "membership"
    | "organization"
    | "invitation"
    | "property"
    | "buyer_interest"
    | "buyer_profile";
  event_type:
    | "creation"
    | "changement_stade"
    | "changement_segment"
    | "changement_affectation"
    | "changement_permission"
    | "resolution_doublon"
    | "resultat_commercial"
    | "invitation_creee"
    | "invitation_renvoyee"
    | "invitation_revoquee"
    | "invitation_acceptee"
    | "changement_role"
    | "activation_membre"
    | "desactivation_membre"
    | "estimation_realisee"
    | "decision_eligibilite"
    | "mandat_brouillon"
    | "mandat_propose"
    | "mandat_signe"
    | "mandat_refuse"
    | "mandat_expire"
    | "mandat_annule"
    | "document_ajoute"
    | "document_supprime"
    | "bien_cree"
    | "bien_identite"
    | "bien_positionnement"
    | "bien_statut"
    | "bien_responsable"
    | "bien_media_ajoute"
    | "bien_media_supprime"
    | "bien_media_principal"
    | "bien_document_ajoute"
    | "bien_document_supprime"
    | "bien_production_maj"
    | "bien_pret"
    | "acquereur_interet_statut"
    // CRM Acquéreurs
    | "acquereur_profil_cree"
    | "acquereur_interet_rattache"
    | "acquereur_stade"
    | "acquereur_qualification"
    | "acquereur_affectation"
    | "acquereur_criteres"
    | "acquereur_offre"
    | "acquereur_resultat";
  entity_id: string;
  old_value: Json | null;
  new_value: Json | null;
  metadata: Json | null;
}

type WithMutations<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

// --- Communications ---------------------------------------------------------
// Miroir TypeScript de 20260818120000_communications_v1. Aucun type ne dépend
// d'un fournisseur : `provider` est une VALEUR, jamais une structure.

export type CommunicationChannel = "email" | "sms";
export type CommunicationCategory = "transactionnel" | "marketing";
export type CommunicationTemplateStatus = "brouillon" | "actif" | "archive";
export type CommunicationBodyFormat = "markdown" | "html" | "texte";

export type CommunicationTemplateRow = {
  id: string;
  created_at: string;
  updated_at: string;
  organization_id: string;
  template_key: string;
  version: number;
  channel: CommunicationChannel;
  category: CommunicationCategory;
  name: string;
  subject: string | null;
  body: string;
  body_format: CommunicationBodyFormat;
  preview_text: string | null;
  /** Variables AUTORISÉES : le rendu refuse toute autre variable. */
  allowed_variables: string[];
  status: CommunicationTemplateStatus;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
};

export type CommunicationMessageStatus =
  | "planifie"
  | "en_attente"
  | "en_file_fournisseur"
  | "livre"
  | "echec"
  | "bloque"
  | "annule";

export type CommunicationErrorCode =
  | "configuration_absente"
  | "authentification_refusee"
  | "destinataire_invalide"
  | "domaine_non_verifie"
  | "limite_debit"
  | "indisponible"
  | "delai_depasse"
  | "rejet_permanent"
  | "erreur_inconnue";

export type CommunicationBlockedReason =
  | "coordonnee_absente"
  | "ne_plus_contacter"
  | "opposition_active"
  | "base_legale_insuffisante"
  | "canal_non_autorise"
  | "modele_absent"
  | "modele_inactif"
  | "google_couvre_l_envoi"
  | "envoi_desactive";

export type CommunicationMessageRow = {
  id: string;
  created_at: string;
  updated_at: string;
  organization_id: string;
  /** Le destinataire est TOUJOURS un contact : aucune coordonnée n'est dupliquée. */
  contact_id: string;
  opportunity_id: string | null;
  buyer_profile_id: string | null;
  property_id: string | null;
  appointment_id: string | null;
  channel: CommunicationChannel;
  category: CommunicationCategory;
  event_type: string;
  template_id: string | null;
  template_key: string | null;
  template_version: number | null;
  status: CommunicationMessageStatus;
  /** Trace fournisseur, jamais une clé métier. */
  provider: "lumail" | "twilio" | "aucun" | null;
  provider_message_id: string | null;
  provider_status: string | null;
  scheduled_at: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  failed_at: string | null;
  error_code: CommunicationErrorCode | null;
  error_detail: string | null;
  /** Décision de la POLITIQUE, jamais un motif fournisseur. */
  blocked_reason: CommunicationBlockedReason | null;
  rendered_subject: string | null;
  rendered_body: string | null;
  /** Clé d'idempotence SANS PII. */
  idempotency_key: string;
  attempt_count: number;
  created_by: string | null;
};

export type CommunicationOutboxStatus =
  | "en_attente"
  | "en_cours"
  | "traite"
  | "ignore"
  | "echec"
  | "abandonne";

export type CommunicationOutboxRow = {
  id: string;
  created_at: string;
  updated_at: string;
  organization_id: string;
  event_type: string;
  /** Clé d'idempotence de l'événement, sans PII. */
  event_key: string;
  contact_id: string | null;
  opportunity_id: string | null;
  buyer_profile_id: string | null;
  property_id: string | null;
  appointment_id: string | null;
  template_key: string;
  channel: CommunicationChannel;
  /** Charge utile MINIMALE : identifiants et horodatages uniquement. */
  payload: Json;
  available_at: string;
  attempt_count: number;
  max_attempts: number;
  locked_at: string | null;
  locked_by: string | null;
  status: CommunicationOutboxStatus;
  skip_reason: string | null;
  last_error_code: string | null;
  message_id: string | null;
};

export type CommunicationSuppressionRow = {
  id: string;
  created_at: string;
  updated_at: string;
  organization_id: string;
  contact_id: string;
  channel: CommunicationChannel | "tout";
  scope: "marketing" | "transactionnel" | "tout";
  reason:
    | "rebond_definitif"
    | "plainte"
    | "desinscription"
    | "demande_personne"
    | "erreur_permanente"
    | "decision_interne";
  source: "fournisseur" | "humain" | "import";
  provider: "lumail" | "twilio" | null;
  evidence: Json | null;
  notes: string | null;
  active: boolean;
  created_by: string | null;
  released_at: string | null;
  released_by: string | null;
  released_reason: string | null;
};

export type CommunicationAutomationStatus = "brouillon" | "actif" | "en_pause" | "archive";

export type CommunicationAutomationRow = {
  id: string;
  created_at: string;
  updated_at: string;
  organization_id: string;
  automation_key: string;
  version: number;
  name: string;
  trigger_event: string;
  conditions: Json;
  delay_minutes: number;
  action_type: "envoyer_message";
  template_key: string;
  channel: CommunicationChannel;
  exit_rules: Json;
  status: CommunicationAutomationStatus;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
};

export type CommunicationAutomationRunRow = {
  id: string;
  created_at: string;
  updated_at: string;
  organization_id: string;
  automation_id: string;
  /** Version RÉELLEMENT exécutée : un changement de règle ne réinterprète rien. */
  automation_version: number;
  contact_id: string | null;
  opportunity_id: string | null;
  buyer_profile_id: string | null;
  appointment_id: string | null;
  status: "planifie" | "en_pause" | "execute" | "sorti" | "annule" | "echec";
  scheduled_at: string;
  executed_at: string | null;
  exit_reason: string | null;
  message_id: string | null;
  idempotency_key: string;
};

export interface Database {
  public: {
    Tables: {
      contacts: WithMutations<ContactRow>;
      opportunities: WithMutations<OpportunityRow>;
      funnel_submissions: WithMutations<FunnelSubmissionRow>;
      opportunity_contacts: WithMutations<OpportunityContactRow>;
      organizations: WithMutations<OrganizationRow>;
      organization_memberships: WithMutations<OrganizationMembershipRow>;
      opportunity_organizations: WithMutations<{
        id: string;
        created_at: string;
        opportunity_id: string;
        organization_id: string;
        function: string;
      }>;
      opportunity_assignments: WithMutations<OpportunityAssignmentRow>;
      activities: WithMutations<ActivityRow>;
      tasks: WithMutations<TaskRow>;
      audit_events: WithMutations<AuditEventRow>;
      organization_invitations: WithMutations<OrganizationInvitationRow>;
      calendar_connections: WithMutations<CalendarConnectionRow>;
      calendar_credentials: WithMutations<CalendarCredentialRow>;
      estimation_appointments: WithMutations<EstimationAppointmentRow>;
      estimation_reports: WithMutations<EstimationReportRow>;
      economic_rule_sets: WithMutations<EconomicRuleSetRow>;
      mandates: WithMutations<MandateRow>;
      mandate_documents: WithMutations<MandateDocumentRow>;
      properties: WithMutations<PropertyRow>;
      property_positioning: WithMutations<PropertyPositioningRow>;
      property_media: WithMutations<PropertyMediaRow>;
      property_documents: WithMutations<PropertyDocumentRow>;
      property_production_items: WithMutations<PropertyProductionItemRow>;
      property_public_config: WithMutations<PropertyPublicConfigRow>;
      property_public_media: WithMutations<PropertyPublicMediaRow>;
      property_public_snapshots: WithMutations<PropertyPublicSnapshotRow>;
      buyer_interests: WithMutations<BuyerInterestRow>;
      buyer_profiles: WithMutations<BuyerProfileRow>;
      buyer_search_criteria: WithMutations<BuyerSearchCriteriaRow>;
      buyer_assignments: WithMutations<BuyerAssignmentRow>;
      communication_templates: WithMutations<CommunicationTemplateRow>;
      communication_messages: WithMutations<CommunicationMessageRow>;
      communication_outbox: WithMutations<CommunicationOutboxRow>;
      communication_suppressions: WithMutations<CommunicationSuppressionRow>;
      communication_automations: WithMutations<CommunicationAutomationRow>;
      communication_automation_runs: WithMutations<CommunicationAutomationRunRow>;
    };
    Views: Record<string, never>;
    Functions: {
      submit_mandate_funnel: { Args: { payload: Json }; Returns: Json };
      crm_active_roles: { Args: Record<string, never>; Returns: string[] };
      crm_has_access: { Args: Record<string, never>; Returns: boolean };
      crm_list_members: {
        Args: Record<string, never>;
        Returns: {
          user_id: string;
          email: string | null;
          role: string;
          organization_id: string;
          status: string;
        }[];
      };
      crm_assign_opportunity: {
        Args: { p_opportunity_id: string; p_user_id: string; p_responsibility?: string };
        Returns: Json;
      };
      crm_self_assign: {
        Args: { p_opportunity_id: string; p_responsibility?: string };
        Returns: Json;
      };
      crm_change_stage: {
        Args: { p_opportunity_id: string; p_stage: string; p_note?: string | null };
        Returns: Json;
      };
      crm_log_activity: {
        Args: {
          p_opportunity_id: string;
          p_type: string;
          p_outcome?: string | null;
          p_body?: string | null;
          p_contact_id?: string | null;
          p_occurred_at?: string | null;
        };
        Returns: Json;
      };
      crm_create_task: {
        Args: {
          p_opportunity_id: string;
          p_title: string;
          p_kind?: string;
          p_due_at?: string | null;
          p_assignee_user_id?: string | null;
        };
        Returns: Json;
      };
      crm_set_task_status: {
        Args: { p_task_id: string; p_status: string };
        Returns: Json;
      };
      crm_decide_segment: {
        Args: {
          p_opportunity_id: string;
          p_segment: string;
          p_reason?: string | null;
          p_is_derogation?: boolean;
        };
        Returns: Json;
      };
      crm_record_outcome: {
        Args: {
          p_opportunity_id: string;
          p_outcome: string;
          p_reason?: string | null;
          p_reason_code?: string | null;
        };
        Returns: Json;
      };
      crm_bootstrap_first_admin: { Args: { p_email: string }; Returns: Json };
      crm_invite_member: {
        Args: { p_email: string; p_role: string; p_organization_slug?: string };
        Returns: Json;
      };
      // --- V1 utilisateurs & accès ---
      crm_is_operator: { Args: Record<string, never>; Returns: boolean };
      crm_role_is_assignable: { Args: { p_role: string }; Returns: boolean };
      crm_assigned_opportunity_ids: {
        Args: Record<string, never>;
        Returns: string[];
      };
      crm_create_invitation: {
        Args: {
          p_email: string;
          p_first_name: string | null;
          p_last_name: string | null;
          p_role: string;
          p_organization_slug?: string;
          p_ttl_days?: number;
        };
        Returns: Json;
      };
      crm_resend_invitation: {
        Args: { p_invitation_id: string; p_ttl_days?: number };
        Returns: Json;
      };
      crm_mark_invitation_sent: {
        Args: { p_invitation_id: string; p_auth_user_id?: string | null };
        Returns: Json;
      };
      crm_revoke_invitation: {
        Args: { p_invitation_id: string };
        Returns: Json;
      };
      crm_accept_invitation: { Args: Record<string, never>; Returns: Json };
      crm_my_pending_invitation: {
        Args: Record<string, never>;
        Returns: MyPendingInvitationRow[];
      };
      crm_change_member_role: {
        Args: { p_user_id: string; p_role: string; p_organization_slug?: string };
        Returns: Json;
      };
      crm_set_member_status: {
        Args: { p_user_id: string; p_status: string; p_organization_slug?: string };
        Returns: Json;
      };
      crm_list_team: {
        Args: Record<string, never>;
        Returns: TeamMemberRow[];
      };
      crm_list_invitations: {
        Args: Record<string, never>;
        Returns: InvitationListRow[];
      };
      // --- V1 planification des estimations & Google Calendar ---
      calendar_can_plan: { Args: Record<string, never>; Returns: boolean };
      calendar_can_connect: { Args: Record<string, never>; Returns: boolean };
      calendar_can_manage: { Args: Record<string, never>; Returns: boolean };
      crm_current_operator_org: { Args: Record<string, never>; Returns: string | null };
      calendar_upsert_connection: {
        Args: {
          p_account_email: string;
          p_scope?: string | null;
          p_calendar_id?: string | null;
          p_calendar_summary?: string | null;
        };
        Returns: Json;
      };
      calendar_select_estimation_calendar: {
        Args: { p_calendar_id: string; p_calendar_summary?: string | null };
        Returns: Json;
      };
      calendar_mark_connection_state: {
        Args: { p_user_id: string; p_status: string; p_error?: string | null };
        Returns: Json;
      };
      calendar_disconnect: { Args: Record<string, never>; Returns: Json };
      calendar_list_bookable_agents: {
        Args: Record<string, never>;
        Returns: BookableAgentRow[];
      };
      crm_reserve_estimation_appointment: {
        Args: {
          p_idempotency_key: string;
          p_opportunity_id: string;
          p_agent_user_id: string;
          p_starts_at: string;
          p_ends_at: string;
          p_timezone?: string;
          p_address?: string | null;
          p_owner_contact_id?: string | null;
          p_owner_email?: string | null;
          p_owner_name?: string | null;
          p_calendar_id?: string | null;
          p_notes?: string | null;
        };
        Returns: Json;
      };
      crm_confirm_estimation_appointment: {
        Args: {
          p_id: string;
          p_google_event_id: string;
          p_google_calendar_id?: string | null;
          p_html_link?: string | null;
        };
        Returns: Json;
      };
      crm_discard_pending_appointment: {
        Args: { p_id: string };
        Returns: Json;
      };
      crm_reschedule_estimation_appointment: {
        Args: { p_id: string; p_starts_at: string; p_ends_at: string };
        Returns: Json;
      };
      crm_cancel_estimation_appointment: {
        Args: { p_id: string; p_reason?: string | null };
        Returns: Json;
      };
      crm_set_appointment_result: {
        Args: { p_id: string; p_status: string; p_notes?: string | null };
        Returns: Json;
      };
      // --- V1 estimation → éligibilité → mandat → bien ---
      crm_can_decide: { Args: Record<string, never>; Returns: boolean };
      crm_can_report_estimation: {
        Args: { p_opportunity_id: string };
        Returns: boolean;
      };
      crm_save_estimation_report: {
        Args: {
          p_opportunity_id: string;
          p_outcome: string;
          p_performed_at?: string | null;
          p_performed_by?: string | null;
          p_value_low_cents?: number | null;
          p_value_recommended_cents?: number | null;
          p_value_high_cents?: number | null;
          p_owner_expected_cents?: number | null;
          p_property_condition?: string | null;
          p_strengths?: string | null;
          p_risks?: string | null;
          p_owner_project_summary?: string | null;
          p_confidential_notes?: string | null;
          p_agent_recommendation?: string | null;
          p_next_action?: string | null;
          p_next_action_at?: string | null;
          p_appointment_id?: string | null;
        };
        Returns: Json;
      };
      crm_validate_eligibility: {
        Args: {
          p_opportunity_id: string;
          p_decision: string;
          p_reason?: string | null;
          p_is_derogation?: boolean;
          p_derogation_reason?: string | null;
        };
        Returns: Json;
      };
      crm_upsert_economic_rule: {
        Args: {
          p_id: string | null;
          p_name: string;
          p_segment: string;
          p_effective_from: string;
          p_fee_basis?: string;
          p_prodigio_share_pct?: number | null;
          p_partner_share_pct?: number | null;
          p_organization_id?: string | null;
          p_effective_to?: string | null;
          p_status?: string;
          p_notes?: string | null;
        };
        Returns: Json;
      };
      crm_create_mandate_draft: {
        Args: {
          p_opportunity_id: string;
          p_holder_organization_id?: string | null;
          p_mandate_type?: string | null;
          p_is_exclusive?: boolean | null;
        };
        Returns: Json;
      };
      crm_propose_mandate: {
        Args: {
          p_mandate_id: string;
          p_economic_rule_id: string;
          p_mandate_type?: string | null;
          p_is_exclusive?: boolean | null;
          p_start_date?: string | null;
          p_expires_at?: string | null;
        };
        Returns: Json;
      };
      crm_sign_mandate: {
        Args: {
          p_mandate_id: string;
          p_mandate_number: string;
          p_signed_at: string;
          p_signed_document_id: string;
          p_start_date?: string | null;
          p_expires_at?: string | null;
        };
        Returns: Json;
      };
      crm_transition_mandate: {
        Args: {
          p_mandate_id: string;
          p_status: string;
          p_reason_code?: string | null;
          p_reason?: string | null;
        };
        Returns: Json;
      };
      crm_register_document: {
        Args: {
          p_opportunity_id: string;
          p_kind: string;
          p_storage_path: string;
          p_file_name: string;
          p_mime_type: string;
          p_size_bytes: number;
          p_mandate_id?: string | null;
        };
        Returns: Json;
      };
      crm_delete_document: {
        Args: { p_document_id: string };
        Returns: Json;
      };
      crm_handoff_create_property: {
        Args: { p_mandate_id: string };
        Returns: Json;
      };
      crm_register_partner_organization: {
        Args: { p_name: string; p_slug: string };
        Returns: Json;
      };
      // --- V1 Fabrique de biens ---
      crm_property_access: { Args: { p_property_id: string }; Returns: boolean };
      crm_property_can_edit: { Args: { p_property_id: string }; Returns: boolean };
      crm_property_update_identity: {
        Args: {
          p_property_id: string;
          p_project_name?: string | null;
          p_commercial_title?: string | null;
          p_property_type?: string | null;
          p_address_line?: string | null;
          p_location_city?: string | null;
          p_location_postal_code?: string | null;
          p_location_country?: string | null;
          p_surface_m2?: number | null;
          p_land_m2?: number | null;
          p_rooms?: number | null;
          p_bedrooms?: number | null;
          p_year_built?: number | null;
          p_arch_style?: string | null;
          p_description?: string | null;
          p_history?: string | null;
          p_signature_detail?: string | null;
        };
        Returns: Json;
      };
      crm_property_upsert_positioning: {
        Args: {
          p_property_id: string;
          p_central_promise?: string | null;
          p_value_pillars?: string | null;
          p_differentiators?: string | null;
          p_emotional_details?: string | null;
          p_ideal_buyer_profile?: string | null;
          p_buyer_locations?: string | null;
          p_buyer_motivation?: string | null;
          p_target_zones?: string | null;
          p_ad_angles?: string | null;
          p_do_not_communicate?: string | null;
          p_brand_name?: string | null;
        };
        Returns: Json;
      };
      crm_property_validate_positioning: {
        Args: { p_property_id: string; p_validated?: boolean };
        Returns: Json;
      };
      crm_property_register_media: {
        Args: {
          p_property_id: string;
          p_kind: string;
          p_storage_path: string;
          p_file_name: string;
          p_mime_type: string;
          p_size_bytes: number;
          p_title?: string | null;
        };
        Returns: Json;
      };
      crm_property_update_media: {
        Args: {
          p_media_id: string;
          p_title?: string | null;
          p_kind?: string | null;
          p_rights_status?: string | null;
        };
        Returns: Json;
      };
      crm_property_set_primary_media: {
        Args: { p_property_id: string; p_media_id: string };
        Returns: Json;
      };
      crm_property_delete_media: {
        Args: { p_media_id: string };
        Returns: Json;
      };
      crm_property_register_document: {
        Args: {
          p_property_id: string;
          p_category: string;
          p_storage_path: string;
          p_file_name: string;
          p_mime_type: string;
          p_size_bytes: number;
          p_visibility?: string;
        };
        Returns: Json;
      };
      crm_property_delete_document: {
        Args: { p_document_id: string };
        Returns: Json;
      };
      crm_property_seed_production_plan: {
        Args: { p_property_id: string };
        Returns: Json;
      };
      crm_property_set_production: {
        Args: {
          p_item_id: string;
          p_status?: string | null;
          p_assignee_user_id?: string | null;
          p_due_at?: string | null;
          p_notes?: string | null;
          p_deliverable_url?: string | null;
          p_blocker?: string | null;
        };
        Returns: Json;
      };
      crm_property_set_responsible: {
        Args: { p_property_id: string; p_user_id: string | null };
        Returns: Json;
      };
      crm_property_readiness: {
        Args: { p_property_id: string };
        Returns: Json;
      };
      crm_property_transition_status: {
        Args: { p_property_id: string; p_status: string; p_reason?: string | null };
        Returns: Json;
      };
      // --- V1 expérience publique & funnel acquéreur ---
      submit_buyer_interest: { Args: { payload: Json }; Returns: Json };
      public_property_by_slug: { Args: { p_slug: string }; Returns: Json };
      public_indexable_properties: {
        Args: Record<string, never>;
        Returns: { slug: string; published_at: string | null }[];
      };
      crm_property_public_readiness: { Args: { p_property_id: string }; Returns: Json };
      crm_property_public_preview: { Args: { p_property_id: string }; Returns: Json };
      crm_property_upsert_public_config: {
        Args: {
          p_property_id: string;
          p_slug?: string | null;
          p_public_name?: string | null;
          p_tagline?: string | null;
          p_intro?: string | null;
          p_story?: string | null;
          p_experience_text?: string | null;
          p_architecture_text?: string | null;
          p_pillars?: string | null;
          p_highlighted_features?: string | null;
          p_emotional_details?: string | null;
          p_environment_text?: string | null;
          p_sections_config?: Json | null;
          p_cta_label?: string | null;
          p_show_price?: boolean | null;
          p_price_label?: string | null;
          p_public_location?: string | null;
          p_reference_value_cents?: number | null;
          p_seo_index?: boolean | null;
          p_seo_title?: string | null;
          p_seo_description?: string | null;
          p_privacy_reviewed?: boolean | null;
        };
        Returns: Json;
      };
      crm_property_validate_public_content: {
        Args: { p_property_id: string; p_validated?: boolean };
        Returns: Json;
      };
      crm_property_register_public_media: {
        Args: {
          p_property_id: string;
          p_kind: string;
          p_storage_path: string;
          p_file_name: string;
          p_mime_type: string;
          p_size_bytes: number;
          p_alt_text?: string | null;
          p_caption?: string | null;
          p_source_media_id?: string | null;
        };
        Returns: Json;
      };
      crm_property_update_public_media: {
        Args: {
          p_media_id: string;
          p_alt_text?: string | null;
          p_caption?: string | null;
          p_kind?: string | null;
          p_sort_order?: number | null;
          p_approved?: boolean | null;
        };
        Returns: Json;
      };
      crm_property_delete_public_media: {
        Args: { p_media_id: string };
        Returns: Json;
      };
      crm_property_set_public_media_role: {
        Args: { p_property_id: string; p_role: string; p_media_id: string | null };
        Returns: Json;
      };
      crm_property_publish: {
        Args: { p_property_id: string; p_public_paths?: Json };
        Returns: Json;
      };
      crm_property_media_to_publish: {
        Args: { p_property_id: string };
        Returns: { id: string; storage_path: string; mime_type: string }[];
      };
      crm_property_unpublish: {
        Args: { p_property_id: string; p_reason?: string | null };
        Returns: Json;
      };
      crm_property_set_publication_status: {
        Args: { p_property_id: string; p_status: string };
        Returns: Json;
      };
      crm_buyer_interest_set_status: {
        Args: { p_interest_id: string; p_status: string };
        Returns: Json;
      };
      // --- CRM Acquéreurs ----------------------------------------------------
      crm_buyer_set_stage: {
        Args: { p_buyer_profile_id: string; p_stage: string };
        Returns: Json;
      };
      crm_buyer_qualify: {
        Args: { p_buyer_profile_id: string; p_status: string; p_reason?: string | null };
        Returns: Json;
      };
      crm_buyer_assign: {
        Args: { p_buyer_profile_id: string; p_user_id: string; p_responsibility?: string };
        Returns: Json;
      };
      crm_buyer_unassign: {
        Args: { p_buyer_profile_id: string; p_user_id: string };
        Returns: Json;
      };
      crm_buyer_upsert_criteria: {
        Args: {
          p_buyer_profile_id: string;
          p_property_types?: string[] | null;
          p_locations?: string[] | null;
          p_budget_min_cents?: number | null;
          p_budget_max_cents?: number | null;
          p_purchase_horizon?: string | null;
          p_financing?: string | null;
          p_project_nature?: string | null;
          p_decision_mode?: string | null;
          p_notes?: string | null;
        };
        Returns: Json;
      };
      crm_buyer_record_offer: {
        Args: {
          p_buyer_profile_id: string;
          p_property_id?: string | null;
          p_amount_cents?: number | null;
          p_note?: string | null;
        };
        Returns: Json;
      };
      crm_buyer_record_outcome: {
        Args: { p_buyer_profile_id: string; p_outcome: string; p_reason?: string | null };
        Returns: Json;
      };
      crm_buyer_reopen: {
        Args: { p_buyer_profile_id: string; p_reason: string };
        Returns: Json;
      };
      crm_buyer_log_activity: {
        Args: {
          p_buyer_profile_id: string;
          p_type: string;
          p_outcome?: string | null;
          p_body?: string | null;
          p_occurred_at?: string | null;
        };
        Returns: Json;
      };
      crm_buyer_create_task: {
        Args: {
          p_buyer_profile_id: string;
          p_title: string;
          p_kind?: string;
          p_due_at?: string | null;
          p_assignee_user_id?: string | null;
        };
        Returns: Json;
      };
      crm_buyer_set_task_status: {
        Args: { p_task_id: string; p_status: string };
        Returns: Json;
      };
      crm_buyer_property_matches: {
        Args: { p_buyer_profile_id: string; p_limit?: number };
        Returns: Json;
      };

      // --- Communications ---------------------------------------------------
      crm_comm_eligibility: {
        Args: { p_contact_id: string; p_channel: string; p_category: string };
        Returns: Json;
      };
      crm_comm_upsert_template: {
        Args: {
          p_template_key: string;
          p_channel: string;
          p_category: string;
          p_name: string;
          p_subject?: string | null;
          p_body: string;
          p_body_format?: string;
          p_preview_text?: string | null;
          p_allowed_variables?: string[];
          p_notes?: string | null;
        };
        Returns: Json;
      };
      crm_comm_set_template_status: {
        Args: { p_template_id: string; p_status: string };
        Returns: Json;
      };
      crm_comm_add_suppression: {
        Args: {
          p_contact_id: string;
          p_channel: string;
          p_scope: string;
          p_reason: string;
          p_notes?: string | null;
        };
        Returns: Json;
      };
      crm_comm_release_suppression: {
        Args: { p_id: string; p_reason: string };
        Returns: Json;
      };
      crm_comm_upsert_automation: {
        Args: {
          p_automation_key: string;
          p_name: string;
          p_trigger_event: string;
          p_template_key: string;
          p_channel: string;
          p_delay_minutes?: number;
          p_conditions?: Json;
          p_exit_rules?: Json;
          p_notes?: string | null;
        };
        Returns: Json;
      };
      crm_comm_set_automation_status: {
        Args: { p_automation_id: string; p_status: string };
        Returns: Json;
      };
      crm_comm_claim_outbox: { Args: { p_limit?: number }; Returns: Json };
      crm_comm_prepare_message: { Args: { p_outbox_id: string }; Returns: Json };
      crm_comm_record_send: {
        Args: {
          p_message_id: string;
          p_status: string;
          p_provider: string;
          p_provider_message_id?: string | null;
          p_error_code?: string | null;
          p_error_detail?: string | null;
          p_rendered_subject?: string | null;
          p_rendered_body?: string | null;
        };
        Returns: Json;
      };
      crm_comm_reconcile_status: {
        Args: {
          p_message_id: string;
          p_status: string;
          p_provider_status?: string | null;
          p_error_code?: string | null;
        };
        Returns: Json;
      };
      crm_comm_cancel_message: {
        Args: { p_message_id: string; p_reason: string };
        Returns: Json;
      };
      crm_comm_retry_message: { Args: { p_message_id: string }; Returns: Json };
      crm_comm_schedule_reminders: { Args: { p_hours_ahead?: number }; Returns: Json };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
