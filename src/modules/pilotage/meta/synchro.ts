/**
 * LA LECTURE DU MATIN — orchestration, sans base ni réseau en dur : Meta et la
 * base sont passés en paramètres (`PortMeta`, `PortBase`), ce qui permet de la
 * jouer entièrement avec un faux Meta dans les tests.
 *
 * Déroulé :
 *   1. démarrer (une seule lecture à la fois, décidé en base) ;
 *   2. la fenêtre : tout l'historique la première fois, puis les 7 jours qui
 *      précèdent le dernier jour enregistré (Meta corrige ses chiffres) ;
 *   3. par tranches de 30 jours : les pubs jour par jour, et la dépense du
 *      compte pour le CONTRÔLE ; chaque période est REMPLACÉE d'un bloc ;
 *   4. les pubs (nom, statut, lien d'aperçu) ;
 *   5. la couverture de chaque période proposée, par bien et au total ;
 *   6. terminer, avec un bilan lisible.
 *
 * Le temps est compté : au-delà de l'échéance, la lecture s'arrête après la
 * tranche en cours, se déclare « partielle », et la suivante reprend d'où elle
 * s'est arrêtée. Rien n'est jamais écrit chez Meta.
 */

import { ErreurMeta } from "./graph";
import type { LigneInsight, PubLue } from "./lecture";
import { fenetreDeLecture, bornes, PERIODES, tranches, ajouterJours, type Periode } from "./periodes";
import type { FiltreCouverture, PortMeta } from "./port-meta";
import {
  dansLesIndicateurs,
  indexerRegles,
  rattacher,
  type PubARattacher,
  type RegleRattachement,
} from "./rattachement";

/** Au-delà, une requête de couverture deviendrait trop longue pour Meta. */
export const MAX_PUBS_PAR_COUVERTURE = 100;

/** Lignes au plus par écriture en base (un jour n'est jamais coupé). */
export const MAX_LIGNES_PAR_ECRITURE = 800;

export interface PubDeLaPeriode extends PubARattacher {
  ad_id: string;
}

export interface LigneCouverture {
  periode: Periode;
  property_id: string | null;
  couverture: number | null;
  impressions: number | null;
  date_debut: string | null;
  date_fin: string | null;
  pubs: number;
  raison: string | null;
}

export type Demarrage =
  | { ok: true; synchroId: string; couvertJusquAu: string | null }
  | { ok: false; occupe: true };

export interface PortBase {
  demarrer(declencheur: "matin" | "manuel", demandeePar: string | null): Promise<Demarrage>;
  remplacerTranche(
    synchroId: string,
    debut: string,
    fin: string,
    lignes: LigneInsight[],
    controle: { jour: string; depense_compte_cents: number }[],
  ): Promise<void>;
  enregistrerPubs(synchroId: string, pubs: PubLue[]): Promise<void>;
  regles(): Promise<RegleRattachement[]>;
  /** Les pubs qui ont tourné sur la période (`debut` null : depuis toujours). */
  pubsDeLaPeriode(debut: string | null, fin: string): Promise<PubDeLaPeriode[]>;
  remplacerCouverture(synchroId: string, lignes: LigneCouverture[]): Promise<void>;
  terminer(
    synchroId: string,
    fin: { statut: "reussie" | "partielle" | "echec"; erreur: string | null; appels: number; devise: string | null; details: Record<string, unknown> },
  ): Promise<void>;
}

export interface Bilan {
  statut: "reussie" | "partielle" | "echec" | "occupe";
  synchroId: string | null;
  periode: { debut: string; fin: string } | null;
  lignes: number;
  tranches: number;
  appels: number;
  devise: string | null;
  couverture: "relue" | "non_relue";
  /** Jours dont la somme des pubs ne vaut pas la dépense du compte. */
  ecarts: { jour: string; pubs_cents: number; compte_cents: number }[];
  message: string | null;
}

/**
 * Partage une tranche en blocs de jours CONSÉCUTIFS couvrant toute la tranche
 * (jours vides compris : leur remplacement efface ce que Meta ne renvoie plus),
 * d'au plus `max` lignes — un jour n'est jamais coupé.
 */
export function blocsDeJours(
  debut: string,
  fin: string,
  lignes: readonly LigneInsight[],
  max = MAX_LIGNES_PAR_ECRITURE,
): { debut: string; fin: string; lignes: LigneInsight[] }[] {
  const parJour = new Map<string, LigneInsight[]>();
  for (const l of lignes) parJour.set(l.jour, [...(parJour.get(l.jour) ?? []), l]);
  const blocs: { debut: string; fin: string; lignes: LigneInsight[] }[] = [];
  let courant: { debut: string; fin: string; lignes: LigneInsight[] } | null = null;
  for (let jour = debut; jour <= fin; jour = ajouterJours(jour, 1)) {
    const duJour = parJour.get(jour) ?? [];
    if (courant && courant.lignes.length + duJour.length > max) {
      blocs.push(courant);
      courant = null;
    }
    if (!courant) courant = { debut: jour, fin: jour, lignes: [] };
    courant.fin = jour;
    courant.lignes.push(...duJour);
  }
  if (courant) blocs.push(courant);
  return blocs;
}

/** Les écarts du contrôle : un centime par pub et par jour est un arrondi de Meta. */
export function ecartsDuControle(
  lignes: readonly LigneInsight[],
  compte: readonly { jour: string; depense_compte_cents: number }[],
): { jour: string; pubs_cents: number; compte_cents: number }[] {
  const pubs = new Map<string, { total: number; n: number }>();
  for (const l of lignes) {
    const p = pubs.get(l.jour) ?? { total: 0, n: 0 };
    p.total += l.depense_cents;
    if (l.depense_cents > 0) p.n += 1;
    pubs.set(l.jour, p);
  }
  const jours = new Set([...pubs.keys(), ...compte.map((c) => c.jour)]);
  const parCompte = new Map(compte.map((c) => [c.jour, c.depense_compte_cents]));
  const out: { jour: string; pubs_cents: number; compte_cents: number }[] = [];
  for (const jour of [...jours].sort()) {
    const p = pubs.get(jour) ?? { total: 0, n: 0 };
    const c = parCompte.get(jour) ?? 0;
    if (Math.abs(p.total - c) > Math.max(p.n, 0)) out.push({ jour, pubs_cents: p.total, compte_cents: c });
  }
  return out;
}

/**
 * Les portées de couverture d'une période : le total (tout sauf « hors
 * portefeuille ») et chaque bien (ses pubs, directes ou de groupe).
 */
export function porteesDeCouverture(
  pubs: readonly PubDeLaPeriode[],
  regles: readonly RegleRattachement[],
): { exclues: string[]; parBien: Map<string, string[]> } {
  const index = indexerRegles(regles);
  const exclues: string[] = [];
  const parBien = new Map<string, string[]>();
  for (const p of pubs) {
    const r = rattacher(p, index);
    if (!dansLesIndicateurs(r)) {
      exclues.push(p.ad_id);
      continue;
    }
    if (r.type === "biens") {
      for (const b of r.biens) parBien.set(b, [...(parBien.get(b) ?? []), p.ad_id]);
    }
  }
  return { exclues, parBien };
}

export interface ParametresLecture {
  meta: PortMeta;
  base: PortBase;
  /** Le jour de l'agence, « AAAA-MM-JJ ». */
  aujourdHui: string;
  maintenant: () => number;
  /** Instant au-delà duquel on n'entame plus de tranche. */
  echeanceMs: number;
  declencheur: "matin" | "manuel";
  demandeePar: string | null;
}

export async function lireMeta(p: ParametresLecture): Promise<Bilan> {
  const demarrage = await p.base.demarrer(p.declencheur, p.demandeePar);
  if (!demarrage.ok) {
    return {
      statut: "occupe",
      synchroId: null,
      periode: null,
      lignes: 0,
      tranches: 0,
      appels: 0,
      devise: null,
      couverture: "non_relue",
      ecarts: [],
      message: "Une lecture est déjà en cours : celle-ci n’a pas été lancée.",
    };
  }
  const id = demarrage.synchroId;
  let lignesLues = 0;
  let tranchesFaites = 0;
  let devise: string | null = null;
  let periode: { debut: string; fin: string } | null = null;
  let couverture: "relue" | "non_relue" = "non_relue";
  const ecarts: Bilan["ecarts"] = [];
  const tempsEcoule = () => p.maintenant() > p.echeanceMs;

  try {
    const compte = await p.meta.compte();
    devise = compte.devise;
    const fenetre = fenetreDeLecture(demarrage.couvertJusquAu, compte.creeLe, p.aujourdHui);
    periode = { debut: fenetre.debut, fin: fenetre.fin };

    let interrompue = false;
    for (const [a, b] of tranches(fenetre.debut, fenetre.fin, 30)) {
      if (tempsEcoule()) {
        interrompue = true;
        break;
      }
      const lignes = await p.meta.insights(a, b);
      const depenses = await p.meta.depenseCompte(a, b);
      for (const bloc of blocsDeJours(a, b, lignes)) {
        await p.base.remplacerTranche(
          id,
          bloc.debut,
          bloc.fin,
          bloc.lignes,
          depenses.filter((d) => d.jour >= bloc.debut && d.jour <= bloc.fin),
        );
      }
      lignesLues += lignes.length;
      tranchesFaites += 1;
      ecarts.push(...ecartsDuControle(lignes, depenses));
    }

    if (!interrompue && !tempsEcoule()) {
      const pubs = await p.meta.pubs();
      for (let i = 0; i < pubs.length; i += 500) {
        await p.base.enregistrerPubs(id, pubs.slice(i, i + 500));
      }

      const regles = await p.base.regles();
      const lignesCouverture: LigneCouverture[] = [];
      let complete = true;
      for (const per of PERIODES) {
        if (tempsEcoule()) {
          complete = false;
          break;
        }
        const { debut, fin } = bornes(per, p.aujourdHui);
        const pubsDeLaPeriode = await p.base.pubsDeLaPeriode(debut, fin);
        const { exclues, parBien } = porteesDeCouverture(pubsDeLaPeriode, regles);
        const portees: { property_id: string | null; filtre: FiltreCouverture; n: number }[] = [
          { property_id: null, filtre: { exclure: exclues }, n: pubsDeLaPeriode.length - exclues.length },
          ...[...parBien.entries()].map(([bien, ids]) => ({ property_id: bien, filtre: { inclure: ids }, n: ids.length })),
        ];
        for (const portee of portees) {
          const liste = "inclure" in portee.filtre ? portee.filtre.inclure : portee.filtre.exclure;
          const base = { periode: per, property_id: portee.property_id, pubs: portee.n };
          if (portee.n === 0) {
            lignesCouverture.push({ ...base, couverture: 0, impressions: 0, date_debut: debut, date_fin: fin, raison: null });
          } else if (liste.length > MAX_PUBS_PAR_COUVERTURE) {
            lignesCouverture.push({
              ...base,
              couverture: null,
              impressions: null,
              date_debut: debut,
              date_fin: fin,
              raison: `trop de pubs (${liste.length}) pour une seule lecture de couverture`,
            });
          } else {
            const c = await p.meta.couverture(per, portee.filtre);
            lignesCouverture.push({
              ...base,
              couverture: c.couverture,
              impressions: c.impressions,
              date_debut: c.debut ?? debut,
              date_fin: c.fin ?? fin,
              raison: null,
            });
          }
        }
      }
      // Une couverture à moitié relue mélangerait deux jours : on garde alors
      // celle de la veille, entière, plutôt que de la remplacer.
      if (complete) {
        await p.base.remplacerCouverture(id, lignesCouverture);
        couverture = "relue";
      } else {
        interrompue = true;
      }
    }

    const statut = interrompue ? "partielle" : "reussie";
    const message = interrompue
      ? "Lecture arrêtée avant la fin, faute de temps : elle reprendra là où elle s’est arrêtée."
      : null;
    await p.base.terminer(id, {
      statut,
      erreur: message,
      appels: p.meta.appels,
      devise,
      details: { fenetre: periode, tranches: tranchesFaites, lignes: lignesLues, couverture, ecarts: ecarts.length },
    });
    return { statut, synchroId: id, periode, lignes: lignesLues, tranches: tranchesFaites, appels: p.meta.appels, devise, couverture, ecarts, message };
  } catch (cause) {
    const message =
      cause instanceof ErreurMeta
        ? cause.message
        : "Erreur inattendue pendant la lecture Meta. Ce qui a été enregistré avant reste valable.";
    if (!(cause instanceof ErreurMeta)) console.error("pilotage : lecture Meta interrompue", cause instanceof Error ? cause.name : "inconnue");
    try {
      await p.base.terminer(id, {
        statut: "echec",
        erreur: message,
        appels: p.meta.appels,
        devise,
        details: { fenetre: periode, tranches: tranchesFaites, lignes: lignesLues, couverture },
      });
    } catch {
      // La clôture a échoué : la lecture sera close d'office au prochain démarrage.
    }
    return { statut: "echec", synchroId: id, periode, lignes: lignesLues, tranches: tranchesFaites, appels: p.meta.appels, devise, couverture, ecarts, message };
  }
}
