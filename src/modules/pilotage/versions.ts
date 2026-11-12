/**
 * Quelle version s'applique ? Fonctions pures, sans base ni horloge cachée :
 * la date du jour est toujours passée en argument.
 *
 * Les conditions d'un bien et les états d'un lot ne sont jamais réécrits :
 * chaque changement ajoute une ligne. Il faut donc savoir laquelle fait foi.
 */

import { FUSEAU_AGENCE } from "@/modules/crm/format";

/** La date du jour à Paris, « AAAA-MM-JJ » — le jour de l'agence, pas celui du serveur. */
export function jourParis(maintenant: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSEAU_AGENCE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(maintenant);
}

interface Datee {
  id: string;
  saisi_le: string;
}

interface AvecDateEffet extends Datee {
  date_effet: string;
}

/** Ordre de saisie croissant ; à horodatage égal, l'identifiant départage. */
function parSaisie(a: Datee, b: Datee): number {
  const t = Date.parse(a.saisi_le) - Date.parse(b.saisi_le);
  if (t !== 0) return t;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * La version EN VIGUEUR un jour donné : la plus récente par date d'effet sans
 * dépasser ce jour ; à date d'effet égale, la dernière saisie — c'est ainsi
 * qu'on corrige une saisie du jour sans rien effacer.
 */
export function versionEnVigueur<T extends AvecDateEffet>(versions: readonly T[], jour: string): T | null {
  let retenue: T | null = null;
  for (const v of versions) {
    if (v.date_effet > jour) continue;
    if (
      !retenue ||
      v.date_effet > retenue.date_effet ||
      (v.date_effet === retenue.date_effet && parSaisie(v, retenue) > 0)
    ) {
      retenue = v;
    }
  }
  return retenue;
}

/** Les versions qui ne s'appliquent pas encore, de la plus proche à la plus lointaine. */
export function versionsAVenir<T extends AvecDateEffet>(versions: readonly T[], jour: string): T[] {
  return versions
    .filter((v) => v.date_effet > jour)
    .sort((a, b) => (a.date_effet < b.date_effet ? -1 : a.date_effet > b.date_effet ? 1 : parSaisie(a, b)));
}

export type EtatVersion = "en_vigueur" | "a_venir" | "remplacee";

/** Pour l'historique : chaque version, et ce qu'elle est devenue. */
export function etatDeLaVersion<T extends AvecDateEffet>(
  version: T,
  enVigueur: T | null,
  jour: string,
): EtatVersion {
  if (enVigueur && version.id === enVigueur.id) return "en_vigueur";
  if (version.date_effet > jour) return "a_venir";
  return "remplacee";
}

/** L'historique, le plus récent d'abord (date d'effet, puis saisie). */
export function historique<T extends AvecDateEffet>(versions: readonly T[]): T[] {
  return [...versions].sort((a, b) =>
    a.date_effet < b.date_effet ? 1 : a.date_effet > b.date_effet ? -1 : -parSaisie(a, b),
  );
}

/** L'état courant d'un lot : son dernier état saisi. */
export function etatCourant<T extends Datee>(etats: readonly T[]): T | null {
  let dernier: T | null = null;
  for (const e of etats) if (!dernier || parSaisie(e, dernier) > 0) dernier = e;
  return dernier;
}

/** Les états d'un lot, le plus récent d'abord. */
export function etatsRecentsDabord<T extends Datee>(etats: readonly T[]): T[] {
  return [...etats].sort((a, b) => -parSaisie(a, b));
}
