/**
 * Ce qu'on vient chercher sur un bien, tous les jours : son tunnel, sa
 * brochure, et ses demandes. Logique **pure** — aucune I/O, testable.
 *
 * Ces trois choses existaient déjà dans le cockpit, mais éparpillées : le lien
 * du tunnel dormait dans la liste des origines autorisées du formulaire, la
 * brochure dans un réglage, et les dossiers acquéreurs huit sections plus bas.
 * Les rassembler ne change aucune donnée ; cela change le temps qu'il faut
 * pour les atteindre.
 */

/**
 * Adresse du tunnel : la page qui porte le formulaire de ce bien.
 *
 * Elle se déduit des **origines autorisées** — la liste blanche qui dit quels
 * sites ont le droit d'afficher le formulaire. C'est la seule source de vérité
 * disponible, et elle a l'avantage d'être toujours exacte : un tunnel qui ne
 * figure pas ici ne peut de toute façon pas afficher le formulaire.
 *
 * On ne retient que `https` : une origine en clair ne serait pas un tunnel en
 * production.
 */
export function lienDuTunnel(origines: readonly string[] | null | undefined): string | null {
  if (!origines) return null;
  for (const brute of origines) {
    const v = typeof brute === "string" ? brute.trim() : "";
    if (/^https:\/\/[^\s/]+/i.test(v)) return v.replace(/\/+$/, "");
  }
  return null;
}

/** Affichage court d'une adresse : le domaine seul, sans protocole ni chemin. */
export function domaineLisible(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Ce qu'il faut savoir d'un dossier pour compter — rien de plus. */
export interface DossierPourCompte {
  pipelineStage: string;
  /** Date de la demande la plus récente de ce dossier sur ce bien. */
  derniereDemande: string | null;
  assigneCount: number;
}

export interface ComptesBien {
  total: number;
  aujourdhui: number;
  aTraiter: number;
  sansResponsable: number;
}

/** Étapes où la balle est encore dans notre camp. */
const A_TRAITER = new Set(["nouveau", "a_rappeler"]);

function memeJour(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Compte les dossiers d'un bien. « Aujourd'hui » se juge dans le fuseau de
 * celui qui regarde, pas en UTC : à 1 h du matin à Paris, une demande de la
 * veille au soir ne doit pas être annoncée comme reçue aujourd'hui.
 */
export function compterDossiers(
  dossiers: readonly DossierPourCompte[],
  maintenant: Date = new Date(),
): ComptesBien {
  let aujourdhui = 0;
  let aTraiter = 0;
  let sansResponsable = 0;
  for (const d of dossiers) {
    if (d.derniereDemande) {
      const quand = new Date(d.derniereDemande);
      if (!Number.isNaN(quand.getTime()) && memeJour(quand, maintenant)) aujourdhui += 1;
    }
    if (A_TRAITER.has(d.pipelineStage)) aTraiter += 1;
    if (d.assigneCount === 0) sansResponsable += 1;
  }
  return { total: dossiers.length, aujourdhui, aTraiter, sansResponsable };
}
