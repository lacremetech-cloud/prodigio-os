import type {
  MandateSituation,
  PropertyType,
  SaleHorizon,
  ValueBand,
} from "../funnel/schema";

/**
 * Configuration du scoring de préqualification — **VERSIONNÉE et CONFIGURABLE**.
 *
 * ⚠️ Ce fichier appartient au domaine (serveur), **jamais** aux composants UI.
 * Le « seuil premium » (hypothèse 800 k€, voir docs/05-OPEN-QUESTIONS.md #6) et
 * les règles de segmentation ne sont **pas** des constantes codées en dur dans
 * l'interface : ils sont représentés ici par une répartition de points entre
 * bandes de valeur, ajustable et versionnée. Toute évolution incrémente
 * `SCORE_VERSION` afin que les anciens dossiers restent lisibles avec leurs
 * règles d'origine (photographie versionnée).
 *
 * Deux axes **indépendants** (jamais fusionnés en un score unique) :
 *  - compatibilité de la PROPRIÉTÉ avec le Système Prodigio (valeur + type) ;
 *  - maturité du PROJET de vente (horizon + démarche en cours).
 *
 * La localisation n'entre pas dans le scoring : sans référentiel de marché, la
 * pondérer serait une fausse précision (docs — règle produit n°5).
 */

export const SCORE_VERSION = "mandate-scoring-v1" as const;

/** Référence de jeu de règles économiques (docs/03 — EconomicRuleSet versionné). */
export const ECONOMIC_RULESET_VERSION = "economic-baseline-v1" as const;

// --- Compatibilité (propriété ↔ Système Prodigio) ----------------------------
// Bande de valeur = signal dominant (le « seuil premium » se lit ici).
export const COMPATIBILITY_VALUE_BAND_POINTS: Record<ValueBand, number> = {
  plus_2m: 70,
  "1_2m_2m": 64,
  "800k_1_2m": 55, // autour du seuil premium : bon
  "500k_800k": 32, // sous le seuil
  moins_500k: 12,
  accompagnement_estimation: 40, // valeur inconnue : neutre, à estimer humainement
};

export const COMPATIBILITY_PROPERTY_TYPE_POINTS: Record<PropertyType, number> = {
  villa_architecte: 30,
  domaine_caractere: 30,
  chalet: 28,
  appartement_exception: 27,
  autre: 18,
};

// --- Maturité (projet de vente) ----------------------------------------------
export const MATURITY_HORIZON_POINTS: Record<SaleHorizon, number> = {
  des_que_possible: 70,
  trois_mois: 58,
  six_mois: 38,
  en_reflexion: 15,
};

// Démarche en cours : concrétude du projet et disponibilité pour Prodigio.
export const MATURITY_MANDATE_POINTS: Record<MandateSituation, number> = {
  mandat_simple: 30, // vente active, toujours ouverte à Prodigio
  aucun_mandat: 26, // prêt et disponible, mais aucune démarche concrète encore
  mandat_exclusif: 22, // vente active mais engagée ailleurs
  autre: 14, // situation à clarifier
};

// --- Seuils « haut / bas » (matrice de priorité) — configurables -------------
export const COMPATIBILITY_HIGH_THRESHOLD = 60;
export const MATURITY_HIGH_THRESHOLD = 55;

// --- Bornes d'appréciation publique (dérivées de la compatibilité) -----------
// Aucune borne ne produit un « non éligible » : la décision finale reste humaine.
export const APPRECIATION_STRONG_MIN = 60; // ≥ → fort potentiel de compatibilité
export const APPRECIATION_CONFIRM_MIN = 35; // ≥ → potentiel à confirmer ; sinon analyse personnalisée
