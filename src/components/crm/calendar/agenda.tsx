"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/crm/ui";
import { appointmentVisual, cssVarRef } from "@/modules/crm/status-visuals";
import { appointmentStatusLabels } from "@/modules/calendar/labels";
import {
  cancelAppointmentAction,
  rescheduleAppointmentAction,
} from "@/modules/calendar/actions";
import {
  formatSlotTime,
  formatDayKeyLong,
  formatDayKeyShort,
  formatDayKeyNum,
  formatMonthYear,
  WEEKDAY_SHORT_LABELS,
} from "@/modules/calendar/format";
import {
  AGENDA_TZ,
  addDaysToKey,
  applyAgendaFilters,
  durationMinutes,
  EMPTY_AGENDA_FILTERS,
  groupByDay,
  isSameMonth,
  monthGridKeys,
  sortByStart,
  todayKey,
  weekKeys,
  type AgendaEvent,
  type AgendaFilters,
  type AgendaView,
} from "@/modules/calendar/agenda";
import { safeAction } from "@/modules/crm/safe-action";

/** Légende discrète des statuts (couleur + icône + libellé). */
function AgendaLegend() {
  const statuses = ["planifie", "confirme", "realise", "a_replanifier", "annule", "absent"];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--crm-text-faint)]">
      {statuses.map((s) => {
        const v = appointmentVisual(s);
        return (
          <span key={s} className="inline-flex items-center gap-1">
            <span aria-hidden style={{ color: cssVarRef(v.cssVar) }}>{v.icon}</span>
            {appointmentStatusLabels[s as keyof typeof appointmentStatusLabels] ?? s}
          </span>
        );
      })}
    </div>
  );
}

export interface AgentOption {
  userId: string;
  name: string;
}

export function Agenda({
  events,
  nowIso,
  canViewContacts,
  canManage,
}: {
  events: AgendaEvent[];
  nowIso: string;
  canViewContacts: boolean;
  canManage: boolean;
}) {
  const [view, setView] = useState<AgendaView>("semaine");
  const [anchor, setAnchor] = useState(() => todayKey(nowIso));
  const [filters, setFilters] = useState<AgendaFilters>(EMPTY_AGENDA_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Sur mobile, la vue « semaine » s'empile verticalement (CSS responsive) et
  // reste lisible ; les vues « Jour » et « Liste » restent accessibles d'un tap.

  const nowMs = new Date(nowIso).getTime();
  const today = todayKey(nowIso);

  const agents = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of events) map.set(e.agentUserId, e.agentName);
    return Array.from(map.entries()).map(([userId, name]) => ({ userId, name }));
  }, [events]);

  const filtered = useMemo(
    () => applyAgendaFilters(events, filters, nowMs),
    [events, filters, nowMs],
  );
  const byDay = useMemo(() => groupByDay(filtered, AGENDA_TZ), [filtered]);

  const selected = useMemo(
    () => events.find((e) => e.id === selectedId) ?? null,
    [events, selectedId],
  );

  const navigate = (dir: -1 | 0 | 1) => {
    if (dir === 0) return setAnchor(today);
    if (view === "jour") setAnchor((k) => addDaysToKey(k, dir));
    else if (view === "semaine") setAnchor((k) => addDaysToKey(k, dir * 7));
    else if (view === "mois") setAnchor((k) => shiftMonth(k, dir));
  };

  const rangeLabel =
    view === "mois"
      ? capitalize(formatMonthYear(anchor))
      : view === "semaine"
        ? weekRangeLabel(anchor)
        : view === "jour"
          ? capitalize(formatDayKeyLong(anchor))
          : "Tous les rendez-vous";

  const filtersActive =
    filters.agentUserId || filters.status || filters.temporal !== "tous" || filters.search;

  return (
    <div className="flex flex-col gap-4">
      {/* Barre d'outils */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="crm-tabs" role="tablist" aria-label="Vue de l’agenda">
            {(["semaine", "mois", "jour", "liste"] as AgendaView[]).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                className={`crm-tab ${view === v ? "crm-tab--active" : ""}`}
                onClick={() => setView(v)}
              >
                {capitalize(v)}
              </button>
            ))}
          </div>
          {view !== "liste" ? (
            <div className="flex items-center gap-2">
              <button type="button" className="crm-btn crm-btn--ghost crm-btn--sm" onClick={() => navigate(-1)} aria-label="Période précédente">‹</button>
              <button type="button" className="crm-btn crm-btn--ghost crm-btn--sm" onClick={() => navigate(0)}>Aujourd’hui</button>
              <button type="button" className="crm-btn crm-btn--ghost crm-btn--sm" onClick={() => navigate(1)} aria-label="Période suivante">›</button>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="crm-wrap text-base font-semibold text-[var(--crm-text)]">{rangeLabel}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="crm-input max-w-[220px] text-sm"
              placeholder="Rechercher (propriétaire, ville…)"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              aria-label="Rechercher un rendez-vous"
            />
            <select
              className="crm-select max-w-[190px] text-sm"
              value={filters.agentUserId}
              onChange={(e) => setFilters((f) => ({ ...f, agentUserId: e.target.value }))}
              aria-label="Filtrer par agent"
            >
              <option value="">Tous les agents</option>
              {agents.map((a) => (
                <option key={a.userId} value={a.userId}>{a.name}</option>
              ))}
            </select>
            <select
              className="crm-select max-w-[170px] text-sm"
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              aria-label="Filtrer par statut"
            >
              <option value="">Tous les statuts</option>
              {Object.entries(appointmentStatusLabels).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <select
              className="crm-select max-w-[150px] text-sm"
              value={filters.temporal}
              onChange={(e) => setFilters((f) => ({ ...f, temporal: e.target.value as AgendaFilters["temporal"] }))}
              aria-label="Filtrer par période"
            >
              <option value="tous">Tous</option>
              <option value="a_venir">À venir</option>
              <option value="passes">Passés</option>
            </select>
            {filtersActive ? (
              <button type="button" className="crm-btn crm-btn--ghost crm-btn--sm" onClick={() => setFilters(EMPTY_AGENDA_FILTERS)}>
                Réinitialiser
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <AgendaLegend />

      {/* Contenu */}
      {filtered.length === 0 ? (
        <p className="rounded-[14px] border border-dashed border-[var(--crm-line)] px-6 py-16 text-center text-sm text-[var(--crm-text-faint)]">
          {events.length === 0
            ? "Aucun rendez-vous d’estimation planifié pour le moment."
            : "Aucun rendez-vous ne correspond à ces filtres."}
        </p>
      ) : view === "semaine" ? (
        <WeekView keys={weekKeys(anchor)} byDay={byDay} today={today} onSelect={setSelectedId} />
      ) : view === "mois" ? (
        <MonthView anchor={anchor} byDay={byDay} today={today} onSelectDay={(k) => { setAnchor(k); setView("jour"); }} onSelect={setSelectedId} />
      ) : view === "jour" ? (
        <DayView dayKey={anchor} events={byDay.get(anchor) ?? []} today={today} onSelect={setSelectedId} />
      ) : (
        <ListView byDay={byDay} today={today} onSelect={setSelectedId} />
      )}

      {selected ? (
        <EventDrawer
          event={selected}
          canViewContacts={canViewContacts}
          canManage={canManage}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </div>
  );
}

// --- Vues --------------------------------------------------------------------

function WeekView({
  keys,
  byDay,
  today,
  onSelect,
}: {
  keys: string[];
  byDay: Map<string, AgendaEvent[]>;
  today: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="crm-agenda-week crm-scroll">
      {keys.map((k, i) => {
        const items = byDay.get(k) ?? [];
        return (
          <div key={k} className="crm-agenda-daycol">
            <div className={`crm-agenda-dayhead ${k === today ? "crm-agenda-dayhead--today" : ""}`}>
              <span className="text-[11px] uppercase tracking-[0.06em] text-[var(--crm-text-faint)]">
                {WEEKDAY_SHORT_LABELS[i]}
              </span>
              <span className="text-sm font-semibold text-[var(--crm-text)]">{formatDayKeyNum(k)}</span>
              {items.length > 0 ? <span className="crm-chip tabular-nums">{items.length}</span> : null}
            </div>
            <div className="flex min-h-[80px] flex-col gap-1.5">
              {items.length === 0 ? (
                <p className="px-1 py-4 text-center text-[11px] text-[var(--crm-text-faint)]">—</p>
              ) : (
                items.map((e) => <EventChip key={e.id} event={e} onSelect={onSelect} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MonthView({
  anchor,
  byDay,
  today,
  onSelectDay,
  onSelect,
}: {
  anchor: string;
  byDay: Map<string, AgendaEvent[]>;
  today: string;
  onSelectDay: (key: string) => void;
  onSelect: (id: string) => void;
}) {
  const keys = monthGridKeys(anchor);
  return (
    <div className="crm-scroll">
      <div className="crm-agenda-month min-w-[560px]">
        {WEEKDAY_SHORT_LABELS.map((w) => (
          <div key={w} className="px-2 py-1 text-center text-[11px] uppercase tracking-[0.06em] text-[var(--crm-text-faint)]">
            {w}
          </div>
        ))}
        {keys.map((k) => {
          const items = byDay.get(k) ?? [];
          const inMonth = isSameMonth(k, anchor);
          return (
            <div
              key={k}
              className={`crm-agenda-cell ${inMonth ? "" : "crm-agenda-cell--out"} ${k === today ? "crm-agenda-cell--today" : ""}`}
            >
              <button
                type="button"
                className="mb-1 flex w-full items-center justify-between"
                onClick={() => onSelectDay(k)}
              >
                <span className="text-xs font-semibold text-[var(--crm-text)]">{formatDayKeyNum(k)}</span>
                {items.length > 0 ? <span className="crm-chip crm-chip--dot tabular-nums">{items.length}</span> : null}
              </button>
              <div className="flex flex-col gap-1">
                {items.slice(0, 3).map((e) => (
                  <EventChip key={e.id} event={e} onSelect={onSelect} compact />
                ))}
                {items.length > 3 ? (
                  <button type="button" className="text-left text-[11px] text-[var(--crm-gold)]" onClick={() => onSelectDay(k)}>
                    +{items.length - 3} autre(s)
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayView({
  dayKey,
  events,
  today,
  onSelect,
}: {
  dayKey: string;
  events: AgendaEvent[];
  today: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {events.length === 0 ? (
        <p className="rounded-[12px] border border-dashed border-[var(--crm-line)] px-4 py-10 text-center text-sm text-[var(--crm-text-faint)]">
          Aucun rendez-vous {dayKey === today ? "aujourd’hui" : "ce jour-là"}.
        </p>
      ) : (
        events.map((e) => <EventBlock key={e.id} event={e} onSelect={onSelect} />)
      )}
    </div>
  );
}

function ListView({
  byDay,
  today,
  onSelect,
}: {
  byDay: Map<string, AgendaEvent[]>;
  today: string;
  onSelect: (id: string) => void;
}) {
  const days = Array.from(byDay.keys()).sort();
  return (
    <div className="flex flex-col gap-5">
      {days.map((k) => (
        <section key={k} className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-[var(--crm-text)]">
            {capitalize(formatDayKeyLong(k))}
            {k === today ? <span className="ml-2 text-xs text-[var(--crm-gold)]">Aujourd’hui</span> : null}
          </h3>
          {sortByStart(byDay.get(k) ?? []).map((e) => (
            <EventBlock key={e.id} event={e} onSelect={onSelect} />
          ))}
        </section>
      ))}
    </div>
  );
}

// --- Éléments ----------------------------------------------------------------

function EventChip({
  event,
  onSelect,
  compact,
}: {
  event: AgendaEvent;
  onSelect: (id: string) => void;
  compact?: boolean;
}) {
  const v = appointmentVisual(event.status);
  return (
    <button
      type="button"
      onClick={() => onSelect(event.id)}
      className="crm-agenda-chip"
      style={{ ["--chip-accent" as keyof CSSProperties]: cssVarRef(v.cssVar) } as CSSProperties}
      title={`${formatSlotTime(event.startsAt, event.timezone)} · ${event.contactLabel}${event.city ? ` · ${event.city}` : ""} · ${appointmentStatusLabels[event.status as keyof typeof appointmentStatusLabels] ?? event.status}`}
    >
      <span aria-hidden className="shrink-0">{v.icon}</span>
      <span className="tabular-nums shrink-0">{formatSlotTime(event.startsAt, event.timezone)}</span>
      <span className="crm-ellipsis">{event.contactLabel}</span>
      {!compact && event.city ? <span className="crm-ellipsis text-[var(--crm-text-faint)]">· {event.city}</span> : null}
    </button>
  );
}

function EventBlock({ event, onSelect }: { event: AgendaEvent; onSelect: (id: string) => void }) {
  const v = appointmentVisual(event.status);
  const mins = durationMinutes(event.startsAt, event.endsAt);
  return (
    <button
      type="button"
      onClick={() => onSelect(event.id)}
      className="flex w-full items-start justify-between gap-3 rounded-[12px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel)] px-4 py-3 text-left transition-colors hover:border-[var(--crm-line)] hover:bg-[var(--crm-panel-2)]"
      style={{ borderInlineStartWidth: "3px", borderInlineStartColor: cssVarRef(v.cssVar) }}
    >
      <div className="min-w-0">
        <p className="crm-wrap text-sm font-medium text-[var(--crm-text)]">
          {formatSlotTime(event.startsAt, event.timezone)} – {formatSlotTime(event.endsAt, event.timezone)}
          <span className="text-[var(--crm-text-faint)]"> · {mins} min</span>
        </p>
        <p className="crm-wrap text-sm text-[var(--crm-text)]">{event.contactLabel}</p>
        <p className="crm-wrap text-xs text-[var(--crm-text-faint)]">
          {[event.city, event.agentName, "Estimation"].filter(Boolean).join(" · ")}
        </p>
      </div>
      <StatusBadge
        cssVar={v.cssVar}
        icon={v.icon}
        label={appointmentStatusLabels[event.status as keyof typeof appointmentStatusLabels] ?? event.status}
      />
    </button>
  );
}

// --- Panneau latéral ---------------------------------------------------------

function EventDrawer({
  event,
  canViewContacts,
  canManage,
  onClose,
}: {
  event: AgendaEvent;
  canViewContacts: boolean;
  canManage: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "reschedule">("idle");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newStart, setNewStart] = useState(() => toLocalInput(event.startsAt));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const active = event.status !== "annule";
  const durationMs = Math.max(0, new Date(event.endsAt).getTime() - new Date(event.startsAt).getTime());

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    setPending(true);
    const res = await safeAction(fn);
    setPending(false);
    if (res.ok) {
      setMode("idle");
      router.refresh();
      onClose();
    } else {
      setError(res.error ?? "Action impossible.");
    }
  };

  return (
    <div className="crm-drawer-backdrop" role="dialog" aria-modal="true" aria-label="Détail du rendez-vous" onClick={onClose}>
      <div className="crm-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="crm-eyebrow">Rendez-vous d’estimation</p>
            <h3 className="mt-1 crm-wrap text-lg font-semibold text-[var(--crm-text)]">{event.contactLabel}</h3>
          </div>
          <button type="button" className="crm-btn crm-btn--ghost crm-btn--icon" onClick={onClose} aria-label="Fermer">✕</button>
        </div>

        <div className="flex flex-col gap-3">
          <Row label="Créneau" value={`${formatSlotTime(event.startsAt, event.timezone)} – ${formatSlotTime(event.endsAt, event.timezone)} (${durationMinutes(event.startsAt, event.endsAt)} min)`} />
          <Row
            label="Statut"
            value={
              <StatusBadge
                cssVar={appointmentVisual(event.status).cssVar}
                icon={appointmentVisual(event.status).icon}
                label={appointmentStatusLabels[event.status as keyof typeof appointmentStatusLabels] ?? event.status}
              />
            }
          />
          <Row label="Agent" value={event.agentName} />
          <Row label="Ville" value={event.city ?? "—"} />
          <Row label="Adresse" value={event.address ?? "—"} />
          <Row label="Téléphone" value={canViewContacts ? (event.ownerPhone ?? "—") : "•••• masqué"} copyable={canViewContacts ? event.ownerPhone : null} />
          <Row label="E-mail" value={canViewContacts ? (event.ownerEmail ?? "—") : "•••• masqué"} copyable={canViewContacts ? event.ownerEmail : null} />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[var(--crm-line-soft)] pt-4">
          <Link href={`/crm/mandats/${event.opportunityId}`} className="crm-btn crm-btn--gold crm-btn--sm">
            Ouvrir le dossier
          </Link>
          {event.googleHtmlLink ? (
            <a href={event.googleHtmlLink} target="_blank" rel="noopener noreferrer" className="crm-btn crm-btn--ghost crm-btn--sm">
              Voir dans Google ↗
            </a>
          ) : null}
          {canManage && active ? (
            <>
              <button type="button" className="crm-btn crm-btn--ghost crm-btn--sm" disabled={pending} onClick={() => setMode(mode === "reschedule" ? "idle" : "reschedule")}>
                Reporter
              </button>
              <button
                type="button"
                className="crm-btn crm-btn--ghost crm-btn--sm"
                disabled={pending}
                onClick={() => {
                  const reason = window.prompt("Motif de l’annulation (facultatif) :") ?? undefined;
                  void run(() => cancelAppointmentAction({ appointmentId: event.id, reason, opportunityId: event.opportunityId }));
                }}
              >
                Annuler
              </button>
            </>
          ) : null}
        </div>

        {mode === "reschedule" && canManage ? (
          <div className="mt-3 flex flex-wrap items-end gap-2 rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] p-3">
            <label className="flex flex-col gap-1">
              <span className="crm-label">Nouveau créneau</span>
              <input type="datetime-local" className="crm-input" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
            </label>
            <button
              type="button"
              className="crm-btn crm-btn--gold crm-btn--sm"
              disabled={pending}
              onClick={() => {
                const startDate = new Date(newStart);
                if (Number.isNaN(startDate.getTime())) { setError("Date invalide."); return; }
                const endDate = new Date(startDate.getTime() + durationMs);
                void run(() => rescheduleAppointmentAction({ appointmentId: event.id, startsAt: startDate.toISOString(), endsAt: endDate.toISOString(), opportunityId: event.opportunityId }));
              }}
            >
              {pending ? "…" : "Confirmer le report"}
            </button>
          </div>
        ) : null}

        {error ? <p role="alert" className="mt-3 text-xs text-[var(--color-danger-on-dark)]">{error}</p> : null}
      </div>
    </div>
  );
}

function Row({ label, value, copyable }: { label: string; value: React.ReactNode; copyable?: string | null }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="crm-label shrink-0 pt-0.5">{label}</span>
      <span className="crm-wrap min-w-0 text-right text-sm text-[var(--crm-text)]">
        {value}
        {copyable ? (
          <button
            type="button"
            className="ml-2 text-[11px] text-[var(--crm-gold)] underline"
            onClick={() => {
              void navigator.clipboard?.writeText(copyable).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              });
            }}
          >
            {copied ? "copié" : "copier"}
          </button>
        ) : null}
      </span>
    </div>
  );
}

// --- Helpers -----------------------------------------------------------------

function capitalize(s: string): string {
  return s.length > 0 ? s[0]!.toUpperCase() + s.slice(1) : s;
}
function shiftMonth(dayKey: string, dir: -1 | 1): string {
  const [y, m] = dayKey.split("-").map(Number);
  const base = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1 + dir, 1, 12));
  return `${String(base.getUTCFullYear()).padStart(4, "0")}-${String(base.getUTCMonth() + 1).padStart(2, "0")}-01`;
}
function weekRangeLabel(anchor: string): string {
  const keys = weekKeys(anchor);
  const first = keys[0]!;
  const last = keys[6]!;
  return `${capitalize(formatDayKeyShort(first))} – ${formatDayKeyShort(last)}`;
}
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
