import { etape as definitionEtape } from "./vocabulaire";

/**
 * QUELLES CONVERSIONS META UN TRAITEMENT DÉCLENCHE — fonction pure.
 *
 * Le panneau « Enregistrer et suivant » (`crm_buyer_enregistrer`) est le
 * chemin le plus utilisé pour faire avancer un dossier, et il n'envoyait
 * RIEN : un dossier passé « en discussion » ou en « visite planifiée » par
 * lui ne comptait ni « inscription terminée » ni « rendez-vous programmé »
 * chez Meta, alors que le même geste fait depuis le Kanban les envoyait.
 *
 * La règle suit le FAIT écrit en base (l'étape avant, l'étape après, la
 * visite réellement inscrite), jamais le seul choix fait à l'écran :
 *  - « inscription terminée » quand le dossier ENTRE en discussion ;
 *  - « rendez-vous programmé » quand il ENTRE en visite planifiée, ou qu'une
 *    visite est inscrite à l'agenda — une seule fois si les deux arrivent
 *    ensemble.
 *
 * Et les nouveaux signaux de l'étape 4, EN ESSAI par défaut (docs/27) :
 *  - `LeadQualifie` quand la personne DEVIENT « qualifié » ou « gros
 *    potentiel » — une décision de l'équipe, jamais un seuil de budget ;
 *  - `Contact` quand le dossier ENTRE en « R1 planifié ».
 */

export type ConversionDuTraitement = "inscription_terminee" | "rendez_vous" | "lead_qualifie" | "contact";

/** « Qualifié » et « gros potentiel » : les deux qualifications qui comptent comme qualifiées partout. */
const QUALIFIEES = new Set(["qualifie", "gros_potentiel"]);

/** L'étape dans le vocabulaire actuel ; `null` si elle est inconnue ou absente. */
function normalisee(valeur: string | null | undefined): string | null {
  if (!valeur) return null;
  return definitionEtape(valeur).valeur;
}

export function conversionsDuTraitement(e: {
  /** L'étape de la personne AVANT l'enregistrement (`null` : illisible). */
  etapeAvant: string | null;
  /** L'étape écrite, telle que la base la renvoie. */
  etapeApres: string | null;
  /** Vrai si une visite a été inscrite ou déplacée par cet enregistrement. */
  visiteInscrite: boolean;
  /** La qualification de la personne avant et après (absentes : pas de signal « qualifié »). */
  qualificationAvant?: string | null;
  qualificationApres?: string | null;
}): ConversionDuTraitement[] {
  const avant = normalisee(e.etapeAvant);
  const apres = normalisee(e.etapeApres);
  const out: ConversionDuTraitement[] = [];
  if (apres === "en_discussion" && avant !== "en_discussion") out.push("inscription_terminee");
  if ((apres === "visite_planifiee" && avant !== "visite_planifiee") || e.visiteInscrite) out.push("rendez_vous");
  if (apres === "r1_planifie" && avant !== "r1_planifie") out.push("contact");
  if (QUALIFIEES.has(e.qualificationApres ?? "") && !QUALIFIEES.has(e.qualificationAvant ?? "")) {
    out.push("lead_qualifie");
  }
  return out;
}
