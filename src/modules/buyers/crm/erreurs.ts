/**
 * CE QU'UN COMMERCIAL A LE DROIT DE LIRE QUAND LA BASE REFUSE.
 *
 * Le 23 octobre, Antoine a vu s'afficher « there is no unique or exclusion
 * constraint matching the ON CONFLICT specification » en essayant de confier
 * un lead. Le defaut de ce traducteur renvoyait le message de PostgreSQL tel
 * quel : un commercial se retrouvait devant une phrase en anglais qui ne lui
 * dit ni ce qui s'est passe, ni quoi faire.
 *
 * Les codes que NOS fonctions levent portent deja un message francais ecrit
 * pour l'ecran — on le laisse passer. Tout le reste vient de PostgreSQL ou
 * de PostgREST : ce sont des pannes, pas des refus metier, et leur texte est
 * un detail technique. On le journalise et on affiche une phrase utile.
 *
 * Module separe d'`actions.ts` pour une raison simple : ce fichier porte
 * « use server » et ne peut donc exporter que des fonctions asynchrones. Isoler
 * la traduction la rend testable.
 */

/** Les codes que nos propres fonctions SQL levent, avec un message francais. */
const NOS_CODES = new Set(["42501", "22023", "22001", "23505", "0A000"]);

export function messageUtilisateur(code: string | undefined, message: string): string {
  if (code === "28000") return "Session expirée. Reconnectez-vous.";

  if (code && NOS_CODES.has(code)) {
    const propre = (message ?? "").trim();
    /* Un message vide ou qui ressemble a du jargon anglais ne doit pas passer
       sous pretexte que le code est l'un des notres : une contrainte de base
       peut lever 23505 sans que personne ait ecrit la phrase. */
    if (propre && !ressembleAuJargon(propre)) return propre;
    return "Action refusée. Vérifiez les informations saisies.";
  }

  console.error("crm acquereurs : erreur base non traduite", { code: code ?? "sans code" });
  return "Une erreur technique empêche cette action. Réessayez ; si cela persiste, signalez-le.";
}

/**
 * Repere les messages bruts de PostgreSQL. On ne cherche pas a etre malin :
 * ces trois marqueurs suffisent a attraper les textes qui ont fuite jusqu'ici,
 * et aucun de nos messages francais ne les contient.
 */
function ressembleAuJargon(m: string): boolean {
  const bas = m.toLowerCase();
  return (
    bas.includes("constraint") ||
    bas.includes("violates") ||
    bas.includes("duplicate key") ||
    bas.includes("on conflict") ||
    bas.includes("relation ") ||
    bas.includes("syntax error")
  );
}
