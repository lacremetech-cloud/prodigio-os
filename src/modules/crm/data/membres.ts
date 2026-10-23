/**
 * QUI PEUT RECEVOIR UN DOSSIER.
 *
 * Le 23 octobre, le menu « Confier à... » proposait « RECETTE (temporaire) » :
 * le compte de recette neutralisé, sur lequel personne ne peut se connecter.
 * Confier un vrai lead à ce compte l'aurait fait disparaître du radar de tout
 * le monde — sans erreur, sans avertissement, et sans que personne ne pense à
 * aller le chercher là.
 *
 * Proposer un nom à qui on ne peut rien confier est pire que ne pas le
 * proposer : on croit avoir passé la main.
 *
 * La liste vivait, identique, dans trois pages — acquéreurs, pipeline, fiche.
 * Trois copies de la même décision, donc trois endroits où la corriger et deux
 * occasions de l'oublier. Elle vit ici désormais.
 *
 * Module distinct de `queries.ts`, qui porte « server-only » : une fonction
 * pure qu'on ne peut pas tester ne protège de rien.
 */

import { memberDisplayName, type MemberInfo } from "./noms";

export interface OptionMembre {
  userId: string;
  name: string;
}

/**
 * Les membres a qui on peut confier un dossier, par ordre alphabetique.
 *
 * Le filtre porte sur le STATUT, pas sur un nom en dur : un collegue suspendu
 * demain disparaitra de la liste sans qu'on touche au code, et le compte de
 * recette avec lui.
 */
export function membresAffectables(membres: Map<string, MemberInfo>): OptionMembre[] {
  return [...membres.entries()]
    .filter(([, info]) => info.status === "actif")
    .map(([userId]) => ({ userId, name: memberDisplayName(userId, membres) }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}
