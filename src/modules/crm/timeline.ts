import type { ActivityRow, AuditEventRow, TaskRow } from "@/lib/supabase/types";
import {
  activityOutcomeLabels,
  activityTypeLabels,
  auditEventLabels,
  segmentLabels,
  stageLabels,
} from "./labels";

/**
 * Fusion **pure** et chronologique de l'historique d'un dossier :
 * activités métier + événements d'audit + tâches. Le tri (plus récent d'abord)
 * et le mapping des libellés sont testables sans dépendance serveur.
 *
 * Respecte la distinction : Activité métier ≠ AuditEvent (deux sources
 * distinctes, réunies uniquement pour l'affichage chronologique).
 */

export type TimelineSource = "activity" | "audit" | "task";

import type { TimelineKind } from "./status-visuals";

export interface TimelineEntry {
  key: string;
  at: string;
  source: TimelineSource;
  kind: TimelineKind;
  title: string;
  body: string | null;
  author: string | null;
  tone: "neutral" | "gold" | "danger" | "ok";
}

/** Type visuel d'une activité métier (icône/couleur de la timeline). */
function activityKind(type: string): TimelineKind {
  switch (type) {
    case "appel":
    case "tentative_appel":
      return "appel";
    case "email":
    case "sms_whatsapp":
      return "email";
    case "rendez_vous":
      return "rendez_vous";
    case "note":
      return "note";
    default:
      return "note";
  }
}

/** Type visuel d'un événement d'audit. */
function auditKind(eventType: string): TimelineKind {
  if (eventType === "changement_stade") return "stade";
  if (eventType === "changement_segment") return "segment";
  if (eventType === "changement_affectation") return "affectation";
  if (eventType === "resultat_commercial") return "resultat";
  if (eventType.startsWith("estimation")) return "estimation";
  if (eventType === "decision_eligibilite") return "eligibilite";
  if (eventType.startsWith("mandat")) return "mandat";
  if (eventType.startsWith("document")) return "document";
  return "audit";
}

function jsonField(value: unknown, key: string): string | null {
  if (value && typeof value === "object" && key in (value as Record<string, unknown>)) {
    const v = (value as Record<string, unknown>)[key];
    return v == null ? null : String(v);
  }
  return null;
}

export interface TimelineInput {
  activities: ActivityRow[];
  auditEvents: AuditEventRow[];
  tasks: TaskRow[];
  nameFor: (userId: string | null) => string | null;
}

export function buildTimeline(input: TimelineInput): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  for (const a of input.activities) {
    const typeLabel = activityTypeLabels[a.type] ?? a.type;
    const outcomeLabel = a.outcome ? activityOutcomeLabels[a.outcome] ?? a.outcome : null;
    entries.push({
      key: `activity-${a.id}`,
      at: a.occurred_at,
      source: "activity",
      kind: activityKind(a.type),
      title: outcomeLabel ? `${typeLabel} — ${outcomeLabel}` : typeLabel,
      body: a.body,
      author: input.nameFor(a.author_user_id),
      tone: a.outcome === "contact_etabli" ? "ok" : "neutral",
    });
  }

  for (const e of input.auditEvents) {
    const evLabel = auditEventLabels[e.event_type] ?? e.event_type;
    let body: string | null = null;
    if (e.event_type === "changement_stade") {
      const oldS = jsonField(e.old_value, "pipeline_stage");
      const newS = jsonField(e.new_value, "pipeline_stage");
      body = `${oldS ? stageLabels[oldS] ?? oldS : "—"} → ${newS ? stageLabels[newS] ?? newS : "—"}`;
    } else if (e.event_type === "changement_segment") {
      const oldS = jsonField(e.old_value, "segment");
      const newS = jsonField(e.new_value, "segment");
      body = `${oldS ? segmentLabels[oldS] ?? oldS : "—"} → ${newS ? segmentLabels[newS] ?? newS : "—"}`;
      const reason = jsonField(e.metadata, "reason");
      if (reason) body += ` · ${reason}`;
    } else if (e.event_type === "resultat_commercial") {
      body = jsonField(e.new_value, "outcome");
    } else if (e.event_type === "changement_affectation") {
      body = jsonField(e.new_value, "responsibility");
    }
    entries.push({
      key: `audit-${e.id}`,
      at: e.created_at,
      source: "audit",
      kind: auditKind(e.event_type),
      title: evLabel,
      body,
      author: input.nameFor(e.actor_user_id),
      tone: e.event_type === "resultat_commercial" ? "gold" : "neutral",
    });
  }

  for (const t of input.tasks) {
    const kindLabel = t.kind === "rappel" ? "Rappel" : "Tâche";
    const statusLabel =
      t.status === "fait" ? "terminée" : t.status === "annule" ? "annulée" : "à faire";
    entries.push({
      key: `task-${t.id}`,
      at: t.created_at,
      source: "task",
      kind: "tache",
      title: `${kindLabel} : ${t.title}`,
      body: `${statusLabel}${t.due_at ? ` · échéance ${t.due_at.slice(0, 16).replace("T", " ")}` : ""}`,
      author: input.nameFor(t.author_user_id),
      tone: t.status === "fait" ? "ok" : "neutral",
    });
  }

  return entries.sort((a, b) => b.at.localeCompare(a.at));
}
