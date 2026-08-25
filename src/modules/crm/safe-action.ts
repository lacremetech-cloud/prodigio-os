/**
 * `safeAction` — une action serveur qui échoue ne doit JAMAIS détruire l'écran.
 *
 * Le problème corrigé ici : un appel d'action serveur lancé depuis une
 * transition React et non rattrapé fait remonter le rejet jusqu'à la frontière
 * d'erreur. La page entière est alors remplacée par « Une erreur est survenue »,
 * et **toute la saisie en cours est perdue** — y compris un formulaire long
 * qu'on venait de remplir.
 *
 * Une panne réseau, un déploiement en cours ou une coupure côté fournisseur
 * doivent rester des contretemps affichés sous le formulaire, jamais des pertes
 * de travail.
 *
 * ⚠️ Deux exceptions ne sont PAS des pannes : `redirect()` et `notFound()` de
 * Next.js sont des mécanismes de **contrôle de flux**. Les rattraper romprait la
 * redirection vers la connexion quand une session expire. Elles sont donc
 * relancées telles quelles.
 */

/** Contrat minimal commun à toutes les actions serveur du CRM. */
export interface ActionOutcome {
  ok: boolean;
  error?: string;
}

export interface ActionFailure {
  ok: false;
  error: string;
  /** Vrai quand un rechargement de page est la seule issue (build remplacé). */
  requiresReload?: true;
}

/**
 * Message par défaut. Il dit trois choses, dans cet ordre : ce qui n'a pas
 * marché, ce qui est préservé, et quoi faire.
 */
export const ACTION_FAILURE_MESSAGE =
  "L'enregistrement n'a pas abouti — rien n'a été modifié. Votre saisie est conservée : réessayez dans un instant.";

/**
 * Cas particulier : l'application a été redéployée pendant que l'onglet était
 * ouvert, et l'action appelée n'existe plus dans le nouveau build. Recharger est
 * alors indispensable — autant le dire, plutôt que de laisser réessayer en vain.
 */
export const ACTION_STALE_BUILD_MESSAGE =
  "L'application a été mise à jour depuis l'ouverture de cette page. Copiez votre saisie, rechargez la page, puis recommencez.";

/** Message affiché quand la connexion au serveur n'a pas pu être établie. */
export const ACTION_NETWORK_MESSAGE =
  "Le serveur n'a pas répondu — rien n'a été modifié. Votre saisie est conservée : vérifiez votre connexion et réessayez.";

/**
 * Digests utilisés par Next.js pour son contrôle de flux. Ce ne sont pas des
 * erreurs applicatives : les intercepter casserait la redirection et le 404.
 */
const CONTROL_FLOW_DIGESTS = ["NEXT_REDIRECT", "NEXT_NOT_FOUND", "NEXT_HTTP_ERROR_FALLBACK"];

/** Vrai si l'exception est un mécanisme de contrôle de flux du framework. */
export function isFrameworkControlFlow(cause: unknown): boolean {
  if (typeof cause !== "object" || cause === null) return false;
  const digest = (cause as { digest?: unknown }).digest;
  if (typeof digest !== "string") return false;
  return CONTROL_FLOW_DIGESTS.some((prefix) => digest.startsWith(prefix));
}

/** Texte d'une exception, quelle que soit sa forme. */
function messageOf(cause: unknown): string {
  if (typeof cause === "string") return cause;
  if (cause instanceof Error) return cause.message;
  if (typeof cause === "object" && cause !== null) {
    const message = (cause as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "";
}

/**
 * Traduit une exception en message lisible. Ne divulgue jamais la trace ni le
 * détail technique : l'utilisateur reçoit une consigne, pas un diagnostic.
 */
export function describeActionFailure(cause: unknown): ActionFailure {
  const message = messageOf(cause);

  // Build remplacé : l'identifiant d'action envoyé n'existe plus côté serveur.
  if (/Failed to find Server Action|older or newer deployment/i.test(message)) {
    return { ok: false, error: ACTION_STALE_BUILD_MESSAGE, requiresReload: true };
  }

  // Échec de transport : la requête n'a pas abouti.
  if (/fetch failed|Failed to fetch|NetworkError|ECONNRESET|ETIMEDOUT|socket hang up/i.test(message)) {
    return { ok: false, error: ACTION_NETWORK_MESSAGE };
  }

  return { ok: false, error: ACTION_FAILURE_MESSAGE };
}

/**
 * Exécute une action serveur sans jamais laisser un rejet s'échapper.
 *
 * Renvoie le résultat de l'action lorsqu'elle aboutit — succès **comme** échec
 * métier, qui reste un `{ ok: false, error }` produit volontairement. Une
 * exception imprévue devient un échec lisible ; une redirection est relancée.
 */
export async function safeAction<T extends ActionOutcome>(
  fn: () => Promise<T>,
): Promise<T | ActionFailure> {
  try {
    return await fn();
  } catch (cause) {
    if (isFrameworkControlFlow(cause)) throw cause;
    return describeActionFailure(cause);
  }
}
