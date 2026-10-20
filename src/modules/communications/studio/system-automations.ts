/**
 * **Automatisations SYSTÈME** — vue en lecture seule des six communications
 * transactionnelles déjà en production.
 *
 * ⚠️ Aucune ligne n'est créée en base : ces automatisations sont PORTÉES par les
 * déclencheurs SQL de la migration `20260818120000_communications_v1.sql` et
 * DÉCRITES par le catalogue `EVENT_DEFINITIONS`. Ce module se contente de les
 * PROJETER dans le studio à partir de cette source unique.
 *
 * C'est la garantie anti-doublon : le studio ne peut pas créer un second
 * déclencheur ni un second message pour un événement déjà couvert, puisqu'il
 * n'invente rien — il lit.
 */

import { EVENT_DEFINITIONS, GOOGLE_COVERED_EVENTS, type EventDefinition } from "../events";
import type { Category, Channel, CommunicationEvent } from "../types";

/** Projection en lecture seule d'une communication transactionnelle existante. */
export interface SystemAutomation {
  /** Clé stable, dérivée de l'événement : jamais saisie par un utilisateur. */
  key: string;
  event: CommunicationEvent;
  label: string;
  channel: Channel;
  category: Category;
  templateKey: string;
  recipient: string;
  rationale: string;
  trigger: string;
  idempotency: string;
  noMessageWhen: readonly string[];
  /** Google Calendar assume-t-il déjà cet envoi ? */
  googleCovered: boolean;
  /** Toujours vrai : une automatisation système ne s'édite pas depuis le studio. */
  readOnly: true;
}

function project(definition: EventDefinition): SystemAutomation {
  return {
    key: `systeme_${definition.event}`,
    event: definition.event,
    label: definition.label,
    channel: definition.channel,
    category: definition.category,
    templateKey: definition.templateKey,
    recipient: definition.recipient,
    rationale: definition.rationale,
    trigger: definition.trigger,
    idempotency: definition.idempotency,
    noMessageWhen: definition.noMessageWhen,
    googleCovered: GOOGLE_COVERED_EVENTS.includes(definition.event),
    readOnly: true,
  };
}

/** Les six automatisations système, dans l'ordre du catalogue d'événements. */
export const SYSTEM_AUTOMATIONS: readonly SystemAutomation[] =
  EVENT_DEFINITIONS.map(project);

/** Événements déjà couverts par une automatisation système. */
export const SYSTEM_COVERED_EVENTS: readonly CommunicationEvent[] =
  SYSTEM_AUTOMATIONS.map((a) => a.event);

/**
 * Vrai si un événement est DÉJÀ couvert par une automatisation système sur ce
 * canal. Sert d'avertissement anti-doublon dans l'éditeur : un brouillon
 * personnalisé visant le même couple (événement, canal) reproduirait un envoi
 * déjà assuré par le système.
 */
export function isCoveredBySystem(event: string, channel: string): boolean {
  return SYSTEM_AUTOMATIONS.some((a) => a.event === event && a.channel === channel);
}

/** Automatisation système couvrant un événement donné, ou `null`. */
export function systemAutomationFor(event: string): SystemAutomation | null {
  return SYSTEM_AUTOMATIONS.find((a) => a.event === event) ?? null;
}
