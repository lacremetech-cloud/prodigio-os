import type {
  Availability,
  BudgetBand,
  DecisionMode,
  Financing,
  ProjectNature,
  PurchaseHorizon,
} from "../funnel/schema";
import {
  AVAILABILITY_POINTS,
  BUDGET_BAND_BOUNDS,
  BUDGET_CLOSE,
  BUDGET_CLOSE_RATIO,
  BUDGET_COVERS,
  BUDGET_NEUTRAL,
  BUDGET_PLUS_3M,
  BUDGET_STRONG,
  BUDGET_WEAK,
  BUYER_SCORE_VERSION,
  DECISION_POINTS,
  FINANCING_POINTS,
  HORIZON_POINTS,
  PRIORITY_A_QUALIFIER_MIN,
  PRIORITY_BUDGET_MIN,
  PRIORITY_FINANCING_MIN,
  PRIORITY_PRIORITAIRE_MIN,
  PROJECT_NATURE_POINTS,
  WEIGHT_AVAILABILITY,
  WEIGHT_BUDGET,
  WEIGHT_FINANCING,
  WEIGHT_MATURITY,
} from "./config";

/**
 * Scoring acquéreur — **déterministe, versionné, explicable, calculé côté serveur**.
 *
 * Miroir EXACT de la fonction SQL `compute_buyer_scores` (buyer-scoring-v1). Les
 * fonctions sont **pures** (mêmes entrées → mêmes sorties, testables). Le score
 * exact reste INTERNE ; il n'est jamais renvoyé au visiteur, qui ne reçoit qu'une
 * réponse neutre et premium — jamais de refus automatique.
 *
 * La valeur de référence du bien (comparaison budgétaire) est INTERNE : elle est
 * injectée côté serveur (jamais transmise par le navigateur).
 */

export type BuyerPriority = "prioritaire" | "a_qualifier" | "a_suivre";

export interface BuyerScoreResult {
  scoreVersion: string;
  budget: number; // 0–100
  maturity: number; // 0–100
  financing: number; // 0–100
  availability: number; // 0–100
  overall: number; // 0–100 (pondéré)
  priority: BuyerPriority;
}

export interface BuyerScoringInput {
  budgetBand: BudgetBand;
  financing: Financing;
  purchaseHorizon: PurchaseHorizon;
  projectNature: ProjectNature;
  decisionMode: DecisionMode;
  availability: Availability;
  /** Valeur de référence du bien en centimes (INTERNE). `null` → budget neutre. */
  referenceValueCents: number | null;
}

function clamp(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Compatibilité budgétaire : la tranche du budget couvre-t-elle la référence ? */
export function computeBudgetScore(band: BudgetBand, referenceCents: number | null): number {
  if (referenceCents == null || band === "a_definir") return BUDGET_NEUTRAL;
  const bounds = BUDGET_BAND_BOUNDS[band];
  if (bounds.min != null && bounds.min >= referenceCents) return BUDGET_STRONG;
  if (bounds.max == null) return BUDGET_PLUS_3M; // plus_3m couvre tout
  if (bounds.max >= referenceCents) return BUDGET_COVERS;
  if (bounds.max >= referenceCents * BUDGET_CLOSE_RATIO) return BUDGET_CLOSE;
  return BUDGET_WEAK;
}

/** Maturité du projet : horizon + mode de décision + nature du projet. */
export function computeMaturityScore(
  horizon: PurchaseHorizon,
  decision: DecisionMode,
  nature: ProjectNature,
): number {
  return clamp(
    HORIZON_POINTS[horizon] + DECISION_POINTS[decision] + PROJECT_NATURE_POINTS[nature],
  );
}

/** Priorité opérationnelle interne (jamais montrée au visiteur). */
export function computeBuyerPriority(
  overall: number,
  budget: number,
  financing: number,
): BuyerPriority {
  if (
    overall >= PRIORITY_PRIORITAIRE_MIN &&
    budget >= PRIORITY_BUDGET_MIN &&
    financing >= PRIORITY_FINANCING_MIN
  ) {
    return "prioritaire";
  }
  if (overall >= PRIORITY_A_QUALIFIER_MIN) return "a_qualifier";
  return "a_suivre";
}

/** Résultat complet. Miroir de `compute_buyer_scores`. */
export function computeBuyerScore(input: BuyerScoringInput): BuyerScoreResult {
  const budget = clamp(computeBudgetScore(input.budgetBand, input.referenceValueCents));
  const financing = clamp(FINANCING_POINTS[input.financing]);
  const maturity = computeMaturityScore(
    input.purchaseHorizon,
    input.decisionMode,
    input.projectNature,
  );
  const availability = clamp(AVAILABILITY_POINTS[input.availability]);
  const overall = clamp(
    budget * WEIGHT_BUDGET +
      maturity * WEIGHT_MATURITY +
      financing * WEIGHT_FINANCING +
      availability * WEIGHT_AVAILABILITY,
  );
  return {
    scoreVersion: BUYER_SCORE_VERSION,
    budget,
    maturity,
    financing,
    availability,
    overall,
    priority: computeBuyerPriority(overall, budget, financing),
  };
}
