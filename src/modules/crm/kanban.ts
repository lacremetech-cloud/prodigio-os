/**
 * Logique **pure** du Kanban (glisser-déposer), testable sans DOM ni serveur.
 *
 * Règle métier centrale : un simple déplacement de carte ne doit JAMAIS fabriquer
 * une information manquante ni forcer un statut « proposé / signé / perdu » en
 * contournant les fonctions dédiées (`crm_propose_mandate`, `crm_sign_mandate`,
 * `crm_record_outcome`). Ces colonnes sont des cibles **protégées** : le
 * déplacement y est refusé et l'utilisateur est renvoyé vers l'action métier.
 */

import { KANBAN_COLUMNS } from "./labels";

export type KanbanStage = (typeof KANBAN_COLUMNS)[number];

/**
 * DTO minimal d'une carte Kanban, prêt à sérialiser vers le navigateur. Les
 * coordonnées sensibles y sont DÉJÀ masquées côté serveur selon le rôle : le
 * client ne reçoit jamais une donnée non autorisée.
 */
export interface KanbanLead {
  opportunityId: string;
  stage: string;
  name: string;
  propertyLabel: string;
  city: string | null;
  valueLabel: string;
  compatibilityScore: number | null;
  maturityScore: number | null;
  highPotential: boolean;
  overdue: boolean;
  unassigned: boolean;
  phoneMasked: string | null;
}

/**
 * Colonnes cibles nécessitant une action métier dédiée (jamais un simple
 * changement de stade). Déplacer une carte vers l'une d'elles est refusé.
 */
export const PROTECTED_TARGET_STAGES: Record<string, "mandat" | "resultat"> = {
  proposition_de_mandat: "mandat",
  en_attente_de_signature: "mandat",
  mandat_signe: "mandat",
  perdu: "resultat",
};

export interface MoveEvaluation {
  allowed: boolean;
  noop?: boolean;
  reason?: string;
  requiresAction?: "mandat" | "resultat";
}

/**
 * Évalue si un déplacement de `fromStage` vers `toStage` est autorisé par un
 * simple changement de stade. Ne dépend d'aucun rôle (le rôle est vérifié en
 * base) : ici uniquement la règle de progression du pipeline.
 */
export function evaluateMove(fromStage: string, toStage: string): MoveEvaluation {
  if (!(KANBAN_COLUMNS as readonly string[]).includes(toStage)) {
    return { allowed: false, reason: "Colonne inconnue." };
  }
  if (fromStage === toStage) {
    return { allowed: false, noop: true };
  }
  const protectedKind = PROTECTED_TARGET_STAGES[toStage];
  if (protectedKind) {
    return {
      allowed: false,
      requiresAction: protectedKind,
      reason:
        protectedKind === "mandat"
          ? "Le passage en proposition ou signature de mandat se fait depuis le dossier (conditions et document requis), pas par glisser-déposer."
          : "Le résultat « perdu » doit être enregistré depuis le dossier, avec un motif obligatoire.",
    };
  }
  return { allowed: true };
}

/** Cible protégée ? (pour signaler visuellement les colonnes non-“droppables”). */
export function isProtectedTarget(stage: string): boolean {
  return stage in PROTECTED_TARGET_STAGES;
}
