/**
 * Éléments de crédibilité affichés publiquement.
 *
 * ⚠️ **À confirmer avant mise en production.** L'ancienneté annoncée engage la
 * crédibilité de Prodigio face à des propriétaires avertis : elle ne doit être
 * publiée qu'une fois vérifiée. Tant qu'elle ne l'est pas, préférer la
 * formulation prudente (« plus de 20 ans »).
 *
 * 👉 Un seul endroit à modifier : cette constante (ou la variable
 *    d'environnement `NEXT_PUBLIC_EXPERIENCE_LABEL`). Aucun autre fichier ne
 *    doit contenir la durée en dur.
 */
export const EXPERIENCE_LABEL =
  process.env.NEXT_PUBLIC_EXPERIENCE_LABEL?.trim() || "plus de 25 ans";

/** Nom de la méthode propriétaire. Le ™ est attaché au **nom**, jamais à « Prodigio » seul. */
export const SYSTEM_NAME = "Système Prodigio™";
