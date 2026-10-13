/**
 * LES filtres du CRM acquéreurs — une définition, deux vues.
 *
 * La liste et le Kanban filtraient chacun à leur façon : la liste avec
 * quatorze « signaux », le Kanban avec cinq onglets qui portaient des noms
 * voisins et ne comptaient pas la même chose. Passer de l'une à l'autre
 * changeait le nombre de dossiers sans que rien ne l'explique. Les deux vues
 * appellent désormais ce module, sur les mêmes champs.
 *
 * Deux étages, et c'est voulu :
 *
 *   • TROIS filtres rapides, toujours visibles — Tous / À contacter /
 *     À rappeler. Ce sont les trois questions d'une session d'appels, et elles
 *     tiennent sur une ligne, même sur un téléphone.
 *   • QUATRE filtres repliés derrière un bouton « Filtres » — qualification,
 *     budget, responsable, étape. Ils servent moins souvent, mais ils restent
 *     à portée de clic : un filtre qu'on ne peut atteindre que par l'URL n'est
 *     pas un filtre, c'est une rumeur.
 *
 * Logique pure : l'instant de référence est un argument, pour que le serveur
 * et le navigateur voient le même « aujourd'hui ».
 */

import type { BuyerQualification } from "@/lib/supabase/types";
import { estDu, etatRappel } from "./prochaine-action";

/**
 * Ce dont le filtrage a besoin d'un dossier. Structurel plutôt que nominal :
 * la ligne de liste comme la carte de Kanban le satisfont, ce qui garantit que
 * les deux vues filtrent sur les mêmes champs.
 */
export interface DossierFiltrable {
  name: string;
  emailMasked: string | null;
  phoneMasked: string | null;
  city: string | null;
  propertyLabel: string | null;
  stage: string;
  qualification: BuyerQualification;
  callAttempts: number;
  nextActionAt: string | null;
  assigneeIds: string[];
  budgetMinCents: number | null;
  budgetMaxCents: number | null;
}

// --- Étage 1 : les trois filtres rapides -------------------------------------

export type Signal = "tous" | "a_contacter" | "a_rappeler";

export const SIGNAUX: readonly Signal[] = ["tous", "a_contacter", "a_rappeler"] as const;

export const FILTRES_RAPIDES: { signal: Signal; label: string }[] = [
  { signal: "tous", label: "Tous" },
  { signal: "a_contacter", label: "À contacter" },
  { signal: "a_rappeler", label: "À rappeler" },
];

/**
 * L'échéance affine « À rappeler », et elle seule.
 *
 * `dus` n'est pas proposé en pastille : c'est l'entrée du tableau de bord,
 * dont la tuile « Rappels dus » compte les échéances atteintes ou dépassées, à
 * l'heure près. Elle reste visible comme étiquette retirable une fois la liste
 * ouverte — un filtre actif que rien n'affiche est un filtre qui ment.
 */
export type Echeance = "toutes" | "en_retard" | "aujourdhui" | "a_venir" | "dus";

export const ECHEANCES: readonly Echeance[] = [
  "toutes",
  "en_retard",
  "aujourdhui",
  "a_venir",
  "dus",
] as const;

export const ECHEANCE_LABELS: Record<Echeance, string> = {
  toutes: "Tous les rappels",
  en_retard: "En retard",
  aujourdhui: "Aujourd’hui",
  a_venir: "À venir",
  dus: "Rappels dus",
};

/** Les trois choix proposés dans l'interface, sous « À rappeler ». */
export const ECHEANCES_PROPOSEES: readonly Echeance[] = [
  "toutes",
  "en_retard",
  "aujourdhui",
  "a_venir",
] as const;

// --- Étage 2 : les quatre filtres repliés ------------------------------------

export interface FiltresAvances {
  qualification: BuyerQualification | "tous";
  budget: string;
  responsable: string;
  etape: string;
}

export const FILTRES_AVANCES_VIDES: FiltresAvances = {
  qualification: "tous",
  budget: "tous",
  responsable: "tous",
  etape: "tous",
};

/** Tranches de budget, en centimes. Bornes ouvertes aux extrémités. */
export const TRANCHES_BUDGET: { valeur: string; label: string; min: number | null; max: number | null }[] = [
  { valeur: "tous", label: "Tous budgets", min: null, max: null },
  { valeur: "moins_800k", label: "< 800 k€", min: null, max: 800_000_00 },
  { valeur: "800k_1_2m", label: "800 k€ – 1,2 M€", min: 800_000_00, max: 1_200_000_00 },
  { valeur: "1_2m_2m", label: "1,2 – 2 M€", min: 1_200_000_00, max: 2_000_000_00 },
  { valeur: "2m_3m", label: "2 – 3 M€", min: 2_000_000_00, max: 3_000_000_00 },
  { valeur: "plus_3m", label: "> 3 M€", min: 3_000_000_00, max: null },
];

// --- Application --------------------------------------------------------------

/**
 * « À contacter » = personne ne lui a encore parlé.
 *
 * Ce n'est pas « sans prochaine action » : un dossier qu'on a appelé trois
 * fois sans succès n'est plus à contacter, il est à rappeler. Confondre les
 * deux remettait en tête de file des gens qu'on venait d'essayer de joindre.
 */
export function porteLeSignal(
  d: DossierFiltrable,
  signal: Signal,
  echeance: Echeance,
  maintenant: number,
): boolean {
  if (signal === "a_contacter") return d.callAttempts === 0;
  if (signal === "a_rappeler") {
    if (d.nextActionAt === null) return false;
    if (echeance === "toutes") return true;
    if (echeance === "dus") return estDu(d.nextActionAt, maintenant);
    return etatRappel(d.nextActionAt, maintenant) === echeance;
  }
  return true;
}

function dansLaTranche(d: DossierFiltrable, valeur: string): boolean {
  const tranche = TRANCHES_BUDGET.find((t) => t.valeur === valeur);
  if (!tranche || valeur === "tous") return true;
  /* Un budget non renseigné ne tombe dans AUCUNE tranche. L'inverse — le
     laisser passer partout — faisait apparaître les mêmes dossiers dans cinq
     tranches incompatibles, et le filtre ne voulait plus rien dire. */
  const min = d.budgetMinCents;
  const max = d.budgetMaxCents;
  if (min === null && max === null) return false;
  const bas = min ?? max ?? 0;
  const haut = max ?? min ?? 0;
  if (tranche.min !== null && haut < tranche.min) return false;
  if (tranche.max !== null && bas >= tranche.max) return false;
  return true;
}

export function passeLesFiltresAvances(d: DossierFiltrable, f: FiltresAvances): boolean {
  if (f.qualification !== "tous" && d.qualification !== f.qualification) return false;
  if (f.etape !== "tous" && d.stage !== f.etape) return false;
  if (f.responsable !== "tous") {
    if (f.responsable === "aucun") {
      if (d.assigneeIds.length > 0) return false;
    } else if (!d.assigneeIds.includes(f.responsable)) {
      return false;
    }
  }
  if (!dansLaTranche(d, f.budget)) return false;
  return true;
}

/** Recherche libre sur ce qu'on tape vraiment : un nom, un numéro, une ville. */
export function correspondALaRecherche(d: DossierFiltrable, recherche: string): boolean {
  const q = recherche.trim().toLowerCase();
  if (q === "") return true;
  return [d.name, d.emailMasked, d.phoneMasked, d.city, d.propertyLabel]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(q);
}

export interface EtatFiltres {
  signal: Signal;
  echeance: Echeance;
  recherche: string;
  avances: FiltresAvances;
}

export function filtrer<T extends DossierFiltrable>(
  dossiers: T[],
  etat: EtatFiltres,
  maintenant: number,
): T[] {
  return dossiers.filter(
    (d) =>
      porteLeSignal(d, etat.signal, etat.echeance, maintenant) &&
      correspondALaRecherche(d, etat.recherche) &&
      passeLesFiltresAvances(d, etat.avances),
  );
}

/** Combien de filtres repliés sont actifs — pour la pastille du bouton. */
export function nombreDeFiltresAvances(f: FiltresAvances): number {
  return (
    (f.qualification !== "tous" ? 1 : 0) +
    (f.budget !== "tous" ? 1 : 0) +
    (f.responsable !== "tous" ? 1 : 0) +
    (f.etape !== "tous" ? 1 : 0)
  );
}

// --- Lecture des paramètres d'URL ---------------------------------------------

function premier(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function lireSignal(v: string | string[] | undefined): Signal {
  const s = premier(v);
  return SIGNAUX.includes(s as Signal) ? (s as Signal) : "tous";
}

export function lireEcheance(v: string | string[] | undefined): Echeance {
  const e = premier(v);
  return ECHEANCES.includes(e as Echeance) ? (e as Echeance) : "toutes";
}
