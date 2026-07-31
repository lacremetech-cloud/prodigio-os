/**
 * Libellés français du cycle « estimation → éligibilité → mandat → bien ».
 * Source unique d'affichage ; les tokens restent alignés sur les contraintes SQL.
 * Aucune valeur économique ni juridique codée en dur — uniquement de l'éditorial.
 */

// --- Résultat du rendez-vous d'estimation ------------------------------------
export const estimationOutcomeLabels: Record<string, string> = {
  realisee: "Estimation réalisée",
  proprietaire_absent: "Propriétaire absent",
  rdv_annule: "Rendez-vous annulé",
  estimation_impossible: "Estimation impossible",
  nouveau_rdv_necessaire: "Nouveau rendez-vous nécessaire",
};

// --- Décision d'éligibilité (validation humaine, ≠ segment) ------------------
export const eligibilityDecisionLabels: Record<string, string> = {
  parcours_premium_prodigio: "Parcours premium Prodigio",
  agence_classique: "Circuit agence classique",
  non_retenu: "Non retenu",
  a_completer: "À compléter",
};

export const eligibilityDecisionTone: Record<string, "gold" | "ok" | "neutral" | "danger"> = {
  parcours_premium_prodigio: "gold",
  agence_classique: "ok",
  non_retenu: "danger",
  a_completer: "neutral",
};

// --- Statuts de mandat -------------------------------------------------------
export const mandateStatusLabels: Record<string, string> = {
  brouillon: "Brouillon",
  propose: "Proposé",
  en_attente_signature: "En attente de signature",
  signe: "Signé",
  refuse: "Refusé",
  expire: "Expiré",
  annule: "Annulé",
};

export const mandateStatusTone: Record<string, "gold" | "ok" | "neutral" | "danger"> = {
  brouillon: "neutral",
  propose: "gold",
  en_attente_signature: "gold",
  signe: "ok",
  refuse: "danger",
  expire: "danger",
  annule: "danger",
};

// --- Base des honoraires (partage économique — jamais liée à la valeur du bien) --
export const feeBasisLabels: Record<string, string> = {
  HT: "Hors taxes (HT)",
  TTC: "Toutes taxes comprises (TTC)",
  a_confirmer: "À confirmer",
};

// --- Types de document -------------------------------------------------------
export const documentKindLabels: Record<string, string> = {
  mandat_propose: "Mandat proposé",
  mandat_signe: "Mandat signé",
  estimation_avis_valeur: "Avis de valeur",
  piece_interne: "Pièce interne",
};

// --- Statut du bien (Fabrique de biens) --------------------------------------
export const propertyStatusLabels: Record<string, string> = {
  preparation_a_lancer: "Préparation à lancer",
};

/**
 * Segments disponibles pour une règle économique. Réutilise les tokens de segment
 * du CRM (source : `crm/labels`), mais laissés libres à la saisie côté admin.
 */
export const economicRuleStatusLabels: Record<string, string> = {
  actif: "Active",
  inactif: "Inactive",
};
