import "server-only";

/**
 * Assemble les données d'une alerte à partir de la base (appointment + bien +
 * contact + membres), via le client serveur déjà ouvert dans la requête. Aucune
 * donnée technique ni secret n'est collecté : uniquement l'opérationnel.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { mandateCrmBaseUrl } from "@/config";
import { getMembersMap, memberDisplayName } from "@/modules/crm/data/queries";
import { propertyLabel, valueBandLabel } from "@/modules/crm/labels";
import type {
  ContactRow,
  Database,
  EstimationAppointmentRow,
  OpportunityRow,
} from "@/lib/supabase/types";
import type { EstimationAlertData, EstimationAlertKind } from "./types";

export interface AlertTrigger {
  kind: EstimationAlertKind;
  appointmentId: string;
  /** Utilisateur ayant effectué l'action (auth.uid()), pour « planifié/reporté/annulé par ». */
  actorUserId: string | null;
  /** Ancien créneau (report uniquement). */
  oldStartsAt?: string | null;
  oldEndsAt?: string | null;
}

type Client = SupabaseClient<Database>;

/**
 * Charge et normalise les données de l'alerte. Renvoie `null` si le rendez-vous
 * est introuvable (aucune alerte ne sera envoyée).
 */
export async function collectEstimationAlertData(
  supabase: Client,
  trigger: AlertTrigger,
): Promise<EstimationAlertData | null> {
  const { data: apptData } = await supabase
    .from("estimation_appointments")
    .select("*")
    .eq("id", trigger.appointmentId)
    .maybeSingle();
  const appt = (apptData as EstimationAppointmentRow | null) ?? null;
  if (!appt) return null;

  const [{ data: oppData }, contact, members] = await Promise.all([
    supabase
      .from("opportunities")
      .select("id, property_type, location_city, estimated_value_band")
      .eq("id", appt.opportunity_id)
      .maybeSingle(),
    appt.owner_contact_id
      ? supabase
          .from("contacts")
          .select("phone")
          .eq("id", appt.owner_contact_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    getMembersMap(),
  ]);

  const opp = (oppData as Pick<
    OpportunityRow,
    "id" | "property_type" | "location_city" | "estimated_value_band"
  > | null) ?? null;
  const ownerPhone = (contact.data as Pick<ContactRow, "phone"> | null)?.phone ?? null;

  return {
    kind: trigger.kind,
    opportunityId: appt.opportunity_id,
    crmBaseUrl: mandateCrmBaseUrl(),
    startsAt: appt.starts_at,
    endsAt: appt.ends_at,
    timezone: appt.timezone || "Europe/Paris",
    oldStartsAt: trigger.oldStartsAt ?? null,
    oldEndsAt: trigger.oldEndsAt ?? null,
    agentName: memberDisplayName(appt.agent_user_id, members),
    actorName: trigger.actorUserId
      ? memberDisplayName(trigger.actorUserId, members)
      : null,
    ownerName: appt.owner_name,
    ownerPhone,
    ownerEmail: appt.owner_email,
    propertyType: propertyLabel(opp?.property_type),
    city: opp?.location_city ?? null,
    address: appt.address,
    valueBand: valueBandLabel(opp?.estimated_value_band),
    // Motif : uniquement s'il existe déjà dans le modèle (colonne cancel_reason).
    reason: trigger.kind === "cancelled" ? appt.cancel_reason : null,
    googleHtmlLink: appt.google_html_link,
  };
}
