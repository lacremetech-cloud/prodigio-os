/**
 * Source **centralisée** des couleurs, icônes et libellés des statuts métier.
 * Réutilisée partout (badges, Kanban, Agenda, fiche, dashboard, tâches,
 * activité, filtres). La couleur n'est **jamais** le seul signal : chaque statut
 * porte aussi une icône et un libellé.
 *
 * Les couleurs sont des **variables CSS thème-adaptatives** (`--crm-st-*`,
 * `--crm-info/success/warning/danger`) : ce module ne renvoie que le NOM de la
 * variable, jamais une valeur brute — clair et sombre restent cohérents.
 */

import { stageLabels } from "./labels";

export interface StatusVisual {
  /** Nom de variable CSS de l'accent (ex. `--crm-st-nouveau`). */
  cssVar: string;
  icon: string;
  label: string;
}

/** Renvoie `var(--x)` prêt à injecter en style inline. */
export function cssVarRef(cssVar: string): string {
  return `var(${cssVar})`;
}

// --- Stades du pipeline ------------------------------------------------------
const STAGE_VISUALS: Record<string, { cssVar: string; icon: string }> = {
  nouveau: { cssVar: "--crm-st-nouveau", icon: "✦" },
  prise_de_contact_en_cours: { cssVar: "--crm-st-a_contacter", icon: "☎" },
  contact_etabli: { cssVar: "--crm-st-contact", icon: "◗" },
  qualification_en_cours: { cssVar: "--crm-st-qualifie", icon: "◎" },
  rendez_vous_planifie: { cssVar: "--crm-st-rdv_planifie", icon: "◷" },
  rendez_vous_realise: { cssVar: "--crm-st-rdv_realise", icon: "◆" },
  estimation_etude_dossier: { cssVar: "--crm-st-estimation", icon: "⚖" },
  proposition_de_mandat: { cssVar: "--crm-st-proposition", icon: "✎" },
  en_attente_de_signature: { cssVar: "--crm-st-attente_signature", icon: "✒" },
  mandat_signe: { cssVar: "--crm-st-signe", icon: "✔" },
  perdu: { cssVar: "--crm-st-perdu", icon: "✕" },
};

export function stageVisual(stage: string): StatusVisual {
  const v = STAGE_VISUALS[stage] ?? { cssVar: "--crm-st-neutre", icon: "•" };
  return { cssVar: v.cssVar, icon: v.icon, label: stageLabels[stage] ?? stage };
}

// --- Statuts de rendez-vous d'estimation -------------------------------------
const APPOINTMENT_VISUALS: Record<string, { cssVar: string; icon: string }> = {
  planifie: { cssVar: "--crm-st-rdv_planifie", icon: "◷" },
  confirme: { cssVar: "--crm-st-signe", icon: "✓" },
  realise: { cssVar: "--crm-st-rdv_realise", icon: "◆" },
  a_replanifier: { cssVar: "--crm-st-a_contacter", icon: "↻" },
  annule: { cssVar: "--crm-st-perdu", icon: "✕" },
  absent: { cssVar: "--crm-st-perdu", icon: "⚠" },
};

export function appointmentVisual(status: string): { cssVar: string; icon: string } {
  return APPOINTMENT_VISUALS[status] ?? { cssVar: "--crm-st-neutre", icon: "•" };
}

// --- Décision d'éligibilité --------------------------------------------------
const ELIGIBILITY_VISUALS: Record<string, { cssVar: string; icon: string }> = {
  parcours_premium_prodigio: { cssVar: "--crm-st-eligibilite", icon: "★" },
  agence_classique: { cssVar: "--crm-st-signe", icon: "✓" },
  non_retenu: { cssVar: "--crm-st-perdu", icon: "✕" },
  a_completer: { cssVar: "--crm-st-neutre", icon: "…" },
};
export function eligibilityVisual(decision: string): { cssVar: string; icon: string } {
  return ELIGIBILITY_VISUALS[decision] ?? { cssVar: "--crm-st-neutre", icon: "•" };
}

// --- Types d'événements de la timeline ---------------------------------------
export type TimelineKind =
  | "appel"
  | "email"
  | "rendez_vous"
  | "note"
  | "stade"
  | "segment"
  | "affectation"
  | "resultat"
  | "estimation"
  | "eligibilite"
  | "mandat"
  | "document"
  | "tache"
  | "audit";

const TIMELINE_VISUALS: Record<TimelineKind, { cssVar: string; icon: string }> = {
  appel: { cssVar: "--crm-st-contact", icon: "☎" },
  email: { cssVar: "--crm-st-nouveau", icon: "✉" },
  rendez_vous: { cssVar: "--crm-st-rdv_planifie", icon: "◷" },
  note: { cssVar: "--crm-st-neutre", icon: "✎" },
  stade: { cssVar: "--crm-st-qualifie", icon: "⇄" },
  segment: { cssVar: "--crm-st-estimation", icon: "⇆" },
  affectation: { cssVar: "--crm-st-rdv_planifie", icon: "☰" },
  resultat: { cssVar: "--crm-st-eligibilite", icon: "★" },
  estimation: { cssVar: "--crm-st-estimation", icon: "⚖" },
  eligibilite: { cssVar: "--crm-st-eligibilite", icon: "✓" },
  mandat: { cssVar: "--crm-st-proposition", icon: "✒" },
  document: { cssVar: "--crm-st-contact", icon: "📄" },
  tache: { cssVar: "--crm-st-a_contacter", icon: "✓" },
  audit: { cssVar: "--crm-st-neutre", icon: "◦" },
};

export function timelineKindVisual(kind: TimelineKind): { cssVar: string; icon: string } {
  return TIMELINE_VISUALS[kind] ?? TIMELINE_VISUALS.audit;
}

export const TIMELINE_KIND_LABELS: Record<TimelineKind, string> = {
  appel: "Appel",
  email: "E-mail",
  rendez_vous: "Rendez-vous",
  note: "Note",
  stade: "Changement de stade",
  segment: "Changement de segment",
  affectation: "Affectation",
  resultat: "Résultat commercial",
  estimation: "Estimation",
  eligibilite: "Éligibilité",
  mandat: "Mandat",
  document: "Document",
  tache: "Tâche",
  audit: "Audit",
};
