/**
 * Faut-il réafficher le budget d'un projet, sur la fiche acquéreur ?
 *
 * L'en-tête de la fiche porte déjà le budget — celui de la manifestation la
 * plus récente. Le répéter sous chaque projet n'apprenait rien : deux projets,
 * deux fois la même phrase ; trois projets, trois fois.
 *
 * Mais les réponses PEUVENT différer d'un bien à l'autre. Christiane DORAT a
 * rempli trois formulaires le même jour : « 500 000 € – 1 M€ », puis « Plus
 * d'1 M€ » deux fois. L'en-tête montre la dernière. Le fait qu'elle ait
 * d'abord annoncé moins ne se lit nulle part ailleurs que sous le projet
 * concerné — et pour un commercial qui rappelle, « elle a revu à la hausse »
 * n'est pas un détail.
 *
 * La règle tient donc en une phrase : on montre ce qui AJOUTE quelque chose.
 */
export function budgetARepeter(
  choixDuProjet: string | null,
  choixEnTete: string | null,
): boolean {
  if (!choixDuProjet) return false;
  return choixDuProjet !== choixEnTete;
}
