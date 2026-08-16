/**
 * Libellés et signaux visuels du **CRM Acquéreurs** (source unique).
 *
 * Les tokens restent alignés sur les contraintes SQL ; ici uniquement
 * l'affichage. Comme partout dans le CRM, la couleur n'est **jamais** le seul
 * signal : chaque statut porte aussi une icône et un libellé, et les couleurs
 * passent par des **variables CSS thème-adaptatives** (clair / sombre / système).
 *
 * Quatre notions distinctes, jamais confondues (voir docs/20) :
 *   • le score automatique du funnel      → `buyer_interests.overall_score`
 *   • la recommandation opérationnelle    → `recommended_priority`
 *   • la qualification validée par un humain → `qualification_status`
 *   • l'étape commerciale du pipeline     → `pipeline_stage`
 */

import type {
  BuyerMatchFactor,
  BuyerPipelineStage,
  BuyerQualificationStatus,
  BuyerRecommendedPriority,
} from "@/lib/supabase/types";

// --- Étapes du pipeline acquéreur (ordre = progression) ----------------------
export const BUYER_PIPELINE_STAGES: readonly BuyerPipelineStage[] = [
  "nouveau",
  "a_contacter",
  "contact_en_cours",
  "qualifie",
  "bien_a_proposer",
  "visite_a_planifier",
  "visite_planifiee",
  "suivi_apres_visite",
  "offre_en_cours",
  "acquereur_gagne",
  "perdu",
] as const;

export const buyerStageLabels: Record<string, string> = {
  nouveau: "Nouveau",
  a_contacter: "À contacter",
  contact_en_cours: "Contact en cours",
  qualifie: "Qualifié",
  bien_a_proposer: "Bien à proposer",
  visite_a_planifier: "Visite à planifier",
  visite_planifiee: "Visite planifiée",
  suivi_apres_visite: "Suivi après visite",
  offre_en_cours: "Offre en cours",
  acquereur_gagne: "Acquéreur gagné",
  perdu: "Perdu",
};

/** Colonnes du Kanban Acquéreurs : toutes les étapes, dans l'ordre du cycle. */
export const BUYER_KANBAN_COLUMNS: readonly BuyerPipelineStage[] = BUYER_PIPELINE_STAGES;

const BUYER_STAGE_VISUALS: Record<string, { cssVar: string; icon: string }> = {
  nouveau: { cssVar: "--crm-st-nouveau", icon: "✦" },
  a_contacter: { cssVar: "--crm-st-a_contacter", icon: "☎" },
  contact_en_cours: { cssVar: "--crm-st-contact", icon: "◗" },
  qualifie: { cssVar: "--crm-st-qualifie", icon: "◎" },
  bien_a_proposer: { cssVar: "--crm-st-estimation", icon: "◈" },
  visite_a_planifier: { cssVar: "--crm-st-a_contacter", icon: "◷" },
  visite_planifiee: { cssVar: "--crm-st-rdv_planifie", icon: "◷" },
  suivi_apres_visite: { cssVar: "--crm-st-rdv_realise", icon: "◆" },
  offre_en_cours: { cssVar: "--crm-st-proposition", icon: "✎" },
  acquereur_gagne: { cssVar: "--crm-st-signe", icon: "✔" },
  perdu: { cssVar: "--crm-st-perdu", icon: "✕" },
};

export function buyerStageVisual(stage: string): {
  cssVar: string;
  icon: string;
  label: string;
} {
  const v = BUYER_STAGE_VISUALS[stage] ?? { cssVar: "--crm-st-neutre", icon: "•" };
  return { ...v, label: buyerStageLabels[stage] ?? stage };
}

// --- Qualification HUMAINE (décision d'une personne, jamais un score) --------
export const buyerQualificationLabels: Record<BuyerQualificationStatus, string> = {
  non_qualifie: "Non qualifié",
  en_cours: "Qualification en cours",
  qualifie: "Qualifié",
  ecarte: "Écarté",
};

export const buyerQualificationVisual: Record<
  BuyerQualificationStatus,
  { cssVar: string; icon: string }
> = {
  non_qualifie: { cssVar: "--crm-st-neutre", icon: "○" },
  en_cours: { cssVar: "--crm-st-qualifie", icon: "◎" },
  qualifie: { cssVar: "--crm-st-signe", icon: "✔" },
  ecarte: { cssVar: "--crm-st-perdu", icon: "✕" },
};

// --- Recommandation opérationnelle (DÉRIVÉE des scores, ≠ qualification) -----
export const buyerRecommendedPriorityLabels: Record<BuyerRecommendedPriority, string> = {
  prioritaire: "Prioritaire",
  a_qualifier: "À qualifier",
  a_suivre: "À suivre",
};

export const buyerRecommendedPriorityVisual: Record<
  BuyerRecommendedPriority,
  { cssVar: string; icon: string }
> = {
  prioritaire: { cssVar: "--crm-st-signe", icon: "★" },
  a_qualifier: { cssVar: "--crm-st-qualifie", icon: "◎" },
  a_suivre: { cssVar: "--crm-st-neutre", icon: "•" },
};

// --- Résultat commercial du dossier ------------------------------------------
export const buyerOutcomeLabels: Record<string, string> = {
  gagne: "Acquéreur gagné",
  perdu: "Perdu",
};

// --- Responsabilités d'affectation -------------------------------------------
export const buyerResponsibilityLabels: Record<string, string> = {
  setter: "Setter",
  manager: "Manager",
  agent_immobilier: "Agent immobilier",
  responsable_marketing: "Responsable marketing",
};

// --- Matching : libellés des facteurs (miroir des tokens SQL) ----------------
export const buyerMatchFactorLabels: Record<BuyerMatchFactor, string> = {
  budget: "Budget",
  type_de_bien: "Type de bien",
  localisation: "Localisation",
  disponibilite: "Disponibilité",
};

export const buyerCriteriaSourceLabels: Record<string, string> = {
  funnel: "Amorcés depuis le funnel",
  humain: "Affinés par l’équipe",
  absent: "Aucun critère renseigné",
};

// --- Journal d'audit : libellés des événements acquéreur ---------------------
export const buyerAuditEventLabels: Record<string, string> = {
  acquereur_profil_cree: "Dossier acquéreur créé",
  acquereur_interet_rattache: "Nouvel intérêt rattaché",
  acquereur_stade: "Changement d’étape",
  acquereur_qualification: "Qualification",
  acquereur_affectation: "Affectation",
  acquereur_criteres: "Critères de recherche",
  acquereur_offre: "Offre en cours",
  acquereur_resultat: "Résultat commercial",
  acquereur_interet_statut: "Statut d’un intérêt",
};
