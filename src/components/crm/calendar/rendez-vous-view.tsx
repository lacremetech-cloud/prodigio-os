"use client";

import { useState } from "react";
import { Agenda } from "./agenda";
import { AppointmentsBoard, type BoardAppointment } from "./appointments-board";
import type { AgendaEvent } from "@/modules/calendar/agenda";

/**
 * Bascule interne « Agenda / Liste » sur la route unique `/crm/rendez-vous`.
 * L'agenda visuel et la liste chronologique partagent la même source de vérité
 * (`estimation_appointments`) ; aucune seconde route concurrente n'est créée.
 */
export function RendezVousView({
  events,
  board,
  nowIso,
  canViewContacts,
  canManage,
}: {
  events: AgendaEvent[];
  board: BoardAppointment[];
  nowIso: string;
  canViewContacts: boolean;
  canManage: boolean;
}) {
  const [tab, setTab] = useState<"agenda" | "liste">("agenda");
  return (
    <div className="flex flex-col gap-5">
      <div className="crm-tabs" role="tablist" aria-label="Affichage des rendez-vous">
        <button type="button" role="tab" aria-selected={tab === "agenda"} className={`crm-tab ${tab === "agenda" ? "crm-tab--active" : ""}`} onClick={() => setTab("agenda")}>
          Agenda
        </button>
        <button type="button" role="tab" aria-selected={tab === "liste"} className={`crm-tab ${tab === "liste" ? "crm-tab--active" : ""}`} onClick={() => setTab("liste")}>
          Liste
        </button>
      </div>
      {tab === "agenda" ? (
        <Agenda events={events} nowIso={nowIso} canViewContacts={canViewContacts} canManage={canManage} />
      ) : (
        <AppointmentsBoard appointments={board} nowIso={nowIso} />
      )}
    </div>
  );
}
