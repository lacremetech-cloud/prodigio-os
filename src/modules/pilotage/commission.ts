/**
 * LE CALCUL DES COMMISSIONS DU PILOTAGE — règles validées par Victor le
 * 12/11/2026, appliquées à la lettre :
 *
 *   1. prix_net_vendeur  = prix_affiche_FAI / (1 + taux_com)
 *   2. com_totale_TTC    = prix_affiche_FAI − prix_net_vendeur
 *   3. com_prodigio_TTC  = com_totale_TTC × part_prodigio
 *   4. com_prodigio_HT   = com_prodigio_TTC / (1 + TVA)
 *
 * Le taux de TVA (20 % dans la règle validée, « / 1,20 ») n'est PAS une
 * constante du code : il est saisi et versionné avec les conditions du bien,
 * comme le taux, la part et la base des honoraires (CLAUDE.md, §6.8).
 *
 * La règle suppose un taux de commission TTC. Si la base des honoraires est HT
 * ou « à confirmer », RIEN n'est calculé : une autre formule n'a pas été
 * validée, et un chiffre approché serait un chiffre inventé.
 *
 * Une donnée manquante reste MANQUANTE, avec sa raison. Elle ne devient
 * jamais 0. Le calcul est exact (voir `exact.ts`) ; l'arrondi n'a lieu qu'à
 * l'affichage.
 */

import {
  decimal,
  divise,
  egal,
  entier,
  fois,
  fraction,
  moins,
  plus,
  pourcent,
  somme,
  type Exact,
} from "./exact";

export type BaseHonoraires = "TTC" | "HT" | "a_confirmer";

/** Pourquoi une valeur ne peut pas être calculée. */
export type Manque =
  | "base_a_confirmer"
  | "base_ht_non_prevue"
  | "prix_manquant"
  | "taux_manquant"
  | "part_manquante"
  | "tva_manquante"
  | "prix_vente_final_manquant";

/** Un montant en centimes exacts, ou la raison de son absence. */
export type Montant =
  | { readonly ok: true; readonly centimes: Exact }
  | { readonly ok: false; readonly manque: Manque };

export interface EntreeCommission {
  /** Prix pris comme prix affiché FAI, en centimes. */
  prixCentimes: number | null;
  /** Taux de commission en pourcentage (3,75), tel que lu en base. */
  tauxCommissionPct: number | string | null;
  baseHonoraires: BaseHonoraires;
  /** Part de Prodigio en pourcentage (70). */
  partProdigioPct: number | string | null;
  /** Taux de TVA des honoraires en pourcentage (20). */
  tauxTvaPct: number | string | null;
}

export interface CalculCommission {
  prixAffiche: Montant;
  netVendeur: Montant;
  comTotaleTTC: Montant;
  comProdigioTTC: Montant;
  comProdigioHT: Montant;
}

const UN = fraction(BigInt(1));

function present(centimes: Exact): Montant {
  return { ok: true, centimes };
}

function absent(manque: Manque): Montant {
  return { ok: false, manque };
}

/** Le calcul des règles 1 à 4, pour un prix donné. */
export function calculerCommission(e: EntreeCommission): CalculCommission {
  const prix =
    e.prixCentimes != null && Number.isSafeInteger(e.prixCentimes) && e.prixCentimes > 0
      ? entier(e.prixCentimes)
      : null;
  const prixAffiche = prix ? present(prix) : absent("prix_manquant");

  // La formule validée suppose un taux TTC : sans elle, aucune valeur dérivée.
  if (e.baseHonoraires !== "TTC") {
    const manque: Manque =
      e.baseHonoraires === "HT" ? "base_ht_non_prevue" : "base_a_confirmer";
    return {
      prixAffiche,
      netVendeur: absent(manque),
      comTotaleTTC: absent(manque),
      comProdigioTTC: absent(manque),
      comProdigioHT: absent(manque),
    };
  }

  const taux = decimal(e.tauxCommissionPct, 4);
  const part = decimal(e.partProdigioPct, 2);
  const tva = decimal(e.tauxTvaPct, 2);

  if (!prix || !taux) {
    const manque: Manque = !prix ? "prix_manquant" : "taux_manquant";
    return {
      prixAffiche,
      netVendeur: absent(manque),
      comTotaleTTC: absent(manque),
      comProdigioTTC: absent(manque),
      comProdigioHT: absent(manque),
    };
  }

  const netVendeur = divise(prix, plus(UN, pourcent(taux)));
  const comTotaleTTC = moins(prix, netVendeur);
  if (!part) {
    return {
      prixAffiche,
      netVendeur: present(netVendeur),
      comTotaleTTC: present(comTotaleTTC),
      comProdigioTTC: absent("part_manquante"),
      comProdigioHT: absent("part_manquante"),
    };
  }

  const comProdigioTTC = fois(comTotaleTTC, pourcent(part));
  return {
    prixAffiche,
    netVendeur: present(netVendeur),
    comTotaleTTC: present(comTotaleTTC),
    comProdigioTTC: present(comProdigioTTC),
    comProdigioHT: tva
      ? present(divise(comProdigioTTC, plus(UN, pourcent(tva))))
      : absent("tva_manquante"),
  };
}

/**
 * La commission ENCAISSÉE (règle 8) : seulement pour un bien ou un lot vendu,
 * calculée sur le prix de vente final. Sans prix final saisi, elle est
 * « manquante » — on ne la remplace pas par le prix affiché, qui n'est pas ce
 * qui a été payé. `null` : pas vendu, la notion ne s'applique pas.
 */
export function calculerEncaisse(
  statut: string | null,
  prixVenteFinalCentimes: number | null,
  e: Omit<EntreeCommission, "prixCentimes">,
): CalculCommission | null {
  if (statut !== "vendu") return null;
  if (prixVenteFinalCentimes == null) {
    const manque = absent("prix_vente_final_manquant");
    return {
      prixAffiche: manque,
      netVendeur: manque,
      comTotaleTTC: manque,
      comProdigioTTC: manque,
      comProdigioHT: manque,
    };
  }
  return calculerCommission({ ...e, prixCentimes: prixVenteFinalCentimes });
}

/** Une somme de montants : ce qui est connu, et ce qui manque. */
export interface Total {
  /** Somme EXACTE des montants présents (l'arrondi vient à l'affichage). */
  centimes: Exact;
  /** Vrai si aucun montant ne manque. Faux : la somme est partielle. */
  complet: boolean;
  /** Nombre de montants absents de la somme. */
  absents: number;
  /** Les raisons des absences, sans doublon. */
  manques: Manque[];
}

/**
 * Additionne des montants. Un total n'est jamais présenté comme complet s'il
 * lui manque une ligne : c'est la différence entre « 120 994 € » et « au
 * moins 120 994 €, un lot sans prix ».
 */
export function totaliser(montants: readonly Montant[]): Total {
  const presents: Exact[] = [];
  const manques = new Set<Manque>();
  let absents = 0;
  for (const m of montants) {
    if (m.ok) presents.push(m.centimes);
    else {
      absents += 1;
      manques.add(m.manque);
    }
  }
  return { centimes: somme(presents), complet: absents === 0, absents, manques: [...manques] };
}

export type SourcePart = "saisie" | "mandat";

export interface PartApplicable {
  /** La part retenue pour le calcul, en pourcentage, ou `null` si aucune. */
  pct: number | string | null;
  source: SourcePart | null;
  /** La part de la photographie du mandat, quand elle existe. */
  pctMandat: number | string | null;
  /** Vrai quand la part saisie et celle du mandat existent et diffèrent. */
  ecart: boolean;
}

/**
 * La part de Prodigio applicable à un bien.
 *
 * La part saisie dans les conditions du bien prime : c'est celle qu'un
 * administrateur a explicitement versionnée pour le pilotage. Sans elle, la
 * photographie économique du mandat, si le bien en a un. Quand les deux
 * existent et diffèrent, l'écart est signalé — jamais tranché en silence.
 * Le mandat, lui, n'est jamais réinterprété : sa photographie reste ce qu'elle
 * était à la proposition.
 */
export function partApplicable(
  partSaisiePct: number | string | null,
  partMandatPct: number | string | null,
): PartApplicable {
  const saisie = decimal(partSaisiePct, 2);
  const mandat = decimal(partMandatPct, 2);
  if (saisie) {
    return {
      pct: partSaisiePct,
      source: "saisie",
      pctMandat: mandat ? partMandatPct : null,
      ecart: mandat ? !egal(saisie, mandat) : false,
    };
  }
  if (mandat) return { pct: partMandatPct, source: "mandat", pctMandat: partMandatPct, ecart: false };
  return { pct: null, source: null, pctMandat: null, ecart: false };
}
