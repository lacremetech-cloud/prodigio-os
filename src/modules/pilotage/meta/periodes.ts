/**
 * Les périodes du pilotage, et le découpage des lectures Meta. Fonctions pures :
 * le jour de référence est toujours passé en argument (« AAAA-MM-JJ », jour de
 * l'agence — voir `jourParis`).
 *
 * Les choix proposés sont ceux du cockpit validé par Victor. Les 7 et 30
 * derniers jours s'arrêtent À HIER, comme dans le Gestionnaire de publicités ;
 * « cette semaine » part du lundi.
 */

export const PERIODES = [
  "aujourdhui",
  "hier",
  "7_derniers_jours",
  "cette_semaine",
  "30_derniers_jours",
  "ce_mois",
  "mois_dernier",
  "cette_annee",
  "toute_la_periode",
] as const;

export type Periode = (typeof PERIODES)[number];

export const periodeLabels: Record<Periode, string> = {
  aujourdhui: "Aujourd’hui",
  hier: "Hier",
  "7_derniers_jours": "7 derniers jours",
  cette_semaine: "Cette semaine",
  "30_derniers_jours": "30 derniers jours",
  ce_mois: "Ce mois-ci",
  mois_dernier: "Le mois dernier",
  cette_annee: "Cette année",
  toute_la_periode: "Toute la période",
};

/** Le préréglage Meta (`date_preset`) qui correspond à chaque période. */
export const presetMeta: Record<Periode, string> = {
  aujourdhui: "today",
  hier: "yesterday",
  "7_derniers_jours": "last_7d",
  cette_semaine: "this_week_mon_today",
  "30_derniers_jours": "last_30d",
  ce_mois: "this_month",
  mois_dernier: "last_month",
  cette_annee: "this_year",
  toute_la_periode: "maximum",
};

const JOUR = /^(\d{4})-(\d{2})-(\d{2})$/;

function enDate(jour: string): Date {
  const m = JOUR.exec(jour);
  if (!m) throw new RangeError(`jour invalide : ${jour}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function versJour(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** `jour` décalé de `n` jours (négatif : en arrière). */
export function ajouterJours(jour: string, n: number): string {
  const d = enDate(jour);
  d.setUTCDate(d.getUTCDate() + n);
  return versJour(d);
}

/** Nombre de jours de `debut` à `fin`, bornes comprises. */
export function nombreDeJours(debut: string, fin: string): number {
  return Math.round((enDate(fin).getTime() - enDate(debut).getTime()) / 86_400_000) + 1;
}

/**
 * Les bornes d'une période, incluses. `debut` vaut `null` pour « toute la
 * période » : elle commence avec la première dépense, que seule la base connaît.
 */
export function bornes(periode: Periode, jour: string): { debut: string | null; fin: string } {
  const d = enDate(jour);
  const an = d.getUTCFullYear();
  const mois = d.getUTCMonth();
  switch (periode) {
    case "aujourdhui":
      return { debut: jour, fin: jour };
    case "hier": {
      const hier = ajouterJours(jour, -1);
      return { debut: hier, fin: hier };
    }
    case "7_derniers_jours":
      return { debut: ajouterJours(jour, -7), fin: ajouterJours(jour, -1) };
    case "30_derniers_jours":
      return { debut: ajouterJours(jour, -30), fin: ajouterJours(jour, -1) };
    case "cette_semaine": {
      // getUTCDay : 0 = dimanche. Lundi = 0 jour de recul, dimanche = 6.
      const recul = (d.getUTCDay() + 6) % 7;
      return { debut: ajouterJours(jour, -recul), fin: jour };
    }
    case "ce_mois":
      return { debut: versJour(new Date(Date.UTC(an, mois, 1))), fin: jour };
    case "mois_dernier":
      return {
        debut: versJour(new Date(Date.UTC(an, mois - 1, 1))),
        fin: versJour(new Date(Date.UTC(an, mois, 0))),
      };
    case "cette_annee":
      return { debut: `${an}-01-01`, fin: jour };
    case "toute_la_periode":
      return { debut: null, fin: jour };
  }
}

/** Découpe `[debut, fin]` en tranches consécutives d'au plus `taille` jours. */
export function tranches(debut: string, fin: string, taille = 30): [string, string][] {
  if (fin < debut) return [];
  const out: [string, string][] = [];
  for (let a = debut; a <= fin; a = ajouterJours(a, taille)) {
    const b = ajouterJours(a, taille - 1);
    out.push([a, b < fin ? b : fin]);
  }
  return out;
}

/**
 * Meta ne rend pas les statistiques de plus de 37 mois. La première lecture
 * part de la création du compte, sans remonter au-delà de cette limite.
 */
export function premierJourLisible(creationDuCompte: string | null, aujourdHui: string): string {
  const d = enDate(aujourdHui);
  const limite = versJour(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 37, d.getUTCDate() + 1)));
  const creation = creationDuCompte && JOUR.test(creationDuCompte.slice(0, 10)) ? creationDuCompte.slice(0, 10) : null;
  return creation && creation > limite ? creation : limite;
}

/**
 * La fenêtre d'une lecture : la première fois, tout l'historique ; ensuite les
 * sept jours qui précèdent le dernier jour enregistré, car Meta corrige ses
 * chiffres après coup. Toujours jusqu'à aujourd'hui inclus.
 */
export function fenetreDeLecture(
  couvertJusquAu: string | null,
  creationDuCompte: string | null,
  aujourdHui: string,
): { debut: string; fin: string; premiereFois: boolean } {
  const plancher = premierJourLisible(creationDuCompte, aujourdHui);
  if (!couvertJusquAu) return { debut: plancher, fin: aujourdHui, premiereFois: true };
  const reprise = ajouterJours(couvertJusquAu, -7);
  return { debut: reprise > plancher ? reprise : plancher, fin: aujourdHui, premiereFois: false };
}
