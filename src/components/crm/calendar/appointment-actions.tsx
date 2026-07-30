"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelAppointmentAction,
  rescheduleAppointmentAction,
  setAppointmentResultAction,
} from "@/modules/calendar/actions";
import { appointmentResultOptions } from "@/modules/calendar/labels";
import type { EstimationAppointmentStatus } from "@/lib/supabase/types";

/**
 * Actions sur un rendez-vous d'estimation depuis la fiche : ouvrir dans Google,
 * reporter, annuler, marquer un résultat. Les droits réels sont appliqués en
 * base ; les boutons ne s'affichent que selon le rôle (défense en profondeur).
 */
export function AppointmentActions({
  appointmentId,
  opportunityId,
  status,
  googleHtmlLink,
  startsAt,
  endsAt,
  canManage,
  canResult,
}: {
  appointmentId: string;
  opportunityId: string;
  status: EstimationAppointmentStatus;
  googleHtmlLink: string | null;
  startsAt: string;
  endsAt: string;
  canManage: boolean;
  canResult: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"idle" | "reschedule">("idle");

  const durationMs = Math.max(0, new Date(endsAt).getTime() - new Date(startsAt).getTime());
  // Valeur initiale du champ datetime-local (heure locale du navigateur).
  const initialLocal = toLocalInput(startsAt);
  const [newStart, setNewStart] = useState(initialLocal);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res.ok) {
        setMode("idle");
        router.refresh();
      } else {
        setError(res.error ?? "Action impossible.");
      }
    });
  };

  const submitReschedule = () => {
    const startDate = new Date(newStart);
    if (Number.isNaN(startDate.getTime())) {
      setError("Date invalide.");
      return;
    }
    const endDate = new Date(startDate.getTime() + durationMs);
    run(() =>
      rescheduleAppointmentAction({
        appointmentId,
        startsAt: startDate.toISOString(),
        endsAt: endDate.toISOString(),
        opportunityId,
      }),
    );
  };

  const submitCancel = () => {
    const reason = window.prompt("Motif de l’annulation (facultatif) :") ?? undefined;
    run(() => cancelAppointmentAction({ appointmentId, reason, opportunityId }));
  };

  const active = status !== "annule";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {googleHtmlLink ? (
          <a
            href={googleHtmlLink}
            target="_blank"
            rel="noopener noreferrer"
            className="crm-btn crm-btn--ghost crm-btn--sm"
          >
            Ouvrir dans Google Calendar ↗
          </a>
        ) : null}
        {canManage && active ? (
          <>
            <button
              type="button"
              className="crm-btn crm-btn--ghost crm-btn--sm"
              onClick={() => setMode(mode === "reschedule" ? "idle" : "reschedule")}
              disabled={pending}
            >
              Reporter
            </button>
            <button
              type="button"
              className="crm-btn crm-btn--ghost crm-btn--sm"
              onClick={submitCancel}
              disabled={pending}
            >
              Annuler
            </button>
          </>
        ) : null}
      </div>

      {mode === "reschedule" && canManage ? (
        <div className="flex flex-wrap items-end gap-2 rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] p-3">
          <label className="flex flex-col gap-1">
            <span className="crm-label">Nouveau créneau</span>
            <input
              type="datetime-local"
              className="crm-input"
              value={newStart}
              onChange={(e) => setNewStart(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="crm-btn crm-btn--gold crm-btn--sm"
            onClick={submitReschedule}
            disabled={pending}
          >
            {pending ? "…" : "Confirmer le report"}
          </button>
        </div>
      ) : null}

      {canResult && active ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="crm-label">Résultat :</span>
          {appointmentResultOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`crm-btn crm-btn--sm ${status === opt.value ? "crm-btn--gold" : "crm-btn--ghost"}`}
              onClick={() =>
                run(() =>
                  setAppointmentResultAction({
                    appointmentId,
                    status: opt.value,
                    opportunityId,
                  }),
                )
              }
              disabled={pending || status === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-xs text-[var(--color-danger-on-dark)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Convertit un ISO en valeur `datetime-local` (heure locale du navigateur). */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
