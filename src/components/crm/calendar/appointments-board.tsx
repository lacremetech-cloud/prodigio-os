"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Chip } from "@/components/crm/ui";
import {
  appointmentStatusLabels,
  appointmentStatusTone,
} from "@/modules/calendar/labels";
import { formatAppointmentRange, zonedDayKey } from "@/modules/calendar/format";
import type { EstimationAppointmentStatus } from "@/lib/supabase/types";

export interface BoardAppointment {
  id: string;
  opportunityId: string;
  agentUserId: string;
  agentName: string;
  city: string | null;
  contactLabel: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  address: string | null;
  status: EstimationAppointmentStatus;
  googleHtmlLink: string | null;
}

const TZ = "Europe/Paris";

/**
 * Vue liste des rendez-vous d'estimation, filtrable par agent et statut. Sections
 * : aujourd'hui, à venir, à replanifier, réalisés, annulés/absents. Responsive et
 * cohérente avec le design CRM.
 */
export function AppointmentsBoard({
  appointments,
  nowIso,
}: {
  appointments: BoardAppointment[];
  nowIso: string;
}) {
  const [agent, setAgent] = useState("");
  const [status, setStatus] = useState("");

  const agents = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of appointments) map.set(a.agentUserId, a.agentName);
    return Array.from(map.entries()).map(([userId, name]) => ({ userId, name }));
  }, [appointments]);

  const filtered = useMemo(
    () =>
      appointments.filter(
        (a) => (!agent || a.agentUserId === agent) && (!status || a.status === status),
      ),
    [appointments, agent, status],
  );

  const todayKey = zonedDayKey(nowIso, TZ);
  const nowMs = new Date(nowIso).getTime();

  const buckets = useMemo(() => {
    const today: BoardAppointment[] = [];
    const upcoming: BoardAppointment[] = [];
    const toReplan: BoardAppointment[] = [];
    const done: BoardAppointment[] = [];
    const cancelled: BoardAppointment[] = [];
    for (const a of filtered) {
      if (a.status === "a_replanifier") toReplan.push(a);
      else if (a.status === "realise") done.push(a);
      else if (a.status === "annule" || a.status === "absent") cancelled.push(a);
      else if (zonedDayKey(a.startsAt, TZ) === todayKey) today.push(a);
      else if (new Date(a.startsAt).getTime() >= nowMs) upcoming.push(a);
      else done.push(a); // passés sans résultat saisi → considérés « à traiter »
    }
    return { today, upcoming, toReplan, done, cancelled };
  }, [filtered, todayKey, nowMs]);

  const sections: { title: string; items: BoardAppointment[] }[] = status
    ? [{ title: appointmentStatusLabels[status as EstimationAppointmentStatus] ?? "Résultats", items: filtered }]
    : [
        { title: "Aujourd’hui", items: buckets.today },
        { title: "À venir", items: buckets.upcoming },
        { title: "À replanifier", items: buckets.toReplan },
        { title: "Réalisés / passés", items: buckets.done },
        { title: "Annulés / absents", items: buckets.cancelled },
      ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="crm-select max-w-[240px]"
          value={agent}
          onChange={(e) => setAgent(e.target.value)}
          aria-label="Filtrer par agent"
        >
          <option value="">Tous les agents</option>
          {agents.map((a) => (
            <option key={a.userId} value={a.userId}>
              {a.name}
            </option>
          ))}
        </select>
        <select
          className="crm-select max-w-[220px]"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filtrer par statut"
        >
          <option value="">Tous les statuts</option>
          {(Object.keys(appointmentStatusLabels) as EstimationAppointmentStatus[]).map((s) => (
            <option key={s} value={s}>
              {appointmentStatusLabels[s]}
            </option>
          ))}
        </select>
        {(agent || status) && (
          <button
            type="button"
            className="crm-btn crm-btn--ghost crm-btn--sm"
            onClick={() => {
              setAgent("");
              setStatus("");
            }}
          >
            Réinitialiser
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-[14px] border border-dashed border-[var(--crm-line)] px-6 py-12 text-center text-sm text-[var(--crm-text-faint)]">
          Aucun rendez-vous ne correspond à ces filtres.
        </p>
      ) : (
        sections
          .filter((s) => s.items.length > 0)
          .map((section) => (
            <section key={section.title} className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--crm-text-dim)]">
                {section.title}{" "}
                <span className="text-[var(--crm-text-faint)]">({section.items.length})</span>
              </h2>
              <ul className="flex flex-col gap-2">
                {section.items.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/crm/mandats/${a.opportunityId}`}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel)] px-4 py-3 transition-colors hover:border-[var(--crm-line)] hover:bg-[var(--crm-panel-2)]"
                    >
                      <div className="min-w-0">
                        <p
                          className="crm-ellipsis text-sm font-medium text-[var(--crm-text)]"
                          title={a.city ? `${a.contactLabel} · ${a.city}` : a.contactLabel}
                        >
                          {a.contactLabel}
                          {a.city ? <span className="text-[var(--crm-text-faint)]"> · {a.city}</span> : null}
                        </p>
                        <p className="crm-ellipsis text-xs text-[var(--crm-text-faint)]" title={a.agentName}>
                          {formatAppointmentRange(a.startsAt, a.endsAt, a.timezone)} · {a.agentName}
                        </p>
                      </div>
                      <Chip variant={appointmentStatusTone[a.status]}>
                        {appointmentStatusLabels[a.status]}
                      </Chip>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
      )}
    </div>
  );
}
