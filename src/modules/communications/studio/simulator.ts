/**
 * **Simulateur de workflow** — pédagogique, hors ligne, strictement synthétique.
 *
 * Ce qu'il fait : rejouer, étape par étape, la décision qui aboutirait à un
 * message *préparé* ou *bloqué*, en réutilisant la POLITIQUE et le MOTEUR DE
 * RENDU réels (`evaluatePolicy`, `renderTemplate`).
 *
 * Ce qu'il ne fait **jamais** :
 *   • écrire dans l'outbox, dans `communication_messages` ou dans l'audit ;
 *   • contacter un fournisseur (aucun `fetch`, aucun réseau — ce module est une
 *     fonction pure) ;
 *   • lire une donnée réelle : le destinataire vient obligatoirement du jeu
 *     synthétique, sinon la simulation est refusée ;
 *   • prétendre qu'une base légale est validée.
 */

import { evaluatePolicy, UNSETTLED_LEGAL_BASIS } from "../policy";
import { BLOCKED_REASON_HINTS, BLOCKED_REASON_LABELS } from "../policy";
import { renderTemplate, renderErrorLabel, type BodyFormat } from "../templates/render";
import { eventLabels, channelLabels, categoryLabels } from "../labels";
import type { BlockedReason, Category, Channel, CommunicationEvent } from "../types";
import {
  conditionDefinition,
  formatDelay,
  type ConditionKey,
  type ConditionValue,
} from "./automation";
import {
  isSyntheticRecipientId,
  syntheticAddress,
  syntheticRecipient,
  type SyntheticRecipient,
} from "./fixtures";
import { systemAutomationFor } from "./system-automations";

/** Résultat d'une étape : ce qui a été constaté, sans interprétation. */
export type StepOutcome = "ok" | "bloquant" | "information";

export interface SimulationStep {
  /** Identifiant stable de l'étape (sert de clé de rendu et de test). */
  key:
    | "evenement"
    | "conditions"
    | "eligibilite"
    | "base_legale"
    | "oppositions"
    | "canal"
    | "delai"
    | "modele"
    | "variables"
    | "decision";
  label: string;
  outcome: StepOutcome;
  /** Constat en une phrase. */
  detail: string;
  /** Détails secondaires (une ligne par élément). */
  items?: readonly string[];
}

export interface SimulationTemplate {
  templateKey: string;
  version: number;
  status: "brouillon" | "actif" | "archive" | "absent";
  channel: Channel;
  category: Category;
  subject: string | null;
  body: string;
  bodyFormat: BodyFormat;
  allowedVariables: readonly string[];
}

export interface SimulationInput {
  /** Identifiant d'un destinataire SYNTHÉTIQUE. Toute autre valeur est refusée. */
  recipientId: string;
  event: CommunicationEvent;
  channel: Channel;
  category: Category;
  delayMinutes: number;
  conditions: Readonly<Partial<Record<ConditionKey, ConditionValue>>>;
  template: SimulationTemplate | null;
  /** L'envoi réel est-il activé ? Toujours transmis, jamais supposé. */
  dispatchEnabled: boolean;
  /** Google Calendar couvre-t-il déjà cet envoi ? */
  googleCovers?: boolean;
}

export interface SimulationResult {
  /** Vrai si le simulateur a pu s'exécuter (destinataire synthétique valide). */
  ran: boolean;
  steps: readonly SimulationStep[];
  /** Décision finale — jamais un envoi, au mieux « préparé ». */
  decision: "prepare" | "bloque" | "refuse";
  blockedReason: BlockedReason | null;
  /** Motif précis, lisible, du blocage ou du refus. */
  reason: string | null;
  /** Sujet et corps rendus, uniquement à partir de valeurs fictives. */
  renderedSubject: string | null;
  renderedBody: string | null;
  /** Toujours vrai : garantit, dans le résultat lui-même, qu'aucune donnée réelle n'a servi. */
  synthetic: true;
}

/** Évaluation d'une condition déclarative contre le contexte synthétique. */
function evaluateConditions(
  conditions: Readonly<Partial<Record<ConditionKey, ConditionValue>>>,
  context: Readonly<Record<string, string | number | boolean>>,
): { satisfied: boolean; items: string[] } {
  const entries = Object.entries(conditions) as [ConditionKey, ConditionValue][];
  if (entries.length === 0) {
    return { satisfied: true, items: ["Aucune condition : le workflow s'applique à tout événement reçu."] };
  }

  const items: string[] = [];
  let satisfied = true;

  for (const [key, expected] of entries) {
    const definition = conditionDefinition(key);
    const actual = context[key];
    // `sans_message_recent` exprime un SEUIL en heures : la condition est
    // remplie si le délai observé est au moins égal au seuil attendu.
    const ok =
      key === "sans_message_recent"
        ? typeof actual === "number" && typeof expected === "number" && actual >= expected
        : actual === expected;
    if (!ok) satisfied = false;
    items.push(
      `${definition?.label ?? key} — attendu « ${String(expected)} », observé « ${
        actual === undefined ? "non renseigné" : String(actual)
      } » → ${ok ? "remplie" : "non remplie"}`,
    );
  }

  return { satisfied, items };
}

function legalBasisItems(recipient: SyntheticRecipient): string[] {
  if (recipient.privacy.length === 0) {
    return ["Aucun choix enregistré pour ce destinataire fictif."];
  }
  return recipient.privacy.map((p) => {
    const unsettled = p.legalBasis === UNSETTLED_LEGAL_BASIS;
    return `Choix « ${p.choice} » · base légale enregistrée : « ${p.legalBasis} »${
      unsettled ? " — non tranchée, donc jamais assimilée à un consentement" : ""
    } · canaux autorisés : ${p.authorizedChannels.join(", ") || "aucun"}${
      p.doNotContact ? " · ne plus contacter" : ""
    }`;
  });
}

/**
 * Rejoue une décision d'envoi sur des données fictives. Fonction **pure** :
 * aucune entrée/sortie, aucun accès réseau, aucun accès base.
 */
export function simulateWorkflow(input: SimulationInput): SimulationResult {
  // Garde-fou n°1 : le destinataire DOIT venir du jeu synthétique.
  if (!isSyntheticRecipientId(input.recipientId)) {
    return {
      ran: false,
      steps: [],
      decision: "refuse",
      blockedReason: null,
      reason:
        "Simulation refusée : le simulateur n'accepte que des destinataires fictifs. Aucune donnée réelle ne peut y entrer.",
      renderedSubject: null,
      renderedBody: null,
      synthetic: true,
    };
  }

  const recipient = syntheticRecipient(input.recipientId) as SyntheticRecipient;
  const steps: SimulationStep[] = [];

  // 1. Événement reçu.
  const system = systemAutomationFor(input.event);
  steps.push({
    key: "evenement",
    label: "Événement reçu",
    outcome: "information",
    detail: `${eventLabels[input.event] ?? input.event} — destinataire fictif : ${recipient.displayName}.`,
    items: system
      ? [`Déjà couvert par une automatisation système (${system.templateKey}) : ${system.trigger}`]
      : undefined,
  });

  // 2. Conditions évaluées.
  const conditions = evaluateConditions(input.conditions, recipient.context);
  steps.push({
    key: "conditions",
    label: "Conditions évaluées",
    outcome: conditions.satisfied ? "ok" : "bloquant",
    detail: conditions.satisfied
      ? "Toutes les conditions déclarées sont remplies."
      : "Au moins une condition n'est pas remplie : aucun message ne serait préparé.",
    items: conditions.items,
  });

  const address = syntheticAddress(recipient, input.channel);

  // 3. Éligibilité du destinataire — la politique RÉELLE, pas une copie.
  const decision = evaluatePolicy({
    channel: input.channel,
    category: input.category,
    hasAddress: Boolean(address),
    privacy: recipient.privacy,
    suppressions: recipient.suppressions,
    templateStatus: input.template?.status ?? "absent",
    googleCovers: input.googleCovers,
    dispatchEnabled: input.dispatchEnabled,
  });

  steps.push({
    key: "eligibilite",
    label: "Éligibilité du destinataire",
    outcome: decision.allowed ? "ok" : "bloquant",
    detail: decision.allowed
      ? "Le destinataire fictif est éligible au regard de la politique."
      : `Politique : ${BLOCKED_REASON_LABELS[decision.reason as BlockedReason]}.`,
    items: [
      `Coordonnée pour le canal ${channelLabels[input.channel]} : ${address ?? "aucune"}`,
      `Catégorie : ${categoryLabels[input.category]}`,
    ],
  });

  // 4. Base légale enregistrée — constatée, jamais présentée comme validée.
  const hasUnsettled = recipient.privacy.some((p) => p.legalBasis === UNSETTLED_LEGAL_BASIS);
  steps.push({
    key: "base_legale",
    label: "Base légale enregistrée",
    outcome: hasUnsettled ? "information" : "ok",
    detail: hasUnsettled
      ? "Base légale enregistrée mais NON TRANCHÉE. Le studio la constate ; il n'affirme aucune conformité."
      : "Une base légale est enregistrée. Sa validité juridique reste à établir hors du système.",
    items: legalBasisItems(recipient),
  });

  // 5. Oppositions.
  const activeSuppressions = recipient.suppressions.filter((s) => s.active);
  const globalOpposition = activeSuppressions.some((s) => s.channel === "tout" && s.scope === "tout");
  steps.push({
    key: "oppositions",
    label: "Oppositions",
    outcome: activeSuppressions.length > 0 ? "bloquant" : "ok",
    detail:
      activeSuppressions.length === 0
        ? "Aucune opposition active sur ce destinataire fictif."
        : globalOpposition
          ? "Opposition GLOBALE active : elle prévaut sur toute autre règle et sur tous les canaux."
          : `${activeSuppressions.length} opposition(s) active(s) sur ce destinataire fictif.`,
    items: activeSuppressions.map(
      (s) => `Canal « ${s.channel} » · portée « ${s.scope} » · active`,
    ),
  });

  // 6. Canal sélectionné.
  steps.push({
    key: "canal",
    label: "Canal sélectionné",
    outcome: address ? "ok" : "bloquant",
    detail: `${channelLabels[input.channel]} — ${address ? `coordonnée fictive ${address}` : "aucune coordonnée exploitable"}.`,
  });

  // 7. Délai calculé.
  steps.push({
    key: "delai",
    label: "Délai calculé",
    outcome: "information",
    detail: `${formatDelay(input.delayMinutes)} après l'événement (${input.delayMinutes} minute(s)).`,
  });

  // 8. Modèle et version.
  steps.push({
    key: "modele",
    label: "Modèle et version",
    outcome: input.template ? (input.template.status === "actif" ? "ok" : "bloquant") : "bloquant",
    detail: input.template
      ? `${input.template.templateKey} v${input.template.version} — statut « ${input.template.status} ».`
      : "Aucun modèle ne correspond à cette clé et à ce canal.",
    items: input.template
      ? [`Variables déclarées : ${input.template.allowedVariables.map((v) => `{{${v}}}`).join(" ") || "aucune"}`]
      : undefined,
  });

  // 9. Variables résolues — rendu réel, sur valeurs fictives uniquement.
  let renderedSubject: string | null = null;
  let renderedBody: string | null = null;
  let renderIssue: string | null = null;

  if (input.template) {
    const rendered = renderTemplate({
      subject: input.template.subject,
      body: input.template.body,
      bodyFormat: input.template.bodyFormat,
      allowedVariables: input.template.allowedVariables,
      values: recipient.variables,
    });
    if (rendered.ok) {
      renderedSubject = rendered.subject;
      renderedBody = rendered.body;
      steps.push({
        key: "variables",
        label: "Variables résolues",
        outcome: "ok",
        detail: "Toutes les variables utilisées sont déclarées et renseignées (valeurs fictives).",
        items: Object.entries(recipient.variables).map(([k, v]) => `{{${k}}} → ${v}`),
      });
    } else {
      renderIssue = renderErrorLabel(rendered);
      steps.push({
        key: "variables",
        label: "Variables résolues",
        outcome: "bloquant",
        detail: renderIssue,
        items: rendered.variables.map((v) => `{{${v}}}`),
      });
    }
  } else {
    steps.push({
      key: "variables",
      label: "Variables résolues",
      outcome: "bloquant",
      detail: "Aucun modèle : le rendu n'a pas lieu.",
    });
  }

  // 10. Décision finale. L'ordre des motifs suit celui de la politique.
  let finalDecision: SimulationResult["decision"] = "prepare";
  let reason: string | null = null;

  if (!decision.allowed) {
    finalDecision = "bloque";
    const code = decision.reason as BlockedReason;
    reason = `${BLOCKED_REASON_LABELS[code]} — ${BLOCKED_REASON_HINTS[code]}`;
  } else if (!conditions.satisfied) {
    finalDecision = "bloque";
    reason = "Les conditions déclarées du workflow ne sont pas remplies : aucun message ne serait préparé.";
  } else if (renderIssue) {
    finalDecision = "bloque";
    reason = `${renderIssue} — mieux vaut ne rien envoyer qu'envoyer un contenu incomplet.`;
  }

  steps.push({
    key: "decision",
    label: "Décision finale",
    outcome: finalDecision === "prepare" ? "ok" : "bloquant",
    detail:
      finalDecision === "prepare"
        ? "Message PRÉPARÉ (simulation). Aucun envoi n'a lieu : rien n'est écrit, aucun fournisseur n'est contacté."
        : `Message BLOQUÉ. ${reason}`,
  });

  return {
    ran: true,
    steps,
    decision: finalDecision,
    blockedReason: decision.allowed ? null : (decision.reason as BlockedReason),
    reason,
    renderedSubject,
    renderedBody,
    synthetic: true,
  };
}
