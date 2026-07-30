import type { Metadata } from "next";
import { requireCrmSession } from "@/modules/crm/auth/session";
import { listAppointments } from "@/modules/calendar/queries";
import {
  AppointmentsBoard,
  type BoardAppointment,
} from "@/components/crm/calendar/appointments-board";

export const metadata: Metadata = { title: "Rendez-vous" };

/**
 * Vue d'ensemble des rendez-vous d'estimation. La RLS restreint la visibilité
 * (opérateur = tout ; agent = ses rendez-vous / dossiers affectés). Le
 * regroupement et les filtres sont appliqués côté client sur les données lues.
 */
export default async function AppointmentsPage() {
  await requireCrmSession("/crm/rendez-vous");
  const rows = await listAppointments();

  const appointments: BoardAppointment[] = rows.map((r) => ({
    id: r.appointment.id,
    opportunityId: r.appointment.opportunity_id,
    agentUserId: r.appointment.agent_user_id,
    agentName: r.agentName,
    city: r.city,
    contactLabel: r.contactLabel,
    startsAt: r.appointment.starts_at,
    endsAt: r.appointment.ends_at,
    timezone: r.appointment.timezone,
    address: r.appointment.address,
    status: r.appointment.status,
    googleHtmlLink: r.appointment.google_html_link,
  }));

  const nowIso = new Date().toISOString();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header>
        <p className="crm-eyebrow">Estimations</p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--crm-text)]">Rendez-vous</h1>
        <p className="mt-1 text-sm text-[var(--crm-text-dim)]">
          Suivi des rendez-vous d’estimation planifiés à partir des agendas Google des agents.
        </p>
      </header>

      <AppointmentsBoard appointments={appointments} nowIso={nowIso} />
    </div>
  );
}
