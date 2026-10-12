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
  "a_rappeler",
  "en_discussion",
  "visite",
  "offre",
  "gagne",
  "perdu",
  "vivier",
] as const;

/**
 * Huit colonnes, chacune repondant a « quelle est ma prochaine action ».
 *
 * Il y en avait onze, dont quatre — a contacter, contact en cours, qualifie,
 * bien a proposer — decrivaient un seul moment reel : on lui parle. Au-dela de
 * sept ou huit colonnes, chacun invente sa propre regle de rangement et le
 * tableau cesse de dire la verite.
 *
 * « Visite » couvre a planifier, planifiee et le suivi d'apres-visite : c'est
 * la date portee par la carte qui les distingue, pas trois colonnes.
 *
 * « Vivier » est la reponse a un besoin que rien ne couvrait : la personne qui
 * n'achetera pas CE bien mais qu'on rappellera au suivant. Elle finissait en
 * « Perdu », qui l'enterrait.
 */
export const buyerStageLabels: Record<string, string> = {
  nouveau: "Nouveau",
  a_rappeler: "À rappeler",
  en_discussion: "En discussion",
  visite: "Visite",
  offre: "Offre",
  gagne: "Gagné",
  perdu: "Perdu",
  vivier: "Vivier",
};

/** Colonnes du Kanban Acquéreurs : toutes les étapes, dans l'ordre du cycle. */
export const BUYER_KANBAN_COLUMNS: readonly BuyerPipelineStage[] = BUYER_PIPELINE_STAGES;

const BUYER_STAGE_VISUALS: Record<string, { cssVar: string; icon: string }> = {
  nouveau: { cssVar: "--crm-st-nouveau", icon: "✦" },
  a_rappeler: { cssVar: "--crm-st-a_contacter", icon: "☎" },
  en_discussion: { cssVar: "--crm-st-contact", icon: "◗" },
  visite: { cssVar: "--crm-st-rdv_planifie", icon: "◷" },
  offre: { cssVar: "--crm-st-proposition", icon: "✎" },
  gagne: { cssVar: "--crm-st-signe", icon: "✔" },
  perdu: { cssVar: "--crm-st-perdu", icon: "✕" },
  vivier: { cssVar: "--crm-st-qualifie", icon: "◈" },
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
