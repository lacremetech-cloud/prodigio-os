import type { BuyerSubmissionRequest } from "../funnel/payload";
import type { BuyerScoreResult } from "../scoring";
import { formatPhoneInternational, normalizeEmail } from "@/modules/mandates/funnel/normalize";
import { escapeSlack } from "@/modules/mandates/notifications/message";
import {
  availabilityLabels,
  budgetBandLabels,
  contactPreferenceLabels,
  financingLabels,
  projectNatureLabels,
  purchaseHorizonLabels,
  recallPreferenceLabels,
} from "../funnel/content";

/**
 * Construction **pure et testable** du message Slack (Block Kit) pour une
 * nouvelle demande acquéreur. Aucune I/O. Échappe toutes les valeurs
 * utilisateur, omet les champs vides, et n'inclut JAMAIS : jeton Turnstile, IP,
 * user agent, preuve de consentement, JSON brut, webhook, secrets, audit.
 * Le score et la priorité sont INTERNES (jamais montrés au visiteur).
 */

export interface BuyerSlackMessage {
  text: string;
  blocks: unknown[];
}

export interface BuyerNotificationInput {
  request: BuyerSubmissionRequest;
  score: BuyerScoreResult;
  interestId: string;
  propertyId: string;
  propertyName: string | null;
  /** Dossier acquéreur consolidé (cible du bouton d'action). */
  buyerProfileId: string | null;
  crmBaseUrl: string;
  receivedAt: Date;
}

const buyerPriorityLabels: Record<string, string> = {
  prioritaire: "Prioritaire",
  a_qualifier: "À qualifier",
  a_suivre: "À suivre",
};

function esc(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed.length === 0 ? null : escapeSlack(trimmed);
}

/**
 * Deep link CRM vers le **dossier acquéreur consolidé** :
 * `/crm/acquereurs/{buyerProfileId}`.
 *
 * C'est le point d'entrée opérationnel : le dossier réunit l'identité, tous les
 * intérêts de la personne, la qualification, l'affectation et le suivi. À
 * défaut de dossier résolu (cas limite : contact non résolu), on retombe sur la
 * réception du bien, qui reste exacte — jamais sur un lien mort.
 */
export function buyerCrmDeepLink(
  baseUrl: string,
  propertyId: string,
  interestId: string,
  buyerProfileId?: string | null,
): string {
  const base = baseUrl.replace(/\/+$/, "");
  if (buyerProfileId) {
    return `${base}/crm/acquereurs/${encodeURIComponent(buyerProfileId)}`;
  }
  return `${base}/crm/biens/${encodeURIComponent(propertyId)}?interet=${encodeURIComponent(interestId)}`;
}

function formatReceivedAt(date: Date): string {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

export function buildBuyerSlackMessage(input: BuyerNotificationInput): BuyerSlackMessage {
  const { request, score, interestId, propertyId, propertyName, buyerProfileId, crmBaseUrl, receivedAt } =
    input;
  const a = request.answers;
  const c = a.contact;

  const fullName = `${esc(c.firstName) ?? ""} ${esc(c.lastName) ?? ""}`.trim() || "Acquéreur";
  const phone = esc(formatPhoneInternational(c.phoneRaw, c.phoneCountry));
  const email = esc(normalizeEmail(c.emailRaw) ?? c.emailRaw);
  const property = esc(propertyName) ?? "Bien concerné";

  const project = esc(projectNatureLabels[a.projectNature]);
  const budget = esc(budgetBandLabels[a.budgetBand]);
  const financing = esc(financingLabels[a.financing]);
  const horizon = esc(purchaseHorizonLabels[a.purchaseHorizon]);
  const availability = esc(availabilityLabels[a.availability]);
  const residence = esc(
    [a.residence.area, a.residence.country].filter((v) => v && v.trim()).join(", "),
  );
  const contactPref = esc(c.preference ? contactPreferenceLabels[c.preference] : null);
  const recall = esc(recallPreferenceLabels[c.recallPreference]);
  const priorityLabel = buyerPriorityLabels[score.priority] ?? score.priority;

  const last = request.context.lastTouch;
  const attribution: string[] = [];
  const pushAttr = (label: string, value: string | null | undefined) => {
    const v = esc(value);
    if (v) attribution.push(`${label} : ${v}`);
  };
  pushAttr("Source", last?.utm_source ?? null);
  pushAttr("Campagne", last?.utm_campaign ?? null);
  pushAttr("Ensemble de pubs", last?.utm_term ?? null);
  pushAttr("Publicité", last?.utm_content ?? null);

  const crmUrl = buyerCrmDeepLink(crmBaseUrl, propertyId, interestId, buyerProfileId);

  const blocks: unknown[] = [
    {
      type: "header",
      text: { type: "plain_text", text: "🔑  Nouvelle demande acquéreur", emoji: true },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${property}*\n*Priorité ${priorityLabel}* · Nouveau\n_Reçu le ${formatReceivedAt(receivedAt)}_`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: [`*👤 ${fullName}*`, phone ? `📞 ${phone}` : null, email ? `✉️ ${email}` : null]
          .filter(Boolean)
          .join("\n"),
      },
    },
    { type: "divider" },
  ];

  const fields = [
    project ? { type: "mrkdwn", text: `*Projet*\n${project}` } : null,
    budget ? { type: "mrkdwn", text: `*Budget*\n${budget}` } : null,
    financing ? { type: "mrkdwn", text: `*Financement*\n${financing}` } : null,
    horizon ? { type: "mrkdwn", text: `*Horizon*\n${horizon}` } : null,
    availability ? { type: "mrkdwn", text: `*Disponibilité*\n${availability}` } : null,
    residence ? { type: "mrkdwn", text: `*Résidence*\n${residence}` } : null,
  ].filter(Boolean);
  if (fields.length > 0) blocks.push({ type: "section", fields: fields.slice(0, 10) });

  // Qualification interne (score global + par dimension).
  blocks.push({
    type: "section",
    fields: [
      { type: "mrkdwn", text: `*Score global*\n${score.overall}/100` },
      { type: "mrkdwn", text: `*Budget*\n${score.budget}/100` },
      { type: "mrkdwn", text: `*Maturité*\n${score.maturity}/100` },
      { type: "mrkdwn", text: `*Financement*\n${score.financing}/100` },
    ],
  });

  const prefText = [
    contactPref ? `canal : ${contactPref}` : null,
    recall ? `rappel : ${recall}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  if (prefText) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: `*Préférence* — ${prefText}` } });
  }

  if (attribution.length > 0) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: "*Acquisition* — " + attribution.join(" · ") },
    });
  }

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `Prodigio OS · Scoring ${escapeSlack(score.scoreVersion)} · Intérêt \`${escapeSlack(interestId)}\``,
      },
    ],
  });

  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: { type: "plain_text", text: "Ouvrir le dossier acquéreur", emoji: false },
        url: crmUrl,
        style: "primary",
      },
    ],
  });

  const text = `Nouvelle demande acquéreur · ${property} · ${priorityLabel} · ${fullName}`;
  return { text, blocks };
}
