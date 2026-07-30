/**
 * Paramètres de planification des estimations.
 *
 * Ces règles métier (durée, horaires de travail, délai minimum, marges, fuseau)
 * sont **configurables** et NE sont PAS codées en dur de façon irréversible : ce
 * module en est la source unique et documentée. À terme, elles pourront être
 * surchargées par organisation / par agent (table versionnée) sans réécrire le
 * module de disponibilités — `resolveSchedulingConfig()` est le point d'entrée
 * prévu pour cette évolution.
 *
 * Aucun paramètre économique (seuil premium, partages, HT/TTC) ici : uniquement
 * l'ergonomie de prise de rendez-vous.
 */

export interface EstimationSchedulingConfig {
  /** Fuseau horaire de référence pour l'affichage et le calcul des créneaux. */
  timeZone: string;
  /** Durée par défaut d'une estimation, en minutes. */
  defaultDurationMinutes: number;
  /** Pas de proposition des créneaux, en minutes (grille d'affichage). */
  slotGranularityMinutes: number;
  /** Plage de travail quotidienne (heure locale, format « HH:MM »). */
  workingHours: { start: string; end: string };
  /** Jours ouvrés (0 = dimanche … 6 = samedi). */
  workingDays: number[];
  /** Délai minimum entre « maintenant » et le début d'un rendez-vous (minutes). */
  minLeadMinutes: number;
  /** Marge tampon libre AVANT un rendez-vous (minutes). */
  marginBeforeMinutes: number;
  /** Marge tampon libre APRÈS un rendez-vous (minutes). */
  marginAfterMinutes: number;
  /** Horizon maximum de réservation à l'avance (jours). */
  maxAdvanceDays: number;
}

/**
 * Valeurs par défaut (V1). Modifiables ici sans toucher au code de calcul.
 * Hypothèses de travail — à ajuster avec l'équipe : estimation de 90 min,
 * 9 h–19 h du lundi au samedi, 2 h de délai minimum, 15 min de marge de part et
 * d'autre, fuseau Europe/Paris, réservation jusqu'à 60 jours à l'avance.
 */
export const DEFAULT_ESTIMATION_CONFIG: EstimationSchedulingConfig = {
  timeZone: "Europe/Paris",
  defaultDurationMinutes: 90,
  slotGranularityMinutes: 30,
  workingHours: { start: "09:00", end: "19:00" },
  workingDays: [1, 2, 3, 4, 5, 6],
  minLeadMinutes: 120,
  marginBeforeMinutes: 15,
  marginAfterMinutes: 15,
  maxAdvanceDays: 60,
};

/**
 * Résout la configuration applicable. En V1, renvoie les valeurs par défaut
 * (éventuellement complétées par des surcharges partielles). Signature stable
 * pour brancher plus tard une configuration par organisation / agent sans
 * réécrire les appelants.
 */
export function resolveSchedulingConfig(
  overrides?: Partial<EstimationSchedulingConfig>,
): EstimationSchedulingConfig {
  return { ...DEFAULT_ESTIMATION_CONFIG, ...(overrides ?? {}) };
}
