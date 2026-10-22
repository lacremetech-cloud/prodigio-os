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

  // Fourni automatiquement par Vercel : « production », « preview » ou
  // « development ». Sert UNIQUEMENT à refuser, sur les déploiements de
  // prévisualisation, les écritures qui créeraient de vraies données de
  // production (organisations, biens). Optionnelle : hors Vercel, elle est
  // absente et aucune restriction n'est appliquée.
  VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),

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

  // --- Slack (alertes des rendez-vous d'estimation) ---
  // URL de webhook entrant Slack du canal privé `#alertes-rdv-estimations`.
  // STRICTEMENT côté serveur : jamais préfixée `NEXT_PUBLIC_`, jamais renvoyée au
  // client, jamais journalisée, jamais dans Git ni le bundle. Présente en
  // PRODUCTION uniquement (Vercel). Absente en preview/dev → alertes désactivées
  // proprement (le rendez-vous fonctionne normalement, aucun appel Slack). Non
  // validée en `z.url()` pour ne jamais faire échouer le build ; la forme https
  // est contrôlée à l'envoi (voir `isEstimationSlackConfigured`).
  SLACK_ESTIMATION_APPOINTMENTS_WEBHOOK_URL: z.string().min(1).optional(),

  // --- Slack (alertes des nouvelles demandes ACQUÉREURS) ---
  // URL de webhook entrant Slack du canal privé `#alertes-acquereurs`. STRICTEMENT
  // côté serveur : jamais préfixée `NEXT_PUBLIC_`, jamais renvoyée au client, jamais
  // journalisée, jamais dans Git ni le bundle. **Distincte du canal Mandats** : ne
  // JAMAIS réutiliser silencieusement `SLACK_MANDATES_WEBHOOK_URL`. Présente en
  // PRODUCTION uniquement (Vercel). Absente en preview/dev → alertes acquéreurs
  // désactivées proprement (le dépôt fonctionne normalement, aucun appel Slack).
  // Non validée en `z.url()` pour ne jamais faire échouer le build ; la forme https
  // est contrôlée à l'envoi (voir `isBuyerSlackConfigured`).
  SLACK_BUYER_LEADS_WEBHOOK_URL: z.string().min(1).optional(),

  // --- Meta (API de conversions, remontee serveur des conversions publicitaires) ---
  // Identifiant du pixel et jeton d'acces systeme de l'API de conversions.
  // STRICTEMENT serveur : jamais prefixes `NEXT_PUBLIC_`, jamais renvoyes au
  // client, jamais journalises. Le jeton donne le droit d'ecrire dans le pixel :
  // il se revoque depuis le Business Manager et se traite comme un mot de passe.
  // Absents (preview/dev) => aucune conversion n'est emise, le CRM fonctionne a
  // l'identique. `META_CAPI_TEST_EVENT_CODE` n'est renseigne que le temps d'une
  // verification dans l'outil « Evenements de test » : laisse en place, il
  // ecarte les evenements des statistiques reelles.
  META_CAPI_PIXEL_ID: z.string().min(1).optional(),
  META_CAPI_ACCESS_TOKEN: z.string().min(1).optional(),
  META_CAPI_TEST_EVENT_CODE: z.string().min(1).optional(),

  // --- SMSFactor (accuse de reception envoye au prospect) ---
  // Jeton d'API et nom d'expediteur. STRICTEMENT serveur : jamais prefixes
  // `NEXT_PUBLIC_`, jamais renvoyes au client, jamais journalises. Le jeton
  // permet de debiter des credits : il se traite comme un mot de passe et se
  // revoque depuis https://my.smsfactor.com/developers/api-tokens.
  // Absents (preview/dev) => aucun SMS n'est envoye, le depot fonctionne a
  // l'identique. L'expediteur est un nom alphanumerique court, declare chez
  // SMSFactor ; sans lui, c'est le numero par defaut du compte qui s'affiche.
  SMSFACTOR_API_TOKEN: z.string().min(1).optional(),
  SMSFACTOR_SENDER: z.string().min(1).max(11).optional(),

  // --- Lien court des brochures ---
  // Base du lien envoye par SMS : `https://brochure.prodigio.fr`. Elle est ici
  // et non dans le code parce qu'elle change une fois (le jour ou le
  // sous-domaine est en service) et ne doit alors demander aucun deploiement.
  // Absente => on retombe sur le domaine canonique, qui sert deja l'appli.
  BROCHURE_BASE_URL: z.url().optional(),

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

  // --- Communications : fournisseur E-MAIL (Lumail) ---------------------------
  // Jeton d'API Lumail (`lum_…`). STRICTEMENT serveur :
  //   - JAMAIS préfixé `NEXT_PUBLIC_` ; JAMAIS renvoyé au client ; JAMAIS journalisé.
  // Absent ⇒ le transport e-mail est « non configuré » : aucun appel réseau n'est
  // tenté et l'interface l'indique explicitement (voir `isLumailConfigured`).
  LUMAIL_API_KEY: z.string().min(1).optional(),
  // Adresse expéditrice. Son DOMAINE doit être vérifié côté Lumail, sans quoi
  // l'API refuse l'envoi (erreur normalisée `domaine_non_verifie`).
  LUMAIL_FROM_EMAIL: z.string().min(1).optional(),
  // Adresse de réponse (facultative). Sert à diriger les réponses vers une boîte
  // réellement relevée plutôt que vers l'expéditeur technique.
  LUMAIL_REPLY_TO: z.string().min(1).optional(),

  // --- Communications : fournisseur SMS (Twilio) ------------------------------
  // PRÉPARÉ, non activé en V1. Mêmes règles : strictement serveur, jamais
  // journalisé, jamais dans le bundle. Absent ⇒ transport SMS désactivé.
  TWILIO_ACCOUNT_SID: z.string().min(1).optional(),
  TWILIO_AUTH_TOKEN: z.string().min(1).optional(),
  // Numéro émetteur E.164 (`+33…`) OU identifiant de Messaging Service (`MG…`).
  TWILIO_FROM: z.string().min(1).optional(),

  // --- Communications : interrupteur d'ENVOI RÉEL -----------------------------
  // Interrupteur explicite. Tant qu'il ne vaut pas exactement « true », le
  // dispatcher fonctionne en SIMULATION : la politique est appliquée, les
  // messages sont préparés et tracés, mais AUCUN appel fournisseur n'est émis.
  // Volontairement distinct de la présence des clés : disposer d'une clé ne doit
  // jamais suffire à déclencher un envoi réel.
  COMMUNICATIONS_DISPATCH_ENABLED: z.string().optional(),

  // --- Alerte E-MAIL a l'equipe pour chaque nouveau lead ----------------------
  // Adresses internes separees par des virgules. Antoine et JC n'ouvrent ni
  // Slack ni WhatsApp : l'e-mail est le seul canal qu'ils relevent, donc le
  // seul qui alerte reellement. Volontairement une variable d'environnement et
  // non une liste en dur : ajouter ou retirer quelqu'un ne doit demander ni
  // modification de code, ni redeploiement, ni de faire figurer des adresses
  // personnelles dans le depot.
  // Absente ⇒ aucune alerte e-mail (le canal Slack continue seul).
  ALERTES_LEADS_EMAILS: z.string().optional(),

  // Webhook Make dedie a l'alerte equipe. Make compose et envoie l'e-mail via
  // le compte Google de l'agence : pas de fournisseur d'envoi a contractualiser.
  // RIEN A VOIR avec `buyer_form_webhook_url` en base, qui porte l'accuse au
  // prospect et n'est plus appele depuis que SMSFactor est configure.
  // Present ⇒ il PRIME sur l'envoi Lumail (jamais les deux : doublon d'alerte).
  ALERTE_LEAD_WEBHOOK_URL: z.string().optional(),

  // QUI DECLENCHE UNE ALERTE IMMEDIATE, UN MAIL PAR LEAD.
  //
  // `tous` = le comportement historique : chaque lead alerte. Douze mails par
  // jour et par personne, mesure faite sur les neuf jours suivant la reprise
  // du 14 octobre — c'est ce qui polluait leur boite.
  //
  // `urgents` = seuls les leads au-dessus d'1 M€ arrives entre 8h et 19h,
  // soit environ trois par jour. Tout le reste part dans le recapitulatif de
  // 8h30, 13h00 et 17h30.
  //
  // Defaut `tous` A DESSEIN : tant que le recapitulatif ne tourne pas, basculer
  // sur `urgents` priverait les leads sous 1 M€ de TOUTE notification. On
  // n'active donc le filtre qu'une fois le recapitulatif verifie.
  ALERTE_LEAD_IMMEDIATE: z.enum(["tous", "urgents"]).default("tous"),

  // Secret partage qui protege l'endpoint de recapitulatif, appele par Make.
  // L'endpoint rend des noms et des telephones : sans ce jeton il ne repond
  // rien du tout, plutot que de s'ouvrir par defaut.
  RECAP_LEADS_TOKEN: z.string().optional(),
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
 * Indique si les alertes Slack des rendez-vous d'estimation sont configurées
 * (webhook présent et de forme `https://`). Ne révèle jamais la valeur. Absent
 * (preview/dev) ⇒ alertes désactivées proprement, sans jamais bloquer un rendez-vous.
 */
export function isEstimationSlackConfigured(
  source: Pick<Env, "SLACK_ESTIMATION_APPOINTMENTS_WEBHOOK_URL"> = env,
): boolean {
  const url = source.SLACK_ESTIMATION_APPOINTMENTS_WEBHOOK_URL;
  return typeof url === "string" && /^https:\/\/\S+$/i.test(url.trim());
}

/**
 * Indique si les alertes Slack des nouvelles demandes acquéreurs sont configurées
 * (webhook présent et de forme `https://`). **Canal distinct** de celui des
 * Mandats : ne réutilise jamais `SLACK_MANDATES_WEBHOOK_URL`. Ne révèle jamais la
 * valeur. Absent (preview/dev) ⇒ alertes désactivées proprement, sans jamais
 * bloquer l'enregistrement de la demande.
 */
/**
 * API de conversions Meta configuree ? Les deux valeurs sont requises : un
 * pixel sans jeton n'ecrit rien, un jeton sans pixel ne sait ou ecrire.
 * Absente (preview/dev) => aucune conversion emise, et c'est voulu : on ne
 * pollue pas les statistiques d'un compte publicitaire depuis une preview.
 */
export function isMetaCapiConfigured(
  source: Pick<Env, "META_CAPI_PIXEL_ID" | "META_CAPI_ACCESS_TOKEN"> = env,
): boolean {
  const id = source.META_CAPI_PIXEL_ID;
  const token = source.META_CAPI_ACCESS_TOKEN;
  return (
    typeof id === "string" && id.trim().length > 0 &&
    typeof token === "string" && token.trim().length > 0
  );
}

/**
 * Envoi de SMS configure ? Seul le jeton est requis : sans nom d'expediteur,
 * SMSFactor utilise le numero par defaut du compte, ce qui reste un envoi
 * valide. Sans jeton, aucun SMS ne part et le depot se deroule a l'identique.
 */
export function isSmsFactorConfigured(
  source: Pick<Env, "SMSFACTOR_API_TOKEN"> = env,
): boolean {
  const jeton = source.SMSFACTOR_API_TOKEN;
  return typeof jeton === "string" && jeton.trim().length > 0;
}

export function isBuyerSlackConfigured(
  source: Pick<Env, "SLACK_BUYER_LEADS_WEBHOOK_URL"> = env,
): boolean {
  const url = source.SLACK_BUYER_LEADS_WEBHOOK_URL;
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
 * Base des liens courts de brochure, sans barre finale.
 *
 * Le SMS d'accusé porte `<base>/<slug>`. La base est une variable parce que le
 * sous-domaine dédié (`brochure.prodigio.fr`) se pose côté DNS, pas côté code :
 * tant qu'il n'est pas en service, les liens partent sur le domaine canonique,
 * qui sert déjà cette même route. Le jour où le DNS est prêt, une variable
 * change et rien d'autre.
 *
 * Les messages DÉJÀ ENVOYÉS continuent de fonctionner : l'ancienne base reste
 * servie par la même application. Un SMS ne se corrige pas après coup, c'est
 * la seule raison pour laquelle on ne remplace jamais un domaine, on en ajoute.
 */
export function brochureBaseUrl(
  source: Pick<Env, "BROCHURE_BASE_URL" | "NEXT_PUBLIC_SITE_URL" | "NODE_ENV"> = env,
): string {
  const explicit = source.BROCHURE_BASE_URL;
  if (typeof explicit === "string" && /^https?:\/\/\S+$/i.test(explicit.trim())) {
    return explicit.trim().replace(/\/+$/, "");
  }
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
 * Indique si le transport e-mail Lumail est configuré : jeton **et** adresse
 * expéditrice présents. Ne révèle jamais la valeur — ne lit qu'une présence.
 * Absent ⇒ transport désactivé proprement, aucun appel réseau tenté.
 */
export function isLumailConfigured(
  source: Pick<Env, "LUMAIL_API_KEY" | "LUMAIL_FROM_EMAIL"> = env,
): boolean {
  return (
    typeof source.LUMAIL_API_KEY === "string" &&
    source.LUMAIL_API_KEY.trim().length > 0 &&
    typeof source.LUMAIL_FROM_EMAIL === "string" &&
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(source.LUMAIL_FROM_EMAIL.trim())
  );
}

/**
 * Indique si l'alerte e-mail « nouveau lead » peut partir : transport Lumail
 * configure ET au moins un destinataire valide. Ne revele aucune adresse.
 *
 * Les deux conditions sont distinctes a dessein : une liste de destinataires
 * sans transport, ou un transport sans destinataires, donnent le meme resultat
 * visible — aucune alerte — pour deux causes opposees. Les separer permet de
 * le dire.
 */
export function isAlerteLeadEmailConfigured(
  source: Pick<Env, "LUMAIL_API_KEY" | "LUMAIL_FROM_EMAIL" | "ALERTES_LEADS_EMAILS"> = env,
): boolean {
  if (!isLumailConfigured(source)) return false;
  const brut = source.ALERTES_LEADS_EMAILS;
  if (typeof brut !== "string") return false;
  return brut
    .split(/[,;\s]+/)
    .some((a) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a.trim()));
}

/**
 * Indique si le transport SMS Twilio est configuré (identifiant de compte, jeton
 * et expéditeur). Ne révèle jamais les valeurs. Absent ⇒ SMS désactivé.
 */
export function isTwilioConfigured(
  source: Pick<Env, "TWILIO_ACCOUNT_SID" | "TWILIO_AUTH_TOKEN" | "TWILIO_FROM"> = env,
): boolean {
  return (
    typeof source.TWILIO_ACCOUNT_SID === "string" &&
    source.TWILIO_ACCOUNT_SID.trim().length > 0 &&
    typeof source.TWILIO_AUTH_TOKEN === "string" &&
    source.TWILIO_AUTH_TOKEN.trim().length > 0 &&
    typeof source.TWILIO_FROM === "string" &&
    source.TWILIO_FROM.trim().length > 0
  );
}

/**
 * Vrai UNIQUEMENT si l'envoi réel a été explicitement activé. Toute autre valeur
 * (absente, vide, « 1 », « yes », « TRUE ») laisse le système en SIMULATION.
 * La comparaison est volontairement stricte : un envoi réel ne doit jamais
 * résulter d'une valeur ambiguë.
 */
export function isCommunicationDispatchEnabled(
  source: Pick<Env, "COMMUNICATIONS_DISPATCH_ENABLED"> = env,
): boolean {
  return source.COMMUNICATIONS_DISPATCH_ENABLED === "true";
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

/**
 * Vrai sur un déploiement de **prévisualisation** Vercel. Les previews partagent
 * la base de production : on y refuse donc explicitement les écritures qui
 * créeraient de vraies données (organisation porteuse, bien). Ce n'est **pas**
 * un « mode test » masqué — le refus est visible, motivé, et n'a aucun effet en
 * production ni en développement local.
 */
export function isPreviewDeployment(
  source: Pick<Env, "VERCEL_ENV"> = env,
): boolean {
  return source.VERCEL_ENV === "preview";
}
