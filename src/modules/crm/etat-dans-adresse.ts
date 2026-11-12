/**
 * Écrire l'état d'un écran dans l'adresse, sans recharger la page.
 *
 * Même intention que `retour` : ce qu'on a filtré, trié ou cherché doit
 * survivre à l'ouverture d'une fiche. La différence est le sens — ici c'est le
 * NAVIGATEUR qui écrit, parce que le filtre est posé côté client.
 *
 * POURQUOI `history.replaceState` ET NON LE ROUTEUR. Le routeur redemande la
 * page au serveur à chaque clic de pastille : sur les écrans chargés du CRM,
 * c'est la tempête de rechargements qu'on a passé du temps à supprimer.
 * `replaceState` ne fait qu'écrire l'adresse — aucun aller-retour, aucun
 * rendu — et c'est tout ce qu'il faut pour que « Précédent » et le bouton de
 * retour d'une fiche retrouvent l'écran qu'on avait.
 *
 * `replace` et non `push` : filtrer n'est pas naviguer. Sinon « Précédent »
 * déferait les filtres un par un au lieu de quitter l'écran.
 */
export function ecrireDansAdresse(valeurs: Record<string, string | null | undefined>): void {
  if (typeof window === "undefined") return;
  const q = new URLSearchParams(window.location.search);
  for (const [cle, valeur] of Object.entries(valeurs)) {
    const v = typeof valeur === "string" ? valeur.trim() : "";
    if (v) q.set(cle, v);
    else q.delete(cle);
  }
  const chaine = q.toString();
  const cible = `${window.location.pathname}${chaine ? `?${chaine}` : ""}`;
  /* Ne rien écrire quand rien ne change : une entrée d'historique identique
     n'apporte rien et brouille le « Précédent ». */
  if (cible !== `${window.location.pathname}${window.location.search}`) {
    window.history.replaceState(null, "", cible);
  }
}
