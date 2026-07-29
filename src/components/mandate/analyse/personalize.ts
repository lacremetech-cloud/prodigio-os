import {
  valueBandLabels,
  type PropertyType,
  type ValueBand,
} from "@/modules/mandates/funnel";
import type { DraftAnswers } from "./use-analyse-machine";

/**
 * Personnalisation discrète des transitions et du récapitulatif à partir des
 * réponses déjà données. Jamais de faux score, de faux taux d'acceptation, ni de
 * prétention à une analyse humaine déjà réalisée — de simples reformulations.
 */

const nouns: Record<PropertyType, { noun: string; feminine: boolean }> = {
  villa_architecte: { noun: "villa", feminine: true },
  appartement_exception: { noun: "appartement", feminine: false },
  chalet: { noun: "chalet", feminine: false },
  domaine_caractere: { noun: "domaine", feminine: false },
  autre: { noun: "propriété", feminine: true },
};

/** « Votre villa », « Votre chalet »… selon le type choisi. */
export function propertyLabel(propertyType?: PropertyType): string {
  if (!propertyType) return "Votre propriété";
  return `Votre ${nouns[propertyType].noun}`;
}

/** « Votre villa située à Montpellier » lorsque la localisation est connue. */
export function locatedPhrase(draft: DraftAnswers): string | null {
  if (!draft.propertyType) return null;
  const { noun, feminine } = nouns[draft.propertyType];
  const city = draft.location.city.trim();
  const base = `Votre ${noun}`;
  if (!city) return base;
  const situe = feminine ? "située" : "situé";
  return `${base} ${situe} à ${city}`;
}

/** « Votre propriété, estimée entre 1,2 et 2 millions d'euros ». */
export function valuePhrase(valueBand?: ValueBand): string | null {
  if (!valueBand) return null;
  if (valueBand === "accompagnement_estimation") {
    return "Votre propriété, dont vous souhaitez affiner l'estimation";
  }
  const label = valueBandLabels[valueBand];
  const lowered = label.charAt(0).toLowerCase() + label.slice(1);
  return `Votre propriété, estimée ${lowered}`;
}
