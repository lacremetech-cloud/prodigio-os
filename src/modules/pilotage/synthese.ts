/**
 * Ce que le pilotage sait d'UN bien, à une date donnée — fonction pure, à
 * partir des lignes lues en base.
 *
 * Elle décide quelle version des conditions s'applique, quel est l'état
 * courant de chaque lot, quelle part de Prodigio retenir, calcule les
 * commissions et dresse les alertes. Elle ne lit ni la base ni l'horloge :
 * tout lui est passé, et tout se teste.
 */

import type {
  Json,
  PilotageConditionsRow,
  PilotageCoutFixeRow,
  PilotageLotRow,
  PilotageLotVersionRow,
} from "@/lib/supabase/types";
import {
  calculerCommission,
  calculerEncaisse,
  partApplicable,
  totaliser,
  type CalculCommission,
  type PartApplicable,
  type Total,
} from "./commission";
import { formatDate } from "@/modules/crm/format";
import { formatPourcentage } from "./affichage";
import { baseHonorairesLabels, TYPES_COUT, type TypeCout } from "./labels";
import {
  etatCourant,
  etatDeLaVersion,
  etatsRecentsDabord,
  historique,
  versionEnVigueur,
  versionsAVenir,
  type EtatVersion,
} from "./versions";

export interface Alerte {
  niveau: "attention" | "info";
  texte: string;
}

export interface LotSynthese {
  lot: PilotageLotRow;
  /** Dernier état saisi ; `null` seulement si le lot n'en a aucun. */
  etat: PilotageLotVersionRow | null;
  etats: PilotageLotVersionRow[];
  /** Au prix du lot, avec les conditions du bien en vigueur. */
  potentiel: CalculCommission | null;
  /** Seulement pour un lot vendu. */
  encaisse: CalculCommission | null;
}

export interface TotauxLots {
  prix: Total;
  comTotaleTTC: Total;
  comProdigioTTC: Total;
  comProdigioHT: Total;
}

export interface SyntheseCouts {
  actifs: PilotageCoutFixeRow[];
  annules: PilotageCoutFixeRow[];
  totalHtCentimes: number;
  parType: Record<TypeCout, number>;
}

export interface SyntheseBien {
  jour: string;
  enVigueur: PilotageConditionsRow | null;
  aVenir: PilotageConditionsRow[];
  historique: { version: PilotageConditionsRow; etat: EtatVersion }[];
  part: PartApplicable;
  /** Un bien vendu en un bloc : sa commission. Par lots : `null` (voir `lots`). */
  potentiel: CalculCommission | null;
  encaisse: CalculCommission | null;
  /** Lots suivis (non retirés), par numéro. */
  lots: LotSynthese[];
  lotsRetires: LotSynthese[];
  totalLots: TotauxLots | null;
  couts: SyntheseCouts;
  alertes: Alerte[];
}

export interface EntreeSynthese {
  jour: string;
  conditions: readonly PilotageConditionsRow[];
  lots: readonly PilotageLotRow[];
  etatsDesLots: readonly PilotageLotVersionRow[];
  couts: readonly PilotageCoutFixeRow[];
  /** Photographie économique du mandat du bien, s'il en a un. */
  photographieMandat: Json | null;
}

/** La part de Prodigio inscrite dans la photographie économique d'un mandat. */
export function partDuMandat(photographie: Json | null): number | string | null {
  if (!photographie || typeof photographie !== "object" || Array.isArray(photographie)) return null;
  const v = (photographie as Record<string, Json | undefined>).prodigio_share_pct;
  return typeof v === "number" || typeof v === "string" ? v : null;
}

const parNumero = new Intl.Collator("fr-FR", { numeric: true, sensitivity: "base" });

function synthetiserCouts(couts: readonly PilotageCoutFixeRow[]): SyntheseCouts {
  const parType = Object.fromEntries(TYPES_COUT.map((t) => [t, 0])) as Record<TypeCout, number>;
  const actifs: PilotageCoutFixeRow[] = [];
  const annules: PilotageCoutFixeRow[] = [];
  let total = 0;
  const recentsDabord = [...couts].sort((a, b) => Date.parse(b.saisi_le) - Date.parse(a.saisi_le));
  for (const c of recentsDabord) {
    if (c.annule_le) {
      annules.push(c);
      continue;
    }
    actifs.push(c);
    total += c.montant_ht_cents;
    if (c.type_cout in parType) parType[c.type_cout] += c.montant_ht_cents;
  }
  return { actifs, annules, totalHtCentimes: total, parType };
}

export function syntheseDuBien(e: EntreeSynthese): SyntheseBien {
  const alertes: Alerte[] = [];
  const enVigueur = versionEnVigueur(e.conditions, e.jour);
  const aVenir = versionsAVenir(e.conditions, e.jour);
  const part = partApplicable(enVigueur?.part_prodigio_pct ?? null, partDuMandat(e.photographieMandat));

  // --- Les lots : état courant de chacun, triés par numéro -------------------
  const etatsParLot = new Map<string, PilotageLotVersionRow[]>();
  for (const v of e.etatsDesLots) {
    const liste = etatsParLot.get(v.lot_id) ?? [];
    liste.push(v);
    etatsParLot.set(v.lot_id, liste);
  }
  const entree = enVigueur
    ? {
        tauxCommissionPct: enVigueur.taux_commission_pct,
        baseHonoraires: enVigueur.base_honoraires,
        partProdigioPct: part.pct,
        tauxTvaPct: enVigueur.taux_tva_pct,
      }
    : null;

  const tousLesLots: LotSynthese[] = [...e.lots]
    .sort((a, b) => parNumero.compare(a.numero, b.numero))
    .map((lot) => {
      const etats = etatsRecentsDabord(etatsParLot.get(lot.id) ?? []);
      const etat = etatCourant(etats);
      return {
        lot,
        etat,
        etats,
        potentiel: entree && etat ? calculerCommission({ ...entree, prixCentimes: etat.prix_cents }) : null,
        encaisse:
          entree && etat ? calculerEncaisse(etat.statut_commercial, etat.prix_vente_final_cents, entree) : null,
      };
    });
  const lots = tousLesLots.filter((l) => !l.etat?.retire);
  const lotsRetires = tousLesLots.filter((l) => l.etat?.retire);

  // --- Le bien -----------------------------------------------------------------
  let potentiel: CalculCommission | null = null;
  let encaisse: CalculCommission | null = null;
  let totalLots: TotauxLots | null = null;

  if (!enVigueur) {
    alertes.push(
      aVenir[0]
        ? {
            niveau: "info",
            texte: `Les conditions saisies ne prennent effet que le ${formatDate(aVenir[0].date_effet)} : rien n'est calculé d'ici là.`,
          }
        : { niveau: "attention", texte: "Aucune condition saisie : ce bien n'entre pas encore dans le pilotage." },
    );
  } else if (entree) {
    if (enVigueur.base_honoraires !== "TTC") {
      alertes.push({
        niveau: "attention",
        texte:
          `Base des honoraires « ${baseHonorairesLabels[enVigueur.base_honoraires]} » : la règle de calcul validée ` +
          "suppose un taux TTC. Aucune commission n'est calculée tant que la base n'est pas TTC.",
      });
    }
    if (enVigueur.nature_prix === "ht_grille_promoteur") {
      alertes.push({
        niveau: "info",
        texte:
          "Le prix HT de la grille du promoteur est pris comme prix affiché. Question ouverte : " +
          "la commission se calcule-t-elle bien sur ce prix HT ?",
      });
    }
    if (part.ecart) {
      alertes.push({
        niveau: "attention",
        texte:
          `La part de Prodigio saisie (${formatPourcentage(part.pct, 2)}) diffère de la photographie ` +
          `du mandat (${formatPourcentage(part.pctMandat, 2)}). Le calcul retient la part saisie : à vérifier.`,
      });
    } else if (part.source === "mandat") {
      alertes.push({
        niveau: "info",
        texte: `Part de Prodigio reprise de la photographie du mandat (${formatPourcentage(part.pct, 2)}).`,
      });
    }
    if (enVigueur.taux_tva_pct == null) {
      alertes.push({ niveau: "attention", texte: "Taux de TVA manquant : la commission HT ne peut pas être calculée." });
    }

    if (enVigueur.vente_par_lots) {
      if (lots.length === 0) {
        alertes.push({ niveau: "attention", texte: "Le bien se vend par lots, mais aucun lot n'est saisi." });
      }
      const potentiels = lots.map((l) => l.potentiel).filter((p): p is CalculCommission => p !== null);
      totalLots = {
        prix: totaliser(potentiels.map((p) => p.prixAffiche)),
        comTotaleTTC: totaliser(potentiels.map((p) => p.comTotaleTTC)),
        comProdigioTTC: totaliser(potentiels.map((p) => p.comProdigioTTC)),
        comProdigioHT: totaliser(potentiels.map((p) => p.comProdigioHT)),
      };
      const sansPrix = lots.filter((l) => l.etat?.prix_cents == null).length;
      if (sansPrix > 0) {
        alertes.push({
          niveau: "attention",
          texte:
            sansPrix === 1
              ? "Un lot n'a pas de prix : les totaux sont partiels."
              : `${sansPrix} lots n'ont pas de prix : les totaux sont partiels.`,
        });
      }
    } else {
      potentiel = calculerCommission({ ...entree, prixCentimes: enVigueur.prix_affiche_cents });
      encaisse = calculerEncaisse(enVigueur.statut_commercial, enVigueur.prix_vente_final_cents, entree);
      if (lots.length > 0) {
        alertes.push({
          niveau: "attention",
          texte:
            `${lots.length === 1 ? "Un lot est saisi" : `${lots.length} lots sont saisis`}, mais le bien ` +
            "se vend en un seul bloc : les lots sont ignorés.",
        });
      }
    }
  }

  if (aVenir.length > 0 && enVigueur) {
    alertes.push({
      niveau: "info",
      texte: `Une nouvelle version des conditions prendra effet le ${formatDate(aVenir[0]!.date_effet)}.`,
    });
  }

  return {
    jour: e.jour,
    enVigueur,
    aVenir,
    historique: historique(e.conditions).map((version) => ({
      version,
      etat: etatDeLaVersion(version, enVigueur, e.jour),
    })),
    part,
    potentiel,
    encaisse,
    lots,
    lotsRetires,
    totalLots,
    couts: synthetiserCouts(e.couts),
    alertes,
  };
}
