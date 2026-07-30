import "server-only";

/**
 * Couche de LECTURE des rendez-vous d'estimation. Les requêtes passent par le
 * client serveur (JWT utilisateur) : la RLS applique les permissions (opérateur =
 * tout ; agent = ses propres rendez-vous ou dossiers affectés).
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMembersMap, memberDisplayName } from "@/modules/crm/data/queries";
import { contactName } from "@/modules/crm/format";
import type {
  BookableAgentRow,
  ContactRow,
  EstimationAppointmentRow,
  OpportunityContactRow,
  OpportunityRow,
} from "@/lib/supabase/types";

/** Agents « réservables » (calendrier Google connecté) — via RPC (opérateurs). */
export async function listBookableAgents(): Promise<BookableAgentRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("calendar_list_bookable_agents");
  return Array.isArray(data) ? (data as BookableAgentRow[]) : [];
}

/** Rendez-vous d'un dossier (ordre chronologique décroissant). */
export async function getAppointmentsForOpportunity(
  opportunityId: string,
): Promise<EstimationAppointmentRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("estimation_appointments")
    .select("*")
    .eq("opportunity_id", opportunityId)
    .order("starts_at", { ascending: false });
  return Array.isArray(data) ? (data as EstimationAppointmentRow[]) : [];
}

export interface AppointmentWithContext {
  appointment: EstimationAppointmentRow;
  agentName: string;
  city: string | null;
  contactLabel: string;
}

/**
 * Tous les rendez-vous visibles, enrichis du nom de l'agent, de la ville du bien
 * et du contact principal (assemblage en mémoire, volumétrie faible).
 */
export async function listAppointments(): Promise<AppointmentWithContext[]> {
  const supabase = await createSupabaseServerClient();
  const [{ data: appointments }, { data: opportunities }, { data: oppContacts }, { data: contacts }, members] =
    await Promise.all([
      supabase
        .from("estimation_appointments")
        .select("*")
        .order("starts_at", { ascending: true }),
      supabase.from("opportunities").select("id, location_city"),
      supabase.from("opportunity_contacts").select("*"),
      supabase.from("contacts").select("*"),
      getMembersMap(),
    ]);

  const cityByOpp = new Map<string, string | null>();
  for (const o of (opportunities ?? []) as Pick<OpportunityRow, "id" | "location_city">[]) {
    cityByOpp.set(o.id, o.location_city);
  }

  const contactById = new Map<string, ContactRow>();
  for (const c of (contacts ?? []) as ContactRow[]) contactById.set(c.id, c);
  const primaryContactByOpp = new Map<string, ContactRow>();
  for (const oc of (oppContacts ?? []) as OpportunityContactRow[]) {
    const contact = contactById.get(oc.contact_id);
    if (!contact) continue;
    if (oc.is_primary || !primaryContactByOpp.has(oc.opportunity_id)) {
      primaryContactByOpp.set(oc.opportunity_id, contact);
    }
  }

  return ((appointments ?? []) as EstimationAppointmentRow[]).map((a) => {
    const contact = primaryContactByOpp.get(a.opportunity_id) ?? null;
    const contactLabel =
      a.owner_name ??
      (contact
        ? contact.company_name ?? contactName(contact.first_name, contact.last_name)
        : "Dossier");
    return {
      appointment: a,
      agentName: memberDisplayName(a.agent_user_id, members),
      city: cityByOpp.get(a.opportunity_id) ?? null,
      contactLabel,
    };
  });
}
