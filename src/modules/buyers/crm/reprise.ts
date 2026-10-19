import {
  etape as definitionEtape,
  qualification as definitionQualification,
} from "./vocabulaire";

/**
 * L'instant de la reprise : la migration `une_personne_une_qualification`,
 * appliquée le 14 octobre 2026 à 19 h UTC.
 *
 * Avant elle, chaque manifestation portait sa propre étape et sa propre
 * qualification. Après, la PERSONNE seule fait foi — les colonnes de la
 * manifestation gardent leur valeur par défaut et ne décrivent plus rien.
 */
export const REPRISE = Date.parse("2026-10-14T19:00:00Z");

export interface EtatFige {
  pipeline_stage: string;
  qualification: string;
  created_at: string;
}

/**
 * L'état figé d'une manifestation — ET SEULEMENT QUAND IL VEUT DIRE QUELQUE
 * CHOSE.
 *
 * La fiche affichait cette ligne SANS AUCUNE CONDITION. Une demande déposée le
 * 19 octobre annonçait donc « Avant la reprise du 14 octobre 2026, ce projet
 * portait : À contacter · À qualifier » : une phrase au passé sur un dossier né
 * cinq jours après, qui ne récite que la valeur par défaut de la colonne. Le
 * commercial y lit un historique qui n'a jamais existé.
 *
 * Deux conditions, toutes deux nécessaires :
 *
 *  • la manifestation est ANTÉRIEURE à la reprise. Les dépôts postérieurs
 *    gardent leurs colonnes à leur valeur par défaut : elles ne racontent rien.
 *  • et son état figé DIFFÈRE de l'état courant de la personne. Répéter au
 *    passé ce que l'en-tête affiche au présent n'apprend rien, et contredit
 *    l'idée même d'un « avant ».
 *
 * Rend `null` quand il n'y a rien à dire : l'appelant n'affiche alors aucune
 * ligne, plutôt qu'une ligne vide.
 */
export function etatFigePertinent(
  i: EtatFige,
  courant: { pipeline_stage: string; qualification: string },
): string | null {
  const ne = Date.parse(i.created_at);
  if (!Number.isFinite(ne) || ne >= REPRISE) return null;
  if (i.pipeline_stage === courant.pipeline_stage && i.qualification === courant.qualification) {
    return null;
  }
  return `${definitionEtape(i.pipeline_stage).label} · ${definitionQualification(i.qualification).label}`;
}
