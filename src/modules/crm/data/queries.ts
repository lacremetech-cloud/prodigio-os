import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { contactName } from "../format";
import type { Lead, LeadAssignee, LeadNextTask } from "../leads";
import type {
  ActivityRow,
  AuditEventRow,
  ContactRow,
  FunnelSubmissionRow,
  OpportunityAssignmentRow,
  OpportunityContactRow,
  OpportunityRow,
  TaskRow,
} from "@/lib/supabase/types";

/**
 * Couche d'accès en LECTURE du CRM. Toutes les requêtes passent par le client
 * serveur (JWT de l'utilisateur) : la RLS PostgreSQL applique les permissions.
 * On NE duplique PAS les données : on lit contacts / opportunities /
 * funnel_submissions / opportunity_contacts et les tables CRM, puis on assemble
 * l'agrégat « Lead » en mémoire (volumétrie faible).
 */

export interface MemberInfo {
  email: string | null;
  role: string;
}

export async function getMembersMap(): Promise<Map<string, MemberInfo>> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("crm_list_members");
  const map = new Map<string, MemberInfo>();
  if (Array.isArray(data)) {
    for (const m of data) {
      map.set(m.user_id, { email: m.email ?? null, role: m.role });
    }
  }
  return map;
}

/** Nom affichable d'un membre : partie locale de l'e-mail, sinon identifiant court. */
export function memberDisplayName(
  userId: string,
  members: Map<string, MemberInfo>,
): string {
  const info = members.get(userId);
  if (info?.email) return info.email.split("@")[0] || info.email;
  return `Membre ${userId.slice(0, 6)}`;
}

interface LeadBundle {
  leads: Lead[];
  contactedOpportunityIds: Set<string>;
  members: Map<string, MemberInfo>;
}

/**
 * Charge tous les leads visibles (agrégat opportunité + contact principal +
 * affectations + prochaine action + soumission) et l'ensemble des opportunités
 * ayant eu un « contact établi » (pour le taux de contact).
 */
export async function loadLeadBundle(): Promise<LeadBundle> {
  const supabase = await createSupabaseServerClient();

  const [
    { data: opportunities },
    { data: oppContacts },
    { data: contacts },
    { data: submissions },
    { data: assignments },
    { data: openTasks },
    { data: activities },
    members,
  ] = await Promise.all([
    supabase
      .from("opportunities")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase.from("opportunity_contacts").select("*"),
    supabase.from("contacts").select("*"),
    supabase.from("funnel_submissions").select("*"),
    supabase.from("opportunity_assignments").select("*"),
    supabase.from("tasks").select("*").eq("status", "a_faire"),
    supabase
      .from("activities")
      .select("id, opportunity_id, occurred_at, type, outcome")
      .order("occurred_at", { ascending: false }),
    getMembersMap(),
  ]);

  const contactById = new Map<string, ContactRow>();
  for (const c of (contacts ?? []) as ContactRow[]) contactById.set(c.id, c);

  // Contact principal par opportunité (à défaut, le premier trouvé).
  const primaryContactByOpp = new Map<string, ContactRow>();
  for (const oc of (oppContacts ?? []) as OpportunityContactRow[]) {
    const contact = contactById.get(oc.contact_id);
    if (!contact) continue;
    if (oc.is_primary || !primaryContactByOpp.has(oc.opportunity_id)) {
      primaryContactByOpp.set(oc.opportunity_id, contact);
    }
  }

  const submissionByOpp = new Map<string, FunnelSubmissionRow>();
  for (const s of (submissions ?? []) as FunnelSubmissionRow[]) {
    if (!s.opportunity_id) continue;
    const prev = submissionByOpp.get(s.opportunity_id);
    if (!prev || s.created_at > prev.created_at) {
      submissionByOpp.set(s.opportunity_id, s);
    }
  }

  const assignmentsByOpp = new Map<string, LeadAssignee[]>();
  for (const a of (assignments ?? []) as OpportunityAssignmentRow[]) {
    const list = assignmentsByOpp.get(a.opportunity_id) ?? [];
    list.push({
      userId: a.user_id,
      responsibility: a.responsibility,
      name: memberDisplayName(a.user_id, members),
    });
    assignmentsByOpp.set(a.opportunity_id, list);
  }

  // Prochaine action = tâche ouverte à l'échéance la plus proche.
  const nextTaskByOpp = new Map<string, LeadNextTask>();
  for (const t of (openTasks ?? []) as TaskRow[]) {
    const current = nextTaskByOpp.get(t.opportunity_id);
    const candidate: LeadNextTask = {
      id: t.id,
      title: t.title,
      kind: t.kind,
      dueAt: t.due_at,
    };
    if (!current) {
      nextTaskByOpp.set(t.opportunity_id, candidate);
    } else if (t.due_at && (!current.dueAt || t.due_at < current.dueAt)) {
      nextTaskByOpp.set(t.opportunity_id, candidate);
    }
  }

  const lastActivityByOpp = new Map<string, string>();
  const contactedOpportunityIds = new Set<string>();
  for (const a of (activities ?? []) as Pick<
    ActivityRow,
    "id" | "opportunity_id" | "occurred_at" | "type" | "outcome"
  >[]) {
    if (!lastActivityByOpp.has(a.opportunity_id)) {
      lastActivityByOpp.set(a.opportunity_id, a.occurred_at);
    }
    if (a.outcome === "contact_etabli" || a.type === "rendez_vous") {
      contactedOpportunityIds.add(a.opportunity_id);
    }
  }

  const leads: Lead[] = ((opportunities ?? []) as OpportunityRow[]).map((o) => {
    const contact = primaryContactByOpp.get(o.id) ?? null;
    const submission = submissionByOpp.get(o.id) ?? null;
    return {
      opportunityId: o.id,
      createdAt: o.created_at,
      stage: o.pipeline_stage,
      segment: o.segment,
      processingStatus: o.processing_status,
      outcome: o.outcome,
      eligibilityDecision: o.eligibility_decision ?? null,
      propertyType: o.property_type,
      city: o.location_city,
      postalCode: o.location_postal_code,
      valueBand: o.estimated_value_band,
      saleHorizon: o.sale_horizon,
      mandateSituation: o.mandate_situation,
      compatibilityScore: o.compatibility_score,
      maturityScore: o.maturity_score,
      recommendedPriority: o.recommended_priority,
      publicAppreciation: submission?.public_appreciation ?? null,
      contactId: contact?.id ?? null,
      contactFirstName: contact?.first_name ?? null,
      contactLastName: contact?.last_name ?? null,
      contactEmail: contact?.email ?? null,
      contactPhone: contact?.phone ?? null,
      contactPreference: contact?.preferred_channel ?? null,
      recallPreference: submission?.contact_recall_preference ?? null,
      assignees: assignmentsByOpp.get(o.id) ?? [],
      nextTask: nextTaskByOpp.get(o.id) ?? null,
      lastActivityAt: lastActivityByOpp.get(o.id) ?? null,
    };
  });

  return { leads, contactedOpportunityIds, members };
}

// --- Détail d'un dossier -----------------------------------------------------

export interface LeadDetailContact {
  id: string;
  role: string;
  isPrimary: boolean;
  kind: string;
  name: string;
  email: string | null;
  phone: string | null;
  preferredChannel: string | null;
}

export interface LeadDetail {
  opportunity: OpportunityRow;
  contacts: LeadDetailContact[];
  submission: FunnelSubmissionRow | null;
  activities: ActivityRow[];
  tasks: TaskRow[];
  auditEvents: AuditEventRow[];
  assignees: LeadAssignee[];
  members: Map<string, MemberInfo>;
}

export async function getLeadDetail(
  opportunityId: string,
): Promise<LeadDetail | null> {
  const supabase = await createSupabaseServerClient();

  const { data: opportunity } = await supabase
    .from("opportunities")
    .select("*")
    .eq("id", opportunityId)
    .maybeSingle();

  if (!opportunity) return null;

  const [
    { data: oppContacts },
    { data: contacts },
    { data: submission },
    { data: activities },
    { data: tasks },
    { data: auditEvents },
    { data: assignments },
    members,
  ] = await Promise.all([
    supabase
      .from("opportunity_contacts")
      .select("*")
      .eq("opportunity_id", opportunityId),
    supabase.from("contacts").select("*"),
    supabase
      .from("funnel_submissions")
      .select("*")
      .eq("opportunity_id", opportunityId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("activities")
      .select("*")
      .eq("opportunity_id", opportunityId)
      .order("occurred_at", { ascending: false }),
    supabase
      .from("tasks")
      .select("*")
      .eq("opportunity_id", opportunityId)
      .order("due_at", { ascending: true }),
    supabase
      .from("audit_events")
      .select("*")
      .eq("entity_type", "opportunity")
      .eq("entity_id", opportunityId)
      .order("created_at", { ascending: false }),
    supabase
      .from("opportunity_assignments")
      .select("*")
      .eq("opportunity_id", opportunityId),
    getMembersMap(),
  ]);

  const contactById = new Map<string, ContactRow>();
  for (const c of (contacts ?? []) as ContactRow[]) contactById.set(c.id, c);

  const detailContacts: LeadDetailContact[] = (
    (oppContacts ?? []) as OpportunityContactRow[]
  )
    .flatMap((oc): LeadDetailContact[] => {
      const c = contactById.get(oc.contact_id);
      if (!c) return [];
      return [
        {
          id: c.id,
          role: oc.role,
          isPrimary: oc.is_primary,
          kind: c.kind,
          name: c.company_name ?? contactName(c.first_name, c.last_name),
          email: c.email,
          phone: c.phone,
          preferredChannel: c.preferred_channel,
        },
      ];
    })
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));

  const assignees: LeadAssignee[] = (
    (assignments ?? []) as OpportunityAssignmentRow[]
  ).map((a) => ({
    userId: a.user_id,
    responsibility: a.responsibility,
    name: memberDisplayName(a.user_id, members),
  }));

  return {
    opportunity: opportunity as OpportunityRow,
    contacts: detailContacts,
    submission: (submission as FunnelSubmissionRow | null) ?? null,
    activities: (activities ?? []) as ActivityRow[],
    tasks: (tasks ?? []) as TaskRow[],
    auditEvents: (auditEvents ?? []) as AuditEventRow[],
    assignees,
    members,
  };
}

/** Tâches ouvertes, avec le contexte minimal de leur opportunité (pour /crm/taches). */
export interface TaskWithContext {
  task: TaskRow;
  opportunityId: string;
  contactLabel: string;
  city: string | null;
}

export async function listOpenTasks(): Promise<TaskWithContext[]> {
  const { leads } = await loadLeadBundle();
  const supabase = await createSupabaseServerClient();
  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .in("status", ["a_faire"])
    .order("due_at", { ascending: true });

  const leadByOpp = new Map(leads.map((l) => [l.opportunityId, l]));
  return ((tasks ?? []) as TaskRow[]).map((t) => {
    const lead = leadByOpp.get(t.opportunity_id);
    return {
      task: t,
      opportunityId: t.opportunity_id,
      contactLabel: lead
        ? contactName(lead.contactFirstName, lead.contactLastName)
        : "Dossier",
      city: lead?.city ?? null,
    };
  });
}
