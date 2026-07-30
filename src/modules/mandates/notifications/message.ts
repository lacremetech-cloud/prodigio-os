import type { SubmissionRequest } from "../funnel/payload";
import type { ScoreResult } from "../scoring";
import { FUNNEL_LANDING } from "../funnel/schema";
import { formatPhoneInternational, normalizeEmail } from "../funnel/normalize";
import {
  appreciationLabelsFr,
  contactPreferenceLabel,
  mandateSituationLabel,
  priorityLabelsFr,
  propertyTypeLabel,
  recallPreferenceLabel,
  saleHorizonLabel,
  valueBandLabel,
} from "./labels";

/**
 * Construction **pure et testable** du message Slack (Block Kit) pour une
 * nouvelle demande de mandat. Aucune I/O. Échappe toutes les valeurs
 * utilisateur (anti-mention, anti-injection de lien/format), omet les champs
 * vides, et n'inclut JAMAIS : jeton Turnstile, IP, user agent, preuve de
 * consentement, JSON brut, secrets, événements d'audit.
 */

export interface SlackMessage {
  /** Texte de repli (aperçu de notification). */
  text: string;
  /** Blocs Block Kit. */
  blocks: unknown[];
}

export interface MandateNotificationInput {
  request: SubmissionRequest;
  score: ScoreResult;
  opportunityId: string;
  crmBaseUrl: string;
  receivedAt: Date;
}

/** Échappe le mrkdwn Slack (ordre important : & d'abord). */
export function escapeSlack(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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

function formatReceivedAt(date: Date): string {
  try {
    const fmt = new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    return fmt.format(date);
  } catch {
    return date.toISOString();
  }
}

export function buildMandateSlackMessage(input: MandateNotificationInput): SlackMessage {
  const { request, score, opportunityId, crmBaseUrl, receivedAt } = input;
  const c = request.answers.contact;

  const firstName = esc(c.firstName) ?? "";
  const lastName = esc(c.lastName) ?? "";
  const fullName = `${firstName} ${lastName}`.trim() || "Propriétaire";

  const phone = esc(formatPhoneInternational(c.phoneRaw, c.phoneCountry));
  const email = esc(normalizeEmail(c.emailRaw) ?? c.emailRaw);

  const propertyLabel = esc(propertyTypeLabel(request.answers.propertyType));
  const city = esc(request.answers.location.city);
  const valueLabel = esc(valueBandLabel(request.answers.valueBand));
  const horizonLabel = esc(saleHorizonLabel(request.answers.saleHorizon));
  const mandateLabel = esc(mandateSituationLabel(request.answers.mandateSituation));

  const priorityLabel = priorityLabelsFr[score.priority];
  const appreciationLabel = appreciationLabelsFr[score.appreciation];

  const contactPref = esc(contactPreferenceLabel(c.preference ?? null));
  const recall = esc(recallPreferenceLabel(c.recallPreference));

  const last = request.context.lastTouch;
  const attribution: { label: string; value: string }[] = [];
  const pushAttr = (label: string, value: string | null | undefined) => {
    const v = esc(value);
    if (v) attribution.push({ label, value: v });
  };
  pushAttr("Source", last?.utm_source ?? null);
  pushAttr("Campagne", last?.utm_campaign ?? null);
  pushAttr("Ensemble de pubs", last?.utm_term ?? null);
  pushAttr("Publicité", last?.utm_content ?? null);
  pushAttr("Landing", FUNNEL_LANDING);

  const crmUrl = crmDeepLink(crmBaseUrl, opportunityId);
  const receivedLabel = formatReceivedAt(receivedAt);

  // --- Blocs ---
  const blocks: unknown[] = [
    {
      type: "header",
      text: { type: "plain_text", text: "🏛️  Nouvelle demande de mandat", emoji: true },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${appreciationLabel}* · *${priorityLabel}* · Non affecté\n_Reçu le ${receivedLabel}_`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          `*👤 ${fullName}*`,
          phone ? `📞 ${phone}` : null,
          email ? `✉️ ${email}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    },
    { type: "divider" },
  ];

  // Bien candidat
  const bienFields = [
    propertyLabel ? { type: "mrkdwn", text: `*Type de bien*\n${propertyLabel}` } : null,
    city ? { type: "mrkdwn", text: `*Localisation*\n${city}` } : null,
    valueLabel ? { type: "mrkdwn", text: `*Valeur estimée*\n${valueLabel}` } : null,
    horizonLabel ? { type: "mrkdwn", text: `*Horizon de vente*\n${horizonLabel}` } : null,
    mandateLabel ? { type: "mrkdwn", text: `*Situation du mandat*\n${mandateLabel}` } : null,
  ].filter(Boolean);
  if (bienFields.length > 0) {
    blocks.push({ type: "section", fields: bienFields.slice(0, 10) });
  }

  // Qualification Prodigio
  blocks.push({
    type: "section",
    fields: [
      { type: "mrkdwn", text: `*Compatibilité*\n${score.compatibility.score}/100` },
      { type: "mrkdwn", text: `*Maturité*\n${score.maturity.score}/100` },
      { type: "mrkdwn", text: `*Appréciation*\n${appreciationLabel}` },
      { type: "mrkdwn", text: `*Priorité*\n${priorityLabel}` },
    ],
  });

  // Préférence de contact
  const prefText = [
    contactPref ? `canal : ${contactPref}` : null,
    recall ? `rappel : ${recall}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  if (prefText) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*Préférence* — ${prefText}` },
    });
  }

  // Attribution marketing (omise si vide)
  if (attribution.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "*Acquisition* — " +
          attribution.map((a) => `${a.label} : ${a.value}`).join(" · "),
      },
    });
  }

  // Contexte discret (version de scoring, référence dossier)
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `Prodigio OS · Scoring ${escapeSlack(score.scoreVersion)} · Dossier \`${escapeSlack(opportunityId)}\``,
      },
    ],
  });

  // Bouton principal → fiche exacte
  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: { type: "plain_text", text: "Ouvrir le dossier dans Prodigio CRM", emoji: false },
        url: crmUrl,
        style: "primary",
      },
    ],
  });

  const text = `Nouvelle demande de mandat · ${appreciationLabel} · ${priorityLabel} · ${fullName}`;
  return { text, blocks };
}
