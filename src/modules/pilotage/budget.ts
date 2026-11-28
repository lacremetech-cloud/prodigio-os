/**
 * LE BUDGET DÉCLARÉ, DANS PILOTAGE PUB — fonctions pures.
 *
 * Chaque bien règle, dans les données du pilotage, les tranches de budget que
 * son formulaire propose et sa CIBLE : le budget minimum d'une demande qui
 * vaut la peine. Ici, on lit ce que les demandes ont répondu, pour garder les
 * pubs qui amènent les bons budgets et couper les autres.
 *
 * LES DÉFINITIONS, dites à l'écran :
 *  - la réponse RETENUE d'une demande : le budget corrigé par l'équipe sur la
 *    personne, sinon celui que la demande a déclaré ;
 *  - une demande est DANS LA CIBLE si la borne basse de sa réponse atteint la
 *    cible ; « pas de projet » n'y est jamais ; une demande sans réponse n'est
 *    ni dedans ni dehors : elle est comptée à part ;
 *  - la part dans la cible se calcule sur les demandes qui ont répondu ;
 *  - la cible est celle EN VIGUEUR AUJOURD'HUI, pour toute période — comme les
 *    conditions de commission de la page ;
 *  - le coût par demande dans la cible : la dépense Meta des MÊMES JOURS que
 *    le CRM (à partir de sa première demande pour le bien) ÷ ces demandes.
 *
 * Rien de tout cela ne part chez Meta (docs/33 § 10).
 */

import type { PilotageBudgetFormulaireRow } from "@/lib/supabase/types";
import { BUDGET_CHOICE_COURT, budgetChoiceBounds, type BuyerBudgetChoice } from "@/modules/buyers/funnel/universal";
import {
  estUneTranche,
  lireTranchesDuFormulaire,
  reponsesDuFormulaire,
  TRANCHES_BUDGET,
  TRANCHES_PAR_DEFAUT,
  trierTranches,
  type TrancheBudget,
} from "@/modules/buyers/funnel/tranches";
import { joursComparables, type MetaEnFace } from "./crm";
import { divise, entier } from "./exact";
import type { SyntheseBien } from "./synthese";
import { depensePubAPartirDu, type Calcule, type TableauPilotage } from "./tableau";
import { versionEnVigueur } from "./versions";

/** Une ligne de `crm_pilotage_crm_budget`. */
export interface LigneCrmBudget {
  regroupement: "bien" | "pub" | "total";
  property_id: string | null;
  niveau: "pub" | "campagne" | "aucun" | null;
  ad_id: string | null;
  campaign_id: string | null;
  reponse: string | null;
  demandes: number;
  personnes: number;
  qualifies: number;
}

// -----------------------------------------------------------------------------
// La cible
// -----------------------------------------------------------------------------

/**
 * Une réponse est-elle dans la cible ? `null` : sans réponse (ou réponse que
 * l'échelle ne connaît pas) — ni dedans, ni dehors.
 */
export function dansLaCible(reponse: string | null, cibleMinCentimes: number): boolean | null {
  if (reponse === "aucun_projet") return false;
  if (reponse === null || !estUneTranche(reponse)) return null;
  return budgetChoiceBounds(reponse).min! >= cibleMinCentimes;
}

/** « à partir de 1 M€ » : la cible dite comme à l'écran. */
export function libelleCible(cibleMinCentimes: number): string {
  const euros = cibleMinCentimes / 100;
  if (euros >= 1_000_000 && euros % 1_000_000 === 0) return `à partir de ${euros / 1_000_000} M€`;
  return `à partir de ${new Intl.NumberFormat("fr-FR").format(euros)} €`;
}

/** Le libellé court d'une réponse, tel que les listes du CRM l'écrivent. */
export function libelleReponse(reponse: string | null): string {
  if (reponse === null) return "Sans réponse";
  return BUDGET_CHOICE_COURT[reponse as BuyerBudgetChoice] ?? reponse;
}

// -----------------------------------------------------------------------------
// Le réglage en vigueur, et la proposition d'après le prix
// -----------------------------------------------------------------------------

export interface ReglageBudget {
  version: PilotageBudgetFormulaireRow;
  /** Relues ; une liste abîmée retombe sur celles d'aujourd'hui (le formulaire fait de même). */
  tranches: TrancheBudget[];
  cibleMinCentimes: number;
}

/** Le réglage en vigueur un jour donné, ou `null` : le formulaire propose alors ses réponses d'aujourd'hui. */
export function reglageEnVigueur(versions: readonly PilotageBudgetFormulaireRow[], jour: string): ReglageBudget | null {
  const v = versionEnVigueur(versions, jour);
  if (!v) return null;
  return {
    version: v,
    tranches: lireTranchesDuFormulaire(v.tranches) ?? [...TRANCHES_PAR_DEFAUT],
    cibleMinCentimes: v.cible_min_cents,
  };
}

/** Au-delà de ce prix, le formulaire distingue 1–2 M€, 2–3 M€ et plus de 3 M€. */
const PRIX_ECHELLE_HAUTE_CENTIMES = 200_000_000;

export interface PropositionBudget {
  tranches: TrancheBudget[];
  cibleMinCentimes: number;
  /** Le prix qui a servi : le prix affiché, ou le lot le moins cher d'un programme. */
  prixCentimes: number;
  depuis: "prix_affiche" | "lot_le_moins_cher";
}

/**
 * Une PROPOSITION de réglage d'après le prix, à valider ou modifier : jamais
 * appliquée d'office.
 *  - sous 2 M€ : les tranches d'aujourd'hui (500 000 € – 1 M€, plus d'1 M€) ;
 *  - à partir de 2 M€ : 1–2 M€, 2–3 M€, plus de 3 M€ ;
 *  - la cible : la plus haute borne basse qui ne dépasse pas le prix (la plus
 *    basse, si le prix est sous toutes).
 * `null` sans prix connu.
 */
export function proposerReglage(prix: { centimes: number; depuis: PropositionBudget["depuis"] } | null): PropositionBudget | null {
  if (!prix || !(prix.centimes > 0)) return null;
  const tranches: TrancheBudget[] =
    prix.centimes >= PRIX_ECHELLE_HAUTE_CENTIMES ? ["1m_2m", "2m_3m", "plus_3m"] : ["500k_1m", "plus_1m"];
  const bornes = tranches.map((t) => budgetChoiceBounds(t).min!);
  const atteintes = bornes.filter((b) => b <= prix.centimes);
  return {
    tranches,
    cibleMinCentimes: atteintes.length > 0 ? Math.max(...atteintes) : Math.min(...bornes),
    prixCentimes: prix.centimes,
    depuis: prix.depuis,
  };
}

/**
 * Le prix qui sert à la proposition : le prix affiché d'un bien vendu en un
 * bloc ; pour un programme, le lot suivi le moins cher (le ticket d'entrée).
 * `null` sans conditions en vigueur ou sans prix saisi.
 */
export function prixDeReference(s: Pick<SyntheseBien, "enVigueur" | "lots">): {
  centimes: number;
  depuis: PropositionBudget["depuis"];
} | null {
  const c = s.enVigueur;
  if (!c) return null;
  if (!c.vente_par_lots) return c.prix_affiche_cents ? { centimes: c.prix_affiche_cents, depuis: "prix_affiche" } : null;
  const prix = s.lots.map((l) => l.etat?.prix_cents ?? null).filter((p): p is number => p != null && p > 0);
  return prix.length > 0 ? { centimes: Math.min(...prix), depuis: "lot_le_moins_cher" } : null;
}

// -----------------------------------------------------------------------------
// La lecture dans Pilotage pub
// -----------------------------------------------------------------------------

export interface LigneBudget {
  reponse: string | null;
  libelle: string;
  demandes: number;
  personnes: number;
  qualifies: number;
  /** `null` : sans réponse, ou pas de cible réglée. */
  dansLaCible: boolean | null;
  /** Vrai si le formulaire du bien propose cette réponse aujourd'hui. */
  proposee: boolean;
}

export interface PubBudget {
  niveau: "pub" | "campagne" | "aucun";
  ad_id: string | null;
  campaign_id: string | null;
  demandes: number;
  avecReponse: number;
  /** `null` sans cible réglée. */
  dansLaCible: number | null;
  part: Calcule;
  cout: Calcule;
}

export interface BudgetDuBien {
  reglage: ReglageBudget | null;
  lignes: LigneBudget[];
  demandes: number;
  avecReponse: number;
  dansLaCible: number | null;
  part: Calcule;
  cout: Calcule;
  qualifies: number;
  qualifiesDansLaCible: number | null;
  parPub: PubBudget[];
}

const SANS_CIBLE: Calcule = { etat: "manquant", raison: "cible non réglée" };

function part(n: number, sur: number, raison: string): Calcule {
  return sur > 0 ? { etat: "ok", valeur: divise(entier(n), entier(sur)) } : { etat: "sans_objet", raison };
}

/** L'ordre de l'échelle : pas de projet, les tranches de la plus basse à la plus haute, puis sans réponse. */
const ORDRE: readonly string[] = ["aucun_projet", ...trierTranches(TRANCHES_BUDGET)];

function rang(reponse: string | null): number {
  if (reponse === null) return ORDRE.length + 1;
  const i = ORDRE.indexOf(reponse);
  return i < 0 ? ORDRE.length : i;
}

/**
 * Le budget déclaré d'un bien sur la période : par réponse, la part dans la
 * cible et son coût, pub par pub. `meta` : la dépense des mêmes jours que le
 * CRM pour le bien (`metaEnFace`) ; `premiereDemande` : le premier jour du
 * CRM pour le bien, pour le coût de chaque pub sur les mêmes jours.
 */
export function calculerBudget(e: {
  t: TableauPilotage;
  bien: string;
  lignes: readonly LigneCrmBudget[];
  reglage: ReglageBudget | null;
  meta: MetaEnFace;
  premiereDemande: string | null;
}): BudgetDuBien {
  const cible = e.reglage?.cibleMinCentimes ?? null;
  const proposees = new Set<string>(reponsesDuFormulaire(e.reglage?.tranches ?? null));
  const duBien = e.lignes.filter((l) => l.regroupement === "bien" && l.property_id === e.bien);

  const parReponse = new Map<string | null, LigneBudget>();
  const ligne = (reponse: string | null): LigneBudget => {
    const deja = parReponse.get(reponse);
    if (deja) return deja;
    const nouvelle: LigneBudget = {
      reponse,
      libelle: libelleReponse(reponse),
      demandes: 0,
      personnes: 0,
      qualifies: 0,
      dansLaCible: cible === null ? null : dansLaCible(reponse, cible),
      proposee: reponse !== null && proposees.has(reponse),
    };
    parReponse.set(reponse, nouvelle);
    return nouvelle;
  };
  // Les réponses proposées aujourd'hui figurent toujours, même à zéro : « 0 demande » se lit.
  for (const r of proposees) ligne(r);
  for (const l of duBien) {
    const x = ligne(l.reponse);
    x.demandes += l.demandes;
    x.personnes += l.personnes;
    x.qualifies += l.qualifies;
  }
  const lignes = [...parReponse.values()].sort((a, b) => rang(a.reponse) - rang(b.reponse));

  const demandes = lignes.reduce((n, l) => n + l.demandes, 0);
  const avecReponse = lignes.filter((l) => l.reponse !== null).reduce((n, l) => n + l.demandes, 0);
  const dedans = cible === null ? null : lignes.filter((l) => l.dansLaCible === true).reduce((n, l) => n + l.demandes, 0);
  const qualifies = lignes.reduce((n, l) => n + l.qualifies, 0);
  const qualifiesDedans =
    cible === null ? null : lignes.filter((l) => l.dansLaCible === true).reduce((n, l) => n + l.qualifies, 0);

  return {
    reglage: e.reglage,
    lignes,
    demandes,
    avecReponse,
    dansLaCible: dedans,
    part: dedans === null ? SANS_CIBLE : part(dedans, avecReponse, "aucune demande n'a répondu"),
    cout: coutDansLaCible(e.meta, dedans),
    qualifies,
    qualifiesDansLaCible: qualifiesDedans,
    parPub: parPub(e, cible),
  };
}

function coutDansLaCible(meta: MetaEnFace, dedans: number | null): Calcule {
  if (dedans === null) return SANS_CIBLE;
  if (meta.etat === "en_attente") return { etat: "en_attente" };
  if (meta.etat === "sans_demande") return { etat: "sans_objet", raison: "aucune demande reçue dans le CRM" };
  return dedans > 0
    ? { etat: "ok", valeur: divise(meta.depense, entier(dedans)) }
    : { etat: "sans_objet", raison: "aucune demande dans la cible" };
}

function parPub(
  e: { t: TableauPilotage; bien: string; lignes: readonly LigneCrmBudget[]; premiereDemande: string | null },
  cible: number | null,
): PubBudget[] {
  const groupes = new Map<string, PubBudget>();
  for (const l of e.lignes) {
    if (l.regroupement !== "pub" || l.property_id !== e.bien || l.niveau === null) continue;
    const cle = `${l.niveau}|${l.ad_id ?? ""}|${l.campaign_id ?? ""}`;
    const g = groupes.get(cle) ?? {
      niveau: l.niveau,
      ad_id: l.ad_id,
      campaign_id: l.campaign_id,
      demandes: 0,
      avecReponse: 0,
      dansLaCible: cible === null ? null : 0,
      part: SANS_CIBLE,
      cout: SANS_CIBLE,
    };
    g.demandes += l.demandes;
    if (l.reponse !== null) g.avecReponse += l.demandes;
    if (cible !== null && dansLaCible(l.reponse, cible) === true) g.dansLaCible = (g.dansLaCible ?? 0) + l.demandes;
    groupes.set(cle, g);
  }

  // Les mêmes jours que le CRM du bien : du premier jour du CRM (ou du début
  // de la période, s'il est plus tardif) à la fin de la période.
  const jours = joursComparables(e.t.periode.debut, e.t.periode.fin, e.premiereDemande);
  for (const g of groupes.values()) {
    if (g.dansLaCible === null) continue;
    g.part = part(g.dansLaCible, g.avecReponse, "aucune demande n'a répondu");
    if (g.niveau !== "pub" || !g.ad_id) {
      g.cout = {
        etat: "sans_objet",
        raison: g.niveau === "campagne" ? "pub inconnue : sa dépense est comptée sur les pubs" : "aucune pub",
      };
    } else if (!jours) {
      g.cout = { etat: "sans_objet", raison: "aucune demande reçue dans le CRM" };
    } else {
      const depense = depensePubAPartirDu(e.t, e.bien, g.ad_id, jours.depuis);
      g.cout =
        depense === null
          ? { etat: "en_attente" }
          : g.dansLaCible > 0
            ? { etat: "ok", valeur: divise(depense, entier(g.dansLaCible)) }
            : { etat: "sans_objet", raison: "aucune demande dans la cible" };
    }
  }
  const ordre = { pub: 0, campagne: 1, aucun: 2 } as const;
  return [...groupes.values()].sort((a, b) => ordre[a.niveau] - ordre[b.niveau] || b.demandes - a.demandes);
}
