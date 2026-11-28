/**
 * LA PAGE « PILOTAGE » (étape 3a) — le calcul, fonction pure.
 *
 * Tout ce que la vue générale et l'onglet d'un bien affichent se calcule ici, à
 * partir des lignes lues en base : commissions et rentabilité « depuis le
 * début », performance Meta « sur la période », fréquence, séries par jour,
 * pubs gagnantes, alertes. Ni base, ni horloge : tout est passé, tout se teste.
 *
 * TROIS ÉTATS, JAMAIS UN ZÉRO INVENTÉ :
 *  - « manquant »   : une donnée du pilotage manque (conditions, prix, part…) ;
 *  - « en attente » : Meta n'a pas encore été lu (ou pas pour cette période) ;
 *  - un vrai zéro   : Meta a été lu, et il ne s'est rien passé.
 *
 * Le rattachement d'une pub se calcule UNE fois, sur ses derniers noms, puis
 * s'applique à chacun de ses jours : une pub ne change pas de bien d'une période
 * à l'autre. Une pub commune à un groupe se répartit au prorata du prix affiché
 * — sa dépense, et avec elle ses impressions, clics et leads, pour que coût par
 * lead, CTR et CPM d'un bien restent cohérents et que la somme des biens égale
 * le total.
 */

import type {
  PilotageMetaCouvertureRow,
  PilotageMetaPubRow,
  PilotageMetaSynchroRow,
  PilotageMetaTotalPubRow,
} from "@/lib/supabase/types";
import { formatEurosExact as eurosDe } from "./affichage";
import { totaliser, type CalculCommission, type Total } from "./commission";
import { centimesArrondis, divise, entier, fois, fraction, moins, plus, somme, type Exact } from "./exact";
import { ajouterJours, bornes, nombreDeJours, periodeLabels, PERIODES, type Periode } from "./meta/periodes";
import {
  indexerRegles,
  rattacher,
  repartirAuProrata,
  type Rattachement,
  type RegleRattachement,
} from "./meta/rattachement";
import { syntheseDuBien, type EntreeSynthese, type SyntheseBien } from "./synthese";

// -----------------------------------------------------------------------------
// Entrées
// -----------------------------------------------------------------------------

export type ChoixPeriode =
  | { type: "proposee"; periode: Periode }
  | { type: "dates"; debut: string; fin: string };

export interface BienDuTableau extends Omit<EntreeSynthese, "jour"> {
  id: string;
  nom: string;
}

/** Une ligne de `pilotage_meta_insights`, réduite à ce que les graphiques lisent. */
export interface LigneDuJour {
  jour: string;
  ad_id: string;
  depense_cents: number;
  leads: number;
}

export interface DonneesMeta {
  /** Le journal des lectures, les plus récentes d'abord. */
  lectures: readonly PilotageMetaSynchroRow[];
  /** Totaux par pub depuis le début (avec ses derniers noms). */
  depuisLeDebut: readonly PilotageMetaTotalPubRow[];
  /** Totaux par pub sur la période. */
  surLaPeriode: readonly PilotageMetaTotalPubRow[];
  parJour: readonly LigneDuJour[];
  /** La couverture lue pour la période proposée (total, puis par bien). */
  couverture: readonly PilotageMetaCouvertureRow[];
  pubs: readonly PilotageMetaPubRow[];
  regles: readonly RegleRattachement[];
  /** Jours, sur les 90 derniers, où la somme des pubs s'écarte de la dépense du compte. */
  joursEnEcart: number;
}

export interface EntreeTableau {
  /** Aujourd'hui, jour de l'agence (« AAAA-MM-JJ »). */
  jour: string;
  choix: ChoixPeriode;
  biens: readonly BienDuTableau[];
  meta: DonneesMeta;
}

// -----------------------------------------------------------------------------
// Sorties
// -----------------------------------------------------------------------------

/** Une valeur calculée, ou ce qui l'empêche. */
export type Calcule =
  | { etat: "ok"; valeur: Exact }
  | { etat: "manquant"; raison: string }
  | { etat: "en_attente" }
  | { etat: "sans_objet"; raison: string };

export interface PeriodeResolue {
  choix: ChoixPeriode;
  libelle: string;
  /** `null` : « toute la période » alors qu'aucune dépense n'est encore lue. */
  debut: string | null;
  fin: string;
}

export interface Indicateurs {
  depense: Exact;
  impressions: Exact;
  clics: Exact;
  leads: Exact;
  coutParLead: Calcule;
  /** Clics (tous) ÷ impressions, comme le champ `ctr` de Meta ; une fraction (0,0123 = 1,23 %). */
  ctr: Calcule;
  /** Centimes pour mille impressions. */
  cpm: Calcule;
}

export type Frequence =
  | { etat: "ok"; valeur: number; couverture: number; impressions: number }
  | { etat: "en_attente" }
  | { etat: "indisponible"; raison: string }
  | { etat: "dates_au_choix" };

export interface PubGagnante {
  adId: string;
  nom: string;
  campagne: string | null;
  depense: Exact;
  leads: number;
  coutParLead: Exact | null;
  lienApercu: string | null;
  /** Les biens de la pub (vide : orpheline). */
  biens: string[];
}

export interface Rentabilite {
  pubHT: Calcule;
  coutsFixesHT: number;
  roas: Calcule;
  margeNetteHT: Calcule;
}

export interface LotDuTableau {
  numero: string;
  prixCentimes: number | null;
  statut: string | null;
  potentiel: CalculCommission | null;
  /** Part du programme au prorata du prix (`null` : un lot sans prix rend le prorata impossible). */
  part: Exact | null;
  pubHT: Calcule;
  coutsFixesHT: Calcule;
  margeNetteHT: Calcule;
  roas: Calcule;
}

export interface BienCalcule {
  id: string;
  nom: string;
  /** Rang de couleur (0 à 7), stable ; `null` : au-delà de huit biens, « Autres biens ». */
  couleur: number | null;
  synthese: SyntheseBien;
  /** `null` : aucune condition en vigueur — la commission est « manquante ». */
  potentielHT: Total | null;
  potentielTTC: Total | null;
  encaisseHT: Total;
  depuisLeDebut: Indicateurs | null;
  rentabilite: Rentabilite;
  surLaPeriode: Indicateurs | null;
  frequence: Frequence;
  lots: LotDuTableau[] | null;
  pubsGagnantes: PubGagnante[];
  /** Vrai si le bien reçoit une part d'une pub commune à plusieurs biens. */
  depensesCommunes: boolean;
}

export interface Point {
  /** Premier jour du point (« AAAA-MM-JJ ») ; une semaine commence le lundi. */
  debut: string;
  fin: string;
  depense: Map<string, Exact>;
  leads: Map<string, Exact>;
}

export interface Serie {
  pas: "jour" | "semaine";
  points: Point[];
  /** Les clés de séries présentes : les biens, puis « non rattachée » s'il y a lieu. */
  cles: string[];
}

export interface Alerte {
  niveau: "attention" | "info";
  texte: string;
  lien?: string;
}

export interface EtatDeLaLecture {
  lu: boolean;
  /** Fin de la dernière lecture réussie ou partielle. */
  lueLe: string | null;
  couvertJusquAu: string | null;
  derniere: PilotageMetaSynchroRow | null;
  devise: string | null;
}

export interface TableauPilotage {
  jour: string;
  periode: PeriodeResolue;
  /** Les noms des pubs et des campagnes, tels que Meta les donne (pour la page). */
  noms: { pubs: Map<string, string>; campagnes: Map<string, string> };
  /**
   * Ce qui distingue deux pubs de même nom : leur campagne, leurs jours de
   * diffusion lus chez Meta (depuis le début) et leur lien d'aperçu.
   */
  fichesPubs: Map<string, FichePub>;
  lecture: EtatDeLaLecture;
  biens: BienCalcule[];
  global: {
    potentielHT: Total;
    potentielTTC: Total;
    encaisseHT: Total;
    depuisLeDebut: Indicateurs | null;
    rentabilite: Rentabilite;
    surLaPeriode: Indicateurs | null;
    frequence: Frequence;
    pubsGagnantes: PubGagnante[];
    horsPortefeuille: { depuisLeDebut: Exact; surLaPeriode: Exact; pubs: number };
    nonRattachee: { depuisLeDebut: Exact; surLaPeriode: Exact; pubs: number };
  };
  serie: Serie;
  /**
   * La dépense et les leads Meta de la période, jour par jour : par bien (sa
   * part des pubs communes comprise) et, sous `CLE_NON_RATTACHEE`, la dépense
   * rattachée à aucun bien ; le hors portefeuille est exclu. Sert à compter
   * « à partir d'un jour » (`metaAPartirDu`).
   */
  quotidien: Map<string, Map<string, MetaDuJour>>;
  /**
   * La dépense de la période, jour par jour, par bien PUIS par pub (la part
   * d'une pub commune comprise) : pour le coût d'une pub sur les mêmes jours
   * que le CRM (`depensePubAPartirDu`).
   */
  quotidienParPub: Map<string, Map<string, Map<string, Exact>>>;
  alertes: Alerte[];
}

export interface FichePub {
  nom: string | null;
  campagne: string | null;
  /** Premier et dernier jour où Meta rapporte la pub. */
  premierJour: string | null;
  dernierJour: string | null;
  lienApercu: string | null;
}

export interface MetaDuJour {
  depense: Exact;
  leads: Exact;
}

export const CLE_NON_RATTACHEE = "non_rattachee";
export const COULEURS = 8;
/** Au-delà de deux mois, un point par semaine : des barres d'un jour seraient illisibles. */
const JOURS_MAX_AU_JOUR = 62;

// -----------------------------------------------------------------------------
// Outils
// -----------------------------------------------------------------------------

const ZERO = fraction(BigInt(0));
const UN = fraction(BigInt(1));
const MILLE = entier(1000);

function estNul(x: Exact): boolean {
  return x.n === BigInt(0);
}

/** Un `numeric` (ou entier) lu en base, en exact ; une valeur illisible compte pour rien. */
function exact(x: number | null | undefined): Exact {
  return typeof x === "number" && Number.isSafeInteger(x) ? entier(x) : ZERO;
}

const parNom = new Intl.Collator("fr-FR", { sensitivity: "base", numeric: true });

/** Le prix qui sert de poids à la répartition d'un groupe : prix affiché, ou somme des lots. */
export function prixDeReference(s: SyntheseBien): number | null {
  const c = s.enVigueur;
  if (!c) return null;
  if (!c.vente_par_lots) return c.prix_affiche_cents;
  const t = s.totalLots?.prix;
  return t && t.complet && s.lots.length > 0 ? centimesArrondis(t.centimes) : null;
}

function choixValide(choix: ChoixPeriode): boolean {
  return choix.type === "dates" || (PERIODES as readonly string[]).includes(choix.periode);
}

const dateCourte = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Un jour « AAAA-MM-JJ », écrit court (« 14 oct. 2026 »). */
export function libelleJour(jour: string): string {
  return dateCourte.format(new Date(`${jour}T00:00:00Z`));
}

/** Les bornes d'un choix ; « toute la période » commence au premier jour lu chez Meta. */
export function resoudrePeriode(choix: ChoixPeriode, jour: string, premierJourMeta: string | null): PeriodeResolue {
  if (!choixValide(choix)) throw new RangeError("période inconnue");
  if (choix.type === "dates") {
    return { choix, libelle: `Du ${libelleJour(choix.debut)} au ${libelleJour(choix.fin)}`, debut: choix.debut, fin: choix.fin };
  }
  const b = bornes(choix.periode, jour);
  return { choix, libelle: periodeLabels[choix.periode], debut: b.debut ?? premierJourMeta, fin: b.fin };
}

// -----------------------------------------------------------------------------
// Rattachement de chaque pub : poids par bien
// -----------------------------------------------------------------------------

type Destination =
  | { type: "biens"; poids: Map<string, Exact>; rattachement: Rattachement }
  | { type: "hors_portefeuille"; rattachement: Rattachement }
  | { type: "orpheline"; rattachement: Rattachement }
  | { type: "non_repartie"; rattachement: Rattachement; biensSansPrix: string[] };

function destinations(
  pubs: readonly PilotageMetaTotalPubRow[],
  regles: readonly RegleRattachement[],
  prix: ReadonlyMap<string, number | null>,
): Map<string, Destination> {
  const index = indexerRegles(regles);
  const out = new Map<string, Destination>();
  for (const p of pubs) {
    const r = rattacher(p, index);
    if (r.type === "orpheline") out.set(p.ad_id, { type: "orpheline", rattachement: r });
    else if (r.type === "hors_portefeuille") out.set(p.ad_id, { type: "hors_portefeuille", rattachement: r });
    else {
      const rep = repartirAuProrata(1, r.biens, prix);
      out.set(
        p.ad_id,
        rep.ok
          ? { type: "biens", poids: rep.parts, rattachement: r }
          : { type: "non_repartie", rattachement: r, biensSansPrix: rep.biensSansPrix },
      );
    }
  }
  return out;
}

// -----------------------------------------------------------------------------
// Compteurs Meta
// -----------------------------------------------------------------------------

interface Compteurs {
  depense: Exact;
  impressions: Exact;
  clics: Exact;
  leads: Exact;
}

function compteursVides(): Compteurs {
  return { depense: ZERO, impressions: ZERO, clics: ZERO, leads: ZERO };
}

function ajouter(c: Compteurs, p: PilotageMetaTotalPubRow, poids: Exact): void {
  c.depense = plus(c.depense, fois(exact(p.depense_cents), poids));
  c.impressions = plus(c.impressions, fois(exact(p.impressions), poids));
  c.clics = plus(c.clics, fois(exact(p.clics), poids));
  c.leads = plus(c.leads, fois(exact(p.leads), poids));
}

function indicateurs(c: Compteurs): Indicateurs {
  return {
    ...c,
    coutParLead: estNul(c.leads) ? { etat: "sans_objet", raison: "aucun lead" } : { etat: "ok", valeur: divise(c.depense, c.leads) },
    ctr: estNul(c.impressions) ? { etat: "sans_objet", raison: "aucune impression" } : { etat: "ok", valeur: divise(c.clics, c.impressions) },
    cpm: estNul(c.impressions)
      ? { etat: "sans_objet", raison: "aucune impression" }
      : { etat: "ok", valeur: divise(fois(c.depense, MILLE), c.impressions) },
  };
}

/** Les compteurs d'une liste de totaux par pub, ventilés : par bien, total, hors portefeuille, non rattaché. */
function ventiler(
  totaux: readonly PilotageMetaTotalPubRow[],
  dest: ReadonlyMap<string, Destination>,
): { parBien: Map<string, Compteurs>; total: Compteurs; hors: Compteurs; nonRattachee: Compteurs; pubsHors: number; pubsNonRattachees: number } {
  const parBien = new Map<string, Compteurs>();
  const total = compteursVides();
  const hors = compteursVides();
  const nonRattachee = compteursVides();
  let pubsHors = 0;
  let pubsNonRattachees = 0;
  for (const p of totaux) {
    const d = dest.get(p.ad_id);
    if (!d || d.type === "orpheline" || d.type === "non_repartie") {
      ajouter(total, p, UN);
      ajouter(nonRattachee, p, UN);
      pubsNonRattachees += 1;
    } else if (d.type === "hors_portefeuille") {
      ajouter(hors, p, UN);
      pubsHors += 1;
    } else {
      ajouter(total, p, UN);
      for (const [bien, poids] of d.poids) {
        const c = parBien.get(bien) ?? compteursVides();
        ajouter(c, p, poids);
        parBien.set(bien, c);
      }
    }
  }
  return { parBien, total, hors, nonRattachee, pubsHors, pubsNonRattachees };
}

// -----------------------------------------------------------------------------
// Fréquence
// -----------------------------------------------------------------------------

function frequence(
  choix: ChoixPeriode,
  jour: string,
  lu: boolean,
  couverture: readonly PilotageMetaCouvertureRow[],
  bien: string | null,
  /** Les impressions du bien sur la période, selon les règles en vigueur (pour un bien). */
  impressionsDuBien: Exact | null,
): Frequence {
  if (choix.type === "dates") return { etat: "dates_au_choix" };
  if (!lu) return { etat: "en_attente" };
  const b = bornes(choix.periode, jour);
  // Une couverture lue un autre jour que celui de la page n'a plus les bornes
  // de la période : elle sera relue à la prochaine lecture.
  const duJour = (l: PilotageMetaCouvertureRow) => l.date_fin === b.fin && (b.debut === null || l.date_debut === b.debut);
  const total = couverture.find((c) => c.periode === choix.periode && (c.property_id ?? null) === null);
  // Sans la ligne du total (ou d'un autre jour), la période elle-même n'a pas été relue.
  if (!total || !duJour(total)) return { etat: "en_attente" };
  const ligne = bien === null ? total : couverture.find((c) => c.periode === choix.periode && c.property_id === bien);
  if (!ligne) {
    // La lecture n'écrit une ligne que pour les biens qui ont diffusé sur la
    // période. Pas de ligne et pas d'impression : rien n'a été diffusé — « — ».
    // Pas de ligne MAIS des impressions : une règle a changé depuis la lecture,
    // la couverture de ce bien sera lue à la prochaine.
    return impressionsDuBien && !estNul(impressionsDuBien)
      ? { etat: "en_attente" }
      : { etat: "indisponible", raison: "aucune diffusion sur la période" };
  }
  if (!duJour(ligne)) return { etat: "en_attente" };
  if (ligne.couverture == null || ligne.impressions == null) {
    return { etat: "indisponible", raison: ligne.raison ?? "couverture non lue" };
  }
  if (ligne.couverture <= 0) return { etat: "indisponible", raison: "aucune diffusion sur la période" };
  return {
    etat: "ok",
    valeur: ligne.impressions / ligne.couverture,
    couverture: ligne.couverture,
    impressions: ligne.impressions,
  };
}

// -----------------------------------------------------------------------------
// Pubs gagnantes : le plus de leads ; à égalité, le moins cher par lead
// -----------------------------------------------------------------------------

function gagnantes(
  totaux: readonly PilotageMetaTotalPubRow[],
  dest: ReadonlyMap<string, Destination>,
  liens: ReadonlyMap<string, string | null>,
  filtre: (d: Destination | undefined) => boolean,
  combien: number,
): PubGagnante[] {
  return totaux
    .filter((p) => p.leads > 0 && filtre(dest.get(p.ad_id)))
    .map((p) => {
      const d = dest.get(p.ad_id);
      const depense = exact(p.depense_cents);
      return {
        adId: p.ad_id,
        nom: p.ad_name ?? p.ad_id,
        campagne: p.campaign_name,
        depense,
        leads: p.leads,
        coutParLead: divise(depense, entier(p.leads)),
        lienApercu: liens.get(p.ad_id) ?? null,
        biens: d && d.type === "biens" ? [...d.poids.keys()] : [],
      };
    })
    .sort((a, b) => {
      if (b.leads !== a.leads) return b.leads - a.leads;
      const ca = a.coutParLead!;
      const cb = b.coutParLead!;
      // a.n/a.d < b.n/b.d  ⇔  a.n·b.d < b.n·a.d (dénominateurs positifs)
      const diff = ca.n * cb.d - cb.n * ca.d;
      if (diff !== BigInt(0)) return diff < BigInt(0) ? -1 : 1;
      return a.adId.localeCompare(b.adId);
    })
    .slice(0, combien);
}

// -----------------------------------------------------------------------------
// Série par jour (ou par semaine au-delà de deux mois)
// -----------------------------------------------------------------------------

function lundi(jourIso: string): string {
  const d = new Date(`${jourIso}T00:00:00Z`);
  return ajouterJours(jourIso, -((d.getUTCDay() + 6) % 7));
}

/** Les colonnes d'un graphique : un jour chacune, ou une semaine (du lundi) au-delà de deux mois. */
export function decoupage(debut: string, fin: string): { pas: Serie["pas"]; points: { debut: string; fin: string }[] } {
  if (fin < debut) return { pas: "jour", points: [] };
  const pas: Serie["pas"] = nombreDeJours(debut, fin) > JOURS_MAX_AU_JOUR ? "semaine" : "jour";
  const points = new Map<string, { debut: string; fin: string }>();
  for (let j = debut; j <= fin; j = ajouterJours(j, 1)) {
    const cle = pas === "jour" ? j : lundi(j);
    const p = points.get(cle);
    if (p) p.fin = j;
    else points.set(cle, { debut: j, fin: j });
  }
  return { pas, points: [...points.values()] };
}

function serie(
  periode: PeriodeResolue,
  lignes: readonly LigneDuJour[],
  dest: ReadonlyMap<string, Destination>,
  couvertJusquAu: string | null,
): Serie {
  const fin = couvertJusquAu && couvertJusquAu < periode.fin ? couvertJusquAu : periode.fin;
  if (!periode.debut || fin < periode.debut) return { pas: "jour", points: [], cles: [] };
  const colonnes = decoupage(periode.debut, fin);
  const pas = colonnes.pas;
  const points = new Map<string, Point>(
    colonnes.points.map((c) => [c.debut, { debut: c.debut, fin: c.fin, depense: new Map(), leads: new Map() }]),
  );
  const cles = new Set<string>();
  const ajouterA = (p: Point, cle: string, depense: Exact, leads: Exact) => {
    cles.add(cle);
    p.depense.set(cle, plus(p.depense.get(cle) ?? ZERO, depense));
    p.leads.set(cle, plus(p.leads.get(cle) ?? ZERO, leads));
  };
  for (const l of lignes) {
    if (l.jour < periode.debut || l.jour > fin) continue;
    const p = points.get(pas === "jour" ? l.jour : lundi(l.jour));
    if (!p) continue;
    const d = dest.get(l.ad_id);
    if (d?.type === "hors_portefeuille") continue;
    if (d?.type === "biens") {
      for (const [bien, poids] of d.poids) ajouterA(p, bien, fois(exact(l.depense_cents), poids), fois(exact(l.leads), poids));
    } else {
      ajouterA(p, CLE_NON_RATTACHEE, exact(l.depense_cents), exact(l.leads));
    }
  }
  return { pas, points: [...points.values()], cles: [...cles] };
}

/** La dépense et les leads de la période, jour par jour et par bien (voir `TableauPilotage.quotidien`). */
function quotidien(
  periode: PeriodeResolue,
  lignes: readonly LigneDuJour[],
  dest: ReadonlyMap<string, Destination>,
): Map<string, Map<string, MetaDuJour>> {
  const out = new Map<string, Map<string, MetaDuJour>>();
  if (!periode.debut) return out;
  const ajouterA = (cle: string, jour: string, depense: Exact, leads: Exact) => {
    const jours = out.get(cle) ?? new Map<string, MetaDuJour>();
    const v = jours.get(jour);
    jours.set(jour, v ? { depense: plus(v.depense, depense), leads: plus(v.leads, leads) } : { depense, leads });
    out.set(cle, jours);
  };
  for (const l of lignes) {
    if (l.jour < periode.debut || l.jour > periode.fin) continue;
    const d = dest.get(l.ad_id);
    if (d?.type === "hors_portefeuille") continue;
    if (d?.type === "biens") {
      for (const [bien, poids] of d.poids) ajouterA(bien, l.jour, fois(exact(l.depense_cents), poids), fois(exact(l.leads), poids));
    } else {
      ajouterA(CLE_NON_RATTACHEE, l.jour, exact(l.depense_cents), exact(l.leads));
    }
  }
  return out;
}

/** La dépense de la période, jour par jour, par bien puis par pub (voir `TableauPilotage.quotidienParPub`). */
function quotidienParPub(
  periode: PeriodeResolue,
  lignes: readonly LigneDuJour[],
  dest: ReadonlyMap<string, Destination>,
): Map<string, Map<string, Map<string, Exact>>> {
  const out = new Map<string, Map<string, Map<string, Exact>>>();
  if (!periode.debut) return out;
  for (const l of lignes) {
    if (l.jour < periode.debut || l.jour > periode.fin) continue;
    const d = dest.get(l.ad_id);
    if (d?.type !== "biens") continue;
    for (const [bien, poids] of d.poids) {
      const pubs = out.get(bien) ?? new Map<string, Map<string, Exact>>();
      const jours = pubs.get(l.ad_id) ?? new Map<string, Exact>();
      jours.set(l.jour, plus(jours.get(l.jour) ?? ZERO, fois(exact(l.depense_cents), poids)));
      pubs.set(l.ad_id, jours);
      out.set(bien, pubs);
    }
  }
  return out;
}

/**
 * La dépense d'UNE pub pour un bien (sa part, si la pub est commune), sur la
 * période et à partir d'un jour (inclus). `null` tant que Meta n'a pas été lu ;
 * un vrai zéro si la pub n'a rien dépensé ces jours-là.
 */
export function depensePubAPartirDu(t: TableauPilotage, bien: string, adId: string, depuis: string): Exact | null {
  if (!t.lecture.lu) return null;
  let depense = ZERO;
  for (const [jour, v] of t.quotidienParPub.get(bien)?.get(adId) ?? []) {
    if (jour >= depuis) depense = plus(depense, v);
  }
  return depense;
}

/**
 * La dépense et les leads Meta de la période À PARTIR D'UN JOUR (inclus) :
 * d'un bien (sa part des pubs communes comprise), ou de tout le portefeuille
 * (`null` : les biens et la dépense non rattachée ; hors portefeuille exclu,
 * comme au total de la période). `null` tant que Meta n'a pas été lu.
 */
export function metaAPartirDu(t: TableauPilotage, bien: string | null, depuis: string): MetaDuJour | null {
  if (!t.lecture.lu) return null;
  let depense = ZERO;
  let leads = ZERO;
  for (const [cle, jours] of t.quotidien) {
    if (bien !== null && cle !== bien) continue;
    for (const [jour, v] of jours) {
      if (jour < depuis) continue;
      depense = plus(depense, v.depense);
      leads = plus(leads, v.leads);
    }
  }
  return { depense, leads };
}

// -----------------------------------------------------------------------------
// Rentabilité
// -----------------------------------------------------------------------------

function totalVide(): Total {
  return totaliser([]);
}

function additionner(totaux: readonly Total[]): Total {
  return {
    centimes: somme(totaux.map((t) => t.centimes)),
    complet: totaux.every((t) => t.complet),
    absents: totaux.reduce((n, t) => n + t.absents, 0),
    manques: [...new Set(totaux.flatMap((t) => t.manques))],
  };
}

const RAISON_COMMISSION = "commission incomplète (voir le calcul)";

function rentabilite(potentielHT: Total | null, pub: Calcule, coutsFixesHT: number): Rentabilite {
  const commission: Calcule =
    potentielHT === null
      ? { etat: "manquant", raison: "aucune condition saisie" }
      : potentielHT.complet
        ? { etat: "ok", valeur: potentielHT.centimes }
        : { etat: "manquant", raison: RAISON_COMMISSION };
  const roas: Calcule =
    commission.etat !== "ok"
      ? commission
      : pub.etat !== "ok"
        ? pub
        : estNul(pub.valeur)
          ? { etat: "sans_objet", raison: "aucune dépense Meta" }
          : { etat: "ok", valeur: divise(commission.valeur, pub.valeur) };
  const marge: Calcule =
    commission.etat !== "ok"
      ? commission
      : pub.etat !== "ok"
        ? pub
        : { etat: "ok", valeur: moins(moins(commission.valeur, pub.valeur), entier(coutsFixesHT)) };
  return { pubHT: pub, coutsFixesHT, roas, margeNetteHT: marge };
}

function lotsDuBien(s: SyntheseBien, pub: Calcule): LotDuTableau[] | null {
  if (!s.enVigueur?.vente_par_lots) return null;
  const prix = s.lots.map((l) => l.etat?.prix_cents ?? null);
  const complet = prix.length > 0 && prix.every((p) => p != null && p > 0);
  const totalPrix = complet ? somme(prix.map((p) => entier(p as number))) : null;
  const coutsBien = entier(s.couts.totalHtCentimes);
  return s.lots.map((l, i) => {
    const part = totalPrix ? divise(entier(prix[i] as number), totalPrix) : null;
    const sansPart: Calcule = { etat: "manquant", raison: "un lot sans prix empêche la répartition" };
    const pubLot: Calcule = pub.etat !== "ok" ? pub : part ? { etat: "ok", valeur: fois(pub.valeur, part) } : sansPart;
    const coutsLot: Calcule = part ? { etat: "ok", valeur: fois(coutsBien, part) } : sansPart;
    const com = l.potentiel?.comProdigioHT;
    const commission: Calcule = com?.ok ? { etat: "ok", valeur: com.centimes } : { etat: "manquant", raison: "commission du lot manquante" };
    const marge: Calcule =
      commission.etat !== "ok"
        ? commission
        : pubLot.etat !== "ok"
          ? pubLot
          : coutsLot.etat !== "ok"
            ? coutsLot
            : { etat: "ok", valeur: moins(moins(commission.valeur, pubLot.valeur), coutsLot.valeur) };
    const roas: Calcule =
      commission.etat !== "ok"
        ? commission
        : pubLot.etat !== "ok"
          ? pubLot
          : estNul(pubLot.valeur)
            ? { etat: "sans_objet", raison: "aucune dépense Meta" }
            : { etat: "ok", valeur: divise(commission.valeur, pubLot.valeur) };
    return {
      numero: l.lot.numero,
      prixCentimes: l.etat?.prix_cents ?? null,
      statut: l.etat?.statut_commercial ?? null,
      potentiel: l.potentiel,
      part,
      pubHT: pubLot,
      coutsFixesHT: coutsLot,
      margeNetteHT: marge,
      roas,
    };
  });
}

function commissions(s: SyntheseBien): { ht: Total | null; ttc: Total | null; encaisse: Total } {
  if (!s.enVigueur) return { ht: null, ttc: null, encaisse: totalVide() };
  if (s.enVigueur.vente_par_lots) {
    const vendus = s.lots.map((l) => l.encaisse).filter((e): e is CalculCommission => e !== null);
    return {
      ht: s.totalLots?.comProdigioHT ?? totalVide(),
      ttc: s.totalLots?.comProdigioTTC ?? totalVide(),
      encaisse: totaliser(vendus.map((e) => e.comProdigioHT)),
    };
  }
  return {
    ht: s.potentiel ? totaliser([s.potentiel.comProdigioHT]) : null,
    ttc: s.potentiel ? totaliser([s.potentiel.comProdigioTTC]) : null,
    encaisse: s.encaisse ? totaliser([s.encaisse.comProdigioHT]) : totalVide(),
  };
}

// -----------------------------------------------------------------------------
// Le tableau
// -----------------------------------------------------------------------------

function etatDeLaLecture(lectures: readonly PilotageMetaSynchroRow[]): EtatDeLaLecture {
  const reussie = lectures.find((l) => l.statut === "reussie" || l.statut === "partielle");
  const couvert = lectures.reduce<string | null>(
    (max, l) => (l.couvert_jusqu_au && (!max || l.couvert_jusqu_au > max) ? l.couvert_jusqu_au : max),
    null,
  );
  return {
    lu: Boolean(reussie) || couvert !== null,
    lueLe: reussie?.terminee_le ?? null,
    couvertJusquAu: couvert,
    derniere: lectures[0] ?? null,
    devise: reussie?.devise ?? lectures.find((l) => l.devise)?.devise ?? null,
  };
}

function aDesDonnees(b: BienDuTableau): boolean {
  return b.conditions.length > 0 || b.lots.length > 0 || b.couts.length > 0;
}

function premiereSaisie(b: BienDuTableau): string {
  return b.conditions.reduce((min, c) => (c.saisi_le < min ? c.saisi_le : min), "9999");
}

export function calculerTableau(e: EntreeTableau): TableauPilotage {
  const lecture = etatDeLaLecture(e.meta.lectures);
  const synth = new Map(e.biens.map((b) => [b.id, syntheseDuBien({ ...b, jour: e.jour })]));
  const prix = new Map([...synth].map(([id, s]) => [id, prixDeReference(s)]));
  const dest = destinations(e.meta.depuisLeDebut, e.meta.regles, prix);
  // Une pub apparue sur la période mais pas encore dans les totaux (impossible
  // en pratique : même lecture) est rattachée à la volée.
  for (const [id, d] of destinations(
    e.meta.surLaPeriode.filter((p) => !dest.has(p.ad_id)),
    e.meta.regles,
    prix,
  )) {
    dest.set(id, d);
  }

  // « Toute la période » commence à la première dépense du PORTEFEUILLE : une
  // vieille campagne hors portefeuille, exclue des indicateurs et des
  // graphiques, ne doit pas ouvrir l'axe sur des semaines vides.
  const premierJour = e.meta.depuisLeDebut.reduce<string | null>((min, p) => {
    if (dest.get(p.ad_id)?.type === "hors_portefeuille") return min;
    return p.premier_jour && (!min || p.premier_jour < min) ? p.premier_jour : min;
  }, null);
  const periode = resoudrePeriode(e.choix, e.jour, premierJour);
  const toujours = ventiler(e.meta.depuisLeDebut, dest);
  const surPeriode = ventiler(e.meta.surLaPeriode, dest);
  const liens = new Map(e.meta.pubs.map((p) => [p.ad_id, p.lien_apercu]));

  // Les biens du pilotage : ceux qui ont des données saisies, ou une dépense rattachée.
  const avecDepense = new Set(toujours.parBien.keys());
  const retenus = e.biens
    .filter((b) => aDesDonnees(b) || avecDepense.has(b.id))
    .sort((a, b) => premiereSaisie(a).localeCompare(premiereSaisie(b)) || parNom.compare(a.nom, b.nom));

  const communes = new Set<string>();
  for (const d of dest.values()) if (d.type === "biens" && d.poids.size > 1) for (const b of d.poids.keys()) communes.add(b);

  const biens: BienCalcule[] = retenus.map((b, rang) => {
    const s = synth.get(b.id)!;
    const com = commissions(s);
    const depuis = lecture.lu ? indicateurs(toujours.parBien.get(b.id) ?? compteursVides()) : null;
    const pub: Calcule = depuis ? { etat: "ok", valeur: depuis.depense } : { etat: "en_attente" };
    return {
      id: b.id,
      nom: b.nom,
      couleur: rang < COULEURS ? rang : null,
      synthese: s,
      potentielHT: com.ht,
      potentielTTC: com.ttc,
      encaisseHT: com.encaisse,
      depuisLeDebut: depuis,
      rentabilite: rentabilite(com.ht, pub, s.couts.totalHtCentimes),
      surLaPeriode: lecture.lu ? indicateurs(surPeriode.parBien.get(b.id) ?? compteursVides()) : null,
      frequence: frequence(
        e.choix,
        e.jour,
        lecture.lu,
        e.meta.couverture,
        b.id,
        surPeriode.parBien.get(b.id)?.impressions ?? null,
      ),
      lots: lotsDuBien(s, pub),
      pubsGagnantes: gagnantes(
        e.meta.surLaPeriode,
        dest,
        liens,
        (d) => d?.type === "biens" && d.poids.has(b.id),
        3,
      ),
      depensesCommunes: communes.has(b.id),
    };
  });

  const potentielHT = additionner(biens.map((b) => b.potentielHT ?? { ...totalVide(), complet: false, absents: 1 }));
  const potentielTTC = additionner(biens.map((b) => b.potentielTTC ?? { ...totalVide(), complet: false, absents: 1 }));
  const encaisseHT = additionner(biens.map((b) => b.encaisseHT));
  const coutsFixes = biens.reduce((n, b) => n + b.synthese.couts.totalHtCentimes, 0);
  const depuisGlobal = lecture.lu ? indicateurs(toujours.total) : null;
  const pubGlobale: Calcule = depuisGlobal ? { etat: "ok", valeur: depuisGlobal.depense } : { etat: "en_attente" };
  const sansCondition = biens.some((b) => b.potentielHT === null);

  const global: TableauPilotage["global"] = {
    potentielHT,
    potentielTTC,
    encaisseHT,
    depuisLeDebut: depuisGlobal,
    rentabilite: rentabilite(sansCondition ? null : potentielHT, pubGlobale, coutsFixes),
    surLaPeriode: lecture.lu ? indicateurs(surPeriode.total) : null,
    frequence: frequence(e.choix, e.jour, lecture.lu, e.meta.couverture, null, null),
    pubsGagnantes: gagnantes(e.meta.surLaPeriode, dest, liens, (d) => d?.type !== "hors_portefeuille", 3),
    horsPortefeuille: { depuisLeDebut: toujours.hors.depense, surLaPeriode: surPeriode.hors.depense, pubs: toujours.pubsHors },
    nonRattachee: {
      depuisLeDebut: toujours.nonRattachee.depense,
      surLaPeriode: surPeriode.nonRattachee.depense,
      pubs: toujours.pubsNonRattachees,
    },
  };
  // Un bien sans conditions rend la rentabilité globale « manquante » : on le dit.
  if (sansCondition && global.rentabilite.roas.etat === "manquant") {
    global.rentabilite.roas = { etat: "manquant", raison: "un bien du pilotage n'a pas de conditions saisies" };
    global.rentabilite.margeNetteHT = global.rentabilite.roas;
  }

  const noms: TableauPilotage["noms"] = { pubs: new Map(), campagnes: new Map() };
  for (const p of e.meta.depuisLeDebut) {
    if (p.ad_name) noms.pubs.set(p.ad_id, p.ad_name);
    if (p.campaign_id && p.campaign_name) noms.campagnes.set(p.campaign_id, p.campaign_name);
  }
  for (const p of e.meta.pubs) if (p.ad_name && !noms.pubs.has(p.ad_id)) noms.pubs.set(p.ad_id, p.ad_name);

  const fichesPubs: TableauPilotage["fichesPubs"] = new Map();
  for (const p of e.meta.depuisLeDebut) {
    fichesPubs.set(p.ad_id, {
      nom: p.ad_name,
      campagne: p.campaign_name,
      premierJour: p.premier_jour,
      dernierJour: p.dernier_jour,
      lienApercu: null,
    });
  }
  for (const p of e.meta.pubs) {
    const f = fichesPubs.get(p.ad_id);
    const campagne = p.campaign_id ? (noms.campagnes.get(p.campaign_id) ?? null) : null;
    if (f) f.lienApercu = p.lien_apercu;
    else fichesPubs.set(p.ad_id, { nom: p.ad_name, campagne, premierJour: null, dernierJour: null, lienApercu: p.lien_apercu });
  }

  return {
    jour: e.jour,
    periode,
    noms,
    fichesPubs,
    lecture,
    biens,
    global,
    serie: serie(periode, e.meta.parJour, dest, lecture.couvertJusquAu),
    quotidien: quotidien(periode, e.meta.parJour, dest),
    quotidienParPub: quotidienParPub(periode, e.meta.parJour, dest),
    alertes: alertes(e, lecture, biens, global, dest),
  };
}

// -----------------------------------------------------------------------------
// « À savoir »
// -----------------------------------------------------------------------------


function alertes(
  e: EntreeTableau,
  lecture: EtatDeLaLecture,
  biens: readonly BienCalcule[],
  global: TableauPilotage["global"],
  dest: ReadonlyMap<string, Destination>,
): Alerte[] {
  const out: Alerte[] = [];
  const meta = "/crm/pilotage/meta";
  if (!lecture.lu) {
    out.push({ niveau: "attention", texte: "Les chiffres Meta n'ont pas encore été lus : ils s'affichent « en attente ».", lien: meta });
  } else {
    const derniere = lecture.derniere;
    if (derniere && derniere.statut === "echec") {
      out.push({
        niveau: "attention",
        texte: `La dernière lecture Meta a échoué${derniere.erreur ? ` : ${derniere.erreur}` : "."} Les chiffres affichés sont ceux de la dernière lecture réussie.`,
        lien: meta,
      });
    }
    if (lecture.lueLe && Date.parse(lecture.lueLe) < Date.parse(`${ajouterJours(e.jour, -1)}T00:00:00Z`)) {
      out.push({
        niveau: "attention",
        texte: "Aucune lecture Meta réussie depuis plus d'un jour : la lecture du matin est à vérifier.",
        lien: meta,
      });
    }
  }
  if (global.nonRattachee.pubs > 0 && !estNul(global.nonRattachee.depuisLeDebut)) {
    out.push({
      niveau: "attention",
      texte:
        `${eurosDe(global.nonRattachee.depuisLeDebut)} de dépense ne sont rattachés à aucun bien ` +
        `(${global.nonRattachee.pubs} pub${global.nonRattachee.pubs > 1 ? "s" : ""}) : comptés dans les totaux, absents des biens.`,
      lien: meta,
    });
  }
  if (global.horsPortefeuille.pubs > 0 && !estNul(global.horsPortefeuille.depuisLeDebut)) {
    out.push({
      niveau: "info",
      texte:
        `${eurosDe(global.horsPortefeuille.depuisLeDebut)} de dépense hors portefeuille ` +
        `(${global.horsPortefeuille.pubs} pub${global.horsPortefeuille.pubs > 1 ? "s" : ""}) : exclus des indicateurs.`,
      lien: meta,
    });
  }
  const sansPrix = new Set<string>();
  for (const d of dest.values()) if (d.type === "non_repartie") for (const b of d.biensSansPrix) sansPrix.add(b);
  if (sansPrix.size > 0) {
    const noms = biens.filter((b) => sansPrix.has(b.id)).map((b) => b.nom);
    out.push({
      niveau: "attention",
      texte: `Une pub commune ne peut pas être répartie : prix manquant pour ${noms.length > 0 ? noms.join(", ") : "un bien du groupe"}.`,
      lien: meta,
    });
  }
  if (e.meta.joursEnEcart > 0) {
    out.push({
      niveau: "attention",
      texte: `${e.meta.joursEnEcart} jour${e.meta.joursEnEcart > 1 ? "s" : ""} sur les 90 derniers : la somme des pubs s'écarte de la dépense du compte.`,
      lien: meta,
    });
  }
  if (lecture.devise && lecture.devise !== "EUR") {
    out.push({ niveau: "attention", texte: `Le compte publicitaire est tenu en ${lecture.devise} : les montants Meta ne sont pas des euros.` });
  }
  for (const b of biens) {
    for (const a of b.synthese.alertes) {
      if (a.niveau === "attention") out.push({ niveau: "attention", texte: `${b.nom} : ${a.texte}`, lien: `/crm/pilotage/donnees/${b.id}` });
    }
  }
  return out;
}
