/**
 * Types partagés des alertes Slack des rendez-vous d'estimation. Aucun secret,
 * aucun jeton, aucune donnée technique : uniquement ce qui est nécessaire au
 * traitement opérationnel du rendez-vous dans le canal privé.
 */

export type EstimationAlertKind = "created" | "rescheduled" | "cancelled";

/**
 * Données **déjà résolues** (aucune I/O) nécessaires à la construction du
 * message. Les coordonnées du propriétaire sont autorisées (canal privé,
 * nécessaires au traitement). Ne contient JAMAIS : jeton OAuth/access/refresh,
 * secret de chiffrement, webhook, variables d'environnement, IP, user agent,
 * JWT, clé d'idempotence, preuve de consentement, payload brut, audit brut.
 */
export interface EstimationAlertData {
  kind: EstimationAlertKind;
  opportunityId: string;
  crmBaseUrl: string;

  // Créneau courant (et ancien créneau pour un report).
  startsAt: string;
  endsAt: string;
  timezone: string;
  oldStartsAt: string | null;
  oldEndsAt: string | null;

  // Personnes.
  agentName: string | null;
  actorName: string | null; // qui a planifié / reporté / annulé
  ownerName: string | null;
  ownerPhone: string | null;
  ownerEmail: string | null;

  // Bien.
  propertyType: string | null; // libellé français
  city: string | null;
  address: string | null;
  valueBand: string | null; // libellé français

  // Facultatifs.
  reason: string | null; // motif d'annulation, uniquement s'il existe dans le modèle
  googleHtmlLink: string | null; // lien Google Calendar non sensible (si disponible)
}
