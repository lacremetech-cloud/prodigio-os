/**
 * Libellés FR et repères visuels de l'**expérience publique** & des **intérêts
 * acquéreurs** (côté CRM). Réutilise les tokens `--crm-st-*` du design system :
 * la couleur n'est jamais le seul signal (toujours icône + libellé).
 */

export type PublicationStatus =
  | "brouillon"
  | "en_preparation"
  | "pret_a_publier"
  | "publie"
  | "depublie"
  | "archive";

export const publicationStatusLabels: Record<PublicationStatus, string> = {
  brouillon: "Brouillon",
  en_preparation: "En préparation",
  pret_a_publier: "Prêt à publier",
  publie: "Publié",
  depublie: "Dépublié",
  archive: "Archivé",
};

export interface Visual {
  cssVar: string;
  icon: string;
}

export const publicationStatusVisual: Record<PublicationStatus, Visual> = {
  brouillon: { cssVar: "--crm-st-neutre", icon: "○" },
  en_preparation: { cssVar: "--crm-st-nouveau", icon: "▤" },
  pret_a_publier: { cssVar: "--crm-st-proposition", icon: "⚑" },
  publie: { cssVar: "--crm-st-signe", icon: "★" },
  depublie: { cssVar: "--crm-st-a_contacter", icon: "‖" },
  archive: { cssVar: "--crm-st-perdu", icon: "✕" },
};

/** Critères calculés en base par `crm_property_public_readiness`. */
export const publicReadinessCheckLabels: Record<string, string> = {
  internal_readiness: "Readiness interne du bien satisfaite",
  positioning_validated: "Positionnement (Fabrique) validé",
  public_title: "Titre public renseigné",
  intro: "Introduction renseignée",
  slug: "Slug public défini",
  content_validated: "Contenu public validé",
  main_public_media: "Image principale publique approuvée",
  approved_media: "Médias à diffuser approuvés",
  privacy_defined: "Confidentialité définie (localisation approx.)",
  cta: "CTA acquéreur configuré",
};

export const PUBLIC_READINESS_CHECK_ORDER = [
  "internal_readiness",
  "positioning_validated",
  "public_title",
  "intro",
  "slug",
  "content_validated",
  "main_public_media",
  "approved_media",
  "privacy_defined",
  "cta",
] as const;

// --- Intérêts acquéreurs -----------------------------------------------------
export type BuyerReviewStatus = "nouveau" | "consulte" | "traite";

export const buyerReviewStatusLabels: Record<BuyerReviewStatus, string> = {
  nouveau: "Nouveau",
  consulte: "Consulté",
  traite: "Traité",
};

export const buyerReviewStatusVisual: Record<BuyerReviewStatus, Visual> = {
  nouveau: { cssVar: "--crm-st-nouveau", icon: "●" },
  consulte: { cssVar: "--crm-st-qualifie", icon: "◎" },
  traite: { cssVar: "--crm-st-signe", icon: "✔" },
};

export const buyerPriorityLabels: Record<string, string> = {
  prioritaire: "Prioritaire",
  a_qualifier: "À qualifier",
  a_suivre: "À suivre",
};

export const buyerPriorityVisual: Record<string, Visual> = {
  prioritaire: { cssVar: "--crm-st-signe", icon: "★" },
  a_qualifier: { cssVar: "--crm-st-qualifie", icon: "◐" },
  a_suivre: { cssVar: "--crm-st-neutre", icon: "○" },
};

export const mediaKindPublicLabels: Record<string, string> = {
  photo: "Photo",
  video: "Vidéo",
  drone: "Drone",
  rendu: "Rendu 3D",
  plan: "Plan",
  couverture: "Couverture",
};
