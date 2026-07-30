import type { EstimationAlertData, EstimationAlertKind } from "./types";

/**
 * Construction **pure et testable** des messages Slack (Block Kit) des rendez-vous
 * d'estimation. Aucune I/O. Toutes les valeurs utilisateur sont échappées
 * (anti-mention `@channel/@here`, anti-injection de lien/format), les champs vides
 * sont omis, et aucune donnée interdite (jeton, secret, webhook, IP, JWT, clé
 * d'idempotence, JSON brut, audit…) n'est incluse.
 */

export interface SlackMessage {
  /** Texte de repli (aperçu de notification, lisible sur mobile). */
  text: string;
  /** Blocs Block Kit. */
  blocks: unknown[];
}

/** Échappe le mrkdwn Slack (ordre important : & d'abord). Neutralise les mentions. */
export function escapeSlack(input: string): string {
  return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function esc(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed.length === 0 ? null : escapeSlack(trimmed);
}

/** Deep link CRM vers la fiche exacte : /crm/mandats/{opportunityId}. */
export function crmDeepLink(baseUrl: string, opportunityId: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}/crm/mandats/${encodeURIComponent(opportunityId)}`;
}

function fmtDateTime(iso: string, timeZone: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      timeZone,
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

function fmtTime(iso: string, timeZone: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return "—";
  }
}

function durationMinutes(startIso: string, endIso: string): number | null {
  const s = new Date(startIso).getTime();
  const e = new Date(endIso).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return null;
  return Math.round((e - s) / 60000);
}

function slotLabel(startIso: string, endIso: string, timeZone: string): string {
  const dur = durationMinutes(startIso, endIso);
  const range = `${fmtDateTime(startIso, timeZone)} → ${fmtTime(endIso, timeZone)}`;
  return dur != null ? `${range} (${dur} min)` : range;
}

/** Lien Google sûr (https, sans fragment de secret évident). */
function safeGoogleLink(link: string | null): string | null {
  if (!link) return null;
  const trimmed = link.trim();
  if (!/^https:\/\//i.test(trimmed)) return null;
  // Refus par prudence si l'URL ressemble à porter un secret.
  if (/(token|secret|access_token|refresh_token|password)/i.test(trimmed)) return null;
  return trimmed;
}

const HEADERS: Record<EstimationAlertKind, string> = {
  created: "📅 Nouveau rendez-vous d’estimation",
  rescheduled: "🔁 Rendez-vous d’estimation reporté",
  cancelled: "❌ Rendez-vous d’estimation annulé",
};

function ownerBlockText(data: EstimationAlertData): string | null {
  const name = esc(data.ownerName);
  const phone = esc(data.ownerPhone);
  const email = esc(data.ownerEmail);
  const lines = [
    name ? `*👤 ${name}*` : null,
    phone ? `📞 ${phone}` : null,
    email ? `✉️ ${email}` : null,
  ].filter(Boolean);
  return lines.length > 0 ? lines.join("\n") : null;
}

function personFields(data: EstimationAlertData, actorLabel: string): { type: string; text: string }[] {
  const fields: { type: string; text: string }[] = [];
  const agent = esc(data.agentName);
  const actor = esc(data.actorName);
  if (agent) fields.push({ type: "mrkdwn", text: `*Agent immobilier*\n${agent}` });
  if (actor) fields.push({ type: "mrkdwn", text: `*${actorLabel}*\n${actor}` });
  return fields;
}

function propertyFields(data: EstimationAlertData): { type: string; text: string }[] {
  const fields: { type: string; text: string }[] = [];
  const type = esc(data.propertyType);
  const city = esc(data.city);
  const value = esc(data.valueBand);
  if (type) fields.push({ type: "mrkdwn", text: `*Type de bien*\n${type}` });
  if (city) fields.push({ type: "mrkdwn", text: `*Ville*\n${city}` });
  if (value) fields.push({ type: "mrkdwn", text: `*Valeur estimée*\n${value}` });
  return fields;
}

function actionsBlock(data: EstimationAlertData): unknown {
  const elements: unknown[] = [
    {
      type: "button",
      text: { type: "plain_text", text: "Ouvrir le dossier dans Prodigio CRM", emoji: false },
      url: crmDeepLink(data.crmBaseUrl, data.opportunityId),
      style: "primary",
    },
  ];
  const gcal = safeGoogleLink(data.googleHtmlLink);
  if (gcal) {
    elements.push({
      type: "button",
      text: { type: "plain_text", text: "Voir dans Google Calendar", emoji: false },
      url: gcal,
    });
  }
  return { type: "actions", elements };
}

function contextBlock(opportunityId: string): unknown {
  return {
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `Prodigio OS · Estimation · Dossier \`${escapeSlack(opportunityId)}\``,
      },
    ],
  };
}

export function buildEstimationSlackMessage(data: EstimationAlertData): SlackMessage {
  const tz = data.timezone || "Europe/Paris";
  const blocks: unknown[] = [
    { type: "header", text: { type: "plain_text", text: HEADERS[data.kind], emoji: true } },
  ];

  if (data.kind === "created") {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${slotLabel(data.startsAt, data.endsAt, tz)}*\nFuseau : Europe/Paris · Statut : *Planifié*`,
      },
    });
  } else if (data.kind === "rescheduled") {
    const oldLabel =
      data.oldStartsAt && data.oldEndsAt
        ? slotLabel(data.oldStartsAt, data.oldEndsAt, tz)
        : "—";
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Ancien créneau*\n${oldLabel}\n\n*Nouveau créneau*\n${slotLabel(data.startsAt, data.endsAt, tz)}\n_Fuseau : Europe/Paris_`,
      },
    });
  } else {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Créneau qui était prévu*\n${slotLabel(data.startsAt, data.endsAt, tz)}\n_Fuseau : Europe/Paris_`,
      },
    });
  }

  const owner = ownerBlockText(data);
  if (owner) blocks.push({ type: "section", text: { type: "mrkdwn", text: owner } });

  const address = esc(data.address);
  if (address) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*Adresse du rendez-vous*\n${address}` },
    });
  }

  const actorLabel =
    data.kind === "created"
      ? "Planifié par"
      : data.kind === "rescheduled"
        ? "Reporté par"
        : "Annulé par";
  const pFields = personFields(data, actorLabel);
  const propFields = data.kind === "created" ? propertyFields(data) : [];
  const allFields = [...pFields, ...propFields].slice(0, 10);
  if (allFields.length > 0) blocks.push({ type: "section", fields: allFields });

  // Motif d'annulation : UNIQUEMENT s'il existe déjà dans le modèle.
  if (data.kind === "cancelled") {
    const reason = esc(data.reason);
    if (reason) {
      blocks.push({ type: "section", text: { type: "mrkdwn", text: `*Motif*\n${reason}` } });
    }
  }

  blocks.push({ type: "divider" });
  blocks.push(actionsBlock(data));
  blocks.push(contextBlock(data.opportunityId));

  const ownerName = esc(data.ownerName) ?? "Propriétaire";
  const city = esc(data.city);
  const previewTitle =
    data.kind === "created"
      ? "Nouveau rendez-vous d’estimation"
      : data.kind === "rescheduled"
        ? "Rendez-vous d’estimation reporté"
        : "Rendez-vous d’estimation annulé";
  const text = `${previewTitle} · ${ownerName}${city ? ` · ${city}` : ""}`;

  return { text, blocks };
}
