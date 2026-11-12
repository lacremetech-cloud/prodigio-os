"use client";

import { useEffect, useState } from "react";
import { ecrireDansAdresse } from "@/modules/crm/etat-dans-adresse";
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
  ongletInitial = "agenda",
  agentInitial = "",
  statutInitial = "",
}: {
  events: AgendaEvent[];
  board: BoardAppointment[];
  nowIso: string;
  canViewContacts: boolean;
  canManage: boolean;
  /** L'onglet posé par l'adresse (`?onglet=liste`) : sans lui, revenir d'un
      dossier ouvert depuis la liste rouvrait l'agenda. */
  ongletInitial?: "agenda" | "liste";
  /** Les filtres de la liste, posés par l'adresse eux aussi. */
  agentInitial?: string;
  statutInitial?: string;
}) {
  const [tab, setTab] = useState<"agenda" | "liste">(ongletInitial);
  useEffect(() => {
    ecrireDansAdresse({ onglet: tab === "liste" ? "liste" : null });
  }, [tab]);
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
        <AppointmentsBoard
          appointments={board}
          nowIso={nowIso}
          agentInitial={agentInitial}
          statutInitial={statutInitial}
        />
      )}
    </div>
  );
}
