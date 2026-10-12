import type { BuyerListItem } from "./queries";

/**
 * Les arrivées, jour par jour.
 *
 * Le tableau de bord ne disait que l'instant présent : combien sont arrivés
 * aujourd'hui, combien de dossiers en cours. Rien ne disait si ça monte ou si
 * ça s'essouffle — or c'est la seule question qu'on se pose devant un funnel
 * payant.
 *
 * Un dossier compte le jour où il a été créé, jamais celui de son dernier
 * intérêt : une personne qui revient une deuxième fois n'est pas une nouvelle
 * arrivée. Les dossiers clos sont comptés comme les autres — ils sont bien
 * arrivés, et les retirer réécrirait l'histoire à chaque dossier perdu.
 */
export interface JourArrivees {
  /** `AAAA-MM-JJ`, en heure locale du serveur. */
  jour: string;
  nombre: number;
}

function cleJour(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const j = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${j}`;
}

/**
 * Une case par jour sur la fenêtre demandée, du plus ancien au plus récent.
 * Les jours sans arrivée valent zéro : les omettre tasserait le graphique et
 * ferait passer un creux pour une continuité.
 */
export function arriveesParJour(
  items: BuyerListItem[],
  jours: number,
  now: number = Date.now(),
): JourArrivees[] {
  const debut = new Date(now);
  debut.setHours(0, 0, 0, 0);
  debut.setDate(debut.getDate() - (jours - 1));

  const cases = new Map<string, number>();
  for (let i = 0; i < jours; i += 1) {
    const d = new Date(debut);
    d.setDate(debut.getDate() + i);
    cases.set(cleJour(d), 0);
  }

  for (const item of items) {
    const brut = item.profile.created_at;
    if (!brut) continue;
    const d = new Date(brut);
    if (Number.isNaN(d.getTime())) continue;
    const cle = cleJour(d);
    const actuel = cases.get(cle);
    // Hors fenêtre : on ne crée pas de case, sinon le graphique s'allongerait
    // d'un jour isolé très à gauche.
    if (actuel === undefined) continue;
    cases.set(cle, actuel + 1);
  }

  return [...cases.entries()].map(([jour, nombre]) => ({ jour, nombre }));
}

/**
 * Variation entre la fenêtre affichée et celle qui la précède immédiatement,
 * en pourcentage arrondi.
 *
 * `null` quand la période précédente est vide : on ne divise pas par zéro, et
 * « +∞ % » n'apprend rien. L'appelant écrit alors « première période ».
 */
export function variationArrivees(
  items: BuyerListItem[],
  jours: number,
  now: number = Date.now(),
): number | null {
  const courante = arriveesParJour(items, jours, now).reduce((t, j) => t + j.nombre, 0);

  const finPrecedente = new Date(now);
  finPrecedente.setHours(0, 0, 0, 0);
  finPrecedente.setDate(finPrecedente.getDate() - jours);
  const precedente = arriveesParJour(
    items,
    jours,
    finPrecedente.getTime() + 23 * 3600 * 1000,
  ).reduce((t, j) => t + j.nombre, 0);

  if (precedente === 0) return null;
  return Math.round(((courante - precedente) / precedente) * 100);
}
