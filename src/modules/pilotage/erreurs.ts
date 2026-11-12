/**
 * Ce que l'écran du pilotage dit quand la base refuse ou manque.
 *
 * Deux familles :
 *  - NOS refus (`crm_pilotage_*` lèvent 42501, 22023, 0A000 avec une phrase
 *    française écrite pour l'écran) : on la laisse passer ;
 *  - le reste vient de PostgreSQL ou de PostgREST : c'est une panne, pas un
 *    refus métier. On ne montre pas son texte, on le journalise.
 *
 * Cas à part, et attendu : l'aperçu Vercel tourne sur la base de production.
 * Tant que la migration du pilotage n'y est pas appliquée, tables et fonctions
 * n'existent pas. L'écran le dit en clair au lieu de s'effondrer.
 */

/** Codes d'un objet absent : table (42P01, PGRST205) ou fonction (42883, PGRST202). */
const ABSENT = new Set(["42P01", "42883", "PGRST202", "PGRST205"]);

const NOS_CODES = new Set(["42501", "22023", "0A000"]);

export const MESSAGE_NON_INSTALLE =
  "Le pilotage n’est pas encore installé dans la base : la migration du 12 novembre 2026 doit d’abord y être appliquée.";

export function estNonInstalle(code: string | undefined): boolean {
  return code != null && ABSENT.has(code);
}

/** Les marqueurs d'un message brut de PostgreSQL, qui ne doit pas atteindre l'écran. */
function ressembleAuJargon(message: string): boolean {
  const bas = message.toLowerCase();
  return ["constraint", "violates", "duplicate key", "on conflict", "relation ", "syntax error", "function "].some(
    (m) => bas.includes(m),
  );
}

export function messagePilotage(code: string | undefined, message: string | undefined): string {
  if (code === "28000") return "Session expirée. Reconnectez-vous.";
  if (estNonInstalle(code)) return MESSAGE_NON_INSTALLE;
  if (code && NOS_CODES.has(code)) {
    const propre = (message ?? "").trim();
    if (propre && !ressembleAuJargon(propre)) {
      // Première lettre en capitale : la base écrit en minuscules.
      return propre.charAt(0).toUpperCase() + propre.slice(1) + (/[.!?]$/.test(propre) ? "" : ".");
    }
    return "Action refusée. Vérifiez les informations saisies.";
  }
  console.error("pilotage : erreur base non traduite", { code: code ?? "sans code" });
  return "Une erreur technique empêche cet enregistrement. Réessayez ; si cela persiste, signalez-le.";
}
