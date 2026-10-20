/**
 * **Automatisations PERSONNALISÉES** — modèle de brouillon.
 *
 * Règles non négociables de la V1 :
 *   1. Une automatisation personnalisée n'a **aucun statut actif**. Le domaine
 *      lui-même ne contient pas la valeur `actif` : impossible d'en activer une,
 *      y compris en falsifiant un appel (la contrainte SQL refuse également).
 *   2. Le déclencheur appartient au **catalogue métier existant** — aucun
 *      nouvel événement n'est inventé.
 *   3. Les conditions sont **déclaratives et déterministes** : un couple
 *      `clé → valeur` issu d'un catalogue fermé, jamais du code.
 *   4. Rien ici n'exécute quoi que ce soit : ce module décrit et valide.
 */

import { COMMUNICATION_EVENTS, CHANNELS, type Channel, type CommunicationEvent } from "../types";

/**
 * Statuts d'une automatisation personnalisée. `actif` est **volontairement
 * absent** : c'est la traduction, dans le type, de l'interdiction produit.
 */
export const DRAFT_AUTOMATION_STATUSES = [
  "brouillon",
  "pret_pour_revue",
  "en_pause",
  "archive",
] as const;
export type DraftAutomationStatus = (typeof DRAFT_AUTOMATION_STATUSES)[number];

export const draftAutomationStatusLabels: Record<DraftAutomationStatus, string> = {
  brouillon: "Brouillon",
  pret_pour_revue: "Prêt pour revue",
  en_pause: "Suspendu",
  archive: "Archivé",
};

export const draftAutomationStatusHints: Record<DraftAutomationStatus, string> = {
  brouillon: "En cours de rédaction. Ne produit rien.",
  pret_pour_revue: "Soumis à relecture. Ne produit toujours rien : aucune exécution n'existe en V1.",
  en_pause: "Mis de côté volontairement. Conservé, sans effet.",
  archive: "Retiré de la liste de travail. La version reste consultable.",
};

/** Visuel de statut : couleur de thème + icône, jamais la couleur seule. */
export function draftAutomationStatusVisual(status: DraftAutomationStatus): {
  cssVar: string;
  icon: string;
} {
  switch (status) {
    case "brouillon":
      return { cssVar: "--crm-st-nouveau", icon: "✎" };
    case "pret_pour_revue":
      return { cssVar: "--crm-st-a_contacter", icon: "◷" };
    case "en_pause":
      return { cssVar: "--crm-st-eligibilite", icon: "⏸" };
    case "archive":
      return { cssVar: "--crm-st-neutre", icon: "▣" };
  }
}

export function isDraftAutomationStatus(value: unknown): value is DraftAutomationStatus {
  return (
    typeof value === "string" &&
    (DRAFT_AUTOMATION_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * Catalogue **fermé** des conditions déclaratives. Miroir exact de
 * `comm_automation_conditions_valid` en base : les deux ne peuvent pas diverger
 * sans faire échouer le test de cohérence.
 */
export const CONDITION_KEYS = [
  "segment",
  "stade",
  "canal_autorise",
  "categorie",
  "source",
  "sans_opposition",
  "sans_message_recent",
] as const;
export type ConditionKey = (typeof CONDITION_KEYS)[number];

export interface ConditionDefinition {
  key: ConditionKey;
  label: string;
  /** Ce que la condition vérifie, en une phrase vérifiable. */
  describes: string;
  kind: "texte" | "booleen" | "nombre";
  /** Valeurs proposées lorsque le domaine est fermé. */
  options?: readonly { value: string; label: string }[];
}

export const CONDITION_DEFINITIONS: readonly ConditionDefinition[] = [
  {
    key: "segment",
    label: "Segment du bien",
    describes: "Le segment validé du bien rattaché au dossier.",
    kind: "texte",
    options: [
      { value: "cible_prodigio_premium", label: "Cible Prodigio premium" },
      { value: "hors_cible_premium", label: "Hors cible premium" },
      { value: "non_determine", label: "Segment non déterminé" },
    ],
  },
  {
    key: "stade",
    label: "Stade du pipeline",
    describes: "La position commerciale de l'opportunité au moment de l'événement.",
    kind: "texte",
  },
  {
    key: "canal_autorise",
    label: "Canal explicitement autorisé",
    describes: "Le canal figure parmi les canaux autorisés par le choix enregistré.",
    kind: "booleen",
  },
  {
    key: "categorie",
    label: "Catégorie du message",
    describes: "Nature juridique du message : transactionnel ou marketing.",
    kind: "texte",
    options: [
      { value: "transactionnel", label: "Transactionnel" },
      { value: "marketing", label: "Marketing" },
    ],
  },
  {
    key: "source",
    label: "Source d'attribution",
    describes: "La source enregistrée sur la soumission d'origine.",
    kind: "texte",
  },
  {
    key: "sans_opposition",
    label: "Aucune opposition active",
    describes: "Aucune opposition active ne couvre le canal et la portée visés.",
    kind: "booleen",
  },
  {
    key: "sans_message_recent",
    label: "Aucun message récent",
    describes: "Aucun message du même modèle n'a été préparé dans les N dernières heures.",
    kind: "nombre",
  },
];

export function conditionDefinition(key: string): ConditionDefinition | null {
  return CONDITION_DEFINITIONS.find((c) => c.key === key) ?? null;
}

/** Valeur admise pour une condition : scalaire uniquement, jamais une structure. */
export type ConditionValue = string | number | boolean;

export interface DraftAutomation {
  automationKey: string;
  name: string;
  triggerEvent: CommunicationEvent;
  channel: Channel;
  templateKey: string;
  /** Version épinglée, ou `null` pour « version active à l'exécution ». */
  templateVersion: number | null;
  delayMinutes: number;
  conditions: Readonly<Partial<Record<ConditionKey, ConditionValue>>>;
  status: DraftAutomationStatus;
  notes?: string | null;
}

export type ValidationIssue = { field: string; message: string };

const KEY_PATTERN = /^[a-z0-9_]{3,64}$/;
/** Un an en minutes — même borne qu'en base (`delay_minutes` ≤ 525600). */
export const MAX_DELAY_MINUTES = 525_600;

/**
 * Valide un brouillon d'automatisation. Renvoie la liste **complète** des
 * problèmes plutôt que le premier : l'utilisateur corrige en une passe.
 *
 * ⚠️ Cette validation est un miroir explicatif. L'autorité reste la base
 * (contraintes + `crm_comm_upsert_automation`), qui refuse de toute façon.
 */
export function validateDraftAutomation(
  draft: Partial<DraftAutomation>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!draft.automationKey || !KEY_PATTERN.test(draft.automationKey)) {
    issues.push({
      field: "automationKey",
      message: "Clé invalide : minuscules, chiffres et « _ », de 3 à 64 caractères.",
    });
  }
  if (!draft.name || draft.name.trim().length < 3) {
    issues.push({ field: "name", message: "Un nom d'au moins 3 caractères est requis." });
  }
  if (
    !draft.triggerEvent ||
    !(COMMUNICATION_EVENTS as readonly string[]).includes(draft.triggerEvent)
  ) {
    issues.push({
      field: "triggerEvent",
      message: "Le déclencheur doit appartenir au catalogue métier existant.",
    });
  }
  if (!draft.channel || !(CHANNELS as readonly string[]).includes(draft.channel)) {
    issues.push({ field: "channel", message: "Canal inconnu." });
  }
  if (!draft.templateKey || !KEY_PATTERN.test(draft.templateKey)) {
    issues.push({ field: "templateKey", message: "Clé de modèle invalide." });
  }
  if (
    draft.templateVersion != null &&
    (!Number.isInteger(draft.templateVersion) || draft.templateVersion < 1)
  ) {
    issues.push({ field: "templateVersion", message: "Version de modèle invalide." });
  }
  const delay = draft.delayMinutes ?? 0;
  if (!Number.isInteger(delay) || delay < 0 || delay > MAX_DELAY_MINUTES) {
    issues.push({
      field: "delayMinutes",
      message: `Le délai doit être un entier entre 0 et ${MAX_DELAY_MINUTES} minutes.`,
    });
  }

  for (const [key, value] of Object.entries(draft.conditions ?? {})) {
    if (!(CONDITION_KEYS as readonly string[]).includes(key)) {
      issues.push({ field: `conditions.${key}`, message: "Condition hors catalogue." });
      continue;
    }
    const kind = typeof value;
    if (kind !== "string" && kind !== "number" && kind !== "boolean") {
      issues.push({
        field: `conditions.${key}`,
        message: "Une condition n'accepte qu'une valeur simple (texte, nombre ou oui/non).",
      });
    }
  }

  // Le statut `actif` n'existe pas dans le domaine : toute tentative est un refus
  // explicite, et non un silence.
  if (draft.status != null && !isDraftAutomationStatus(draft.status)) {
    issues.push({
      field: "status",
      message:
        "Statut refusé. Une automatisation personnalisée reste un brouillon : elle ne peut pas être activée en V1.",
    });
  }

  return issues;
}

/** Délai lisible (« immédiat », « 30 min », « 2 h », « 3 j »). */
export function formatDelay(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "Immédiat";
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) {
    const hours = minutes / 60;
    return Number.isInteger(hours) ? `${hours} h` : `${Math.floor(hours)} h ${minutes % 60} min`;
  }
  const days = minutes / 1440;
  return Number.isInteger(days) ? `${days} j` : `${Math.floor(days)} j ${Math.round((minutes % 1440) / 60)} h`;
}

/**
 * Vrai si une automatisation personnalisée peut être **exécutée**.
 * Toujours faux en V1 — la fonction existe pour être appelée (et testée)
 * partout où une exécution serait envisagée, plutôt que d'être supposée.
 */
export function canRunCustomAutomation(): false {
  return false;
}
