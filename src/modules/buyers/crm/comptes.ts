import type { BuyerListItem } from "./queries";

/**
 * Nombre de dossiers ACTIFS par projet, pour la barre de navigation.
 *
 * Actif = ni gagné ni perdu. Un dossier clos ne demande plus rien : le compter
 * gonflerait un chiffre qu'on lit comme « ce qu'il me reste à faire ».
 *
 * Fonction pure, calculée sur les lignes déjà autorisées par la RLS.
 */
export function comptesParProjet(items: BuyerListItem[]): Map<string, number> {
  const comptes = new Map<string, number>();
  for (const i of items) {
    if (!i.propertyId) continue;
    if (i.stage === "gagne" || i.stage === "perdu") continue;
    comptes.set(i.propertyId, (comptes.get(i.propertyId) ?? 0) + 1);
  }
  return comptes;
}
