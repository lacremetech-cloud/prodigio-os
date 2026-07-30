/**
 * Scopes OAuth Google demandés (principe du moindre privilège) :
 *   - `openid` + `email` : identifier le compte connecté (adresse affichée).
 *   - `calendar.readonly` : lire la liste des calendriers et interroger FreeBusy
 *     (disponibilités réelles) — sans droit d'écriture supplémentaire.
 *   - `calendar.events` : créer / modifier / supprimer les événements
 *     d'estimation dans le calendrier de l'agent.
 *
 * Aucun scope plus large (`calendar` complet) : on n'obtient que ce qui est
 * nécessaire aux estimations.
 */
export const GOOGLE_OAUTH_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
] as const;

export const GOOGLE_OAUTH_SCOPE_STRING = GOOGLE_OAUTH_SCOPES.join(" ");
