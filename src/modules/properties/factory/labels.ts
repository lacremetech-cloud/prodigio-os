/**
 * Libellés français et repères visuels de la **Fabrique de biens V1**.
 *
 * Source unique d'affichage : statuts du bien, catégories de médias / documents,
 * éléments du plan de production, statuts de production, statuts de droits, et
 * libellés des critères de « préparation au lancement ». Aucune valeur métier
 * codée en dur — uniquement de l'éditorial et des NOMS de variables CSS
 * thème-adaptatives (jamais de couleur brute), cohérents en clair et en sombre.
 *
 * Les couleurs réutilisent les tokens `--crm-st-*` déjà définis (design system
 * CRM V1.2) : la couleur n'est jamais le seul signal (toujours icône + libellé).
 */

import type {
  PropertyDocumentCategory,
  PropertyMediaKind,
  PropertyMediaRightsStatus,
  PropertyProductionKind,
  PropertyProductionStatus,
  PropertyStatus,
} from "@/lib/supabase/types";

export interface Visual {
  cssVar: string;
  icon: string;
}

// --- Statuts du bien (machine d'état) ----------------------------------------
export const propertyStatusLabels: Record<PropertyStatus, string> = {
  preparation_a_lancer: "À configurer",
  collecte_en_cours: "Collecte en cours",
  strategie_en_cours: "Stratégie en cours",
  production_en_cours: "Production en cours",
  validation_avant_lancement: "Validation avant lancement",
  pret_a_lancer: "Prêt à lancer",
  en_diffusion: "En diffusion",
  suspendu: "Suspendu",
  archive: "Archivé",
};

export const propertyStatusVisual: Record<PropertyStatus, Visual> = {
  preparation_a_lancer: { cssVar: "--crm-st-neutre", icon: "○" },
  collecte_en_cours: { cssVar: "--crm-st-nouveau", icon: "▤" },
  strategie_en_cours: { cssVar: "--crm-st-qualifie", icon: "◎" },
  production_en_cours: { cssVar: "--crm-st-rdv_planifie", icon: "⚙" },
  validation_avant_lancement: { cssVar: "--crm-st-proposition", icon: "⚑" },
  pret_a_lancer: { cssVar: "--crm-st-signe", icon: "✔" },
  en_diffusion: { cssVar: "--crm-st-eligibilite", icon: "★" },
  suspendu: { cssVar: "--crm-st-a_contacter", icon: "‖" },
  archive: { cssVar: "--crm-st-perdu", icon: "✕" },
};

/**
 * Ordre logique des statuts (progression). Sert à l'affichage du sélecteur de
 * transition ; la base reste l'autorité sur les transitions autorisées.
 */
export const PROPERTY_STATUS_ORDER: PropertyStatus[] = [
  "preparation_a_lancer",
  "collecte_en_cours",
  "strategie_en_cours",
  "production_en_cours",
  "validation_avant_lancement",
  "pret_a_lancer",
  "en_diffusion",
  "suspendu",
  "archive",
];

// --- Médias (médiathèque privée) ---------------------------------------------
export const mediaKindLabels: Record<PropertyMediaKind, string> = {
  photo: "Photo",
  video: "Vidéo",
  drone: "Drone",
  plan: "Plan",
  rendu: "Rendu 3D",
  couverture: "Couverture",
  autre: "Autre",
};

export const mediaRightsLabels: Record<PropertyMediaRightsStatus, string> = {
  a_verifier: "Droits à vérifier",
  libre: "Libre de droits",
  sous_licence: "Sous licence",
  restreint: "Usage restreint",
};

export const mediaRightsTone: Record<
  PropertyMediaRightsStatus,
  "neutral" | "ok" | "gold" | "danger"
> = {
  a_verifier: "gold",
  libre: "ok",
  sous_licence: "neutral",
  restreint: "danger",
};

// --- Documents ---------------------------------------------------------------
export const documentCategoryLabels: Record<PropertyDocumentCategory, string> = {
  mandat: "Mandat",
  diagnostic: "Diagnostics",
  plan: "Plans",
  titre: "Titre de propriété",
  legal: "Légal",
  copropriete: "Copropriété",
  autorisation: "Autorisations",
  libre: "Libres",
};

export const documentStatusLabels: Record<string, string> = {
  a_valider: "À valider",
  valide: "Validé",
  obsolete: "Obsolète",
};

export const documentVisibilityLabels: Record<string, string> = {
  interne: "Interne",
  restreint: "Restreint",
};

// --- Plan de production ------------------------------------------------------
export const productionKindLabels: Record<PropertyProductionKind, string> = {
  photographie: "Photographie",
  video: "Vidéo",
  drone: "Prises de vue drone",
  redaction: "Rédaction commerciale",
  positionnement: "Positionnement & stratégie",
  identite_visuelle: "Identité visuelle",
  site_dedie: "Site dédié",
  brochure: "Brochure",
  publicites: "Publicités",
  funnel_acquereur: "Funnel acquéreurs",
  validation_finale: "Validation finale",
};

/** Ordre d'affichage du plan de production. */
export const PRODUCTION_KIND_ORDER: PropertyProductionKind[] = [
  "photographie",
  "video",
  "drone",
  "redaction",
  "positionnement",
  "identite_visuelle",
  "site_dedie",
  "brochure",
  "publicites",
  "funnel_acquereur",
  "validation_finale",
];

export const productionStatusLabels: Record<PropertyProductionStatus, string> = {
  a_faire: "À faire",
  en_cours: "En cours",
  en_revue: "En revue",
  termine: "Terminé",
  valide: "Validé",
  bloque: "Bloqué",
};

export const productionStatusVisual: Record<PropertyProductionStatus, Visual> = {
  a_faire: { cssVar: "--crm-st-neutre", icon: "○" },
  en_cours: { cssVar: "--crm-st-rdv_planifie", icon: "◐" },
  en_revue: { cssVar: "--crm-st-qualifie", icon: "◎" },
  termine: { cssVar: "--crm-st-contact", icon: "◗" },
  valide: { cssVar: "--crm-st-signe", icon: "✔" },
  bloque: { cssVar: "--crm-st-perdu", icon: "⚠" },
};

// --- Critères de préparation au lancement (readiness) ------------------------
/**
 * Libellés lisibles des 7 critères calculés EN BASE par `crm_property_readiness`.
 * L'ordre correspond à l'affichage de la checklist. La base reste l'autorité :
 * ces libellés ne servent qu'à expliquer, jamais à décider.
 */
export const readinessCheckLabels: Record<string, string> = {
  identity: "Identité complète (nom, type, localisation, description)",
  positioning_validated: "Positionnement validé",
  main_media: "Image principale définie",
  photos: "Au moins une photo dans la médiathèque",
  mandate_document: "Document de mandat présent",
  deliverables: "Livrables clés validés (photo, rédaction, positionnement, validation finale)",
  responsible: "Responsable du bien désigné",
};

export const READINESS_CHECK_ORDER = [
  "identity",
  "positioning_validated",
  "main_media",
  "photos",
  "mandate_document",
  "deliverables",
  "responsible",
] as const;
