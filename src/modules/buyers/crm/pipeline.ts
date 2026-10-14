/**
 * Logique **pure** du Kanban Acquéreurs (glisser-déposer), testable sans DOM ni
 * serveur. Miroir de `src/modules/crm/kanban.ts` pour le pipeline Mandats.
 *
 * Règle métier centrale : un simple déplacement de carte ne doit JAMAIS
 * fabriquer une information manquante ni forcer une étape sensible en
 * contournant les fonctions dédiées (`crm_buyer_record_offer`,
 * `crm_buyer_record_outcome`). « Offre en cours », « Acquéreur gagné » et
 * « Perdu » sont des cibles **protégées** : le dépôt y est refusé et
 * l'utilisateur est renvoyé vers l'action métier (confirmation, motif, audit).
 *
 * La base reste l'autorité : `crm_buyer_set_stage` refuse elle aussi ces
 * étapes. Ce module évite seulement un aller-retour serveur inutile et permet
 * d'expliquer le refus à l'utilisateur.
 */

import { BUYER_KANBAN_COLUMNS } from "./labels";
import type { BuyerPipelineStage, BuyerRecommendedPriority } from "@/lib/supabase/types";

/**
 * DTO minimal d'une carte du Kanban Acquéreurs, prêt à sérialiser vers le
 * navigateur. Les coordonnées sensibles sont DÉJÀ masquées côté serveur selon
 * le rôle : le client ne reçoit jamais une donnée non autorisée.
 */
export interface BuyerKanbanCard {
  /** Clé de la CARTE : une personne sur un projet. Sans elle, une personne
      intéressée par deux projets n'aurait qu'une carte, et on ne saurait pas
      de quel projet elle parle. */
  interestId: string | null;
  propertyId: string | null;
  buyerProfileId: string;
  stage: string;
  name: string;
  /** Projet de CETTE carte. */
  propertyLabel: string | null;
  city: string | null;
  /** Score automatique du meilleur intérêt (≠ qualification humaine). */
  bestScore: number | null;
  recommendedPriority: BuyerRecommendedPriority | null;
  qualificationLabel: string;
  interestCount: number;
  unassigned: boolean;
  overdue: boolean;
  noNextAction: boolean;
  newInterest: boolean;
  phoneMasked: string | null;
}

/**
 * Étapes exigeant une action métier dédiée. **Il n'y en a plus aucune.**
 *
 * Il y en avait trois — offre, gagné, perdu — parce qu'elles engageaient : on
 * ne gagne pas un acquéreur en faisant glisser une carte. Elles ont quitté le
 * pipeline à la reprise du 14/10/2026 : une offre et une issue commerciale
 * appartiennent à l'AFFAIRE, donc au bien. Éric peut acheter Verdun sans
 * jamais donner suite sur Jean Jaurès — une seule étape de traitement pour
 * lui, deux issues distinctes.
 *
 * Les sept étapes restantes décrivent toutes où en est la CONVERSATION, et
 * une conversation se déplace librement. Le registre est conservé plutôt que
 * supprimé : le jour où une étape redeviendra engageante, elle a sa place.
 */
export const PROTECTED_BUYER_STAGES: Record<string, "offre" | "resultat"> = {};

/**
 * Étapes terminales. Vide pour la même raison : « pas intéressé » et « mauvais
 * numéro » n'enferment personne. Un numéro se corrige, et quelqu'un qui a dit
 * non à une villa dira peut-être oui à la suivante — c'est précisément à quoi
 * sert le vivier.
 */
export const CLOSED_BUYER_STAGES: readonly string[] = [];

export interface BuyerMoveEvaluation {
  allowed: boolean;
  noop?: boolean;
  reason?: string;
  requiresAction?: "offre" | "resultat" | "reouverture";
}

/**
 * Évalue si un déplacement de `fromStage` vers `toStage` est autorisé par un
 * simple changement d'étape. Ne dépend d'aucun rôle (le rôle est vérifié en
 * base) : ici uniquement la règle de progression du pipeline.
 */
export function evaluateBuyerMove(fromStage: string, toStage: string): BuyerMoveEvaluation {
  if (!(BUYER_KANBAN_COLUMNS as readonly string[]).includes(toStage)) {
    return { allowed: false, reason: "Colonne inconnue." };
  }
  if (fromStage === toStage) {
    return { allowed: false, noop: true };
  }
  if (CLOSED_BUYER_STAGES.includes(fromStage)) {
    return {
      allowed: false,
      requiresAction: "reouverture",
      reason:
        "Ce dossier est clos. Sa réouverture est une décision tracée : elle se fait depuis la fiche acquéreur, avec un motif.",
    };
  }
  const protectedKind = PROTECTED_BUYER_STAGES[toStage];
  if (protectedKind) {
    return {
      allowed: false,
      requiresAction: protectedKind,
      reason:
        protectedKind === "offre"
          ? "L’enregistrement d’une offre se fait depuis la fiche acquéreur (bien concerné et montant), pas par glisser-déposer."
          : "Le résultat « gagné » ou « perdu » s’enregistre depuis la fiche acquéreur, avec confirmation et motif obligatoire en cas de perte.",
    };
  }
  return { allowed: true };
}

/** Cible protégée ? (pour signaler visuellement les colonnes non-« droppables »). */
export function isProtectedBuyerStage(stage: string): boolean {
  return stage in PROTECTED_BUYER_STAGES;
}

/**
 * Poids d'urgence d'une carte, pour le tri « par urgence » de la boîte de
 * réception. Purement dérivé de signaux opérationnels : jamais du seul score.
 */
export function buyerUrgencyWeight(card: BuyerKanbanCard): number {
  let weight = 0;
  if (card.overdue) weight += 8;
  if (card.newInterest) weight += 5;
  if (card.unassigned) weight += 4;
  if (card.noNextAction) weight += 3;
  if (card.recommendedPriority === "prioritaire") weight += 2;
  else if (card.recommendedPriority === "a_qualifier") weight += 1;
  return weight;
}

/** Étapes réellement atteignables par un simple déplacement depuis `fromStage`. */
export function movableBuyerStages(fromStage: string): BuyerPipelineStage[] {
  if (CLOSED_BUYER_STAGES.includes(fromStage)) return [];
  return BUYER_KANBAN_COLUMNS.filter(
    (s) => s !== fromStage && !isProtectedBuyerStage(s),
  ) as BuyerPipelineStage[];
}
