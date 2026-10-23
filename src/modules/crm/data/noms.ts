/**
 * L'IDENTITE D'UN MEMBRE : sa fiche minimale et son nom affichable.
 *
 * Extrait de `queries.ts`, qui porte « server-only » : ces deux-la sont du
 * calcul pur, utile cote serveur comme dans un test, et le garder derriere un
 * verrou serveur empechait d'ecrire le moindre test dessus.
 */

export interface MemberInfo {
  email: string | null;
  role: string;
  /** Nom court choisi par l'organisation. Absent tant qu'il n'est pas saisi. */
  displayName: string | null;
  /**
   * `actif` ou `suspendu`. Lu pour ne proposer que des membres a qui on peut
   * reellement confier un dossier — un compte suspendu ne doit plus apparaitre
   * dans « Confier a... ».
   */
  status: string;
}

/**
 * Nom affichable d'un membre. UNIQUE endroit où cette décision se prend :
 * elle était recopiée dans cinq fichiers, qui divergeaient déjà.
 *
 * Le nom choisi par l'organisation d'abord. À défaut, la partie locale de
 * l'e-mail — lisible par personne (« casteljc69 »), mais toujours préférable à
 * un identifiant. À défaut encore, un identifiant court, qui ne devrait jamais
 * s'afficher.
 */
export function memberDisplayName(
  userId: string,
  members: Map<string, MemberInfo>,
): string {
  const info = members.get(userId);
  const nom = info?.displayName?.trim();
  if (nom) return nom;
  if (info?.email) return info.email.split("@")[0] || info.email;
  return `Membre ${userId.slice(0, 6)}`;
}
