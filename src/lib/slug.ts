/**
 * Fabrication d'identifiants publics lisibles (« slug ») à partir d'un nom.
 *
 * Une seule implémentation pour tout le produit : l'identifiant proposé par
 * l'interface doit être exactement celui que la base accepterait, sinon
 * l'utilisateur découvre la règle en se faisant refuser sa saisie.
 */

/** Minuscules, sans accent ni espace insécable, espaces normalisés. */
export function foldText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[  ]/g, " ")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Identifiant stable dérivé d'un nom : minuscules, sans accent, tirets.
 * Conforme au nettoyage appliqué en base. Renvoie `""` si le nom ne contient
 * aucun caractère exploitable — l'appelant décide quoi en faire, on ne
 * fabrique jamais un identifiant de remplacement.
 */
export function slugify(name: string): string {
  return foldText(name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
    .replace(/-+$/, "");
}
