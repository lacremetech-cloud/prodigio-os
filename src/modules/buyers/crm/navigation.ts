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
  /** Tranche de budget. DEUX AXES : on croise « en retard » et « plus d'1 M€ »,
      au lieu de choisir entre les deux. */
  budget?: string;
  /** Niveau de qualification — le TROISIÈME axe, même principe : on croise
      « plus d'1 M€ » et « à qualifier » au lieu de choisir. */
  qualification?: string;
  /** Étape du pipeline, filtre détaillé de la liste. */
  stage?: string;
  /** Responsable : un identifiant de membre, ou « aucun ». */
  responsable?: string;
  /**
   * L'ORDRE DE LA LISTE, écrit `?tri=`.
   *
   * Il voyage comme les filtres, et pour la même raison. Il était le dernier à
   * ne vivre que dans la mémoire du composant : on triait par date d'arrivée,
   * on ouvrait un dossier, on revenait — et la liste était retriée par urgence
   * sans que rien à l'écran ne le signale. C'est plus sournois qu'un filtre
   * perdu : un filtre perdu se voit, la liste s'allonge ; un tri perdu ne se
   * voit pas, on croit seulement que les dossiers ont bougé.
   *
   * `urgence` est l'ordre par défaut, et ne s'écrit pas : les adresses restent
   * courtes tant qu'on n'a rien changé.
   */
  tri?: string;
  /**
   * La recherche texte, écrite `?q=`.
   *
   * Elle non plus ne survivait pas à l'ouverture d'une fiche : on cherchait un
   * nom, on ouvrait le dossier, on revenait, et il fallait retaper. Le
   * composant ne la pose dans l'adresse qu'APRÈS une pause de frappe — voir
   * `buyer-inbox` — pour ne pas la réécrire à chaque lettre.
   */
  recherche?: string;
}): string {
  const q = new URLSearchParams();
  if (params.projets.length > 0) q.set("projets", params.projets.join(","));
  if (params.vue !== "liste") q.set("vue", params.vue);
  if (params.signal && params.signal !== "tous") q.set("signal", params.signal);
  if (params.budget && params.budget !== "tous") q.set("budget", params.budget);
  if (params.qualification && params.qualification !== "tous") {
    q.set("qualification", params.qualification);
  }
  if (params.stage && params.stage !== "tous") q.set("stage", params.stage);
  if (params.responsable && params.responsable !== "tous") {
    q.set("responsable", params.responsable);
  }
  if (params.tri && params.tri !== TRI_PAR_DEFAUT) q.set("tri", params.tri);
  if (params.recherche && params.recherche.trim()) q.set("q", params.recherche.trim());
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** Les ordres possibles de la liste, et celui qu'on applique sans rien demander. */
export const TRIS_ACQUEREURS = ["urgence", "arrivee", "arrivee_ancienne", "activite"] as const;
export type TriAcquereurs = (typeof TRIS_ACQUEREURS)[number];
export const TRI_PAR_DEFAUT: TriAcquereurs = "urgence";

/**
 * `?tri=`. Une valeur inconnue rend l'ordre par défaut plutôt qu'une liste
 * vide ou une exception : un lien copié d'une version plus ancienne du CRM
 * doit continuer d'ouvrir un écran utilisable.
 */
export function lireTri(valeur: string | string[] | undefined): TriAcquereurs {
  const v = Array.isArray(valeur) ? valeur[0] : valeur;
  return TRIS_ACQUEREURS.includes(v as TriAcquereurs) ? (v as TriAcquereurs) : TRI_PAR_DEFAUT;
}

/** `?q=`. Le texte cherché, borné : une adresse n'est pas un champ de saisie. */
export function lireRecherche(valeur: string | string[] | undefined): string {
  const v = Array.isArray(valeur) ? valeur[0] : valeur;
  return typeof v === "string" ? v.slice(0, 120) : "";
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
