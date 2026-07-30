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
  opportunity_id: string;
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
  opportunity_id: string;
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
  entity_type: "opportunity" | "contact" | "membership" | "organization" | "invitation";
  entity_id: string;
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
    | "desactivation_membre";
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
        Args: { p_opportunity_id: string; p_outcome: string; p_reason?: string | null };
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
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
