/**
 * Navigation du CRM Acquéreurs : par quel projet on travaille, et dans quelle
 * vue.
 *
 * Tout l'état tient dans l'URL. C'est ce qui permet de partager « la liste de
 * Villa Verdun », de la retrouver après une actualisation, et de revenir d'une
 * fiche sans avoir reperdu sa sélection. Un état gardé en mémoire aurait été
 * effacé par le premier aller-retour vers une fiche.
 *
 * Module neutre (ni serveur, ni client) : la page serveur lit les paramètres,
 * le composant client les écrit.
 */

export type VueAcquereurs = "liste" | "pipeline";

const VUES: VueAcquereurs[] = ["liste", "pipeline"];

/** `?vue=pipeline`. Toute autre valeur rend la liste. */
export function lireVue(valeur: string | string[] | undefined): VueAcquereurs {
  const v = Array.isArray(valeur) ? valeur[0] : valeur;
  return VUES.includes(v as VueAcquereurs) ? (v as VueAcquereurs) : "liste";
}

/**
 * `?projets=<id>,<id>`. Sélection MULTIPLE : on peut travailler sur Verdun et
 * Jean Jaurès ensemble sans subir un troisième projet.
 *
 * Un identifiant inconnu est écarté plutôt qu'appliqué : un lien partagé vers
 * un projet auquel on n'a pas accès rend « tous les projets », jamais une liste
 * vide inexplicable — et ne révèle surtout pas l'existence de ce projet.
 * Une sélection vide VAUT « tous les projets ».
 */
export function lireProjets(
  valeur: string | string[] | undefined,
  projetsAutorises: readonly { id: string }[],
): string[] {
  const brut = Array.isArray(valeur) ? valeur.join(",") : valeur ?? "";
  const permis = new Set(projetsAutorises.map((p) => p.id));
  return [...new Set(brut.split(",").map((v) => v.trim()).filter(Boolean))].filter((id) =>
    permis.has(id),
  );
}

/** Écrit la sélection dans une chaîne de requête. Vide = « tous les projets ». */
export function ecrireNavigation(params: {
  projets: readonly string[];
  vue: VueAcquereurs;
  signal?: string;
}): string {
  const q = new URLSearchParams();
  if (params.projets.length > 0) q.set("projets", params.projets.join(","));
  if (params.vue !== "liste") q.set("vue", params.vue);
  if (params.signal && params.signal !== "tous") q.set("signal", params.signal);
  const s = q.toString();
  return s ? `?${s}` : "";
}

/**
 * Une ligne appartient-elle à la sélection ? Une sélection vide laisse tout
 * passer. Fonction pure.
 */
export function dansLaSelection(
  propertyId: string | null,
  projets: readonly string[],
): boolean {
  if (projets.length === 0) return true;
  if (!propertyId) return false;
  return projets.includes(propertyId);
}

/**
 * Couleur stable d'un projet, dérivée de son identifiant.
 *
 * Stable : le même projet garde sa teinte d'un écran à l'autre et d'une session
 * à l'autre, sans table de correspondance à tenir à jour — un nouveau projet
 * reçoit la sienne sans qu'on touche au code.
 *
 * Discrète et DISTINCTE des couleurs d'étape : ces teintes-ci disent « quel
 * projet », celles-là disent « où en est l'affaire ». Les confondre ferait lire
 * un projet comme un statut. Le nom du projet est toujours écrit à côté : la
 * couleur ne porte jamais seule l'information.
 */
const TEINTES_PROJET = [210, 160, 280, 30, 330, 100] as const;

export function teinteProjet(propertyId: string): number {
  let h = 0;
  for (let i = 0; i < propertyId.length; i += 1) {
    h = (h * 31 + propertyId.charCodeAt(i)) % 100000;
  }
  return TEINTES_PROJET[h % TEINTES_PROJET.length] as number;
}
