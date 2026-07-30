/**
 * Erreur normalisée des appels Google, avec le code HTTP et un « kind » métier
 * pour réagir proprement (jeton expiré / révoqué, événement supprimé, quota…).
 * Ne contient JAMAIS de jeton ni de secret : uniquement statut et message court.
 */
export type GoogleErrorKind =
  | "unauthorized" // 401 : jeton invalide / expiré / révoqué
  | "forbidden" // 403 : accès refusé / quota
  | "not_found" // 404 : calendrier ou événement introuvable
  | "rate_limited" // 429
  | "invalid" // 400
  | "server" // 5xx
  | "network" // échec réseau / parsing
  | "unknown";

export class GoogleApiError extends Error {
  readonly status: number;
  readonly kind: GoogleErrorKind;

  constructor(message: string, status: number, kind: GoogleErrorKind) {
    super(message);
    this.name = "GoogleApiError";
    this.status = status;
    this.kind = kind;
  }
}

export function googleErrorKindFromStatus(status: number): GoogleErrorKind {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limited";
  if (status === 400) return "invalid";
  if (status >= 500) return "server";
  return "unknown";
}
