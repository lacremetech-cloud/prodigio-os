/**
 * Matching biens ↔ acquéreurs — **fondation V1**, côté application.
 *
 * Le calcul lui-même vit EN BASE (`crm_buyer_property_matches`, versionné
 * `buyer-matching-v1`) : c'est la seule source de vérité, le navigateur ne peut
 * ni injecter ni modifier un résultat. Ce module ne fait que **typer, valider et
 * expliquer** ce que la base a calculé.
 *
 * Propriétés garanties (voir docs/20) :
 *   • déterministe — mêmes critères + mêmes biens ⇒ même résultat ;
 *   • explicable — facteurs positifs, incompatibilités et données manquantes
 *     sont énumérés séparément, jamais résumés en un score opaque ;
 *   • versionné — le numéro de version accompagne chaque résultat ;
 *   • **distinct du scoring du funnel** (qui qualifie la DEMANDE ; ici on
 *     compare des critères explicites à des biens réels) ;
 *   • **recommandation, jamais décision** — aucune action n'est déclenchée
 *     automatiquement, aucune boîte noire, aucune IA.
 */

import type {
  BuyerMatchFactor,
  BuyerMatchItem,
  BuyerMatchResult,
} from "@/lib/supabase/types";
import { buyerMatchFactorLabels } from "./labels";

export const BUYER_MATCHING_VERSION = "buyer-matching-v1";

const FACTORS: readonly BuyerMatchFactor[] = [
  "budget",
  "type_de_bien",
  "localisation",
  "disponibilite",
] as const;

function toFactors(value: unknown): BuyerMatchFactor[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is BuyerMatchFactor =>
    (FACTORS as readonly string[]).includes(v as string),
  );
}

function toNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Valide et normalise la charge JSON renvoyée par la base. Toute forme
 * inattendue dégrade proprement vers un résultat vide plutôt que de laisser
 * passer une donnée non typée dans l'interface.
 */
export function parseMatchResult(raw: unknown): BuyerMatchResult {
  const empty: BuyerMatchResult = {
    version: BUYER_MATCHING_VERSION,
    criteria_source: "absent",
    weights: { budget: 40, type_de_bien: 25, localisation: 25, disponibilite: 10 },
    items: [],
  };
  if (!raw || typeof raw !== "object") return empty;
  const obj = raw as Record<string, unknown>;

  const source = obj.criteria_source;
  const criteriaSource: BuyerMatchResult["criteria_source"] =
    source === "funnel" || source === "humain" ? source : "absent";

  const items: BuyerMatchItem[] = Array.isArray(obj.items)
    ? obj.items.flatMap((entry): BuyerMatchItem[] => {
        if (!entry || typeof entry !== "object") return [];
        const it = entry as Record<string, unknown>;
        const propertyId = toNullableString(it.property_id);
        if (!propertyId) return [];
        return [
          {
            property_id: propertyId,
            name: toNullableString(it.name) ?? "Bien sans nom",
            slug: toNullableString(it.slug),
            property_type: toNullableString(it.property_type),
            city: toNullableString(it.city),
            publication_status: toNullableString(it.publication_status),
            score: toNullableNumber(it.score),
            evaluable_weight: toNullableNumber(it.evaluable_weight) ?? 0,
            positives: toFactors(it.positives),
            incompatibilities: toFactors(it.incompatibilities),
            missing: toFactors(it.missing),
          },
        ];
      })
    : [];

  return {
    version: toNullableString(obj.version) ?? BUYER_MATCHING_VERSION,
    criteria_source: criteriaSource,
    weights: (obj.weights as BuyerMatchResult["weights"]) ?? empty.weights,
    items,
  };
}

/**
 * Phrase d'explication d'une suggestion, en français, à partir des seuls
 * facteurs calculés en base. Aucune interprétation supplémentaire : si une
 * donnée manque, on le dit — on ne comble jamais par une hypothèse.
 */
export function explainMatch(item: BuyerMatchItem): string {
  const parts: string[] = [];
  if (item.positives.length > 0) {
    parts.push(
      `Compatible sur ${item.positives.map((f) => buyerMatchFactorLabels[f].toLowerCase()).join(", ")}`,
    );
  }
  if (item.incompatibilities.length > 0) {
    parts.push(
      `Incompatible sur ${item.incompatibilities.map((f) => buyerMatchFactorLabels[f].toLowerCase()).join(", ")}`,
    );
  }
  if (item.missing.length > 0) {
    parts.push(
      `Donnée manquante : ${item.missing.map((f) => buyerMatchFactorLabels[f].toLowerCase()).join(", ")}`,
    );
  }
  return parts.length > 0 ? parts.join(" · ") : "Aucun critère évaluable.";
}

/**
 * Niveau de confiance de la suggestion, dérivé de la part du poids réellement
 * évaluable. Un score calculé sur peu de critères n'est pas présenté avec la
 * même assurance qu'un score complet : pas de fausse précision.
 */
export function matchConfidence(item: BuyerMatchItem): "elevee" | "partielle" | "faible" {
  if (item.evaluable_weight >= 90) return "elevee";
  if (item.evaluable_weight >= 50) return "partielle";
  return "faible";
}

export const matchConfidenceLabels: Record<
  ReturnType<typeof matchConfidence>,
  string
> = {
  elevee: "Évaluation complète",
  partielle: "Évaluation partielle",
  faible: "Peu de critères évaluables",
};
