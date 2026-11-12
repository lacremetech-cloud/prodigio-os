/**
 * Revenir d'une fiche sur l'écran qu'on avait quitté.
 *
 * LE DÉFAUT. On filtre une liste, on la trie, on ouvre un dossier, on revient
 * — et la liste est repartie de zéro. Sur une journée d'appels, c'est quelques
 * secondes perdues par dossier, répétées cent fois, et la certitude diffuse
 * que l'outil ne retient rien.
 *
 * LE PRINCIPE. Tout l'état d'une liste tient dans son adresse. Il suffit alors
 * que le lien vers la fiche l'emporte, et que le lien de retour le rende. Rien
 * n'est gardé en mémoire : un état en mémoire est effacé par le premier
 * aller-retour, et ne se partage pas.
 *
 * Ce module sert les listes dont les filtres vivent DÉJÀ dans l'adresse et
 * sont lus côté serveur — Mandats, Biens. Les acquéreurs ont le leur,
 * `buyers/crm/navigation`, parce que leur liste écrit aussi dans l'adresse
 * depuis le navigateur et doit nommer chaque paramètre.
 *
 * Module neutre : ni serveur, ni client.
 */

/** Ce qui n'identifie pas un écran de liste et n'a donc rien à faire au retour. */
const JAMAIS_REPORTES = new Set(["id"]);

/**
 * La chaîne de requête à recopier dans un lien, à partir des paramètres reçus
 * par une page.
 *
 * On recopie TOUT plutôt qu'une liste de clés connues : ajouter un filtre à
 * une liste ne doit pas obliger à penser, des mois plus tard, à l'ajouter ici.
 * Le prix est qu'un paramètre inconnu voyage aussi — sans conséquence : la
 * page de destination ne lit que ce qu'elle sait lire.
 *
 * Les valeurs vides sont écartées, pour ne pas allonger l'adresse de
 * `?q=&statut=` qui ne filtrent rien.
 */
export function chaineDeRetour(
  params: Record<string, string | string[] | undefined>,
): string {
  const q = new URLSearchParams();
  for (const [cle, valeur] of Object.entries(params)) {
    if (JAMAIS_REPORTES.has(cle)) continue;
    const v = Array.isArray(valeur) ? valeur[0] : valeur;
    if (typeof v === "string" && v.trim() !== "") q.set(cle, v);
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** `chemin` + l'état de la liste. Pour un lien de retour depuis une fiche. */
export function lienDeRetour(
  chemin: string,
  params: Record<string, string | string[] | undefined>,
): string {
  return `${chemin}${chaineDeRetour(params)}`;
}
