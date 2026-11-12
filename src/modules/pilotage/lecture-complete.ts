/**
 * LIRE JUSQU'AU BOUT. PostgREST plafonne une réponse (1 000 lignes par défaut) :
 * un total calculé sur une liste tronquée serait faux SANS LE DIRE. On lit donc
 * page après page, jusqu'à une page incomplète.
 *
 * La requête doit être triée sur une clé unique : sans ordre stable, deux pages
 * peuvent se chevaucher ou laisser un trou.
 */

export type Echec = { code?: string; message?: string } | null;

export class LectureImpossible extends Error {
  constructor(readonly code: string | undefined) {
    super("lecture du pilotage impossible");
  }
}

export const TAILLE_DE_PAGE = 1000;

/** Toutes les lignes d'une requête, page après page. */
export async function toutLire<T>(
  requete: (debut: number, fin: number) => PromiseLike<{ data: unknown; error: Echec }>,
): Promise<T[]> {
  const lignes: T[] = [];
  for (let debut = 0; ; debut += TAILLE_DE_PAGE) {
    const { data, error } = await requete(debut, debut + TAILLE_DE_PAGE - 1);
    if (error) throw new LectureImpossible(error.code);
    const page = Array.isArray(data) ? (data as T[]) : [];
    lignes.push(...page);
    if (page.length < TAILLE_DE_PAGE) return lignes;
  }
}
