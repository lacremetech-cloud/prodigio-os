"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/crm/modal";
import {
  bookEstimationAction,
  getAvailabilityAction,
} from "@/modules/calendar/actions";
import type { FreeSlot } from "@/modules/calendar/availability";
import { formatSlotTime } from "@/modules/calendar/format";
import type { BookableAgentRow } from "@/lib/supabase/types";

export interface SchedulerAgent {
  userId: string;
  label: string;
}

/** Clé d'idempotence côté client (crypto uniquement, jamais Math.random). */
function makeIdempotencyKey(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  const bytes = new Uint8Array(16);
  c?.getRandomValues?.(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Parcours de planification d'une estimation depuis la fiche mandat : choix de
 * l'agent → date → créneaux réels (Google FreeBusy) → adresse → confirmation.
 * Aucune confirmation n'est affichée si Prodigio ET Google n'ont pas réellement
 * enregistré le rendez-vous. Double-clic neutralisé (bouton désactivé + clé
 * d'idempotence stable côté serveur).
 */
export function EstimationScheduler({
  opportunityId,
  city,
  defaultAddress,
  defaultOwnerEmail,
  defaultOwnerName,
  ownerContactId,
  agents,
  timezone = "Europe/Paris",
  durationMinutes = 90,
}: {
  opportunityId: string;
  city: string | null;
  defaultAddress: string | null;
  defaultOwnerEmail: string | null;
  defaultOwnerName: string | null;
  ownerContactId: string | null;
  agents: BookableAgentRow[];
  timezone?: string;
  durationMinutes?: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const agentOptions: SchedulerAgent[] = useMemo(
    () =>
      agents.map((a) => ({
        userId: a.user_id,
        label: `${a.email ?? a.user_id.slice(0, 8)}${a.calendar_summary ? ` · ${a.calendar_summary}` : ""}`,
      })),
    [agents],
  );

  const [agentId, setAgentId] = useState(agentOptions[0]?.userId ?? "");
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [date, setDate] = useState(todayIso);
  const [slots, setSlots] = useState<FreeSlot[] | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<FreeSlot | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [address, setAddress] = useState(defaultAddress ?? "");
  const [ownerEmail, setOwnerEmail] = useState(defaultOwnerEmail ?? "");
  const [ownerName, setOwnerName] = useState(defaultOwnerName ?? "");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const reset = () => {
    setSlots(null);
    setSelectedSlot(null);
    setError(null);
    setInfo(null);
  };

  const loadSlots = () => {
    reset();
    start(async () => {
      const res = await getAvailabilityAction({ agentUserId: agentId, date, durationMinutes });
      if (res.ok) {
        setSlots(res.slots ?? []);
        if ((res.slots ?? []).length === 0) {
          setInfo("Aucun créneau disponible ce jour-là. Essayez une autre date.");
        }
      } else {
        setError(res.error ?? "Impossible de charger les disponibilités.");
      }
    });
  };

  const pickSlot = (slot: FreeSlot) => {
    setSelectedSlot(slot);
    setError(null);
    setInfo(null);
    // Clé d'idempotence stable pour cette tentative de réservation.
    setIdempotencyKey(makeIdempotencyKey());
  };

  const confirmBooking = () => {
    if (!selectedSlot) return;
    setError(null);
    setInfo(null);
    start(async () => {
      const res = await bookEstimationAction({
        idempotencyKey,
        opportunityId,
        agentUserId: agentId,
        startsAt: selectedSlot.start,
        endsAt: selectedSlot.end,
        timezone,
        address: address.trim() || null,
        city,
        ownerContactId,
        ownerEmail: ownerEmail.trim() || null,
        ownerName: ownerName.trim() || null,
        notes: notes.trim() || null,
      });
      if (res.ok) {
        if (res.processing) {
          setInfo("Réservation en cours d'enregistrement…");
        } else {
          setInfo(res.alreadyBooked ? "Ce rendez-vous était déjà planifié." : "Rendez-vous planifié et invitation envoyée.");
        }
        setOpen(false);
        router.refresh();
      } else if (res.code === "slot_taken") {
        setError(res.error ?? "Ce créneau vient d'être pris.");
        setSelectedSlot(null);
        loadSlots();
      } else {
        setError(res.error ?? "La réservation a échoué.");
      }
    });
  };

  const noAgents = agentOptions.length === 0;

  return (
    <>
      <button type="button" className="crm-btn crm-btn--gold" onClick={() => setOpen(true)}>
        Planifier l’estimation
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Planifier une estimation"
        description="Choisissez un agent, une date et un créneau réellement disponible."
      >
        {noAgents ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-[var(--crm-text-dim)]">
              Aucun agent n’a connecté son calendrier Google. Un agent, un manager ou un
              administrateur doit d’abord connecter son agenda depuis
              <span className="whitespace-nowrap"> « Paramètres → Google Calendar »</span>.
            </p>
            <a href="/crm/parametres/calendrier" className="crm-btn crm-btn--sm self-start">
              Ouvrir les paramètres calendrier
            </a>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="crm-label">Agent immobilier</span>
                <select
                  className="crm-select h-9"
                  value={agentId}
                  onChange={(e) => {
                    setAgentId(e.target.value);
                    reset();
                  }}
                >
                  {agentOptions.map((a) => (
                    <option key={a.userId} value={a.userId}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="crm-label">Date</span>
                <input
                  type="date"
                  className="crm-input h-9"
                  value={date}
                  min={todayIso}
                  onChange={(e) => {
                    setDate(e.target.value);
                    reset();
                  }}
                />
              </label>
            </div>

            <button
              type="button"
              className="crm-btn crm-btn--sm self-start"
              onClick={loadSlots}
              disabled={pending || !agentId}
            >
              {pending && !selectedSlot ? "Recherche…" : "Voir les disponibilités"}
            </button>

            {slots && slots.length > 0 ? (
              <div className="flex flex-col gap-2">
                <span className="crm-label">Créneaux disponibles</span>
                <div className="flex flex-wrap gap-2">
                  {slots.map((s) => {
                    const active = selectedSlot?.start === s.start;
                    return (
                      <button
                        key={s.start}
                        type="button"
                        onClick={() => pickSlot(s)}
                        aria-pressed={active}
                        className={`crm-btn crm-btn--sm ${active ? "crm-btn--gold" : "crm-btn--ghost"}`}
                      >
                        {formatSlotTime(s.start, timezone)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {selectedSlot ? (
              <div className="flex flex-col gap-3 border-t border-[var(--crm-line-soft)] pt-4">
                <label className="flex flex-col gap-1">
                  <span className="crm-label">Adresse du bien</span>
                  <input
                    className="crm-input h-9"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Numéro, rue, code postal, ville"
                  />
                </label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="crm-label">E-mail du propriétaire (invitation)</span>
                    <input
                      type="email"
                      className="crm-input h-9"
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                      placeholder="proprietaire@exemple.fr"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="crm-label">Nom du propriétaire</span>
                    <input
                      className="crm-input h-9"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                    />
                  </label>
                </div>
                <label className="flex flex-col gap-1">
                  <span className="crm-label">Notes internes (facultatif)</span>
                  <textarea
                    className="crm-textarea"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Précisions pour l’agent (accès, étage, contexte…)"
                  />
                </label>
                <p className="text-[11px] text-[var(--crm-text-faint)]">
                  Le propriétaire recevra une invitation Google Calendar. Aucune donnée interne ni
                  accès au CRM ne lui est transmis.
                </p>
              </div>
            ) : null}

            {info ? <p className="text-xs crm-aging--frais">{info}</p> : null}
            {error ? (
              <p role="alert" className="text-xs text-[var(--color-danger-on-dark)]">
                {error}
              </p>
            ) : null}

            <div className="flex items-center justify-end gap-2 border-t border-[var(--crm-line-soft)] pt-4">
              <button type="button" className="crm-btn crm-btn--ghost crm-btn--sm" onClick={() => setOpen(false)}>
                Annuler
              </button>
              <button
                type="button"
                className="crm-btn crm-btn--gold crm-btn--sm"
                onClick={confirmBooking}
                disabled={pending || !selectedSlot}
              >
                {pending && selectedSlot ? "Réservation…" : "Confirmer la réservation"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
