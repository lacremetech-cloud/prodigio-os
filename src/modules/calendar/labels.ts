/**
 * Libellés français des rendez-vous d'estimation et des connexions calendrier.
 * Source unique d'affichage : les valeurs normalisées (tokens) restent alignées
 * sur les contraintes SQL ; ici uniquement le rendu en français.
 */

import type { EstimationAppointmentStatus } from "@/lib/supabase/types";

export const appointmentStatusLabels: Record<EstimationAppointmentStatus, string> = {
  planifie: "Planifié",
  confirme: "Confirmé",
  realise: "Réalisé",
  annule: "Annulé",
  absent: "Absent",
  a_replanifier: "À replanifier",
};

/** Tonalité visuelle par statut, alignée sur les variantes de `Chip`. */
export const appointmentStatusTone: Record<
  EstimationAppointmentStatus,
  "neutral" | "gold" | "danger" | "ok"
> = {
  planifie: "gold",
  confirme: "ok",
  realise: "ok",
  annule: "danger",
  absent: "danger",
  a_replanifier: "neutral",
};

export const connectionStatusLabels: Record<string, string> = {
  connecte: "Connecté",
  deconnecte: "Déconnecté",
  erreur: "Erreur",
  revoque: "Accès révoqué",
};

/** Résultats sélectionnables depuis la fiche (après le rendez-vous). */
export const appointmentResultOptions: {
  value: EstimationAppointmentStatus;
  label: string;
}[] = [
  { value: "realise", label: "Réalisé" },
  { value: "absent", label: "Absent (propriétaire)" },
  { value: "a_replanifier", label: "À replanifier" },
  { value: "confirme", label: "Confirmé par le propriétaire" },
];
