/**
 * LA prochaine action d'un dossier — une définition, pour tous les écrans.
 *
 * Avant, chacun lisait les tâches à sa façon : la liste ne prenait que les
 * tâches ouvertes, la fiche les affichait toutes (faites comprises) sans dire
 * laquelle était la prochaine, le tableau de bord recomptait de son côté. Un
 * même dossier pouvait donc afficher « Aucune action prévue » dans la liste et
 * un rappel de mardi sur la fiche. Tout ce qui parle de prochaine action passe
 * désormais par ce module.
 *
 * Logique pure : pas de DOM, pas d'horloge implicite. L'instant de référence
 * est un argument, pour que le serveur et le navigateur voient la même chose —
 * sans quoi un rendu serveur de 23 h 59 et une hydratation de 00 h 01
 * n'auraient pas le même « aujourd'hui ».
 */

/** Ce dont ce module a besoin d'une tâche. Volontairement minimal. */
export interface TacheOuverte {
  id: string;
  title: string | null;
  kind: string | null;
  due_at: string | null;
  status: string;
  /** La personne. Les tâches d'une autre ne concernent pas ce dossier. */
  buyer_profile_id: string | null;
  /** Le projet, ou `null` pour un suivi général valable sur tous ses projets. */
  interest_id: string | null;
}

export interface ProchaineAction {
  id: string;
  titre: string;
  kind: string;
  dueAt: string;
  etat: EtatRappel;
  /** Vraie si la tâche vaut pour tous les projets de la personne. */
  generale: boolean;
}

/**
 * Trois états, exclusifs, lus sur le JOUR CIVIL et non sur l'heure.
 *
 * Un rappel calé à 9 h et consulté à 14 h est « aujourd'hui », pas « en
 * retard » : c'est encore la journée pour lequel il a été pris, et le ranger
 * dans les retards ferait paniquer pour rien. « En retard » commence le
 * lendemain, quand la journée promise est passée.
 */
export type EtatRappel = "en_retard" | "aujourdhui" | "a_venir";

export function etatRappel(dueAt: string, maintenant: number): EtatRappel {
  const d = new Date(dueAt);
  const n = new Date(maintenant);
  const jourD = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const jourN = Date.UTC(n.getFullYear(), n.getMonth(), n.getDate());
  if (jourD < jourN) return "en_retard";
  if (jourD > jourN) return "a_venir";
  return "aujourdhui";
}

/**
 * « Dû » = l'échéance est atteinte ou dépassée, à l'heure près.
 *
 * C'est la mesure du tableau de bord, et elle est volontairement différente
 * des trois états ci-dessus : « Rappels dus » répond à « qu'est-ce que je dois
 * faire MAINTENANT », pas à « quel jour était-ce prévu ». Un rappel pris pour
 * 17 h n'est pas dû à 14 h, même s'il est bien « aujourd'hui ».
 */
export function estDu(dueAt: string, maintenant: number): boolean {
  return new Date(dueAt).getTime() <= maintenant;
}

const ETIQUETTE_PAR_DEFAUT: Record<string, string> = {
  rappel: "Rappeler",
  visite: "Visite",
  tache: "À faire",
};

/**
 * La prochaine action d'un dossier (personne × projet).
 *
 * Une tâche rattachée à une manifestation ne vaut QUE pour ce projet : sans
 * cette distinction, caler une visite à Verdun donnerait « prochaine action :
 * visite » à la ligne Jean Jaurès de la même personne. Une tâche sans
 * manifestation est un suivi général : elle vaut pour toutes ses lignes.
 *
 * Entre les deux, la plus proche gagne — c'est elle qu'il faut faire d'abord.
 */
export function prochaineAction(
  taches: TacheOuverte[],
  interestId: string | null,
  maintenant: number,
): ProchaineAction | null {
  const ouvertes = taches.filter((t) => t.status === "a_faire" && t.due_at);
  const candidates = ouvertes.filter(
    (t) => t.interest_id === null || (interestId !== null && t.interest_id === interestId),
  );
  if (candidates.length === 0) return null;

  const meilleure = candidates.reduce((a, b) =>
    (b.due_at ?? "") < (a.due_at ?? "") ? b : a,
  );

  const dueAt = meilleure.due_at as string;
  const kind = meilleure.kind ?? "rappel";
  return {
    id: meilleure.id,
    titre: meilleure.title?.trim() || ETIQUETTE_PAR_DEFAUT[kind] || "À faire",
    kind,
    dueAt,
    etat: etatRappel(dueAt, maintenant),
    generale: meilleure.interest_id === null,
  };
}
