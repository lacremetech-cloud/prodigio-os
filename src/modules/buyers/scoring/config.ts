import type {
  Availability,
  BudgetBand,
  DecisionMode,
  Financing,
  ProjectNature,
  PurchaseHorizon,
} from "../funnel/schema";

/**
 * Configuration du scoring ACQUÉREUR — **VERSIONNÉE et CENTRALISÉE**.
 *
 * ⚠️ Ce fichier appartient au domaine (serveur) — **jamais** aux composants UI.
 * Il est le **miroir exact** de la fonction SQL `compute_buyer_scores`
 * (buyer-scoring-v1). Toute évolution incrémente `BUYER_SCORE_VERSION` des deux
 * côtés afin que les anciens intérêts restent lisibles avec leurs règles
 * d'origine (photographie versionnée).
 *
 * Le scoring est **distinct** du scoring Mandats. Quatre dimensions
 * indépendantes, puis un score global pondéré et une **priorité opérationnelle
 * interne**. Le score exact reste INTERNE : le visiteur ne reçoit qu'une réponse
 * neutre et premium — jamais de « refusé » ni de « non qualifié ».
 *
 * Les seuils et pondérations sont ici (centralisés), jamais dispersés dans
 * l'interface. La valeur de référence du bien (comparaison budgétaire) est une
 * donnée INTERNE, lue côté serveur — jamais contrôlable depuis le navigateur.
 */

export const BUYER_SCORE_VERSION = "buyer-scoring-v1" as const;

/**
 * Bornes indicatives (centimes) de chaque tranche de budget acquéreur. Servent
 * la comparaison avec la valeur de référence du bien. `max = null` = illimité.
 * Miroir des bornes SQL de `compute_buyer_scores`.
 */
export const BUDGET_BAND_BOUNDS: Record<BudgetBand, { min: number | null; max: number | null }> = {
  moins_800k: { min: 0, max: 80_000_000 },
  "800k_1_2m": { min: 80_000_000, max: 120_000_000 },
  "1_2m_2m": { min: 120_000_000, max: 200_000_000 },
  "2m_3m": { min: 200_000_000, max: 300_000_000 },
  plus_3m: { min: 300_000_000, max: null },
  a_definir: { min: null, max: null },
};

// --- Financement -------------------------------------------------------------
export const FINANCING_POINTS: Record<Financing, number> = {
  fonds_propres: 100,
  accord_bancaire: 76,
  financement_a_organiser: 40,
};

// --- Maturité (horizon + décision + nature du projet) ------------------------
export const HORIZON_POINTS: Record<PurchaseHorizon, number> = {
  immediat: 60,
  trois_mois: 50,
  six_mois: 34,
  en_reflexion: 14,
};

export const DECISION_POINTS: Record<DecisionMode, number> = {
  seul: 22,
  avec_autres: 14,
};

export const PROJECT_NATURE_POINTS: Record<ProjectNature, number> = {
  residence_principale: 18,
  residence_secondaire: 16,
  investissement: 12,
  autre: 8,
};

// --- Disponibilité -----------------------------------------------------------
export const AVAILABILITY_POINTS: Record<Availability, number> = {
  disponible_visite: 100,
  disponible_echange: 72,
  a_convenir: 45,
};

// --- Pondération du score global (somme = 100) -------------------------------
export const WEIGHT_BUDGET = 0.35;
export const WEIGHT_MATURITY = 0.3;
export const WEIGHT_FINANCING = 0.2;
export const WEIGHT_AVAILABILITY = 0.15;

// --- Seuils de priorité opérationnelle (configurables) -----------------------
export const PRIORITY_PRIORITAIRE_MIN = 68; // score global ≥ → candidat prioritaire…
export const PRIORITY_BUDGET_MIN = 55; // … si compatibilité budgétaire suffisante…
export const PRIORITY_FINANCING_MIN = 55; // … et financement crédible.
export const PRIORITY_A_QUALIFIER_MIN = 45; // ≥ → à qualifier ; sinon à suivre.

// --- Compatibilité budgétaire (points) ---------------------------------------
export const BUDGET_STRONG = 92; // budget couvre confortablement la référence
export const BUDGET_PLUS_3M = 78; // tranche « plus_3m » (couvre tout)
export const BUDGET_COVERS = 66; // budget couvre la référence
export const BUDGET_CLOSE = 42; // budget proche (≥ 85 % de la référence)
export const BUDGET_WEAK = 20; // budget en deçà
export const BUDGET_NEUTRAL = 50; // référence inconnue / tranche « à définir »
export const BUDGET_CLOSE_RATIO = 0.85; // seuil de proximité budgétaire
