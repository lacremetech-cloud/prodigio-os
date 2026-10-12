/**
 * Numéro composable — logique **pure**, utilisable des deux côtés.
 *
 * Elle vivait dans un module `"use client"`, et la fiche acquéreur, qui est un
 * composant serveur, l'appelait : Next refuse d'invoquer une fonction cliente
 * depuis le serveur, et la page entière tombait en erreur. Pour tout le monde,
 * pas seulement pour les rôles restreints.
 *
 * Une fonction pure n'appartient à aucun des deux côtés : elle vit donc ici.
 */

/**
 * Un numéro masqué (rôle sans accès aux coordonnées) n'est jamais composable :
 * on renvoie `null` plutôt que de proposer un bouton qui appellerait « ••• ».
 */
export function numeroAppelable(masque: string | null): string | null {
  if (!masque || masque.includes("masqu")) return null;
  const compact = masque.replace(/[^\d+]/g, "");
  return compact.length >= 6 ? compact : null;
}
