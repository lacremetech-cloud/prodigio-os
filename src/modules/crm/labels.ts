import {
  mandateSituationLabels,
  propertyTypeLabels,
  saleHorizonLabels,
  valueBandLabels,
} from "@/modules/mandates/funnel/content";
import type { CrmRole } from "./auth/roles";

/**
 * Libellés français du CRM (source unique). Les valeurs normalisées (tokens)
 * restent alignées sur les contraintes SQL ; ici uniquement l'affichage. On
 * réutilise les libellés publics du funnel (`content.ts`) là où c'est pertinent.
 */

// --- Stades du pipeline (ordre = progression) --------------------------------
export const PIPELINE_STAGES = [
  "nouveau",
  "prise_de_contact_en_cours",
  "contact_etabli",
  "qualification_en_cours",
  "rendez_vous_planifie",
  "rendez_vous_realise",
  "estimation_etude_dossier",
  "proposition_de_mandat",
  "en_attente_de_signature",
  "mandat_signe",
  "perdu",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const stageLabels: Record<string, string> = {
  nouveau: "Nouveau",
  prise_de_contact_en_cours: "À contacter",
  contact_etabli: "Contacté",
  qualification_en_cours: "Qualifié",
  rendez_vous_planifie: "Rendez-vous planifié",
  rendez_vous_realise: "Rendez-vous réalisé",
  estimation_etude_dossier: "Estimation",
  proposition_de_mandat: "Mandat proposé",
  en_attente_de_signature: "En attente de signature",
  mandat_signe: "Mandat signé",
  perdu: "Perdu ou disqualifié",
};

/**
 * Colonnes du Kanban V1 (docs — pipeline V1 demandé). On regroupe
 * « rendez_vous_realise » et « en_attente_de_signature » dans les colonnes
 * voisines pour rester lisible sans perdre la granularité des stades.
 */
export const KANBAN_COLUMNS: PipelineStage[] = [
  "nouveau",
  "prise_de_contact_en_cours",
  "contact_etabli",
  "qualification_en_cours",
  "rendez_vous_planifie",
  "estimation_etude_dossier",
  "proposition_de_mandat",
  "mandat_signe",
  "perdu",
];

// --- Segments (distincts des stades) -----------------------------------------
export const segmentLabels: Record<string, string> = {
  non_determine: "Non déterminé",
  cible_prodigio_premium: "Cible Prodigio premium",
  agence_partenaire_classique: "Agence partenaire classique",
  hors_perimetre: "Hors périmètre",
  a_reevaluer: "À réévaluer",
};

// --- Priorité opérationnelle (recommandation du scoring) ---------------------
export const priorityLabels: Record<string, string> = {
  rappel_prioritaire: "Rappel prioritaire",
  nurturing: "Nurturing",
  circuit_partenaire: "Circuit partenaire",
  suivi_long_terme: "Suivi long terme",
};

// Poids d'urgence pour le tri « fort potentiel » / priorités.
export const priorityWeight: Record<string, number> = {
  rappel_prioritaire: 3,
  circuit_partenaire: 2,
  nurturing: 1,
  suivi_long_terme: 0,
};

// --- Appréciation publique (montrée au propriétaire) -------------------------
export const appreciationLabels: Record<string, string> = {
  fort_potentiel: "Fort potentiel",
  a_confirmer: "À confirmer",
  analyse_personnalisee: "Analyse personnalisée",
};

// --- Préférences de contact / rappel -----------------------------------------
export const contactPreferenceLabels: Record<string, string> = {
  telephone: "Par téléphone",
  email: "Par e-mail",
  indifferent: "Indifférent",
};

export const recallPreferenceLabels: Record<string, string> = {
  des_que_possible: "Dès que possible",
  matin: "Le matin",
  apres_midi: "L'après-midi",
  debut_soiree: "En début de soirée",
};

// --- Activités ---------------------------------------------------------------
export const activityTypeLabels: Record<string, string> = {
  appel: "Appel",
  tentative_appel: "Tentative d'appel",
  email: "E-mail",
  sms_whatsapp: "SMS / WhatsApp",
  rendez_vous: "Rendez-vous",
  note: "Note",
  autre: "Autre",
};

export const activityOutcomeLabels: Record<string, string> = {
  sans_reponse: "Sans réponse",
  message_laisse: "Message laissé",
  rappel_demande: "Rappel demandé",
  contact_etabli: "Contact établi",
  mauvais_numero: "Mauvais numéro",
};

// --- Résultat commercial -----------------------------------------------------
export const outcomeLabels: Record<string, string> = {
  signe_gagne: "Signé / gagné",
  refuse_apres_proposition: "Refusé après proposition",
  perdu_avant_signature: "Perdu ou disqualifié avant signature",
};

// --- Rôles & responsabilités -------------------------------------------------
export const roleLabels: Record<CrmRole, string> = {
  administrateur: "Administrateur",
  manager: "Manager",
  setter: "Setter",
  agent_immobilier: "Agent immobilier",
  partenaire_lecture: "Partenaire (lecture)",
};

export const responsibilityLabels: Record<string, string> = {
  setter: "Setter",
  manager: "Manager",
  agent_immobilier: "Agent immobilier",
  responsable_marketing: "Responsable marketing",
};

export const auditEventLabels: Record<string, string> = {
  creation: "Création",
  changement_stade: "Changement de stade",
  changement_segment: "Changement de segment",
  changement_affectation: "Changement d'affectation",
  changement_permission: "Changement de permission",
  resolution_doublon: "Résolution de doublon",
  resultat_commercial: "Résultat commercial",
  // Cycle estimation → mandat → bien
  estimation_realisee: "Estimation réalisée",
  decision_eligibilite: "Décision d'éligibilité",
  regle_economique_maj: "Règle économique",
  mandat_brouillon: "Mandat — brouillon",
  mandat_propose: "Mandat proposé",
  mandat_signe: "Mandat signé",
  mandat_refuse: "Mandat refusé",
  mandat_expire: "Mandat expiré",
  mandat_annule: "Mandat annulé",
  document_ajoute: "Document ajouté",
  document_remplace: "Document remplacé",
  document_supprime: "Document supprimé",
  bien_cree: "Bien créé",
  // Rendez-vous d'estimation
  estimation_planifiee: "Estimation planifiée",
  estimation_replanifiee: "Estimation reportée",
  estimation_annulee: "Estimation annulée",
  estimation_resultat: "Résultat de rendez-vous",
};

export const auditEntityLabels: Record<string, string> = {
  opportunity: "Opportunité",
  contact: "Contact",
  membership: "Membre",
  organization: "Organisation",
};

// --- Réexports des libellés funnel (bien candidat / projet) ------------------
export const propertyLabel = (token: string | null | undefined): string | null =>
  token && token in propertyTypeLabels
    ? propertyTypeLabels[token as keyof typeof propertyTypeLabels].label
    : null;

export const valueBandLabel = (token: string | null | undefined): string | null =>
  token && token in valueBandLabels
    ? valueBandLabels[token as keyof typeof valueBandLabels]
    : null;

export const saleHorizonLabel = (token: string | null | undefined): string | null =>
  token && token in saleHorizonLabels
    ? saleHorizonLabels[token as keyof typeof saleHorizonLabels]
    : null;

export const mandateSituationLabel = (
  token: string | null | undefined,
): string | null =>
  token && token in mandateSituationLabels
    ? mandateSituationLabels[token as keyof typeof mandateSituationLabels]
    : null;

/** Petite aide générique : renvoie le libellé, à défaut le token, à défaut « — ». */
export function label(
  map: Record<string, string>,
  token: string | null | undefined,
): string {
  if (!token) return "—";
  return map[token] ?? token;
}
