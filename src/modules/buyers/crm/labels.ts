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

import { ETAPES } from "./vocabulaire";
import type {
  BuyerMatchFactor,
  BuyerPipelineStage,
  BuyerQualificationStatus,
  BuyerRecommendedPriority,
} from "@/lib/supabase/types";

// --- Étapes de traitement ----------------------------------------------------
/* La liste, les libellés et les couleurs vivent dans `vocabulaire.ts`, seul
   endroit où elles sont écrites. Ce fichier les ré-expose sous les noms que
   les écrans utilisent déjà, pour que la bascule ne demande pas de toucher à
   treize composants le même jour. */
export const BUYER_PIPELINE_STAGES = ETAPES.map((e) => e.valeur);

export const buyerStageLabels: Record<string, string> = {
  ...Object.fromEntries(ETAPES.map((e) => [e.valeur, e.label])),
  /* L'ancien vocabulaire reste traduit : il subsiste sur les manifestations,
     figé, et un historique qui afficherait « nouveau » en brut serait pire
     qu'un historique traduit. */
  nouveau: "À contacter",
  visite: "Visite planifiée",
  offre: "En discussion",
  gagne: "En discussion",
  perdu: "Pas intéressé",
};

/** Colonnes du Kanban Acquéreurs : les sept étapes, dans l'ordre du cycle. */
export const BUYER_KANBAN_COLUMNS = BUYER_PIPELINE_STAGES;

const BUYER_STAGE_VISUALS: Record<string, { cssVar: string; icon: string }> = {
  a_contacter: { cssVar: "--crm-acq-a_contacter", icon: "✦" },
  a_rappeler: { cssVar: "--crm-acq-a_rappeler", icon: "☎︎" },
  en_discussion: { cssVar: "--crm-acq-en_discussion", icon: "◗" },
  visite_planifiee: { cssVar: "--crm-acq-visite_planifiee", icon: "◷" },
  vivier: { cssVar: "--crm-acq-vivier", icon: "◈" },
  pas_interesse: { cssVar: "--crm-acq-pas_interesse", icon: "✕" },
  mauvais_numero: { cssVar: "--crm-acq-mauvais_numero", icon: "⊘" },
  // Ancien vocabulaire, figé sur les manifestations.
  nouveau: { cssVar: "--crm-acq-a_contacter", icon: "✦" },
  visite: { cssVar: "--crm-acq-visite_planifiee", icon: "◷" },
  offre: { cssVar: "--crm-acq-en_discussion", icon: "◗" },
  gagne: { cssVar: "--crm-acq-en_discussion", icon: "◗" },
  perdu: { cssVar: "--crm-acq-pas_interesse", icon: "✕" },
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
  qualifie: { cssVar: "--crm-st-signe", icon: "✔︎" },
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
  /* L'événement le plus fréquent du journal, et le seul qui n'avait pas de
     libellé : la fiche affichait « acquereur_traitement » en clair. */
  acquereur_traitement: "Suivi enregistré",
  acquereur_tache: "Tâche",
  acquereur_reouverture: "Dossier rouvert",
  acquereur_archive: "Contact archivé",
  acquereur_desarchive: "Contact rétabli",
};
