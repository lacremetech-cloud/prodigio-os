/** Nom du cookie httpOnly portant le `state` anti-CSRF du flux OAuth Google. */
export const OAUTH_STATE_COOKIE = "gcal_oauth_state";

/** Chemin du cookie de state (limité aux routes OAuth calendrier). */
export const OAUTH_STATE_COOKIE_PATH = "/api/calendar/google";
