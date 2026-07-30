import { z } from "zod";

/**
 * Validation de configuration d'environnement.
 *
 * Principe : l'application doit fonctionner **sans aucune variable
 * d'environnement** à ce stade. Le schéma est donc volontairement permissif et
 * **extensible** — aucune variable n'est rendue obligatoire tant que le service
 * correspondant n'est pas connecté.
 *
 * Les variables Supabase (et autres services) seront ajoutées ici à l'étape
 * suivante, en les déclarant `optional()` puis, le moment venu, requises dans
 * les seuls environnements concernés. Voir `.env.example`.
 */
const envSchema = z.object({
  // Fourni par Next.js / Node ; borné aux valeurs connues, avec valeur par défaut.
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  // --- Supabase (base + dépôt de demande publique) ---
  // Toutes optionnelles : l'application démarre sans elles. La capture des
  // demandes est simplement désactivée tant que l'URL et la clé publiable ne
  // sont pas fournies (voir `isSupabaseConfigured`). On n'utilise QUE la clé
  // publiable (anon) : aucune clé `service_role`, aucun secret de base ici.
  NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  // Référence du projet Supabase (identifiant public, non secret). Sert la
  // documentation et les outils ; jamais requise à l'exécution de l'app.
  SUPABASE_PROJECT_REF: z.string().min(1).optional(),

  // Clé SECRÈTE Supabase (moderne « sb_secret_… » ou service_role JWT), utilisée
  // EXCLUSIVEMENT côté serveur pour les opérations administratives Supabase Auth
  // (invitations `inviteUserByEmail`). STRICTEMENT serveur :
  //   - JAMAIS préfixée NEXT_PUBLIC_ (jamais incluse dans le bundle navigateur) ;
  //   - JAMAIS renvoyée au client, JAMAIS journalisée.
  // Optionnelle : sans elle, la gestion des membres reste consultable mais l'envoi
  // réel d'invitations est désactivé proprement (erreur de configuration réservée
  // aux administrateurs — voir `isSupabaseAdminConfigured`). Aucun appel Admin
  // n'est déclenché tant qu'elle est absente.
  SUPABASE_SECRET_KEY: z.string().min(1).optional(),

  // URL canonique publique du site (métadonnées / SEO). Optionnelle.
  NEXT_PUBLIC_SITE_URL: z.url().optional(),

  // URL de la présentation vidéo (VSL), hébergée sur Vimeo/Wistia. Optionnelle :
  // tant qu'elle est absente, la landing affiche un visuel éditorial (aucun faux
  // lecteur, aucun faux bouton de lecture). Permet de brancher la VSL sans
  // reconstruire la page.
  NEXT_PUBLIC_MANDATE_VSL_URL: z.url().optional(),

  // --- Cloudflare Turnstile (anti-abus du dépôt public de demande) ---
  // La clé de site est PUBLIQUE (rendue côté navigateur). Le secret reste
  // STRICTEMENT côté serveur (jamais préfixé `NEXT_PUBLIC_`, jamais renvoyé au
  // client). Toutes optionnelles : sans elles, la vérification est simplement
  // « non configurée » (voir `isTurnstileConfigured`) et le dépôt reste protégé
  // par un refus explicite. En production, des clés de TEST sont refusées
  // (voir `assertTurnstileProductionSafe`).
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
  TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
  // Hostname attendu dans la réponse de siteverify. Obligatoire de fait en
  // production (contrôle d'origine) ; facultatif hors production.
  TURNSTILE_EXPECTED_HOSTNAME: z.string().min(1).optional(),

  // --- Slack (alerte opérationnelle des nouvelles demandes de mandat) ---
  // URL de webhook entrant Slack (https://hooks.slack.com/…), STRICTEMENT côté
  // serveur : jamais préfixée `NEXT_PUBLIC_`, jamais renvoyée au client, jamais
  // journalisée. Présente en PRODUCTION uniquement (ajoutée manuellement dans
  // Vercel). Absente en preview/dev → notifications désactivées proprement (le
  // funnel fonctionne normalement). Non validée en `z.url()` pour ne JAMAIS faire
  // échouer le build sur une valeur inattendue : la forme https est contrôlée à
  // l'envoi (voir `isSlackConfigured`).
  SLACK_MANDATES_WEBHOOK_URL: z.string().min(1).optional(),

  // --- Google Calendar (planification des rendez-vous d'estimation) ---
  // Identifiants OAuth du projet Google Cloud. Utilisés EXCLUSIVEMENT côté
  // serveur (construction de l'URL de consentement, échange du code, rafraîchi-
  // ssement et révocation des jetons). STRICTEMENT serveur :
  //   - JAMAIS préfixés `NEXT_PUBLIC_` (jamais inclus dans le bundle navigateur) ;
  //   - JAMAIS renvoyés au client, JAMAIS journalisés.
  // Le client_id n'est pas un secret au sens strict, mais reste côté serveur par
  // cohérence (le navigateur n'en a jamais besoin : la redirection est amorcée
  // par un Route Handler). Toutes optionnelles : sans elles, la connexion
  // Google Calendar est simplement « non configurée » (voir
  // `isGoogleCalendarConfigured`) et l'UI l'indique proprement.
  GOOGLE_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
  // URI de redirection OAuth. Optionnelle : dérivée de `canonicalSiteUrl()` +
  // `/api/calendar/google/callback` lorsqu'elle est absente. À déclarer telle
  // quelle dans la console Google Cloud (« Authorized redirect URIs »).
  GOOGLE_OAUTH_REDIRECT_URI: z.url().optional(),

  // Clé de CHIFFREMENT au repos des jetons Google (access + refresh). 32 octets
  // encodés en base64 (openssl rand -base64 32). STRICTEMENT serveur :
  //   - JAMAIS préfixée `NEXT_PUBLIC_` ; JAMAIS renvoyée au client ; JAMAIS journalisée.
  // Sans elle, AUCUN jeton ne peut être stocké ni déchiffré : la connexion
  // Google Calendar est désactivée proprement (jamais de jeton en clair). Voir
  // `isCalendarEncryptionConfigured` et `src/modules/calendar/google/crypto.ts`.
  CALENDAR_TOKEN_ENCRYPTION_KEY: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Analyse et valide un ensemble de variables d'environnement.
 * Fonction pure (testable) : ne lit pas `process.env` directement.
 */
export function parseEnv(source: Record<string, string | undefined>): Env {
  return envSchema.parse(source);
}

/**
 * Configuration validée du processus courant. Sûre à importer partout :
 * avec un environnement vide, renvoie les valeurs par défaut.
 */
export const env: Env = parseEnv(process.env);

/**
 * Indique si Supabase est suffisamment configuré pour déposer une demande.
 * Ne lit qu'une URL publique et une clé publiable — jamais de secret serveur.
 */
export function isSupabaseConfigured(
  source: Pick<
    Env,
    "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
  > = env,
): boolean {
  return (
    typeof source.NEXT_PUBLIC_SUPABASE_URL === "string" &&
    source.NEXT_PUBLIC_SUPABASE_URL.length > 0 &&
    typeof source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY === "string" &&
    source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.length > 0
  );
}

/**
 * Indique si les opérations administratives Supabase Auth sont configurées :
 * URL du projet **et** clé secrète serveur présentes. Ne lit qu'une présence —
 * ne révèle jamais la valeur du secret. Sans elle, aucune opération Admin n'est
 * tentée (l'espace administrateur affiche une erreur de configuration dédiée).
 */
export function isSupabaseAdminConfigured(
  source: Pick<Env, "NEXT_PUBLIC_SUPABASE_URL" | "SUPABASE_SECRET_KEY"> = env,
): boolean {
  return (
    typeof source.NEXT_PUBLIC_SUPABASE_URL === "string" &&
    source.NEXT_PUBLIC_SUPABASE_URL.length > 0 &&
    typeof source.SUPABASE_SECRET_KEY === "string" &&
    source.SUPABASE_SECRET_KEY.length > 0
  );
}

/**
 * Clés de TEST officielles Cloudflare Turnstile (publiques, documentées). Elles
 * acceptent (ou refusent) toujours, sans réelle protection : parfaites pour le
 * développement et les tests, **interdites en production**.
 * https://developers.cloudflare.com/turnstile/troubleshooting/testing/
 */
export const TURNSTILE_TEST_SITE_KEYS = new Set<string>([
  "1x00000000000000000000AA", // toujours visible, réussit
  "2x00000000000000000000AB", // toujours visible, échoue
  "3x00000000000000000000FF", // force un challenge interactif
]);

export const TURNSTILE_TEST_SECRET_KEYS = new Set<string>([
  "1x0000000000000000000000000000000AA", // réussit toujours
  "2x0000000000000000000000000000000AA", // échoue toujours
  "3x0000000000000000000000000000000AA", // « token already spent »
]);

/** Vraie si la clé de site fournie est une clé de test officielle Cloudflare. */
export function isTurnstileTestSiteKey(key: string | undefined): boolean {
  return typeof key === "string" && TURNSTILE_TEST_SITE_KEYS.has(key);
}

/** Vraie si le secret fourni est un secret de test officiel Cloudflare. */
export function isTurnstileTestSecretKey(key: string | undefined): boolean {
  return typeof key === "string" && TURNSTILE_TEST_SECRET_KEYS.has(key);
}

/**
 * Indique si Turnstile est suffisamment configuré pour vérifier un jeton :
 * clé de site publique **et** secret serveur présents. Ne révèle jamais le
 * secret ; ne lit qu'une présence.
 */
export function isTurnstileConfigured(
  source: Pick<
    Env,
    "NEXT_PUBLIC_TURNSTILE_SITE_KEY" | "TURNSTILE_SECRET_KEY"
  > = env,
): boolean {
  return (
    typeof source.NEXT_PUBLIC_TURNSTILE_SITE_KEY === "string" &&
    source.NEXT_PUBLIC_TURNSTILE_SITE_KEY.length > 0 &&
    typeof source.TURNSTILE_SECRET_KEY === "string" &&
    source.TURNSTILE_SECRET_KEY.length > 0
  );
}

/**
 * Garde-fou de production : les **clés de test** Cloudflare ne doivent JAMAIS
 * accorder l'accès en production. Renvoie `false` (non sûr) si l'on est en
 * production et que la clé de site ou le secret est une clé de test.
 *
 * Utilisé côté serveur avant tout appel à siteverify : en cas d'insécurité, le
 * dépôt est refusé plutôt que « validé » par une clé de test.
 */
export function isTurnstileProductionSafe(
  source: Pick<
    Env,
    "NODE_ENV" | "NEXT_PUBLIC_TURNSTILE_SITE_KEY" | "TURNSTILE_SECRET_KEY"
  > = env,
): boolean {
  if (source.NODE_ENV !== "production") return true;
  if (isTurnstileTestSiteKey(source.NEXT_PUBLIC_TURNSTILE_SITE_KEY)) return false;
  if (isTurnstileTestSecretKey(source.TURNSTILE_SECRET_KEY)) return false;
  return true;
}

/**
 * Indique si les notifications Slack sont configurées (webhook présent et de
 * forme `https://`). Ne révèle jamais la valeur — ne lit qu'une présence/forme.
 * Absent (preview/dev) ⇒ notifications désactivées proprement.
 */
export function isSlackConfigured(
  source: Pick<Env, "SLACK_MANDATES_WEBHOOK_URL"> = env,
): boolean {
  const url = source.SLACK_MANDATES_WEBHOOK_URL;
  return typeof url === "string" && /^https:\/\/\S+$/i.test(url.trim());
}

/**
 * Base d'URL publique utilisée pour les **deep links CRM** (Slack, e-mails…).
 * Priorité à `NEXT_PUBLIC_SITE_URL` s'il est renseigné ; sinon domaine canonique
 * de production (`https://go.prodigio.fr`) en production, `http://localhost:3000`
 * hors production. Ne code aucun paramètre métier : uniquement l'hôte de déploiement.
 */
export function mandateCrmBaseUrl(
  source: Pick<Env, "NEXT_PUBLIC_SITE_URL" | "NODE_ENV"> = env,
): string {
  const explicit = source.NEXT_PUBLIC_SITE_URL;
  if (typeof explicit === "string" && /^https?:\/\/\S+$/i.test(explicit.trim())) {
    return explicit.trim().replace(/\/+$/, "");
  }
  return source.NODE_ENV === "production"
    ? "https://go.prodigio.fr"
    : "http://localhost:3000";
}

/**
 * URL canonique publique du site (identique à `mandateCrmBaseUrl`) — base des
 * liens d'invitation / redirection d'authentification. Priorité à
 * `NEXT_PUBLIC_SITE_URL` ; fallback production `https://go.prodigio.fr`.
 */
export function canonicalSiteUrl(
  source: Pick<Env, "NEXT_PUBLIC_SITE_URL" | "NODE_ENV"> = env,
): string {
  return mandateCrmBaseUrl(source);
}

/**
 * URI de redirection OAuth Google effective : valeur explicite si fournie, sinon
 * dérivée du domaine canonique + `/api/calendar/google/callback`. À déclarer à
 * l'identique dans la console Google Cloud. Ne lit aucun secret.
 */
export function googleOAuthRedirectUri(
  source: Pick<
    Env,
    "GOOGLE_OAUTH_REDIRECT_URI" | "NEXT_PUBLIC_SITE_URL" | "NODE_ENV"
  > = env,
): string {
  const explicit = source.GOOGLE_OAUTH_REDIRECT_URI;
  if (typeof explicit === "string" && /^https?:\/\/\S+$/i.test(explicit.trim())) {
    return explicit.trim();
  }
  return `${canonicalSiteUrl(source)}/api/calendar/google/callback`;
}

/**
 * Indique si l'intégration Google Calendar est configurée : identifiants OAuth
 * (client id + secret) **et** clé de chiffrement des jetons présents. Ne révèle
 * jamais les valeurs — ne lit qu'une présence. Sans cela, la connexion Google
 * Calendar reste « non configurée » (aucun jeton stocké, aucun appel OAuth).
 */
export function isGoogleCalendarConfigured(
  source: Pick<
    Env,
    | "GOOGLE_OAUTH_CLIENT_ID"
    | "GOOGLE_OAUTH_CLIENT_SECRET"
    | "CALENDAR_TOKEN_ENCRYPTION_KEY"
  > = env,
): boolean {
  return (
    typeof source.GOOGLE_OAUTH_CLIENT_ID === "string" &&
    source.GOOGLE_OAUTH_CLIENT_ID.length > 0 &&
    typeof source.GOOGLE_OAUTH_CLIENT_SECRET === "string" &&
    source.GOOGLE_OAUTH_CLIENT_SECRET.length > 0 &&
    isCalendarEncryptionConfigured(source)
  );
}

/**
 * Indique si la clé de chiffrement des jetons est présente et de longueur
 * valide (32 octets une fois décodée en base64). Ne révèle jamais la valeur.
 * Une clé mal dimensionnée est traitée comme absente (aucun chiffrement à vide).
 */
export function isCalendarEncryptionConfigured(
  source: Pick<Env, "CALENDAR_TOKEN_ENCRYPTION_KEY"> = env,
): boolean {
  const key = source.CALENDAR_TOKEN_ENCRYPTION_KEY;
  if (typeof key !== "string" || key.length === 0) return false;
  try {
    return Buffer.from(key, "base64").length === 32;
  } catch {
    return false;
  }
}

/**
 * Construit une URL de redirection **interne** sûre (anti open-redirect). Renvoie
 * un chemin absolu commençant par un seul `/` (jamais `//` ni un schéma), sinon
 * la valeur de repli. Utilisée pour les redirections post-authentification.
 */
export function safeInternalPath(
  target: string | null | undefined,
  fallback = "/crm",
): string {
  if (typeof target !== "string") return fallback;
  const t = target.trim();
  // Doit commencer par un seul « / » et ne pas être un chemin protocol-relative.
  if (!t.startsWith("/") || t.startsWith("//") || t.startsWith("/\\")) return fallback;
  return t;
}
