"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  disconnectCalendarAction,
  listMyCalendarsAction,
  selectCalendarAction,
} from "@/modules/calendar/actions";
import type { GoogleCalendarEntry } from "@/modules/calendar/google/client";

/**
 * Gestion cliente de la connexion Google Calendar : sélection du calendrier
 * d'estimation, rafraîchissement de la liste, déconnexion. Aucun jeton n'est
 * jamais manipulé ici : uniquement des libellés et identifiants de calendrier.
 */
export function CalendarConnectionManager({
  connected,
  selectedCalendarId,
  selectedCalendarSummary,
}: {
  connected: boolean;
  selectedCalendarId: string | null;
  selectedCalendarSummary: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [calendars, setCalendars] = useState<GoogleCalendarEntry[] | null>(null);
  const [loadingList, setLoadingList] = useState(connected);

  const applyResult = useCallback(
    (res: Awaited<ReturnType<typeof listMyCalendarsAction>>) => {
      if (res.ok && res.calendars) setCalendars(res.calendars);
      else setError(res.error ?? "Impossible de charger les calendriers.");
    },
    [],
  );

  const loadCalendars = useCallback(() => {
    setLoadingList(true);
    setError(null);
    listMyCalendarsAction()
      .then(applyResult)
      .finally(() => setLoadingList(false));
  }, [applyResult]);

  // Charge la liste des calendriers à l'ouverture si connecté. L'effet ne modifie
  // pas l'état de façon synchrone : seules les callbacks asynchrones le font.
  useEffect(() => {
    if (!connected) return;
    let active = true;
    listMyCalendarsAction()
      .then((res) => {
        if (active) applyResult(res);
      })
      .finally(() => {
        if (active) setLoadingList(false);
      });
    return () => {
      active = false;
    };
  }, [connected, applyResult]);

  const onSelect = (calendarId: string) => {
    const summary = calendars?.find((c) => c.id === calendarId)?.summary ?? "";
    setError(null);
    setNotice(null);
    start(async () => {
      const res = await selectCalendarAction({ calendarId, summary });
      if (res.ok) {
        setNotice("Calendrier d'estimation mis à jour.");
        router.refresh();
      } else {
        setError(res.error ?? "Échec de la sélection.");
      }
    });
  };

  const onDisconnect = () => {
    if (!confirm("Déconnecter Google Calendar ? Vous pourrez le reconnecter à tout moment.")) {
      return;
    }
    setError(null);
    setNotice(null);
    start(async () => {
      const res = await disconnectCalendarAction();
      if (res.ok) {
        router.refresh();
      } else {
        setError(res.error ?? "Échec de la déconnexion.");
      }
    });
  };

  if (!connected) {
    return (
      <div className="flex flex-col gap-3">
        <a href="/api/calendar/google/connect" className="crm-btn crm-btn--gold self-start">
          Connecter Google Calendar
        </a>
        <p className="text-xs text-[var(--crm-text-faint)]">
          Vous serez redirigé vers Google pour autoriser l&apos;accès à vos disponibilités et la
          création d&apos;événements. Vos jetons restent chiffrés côté serveur.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="crm-label">Calendrier utilisé pour les estimations</span>
        {loadingList ? (
          <p className="text-sm text-[var(--crm-text-faint)]">Chargement des calendriers…</p>
        ) : calendars && calendars.length > 0 ? (
          <select
            className="crm-select max-w-md"
            value={selectedCalendarId ?? ""}
            disabled={pending}
            onChange={(e) => onSelect(e.target.value)}
            aria-label="Choisir le calendrier d'estimation"
          >
            {calendars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.summary}
                {c.primary ? " (principal)" : ""}
              </option>
            ))}
          </select>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <p className="crm-wrap min-w-0 flex-1 text-sm text-[var(--crm-text-dim)]">
              {selectedCalendarSummary ?? selectedCalendarId ?? "Calendrier principal"}
            </p>
            <button type="button" className="crm-btn crm-btn--ghost crm-btn--sm shrink-0" onClick={loadCalendars}>
              Recharger la liste
            </button>
          </div>
        )}
      </div>

      {notice ? <p className="text-xs crm-aging--frais">{notice}</p> : null}
      {error ? (
        <p role="alert" className="text-xs text-[var(--color-danger-on-dark)]">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <a href="/api/calendar/google/connect" className="crm-btn crm-btn--ghost crm-btn--sm">
          Reconnecter
        </a>
        <button
          type="button"
          className="crm-btn crm-btn--ghost crm-btn--sm"
          onClick={onDisconnect}
          disabled={pending}
        >
          Déconnecter
        </button>
      </div>
    </div>
  );
}
