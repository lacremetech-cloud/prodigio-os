import type { Metadata } from "next";
import { requireCrmSession } from "@/modules/crm/auth/session";
import { canManageAppointments, canViewContactDetails } from "@/modules/crm/auth/roles";
import { listAppointments } from "@/modules/calendar/queries";
import type { BoardAppointment } from "@/components/crm/calendar/appointments-board";
import { RendezVousView } from "@/components/crm/calendar/rendez-vous-view";
import type { AgendaEvent } from "@/modules/calendar/agenda";

export const metadata: Metadata = { title: "Agenda" };

/**
 * Agenda des rendez-vous d'estimation. Source de vérité : `estimation_appointments`
 * (jamais l'agenda Google directement). La RLS restreint la visibilité (opérateur
 * = tout ; agent = ses rendez-vous / dossiers affectés). Deux affichages internes :
 * Agenda visuel (semaine/mois/jour) et Liste chronologique.
 */
export default async function AppointmentsPage() {
  const session = await requireCrmSession("/crm/rendez-vous");
  const canView = canViewContactDetails(session.roles);
  const canManage = canManageAppointments(session.roles);
  const rows = await listAppointments();

  const events: AgendaEvent[] = rows.map((r) => ({
    id: r.appointment.id,
    opportunityId: r.appointment.opportunity_id,
    agentUserId: r.appointment.agent_user_id,
    agentName: r.agentName,
    contactLabel: r.contactLabel,
    city: r.city,
    address: r.appointment.address,
    ownerPhone: r.ownerPhone,
    ownerEmail: r.ownerEmail,
    startsAt: r.appointment.starts_at,
    endsAt: r.appointment.ends_at,
    timezone: r.appointment.timezone,
    status: r.appointment.status,
    googleHtmlLink: r.appointment.google_html_link,
    kind: "estimation",
  }));

  const board: BoardAppointment[] = rows.map((r) => ({
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
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header>
        <p className="crm-eyebrow">Estimations</p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--crm-text)]">Agenda</h1>
        <p className="mt-1 text-sm text-[var(--crm-text-dim)]">
          Rendez-vous d’estimation planifiés depuis Prodigio OS (source de vérité interne),
          synchronisés avec les agendas Google des agents.
        </p>
      </header>

      <RendezVousView
        events={events}
        board={board}
        nowIso={nowIso}
        canViewContacts={canView}
        canManage={canManage}
      />
    </div>
  );
}
