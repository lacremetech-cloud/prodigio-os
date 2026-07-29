import type {
  MandateSituation,
  PropertyType,
  SaleHorizon,
  ValueBand,
} from "../funnel/schema";
import {
  APPRECIATION_CONFIRM_MIN,
  APPRECIATION_STRONG_MIN,
  COMPATIBILITY_HIGH_THRESHOLD,
  COMPATIBILITY_PROPERTY_TYPE_POINTS,
  COMPATIBILITY_VALUE_BAND_POINTS,
  ECONOMIC_RULESET_VERSION,
  MATURITY_HIGH_THRESHOLD,
  MATURITY_HORIZON_POINTS,
  MATURITY_MANDATE_POINTS,
  SCORE_VERSION,
} from "./config";

/**
 * Scoring de préqualification — **déterministe, versionné, calculé côté serveur**.
 *
 * Deux scores 0–100 **distincts** (jamais fusionnés) :
 *  - `compatibility` : adéquation de la propriété avec le Système Prodigio ;
 *  - `maturity` : maturité du projet de vente.
 *
 * En est déduite une **priorité opérationnelle** (usage interne CRM) et une
 * **appréciation publique** qualitative (seul élément montré au propriétaire).
 * Les fonctions sont **pures** : mêmes entrées → mêmes sorties, testables.
 */

export type PriorityKey =
  | "rappel_prioritaire"
  | "nurturing"
  | "circuit_partenaire"
  | "suivi_long_terme";

export type AppreciationKey =
  | "fort_potentiel"
  | "a_confirmer"
  | "analyse_personnalisee";

export type ScoreBand = "haute" | "basse";

export interface ScoreFactor {
  key: string;
  value: string;
  points: number;
  max: number;
}

export interface AxisScore {
  score: number; // 0–100
  band: ScoreBand;
  factors: ScoreFactor[];
}

export interface ScoreResult {
  scoreVersion: string;
  economicRulesetVersion: string;
  compatibility: AxisScore;
  maturity: AxisScore;
  priority: PriorityKey;
  appreciation: AppreciationKey;
  needsEstimation: boolean;
}

/**
 * Entrées du scoring : uniquement les réponses « propriété / projet ». La
 * localisation et les coordonnées n'entrent PAS dans le calcul.
 */
export interface ScoringInput {
  propertyType: PropertyType;
  valueBand: ValueBand;
  saleHorizon: SaleHorizon;
  mandateSituation: MandateSituation;
}

function clampScore(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function bandOf(score: number, highThreshold: number): ScoreBand {
  return score >= highThreshold ? "haute" : "basse";
}

/** Compatibilité de la propriété avec le Système Prodigio (valeur + type). */
export function computeCompatibility(input: ScoringInput): AxisScore {
  const valuePoints = COMPATIBILITY_VALUE_BAND_POINTS[input.valueBand];
  const typePoints = COMPATIBILITY_PROPERTY_TYPE_POINTS[input.propertyType];
  const score = clampScore(valuePoints + typePoints);
  return {
    score,
    band: bandOf(score, COMPATIBILITY_HIGH_THRESHOLD),
    factors: [
      { key: "value_band", value: input.valueBand, points: valuePoints, max: 70 },
      {
        key: "property_type",
        value: input.propertyType,
        points: typePoints,
        max: 30,
      },
    ],
  };
}

/** Maturité du projet de vente (horizon + démarche en cours). */
export function computeMaturity(input: ScoringInput): AxisScore {
  const horizonPoints = MATURITY_HORIZON_POINTS[input.saleHorizon];
  const mandatePoints = MATURITY_MANDATE_POINTS[input.mandateSituation];
  const score = clampScore(horizonPoints + mandatePoints);
  return {
    score,
    band: bandOf(score, MATURITY_HIGH_THRESHOLD),
    factors: [
      { key: "sale_horizon", value: input.saleHorizon, points: horizonPoints, max: 70 },
      {
        key: "mandate_situation",
        value: input.mandateSituation,
        points: mandatePoints,
        max: 30,
      },
    ],
  };
}

/** Priorité opérationnelle (matrice 2×2 compatibilité × maturité). */
export function computePriority(
  compatibility: AxisScore,
  maturity: AxisScore,
): PriorityKey {
  const compatHigh = compatibility.band === "haute";
  const maturityHigh = maturity.band === "haute";
  if (compatHigh && maturityHigh) return "rappel_prioritaire";
  if (compatHigh && !maturityHigh) return "nurturing";
  if (!compatHigh && maturityHigh) return "circuit_partenaire";
  return "suivi_long_terme";
}

/**
 * Appréciation publique (qualitative). Dérivée de la compatibilité, mais jamais
 * « non éligible » : au pire « analyse personnalisée nécessaire ». Quand la
 * valeur est inconnue (`accompagnement_estimation`), on ne surjoue aucune
 * précision → analyse personnalisée.
 */
export function computeAppreciation(
  compatibility: AxisScore,
  needsEstimation: boolean,
): AppreciationKey {
  if (needsEstimation) return "analyse_personnalisee";
  if (compatibility.score >= APPRECIATION_STRONG_MIN) return "fort_potentiel";
  if (compatibility.score >= APPRECIATION_CONFIRM_MIN) return "a_confirmer";
  return "analyse_personnalisee";
}

/** Résultat complet, avec `score_breakdown` exploitable par le futur CRM. */
export function computeScoreResult(input: ScoringInput): ScoreResult {
  const compatibility = computeCompatibility(input);
  const maturity = computeMaturity(input);
  const needsEstimation = input.valueBand === "accompagnement_estimation";
  return {
    scoreVersion: SCORE_VERSION,
    economicRulesetVersion: ECONOMIC_RULESET_VERSION,
    compatibility,
    maturity,
    priority: computePriority(compatibility, maturity),
    appreciation: computeAppreciation(compatibility, needsEstimation),
    needsEstimation,
  };
}

/**
 * Point d'entrée depuis les réponses du funnel. N'utilise QUE les 4 tokens de
 * scoring : tout autre champ (y compris un score injecté par un client
 * malveillant) est **ignoré** — impossible d'imposer un score depuis le navigateur.
 */
export function scoreFromAnswers(answers: {
  propertyType: PropertyType;
  valueBand: ValueBand;
  saleHorizon: SaleHorizon;
  mandateSituation: MandateSituation;
}): ScoreResult {
  return computeScoreResult({
    propertyType: answers.propertyType,
    valueBand: answers.valueBand,
    saleHorizon: answers.saleHorizon,
    mandateSituation: answers.mandateSituation,
  });
}
