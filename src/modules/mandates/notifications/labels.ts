import {
  mandateSituationLabels,
  propertyTypeLabels,
  saleHorizonLabels,
  valueBandLabels,
} from "../funnel/content";
import type {
  AppreciationKey,
  PriorityKey,
} from "../scoring";

/**
 * Libellés **humains** (français) pour l'alerte Slack. Aucun code technique brut
 * (jamais `fort_potentiel` / `rappel_prioritaire` seuls). Volontairement local au
 * module notifications : le funnel ne dépend pas du module CRM.
 *
 * Les libellés « bien candidat » (type / valeur / horizon / situation) sont
 * réutilisés depuis le contenu éditorial du funnel (`content.ts`).
 */

export const priorityLabelsFr: Record<PriorityKey, string> = {
  rappel_prioritaire: "Rappel prioritaire",
  nurturing: "Nurturing",
  circuit_partenaire: "Circuit partenaire",
  suivi_long_terme: "Suivi long terme",
};

export const appreciationLabelsFr: Record<AppreciationKey, string> = {
  fort_potentiel: "Fort potentiel",
  a_confirmer: "À confirmer",
  analyse_personnalisee: "Analyse personnalisée",
};

export const contactPreferenceLabelsFr: Record<string, string> = {
  telephone: "Téléphone",
  email: "E-mail",
  indifferent: "Indifférent",
};

export const recallPreferenceLabelsFr: Record<string, string> = {
  des_que_possible: "Dès que possible",
  matin: "Le matin",
  apres_midi: "L'après-midi",
  debut_soiree: "En début de soirée",
};

export function propertyTypeLabel(token: string | null | undefined): string | null {
  return token && token in propertyTypeLabels
    ? propertyTypeLabels[token as keyof typeof propertyTypeLabels].label
    : null;
}

export function valueBandLabel(token: string | null | undefined): string | null {
  return token && token in valueBandLabels
    ? valueBandLabels[token as keyof typeof valueBandLabels]
    : null;
}

export function saleHorizonLabel(token: string | null | undefined): string | null {
  return token && token in saleHorizonLabels
    ? saleHorizonLabels[token as keyof typeof saleHorizonLabels]
    : null;
}

export function mandateSituationLabel(
  token: string | null | undefined,
): string | null {
  return token && token in mandateSituationLabels
    ? mandateSituationLabels[token as keyof typeof mandateSituationLabels]
    : null;
}

export function contactPreferenceLabel(
  token: string | null | undefined,
): string | null {
  return token ? contactPreferenceLabelsFr[token] ?? null : null;
}

export function recallPreferenceLabel(
  token: string | null | undefined,
): string | null {
  return token ? recallPreferenceLabelsFr[token] ?? null : null;
}
