/**
 * La file d'appels : dans quel ordre Jean-Charles attaque sa session.
 *
 * Logique pure, sans DOM ni horloge implicite — l'instant de référence est
 * passé en argument, pour que le serveur et le navigateur voient la même file.
 */

import type { BuyerInboxRow } from "./queries";

export type RangFile = "retard" | "aujourdhui" | "nouveau" | "plus_tard";

/**
 * Trois priorités, dans cet ordre : ce qu'on a promis et qu'on n'a pas tenu,
 * ce qu'on a promis pour aujourd'hui, puis ce qui vient d'arriver.
 *
 * Les rappels FUTURS restent accessibles mais sortent de la file : les afficher
 * comme urgents transforme un carnet de rendez-vous en liste de retards, et on
 * finit par ne plus croire aucune échéance.
 */
export function rangDansLaFile(row: BuyerInboxRow, maintenant: number): RangFile {
  if (row.nextActionAt) {
    const du = new Date(row.nextActionAt).getTime();
    if (du < maintenant) return "retard";
    if (memeJour(du, maintenant)) return "aujourdhui";
    return "plus_tard";
  }
  // Jamais appelé et aucune action prévue : c'est un lead à attaquer.
  return row.callAttempts === 0 ? "nouveau" : "plus_tard";
}

function memeJour(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

const POIDS: Record<RangFile, number> = {
  retard: 0,
  aujourdhui: 1,
  nouveau: 2,
  plus_tard: 3,
};

/**
 * Les dossiers réellement appelables, dans l'ordre d'attaque.
 *
 * Un numéro signalé invalide en SORT : le rappeler ne produirait qu'une
 * nouvelle tentative perdue. Le dossier, lui, reste dans la liste — on l'a
 * perdu de vue au téléphone, pas tout court.
 */
export function fileDAppels(rows: BuyerInboxRow[], maintenant: number): BuyerInboxRow[] {
  return rows
    .filter((r) => !r.phoneInvalid)
    .map((r) => ({ r, rang: rangDansLaFile(r, maintenant) }))
    .filter((x) => x.rang !== "plus_tard")
    .sort((a, b) => {
      const d = POIDS[a.rang] - POIDS[b.rang];
      if (d !== 0) return d;
      // À rang égal, le plus ancien d'abord : on ne laisse personne traîner.
      const ea = a.r.nextActionAt ?? a.r.createdAt;
      const eb = b.r.nextActionAt ?? b.r.createdAt;
      return ea.localeCompare(eb);
    })
    .map((x) => x.r);
}

/**
 * Le dossier suivant, dans l'ordre de la file FIGÉ au démarrage de la session.
 *
 * Se fier à la file recalculée ferait sauter des dossiers : celui qu'on vient
 * d'enregistrer en sort (il a désormais un rappel futur), toutes les positions
 * glissent d'un cran, et le suivant passe à la trappe sans que personne ne le
 * remarque. On avance donc dans une liste d'identifiants prise au départ.
 */
export function suivantDansLaFile(
  ordre: string[],
  courant: string | null,
): string | null {
  if (courant === null) return ordre[0] ?? null;
  const i = ordre.indexOf(courant);
  if (i < 0) return ordre[0] ?? null;
  return ordre[i + 1] ?? null;
}

/** « 3 sur 18 » : savoir où l'on en est change tout sur une longue session. */
export function positionDansLaFile(ordre: string[], courant: string | null): {
  position: number;
  total: number;
} {
  const total = ordre.length;
  if (courant === null) return { position: 0, total };
  const i = ordre.indexOf(courant);
  return { position: i < 0 ? 0 : i + 1, total };
}
