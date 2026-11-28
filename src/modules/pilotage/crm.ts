/**
 * CE QUE LE CRM SAIT, PAR BIEN ET SUR LA PÉRIODE (étape 3b) — fonction pure.
 *
 * Les comptes viennent de la base (`crm_pilotage_crm_*`), qui ne rend que des
 * nombres : aucune ligne d'acquéreur n'arrive jusqu'ici. Ce module les lit
 * (validés), puis calcule ce que la page affiche : coûts par étape, parts et
 * taux de passage, provenance, écart entre leads Meta et demandes reçues.
 *
 * LES DÉFINITIONS, dites à l'écran :
 *  - la période se mesure sur la DATE D'ARRIVÉE de la demande (jour de Paris) ;
 *  - « demandes » compte des demandes ; tout le reste compte des PERSONNES
 *    (l'étape et la qualification sont celles de la personne) ;
 *  - une personne archivée (faux numéro, test, doublon) est exclue ;
 *  - « étape atteinte » : l'étape actuelle, ou une étape passée selon le
 *    journal ; un taux de passage « A → B » se calcule sur les MÊMES
 *    personnes : parmi celles passées par A, la part passée aussi par B ;
 *  - les coûts et l'écart avec Meta comparent les MÊMES JOURS : la dépense et
 *    les leads Meta ne comptent qu'à partir de la première demande reçue dans
 *    le CRM (avant, les demandes n'y arrivaient pas).
 */

import { z } from "zod";
import { ETAPES, QUALIFICATIONS, type EtapeAcquereur } from "@/modules/buyers/crm/vocabulaire";
import { divise, entier, type Exact } from "./exact";
import { metaAPartirDu, type Calcule, type TableauPilotage } from "./tableau";

const compte = z.number().int().nonnegative();
const comptes = z.record(z.string(), compte);

export const mesuresCrmSchema = z.object({
  demandes: compte,
  demandes_sans_personne: compte,
  demandes_archivees: compte,
  personnes: compte,
  etapes: comptes,
  atteintes: comptes,
  qualification: comptes,
  visites: z.object({ planifiees: compte, a_venir: compte, faites: compte, annulees: compte }),
  offres: z.object({ personnes: compte, montants: compte, somme_cents: compte }),
  provenance: comptes,
  responsables: comptes,
  pub: z.object({ pub: compte, campagne: compte, aucun: compte }),
  /** Personnes passées par les deux étapes d'un passage (« A>B ») ; absent
      tant que la migration du 28/11/2026 n'est pas installée. */
  passages: comptes.optional(),
});

export type MesuresCrm = z.infer<typeof mesuresCrmSchema>;

/** Un bien sans demande sur la période : le CRM a été lu, il n'y a rien eu — de vrais zéros. */
export const MESURES_VIDES: MesuresCrm = {
  demandes: 0,
  demandes_sans_personne: 0,
  demandes_archivees: 0,
  personnes: 0,
  etapes: {},
  atteintes: {},
  qualification: {},
  visites: { planifiees: 0, a_venir: 0, faites: 0, annulees: 0 },
  offres: { personnes: 0, montants: 0, somme_cents: 0 },
  provenance: {},
  responsables: {},
  pub: { pub: 0, campagne: 0, aucun: 0 },
  passages: {},
};

export interface LigneCrmJour {
  property_id: string;
  jour: string;
  demandes: number;
}

export interface LigneCrmPub {
  property_id: string;
  niveau: "pub" | "campagne" | "aucun";
  ad_id: string | null;
  campaign_id: string | null;
  demandes: number;
  personnes: number;
  qualifies: number;
  visites: number;
  visites_faites: number;
  offres: number;
}

export interface LigneEtape {
  valeur: EtapeAcquereur;
  label: string;
  sens: string;
  /** Personnes à cette étape aujourd'hui. */
  aujourdHui: number;
  /** Personnes passées au moins une fois par cette étape. */
  atteinte: number;
  /** Part des personnes arrivées sur la période qui ont atteint l'étape. */
  part: Calcule;
}

export interface Passage {
  de: string;
  vers: string;
  /** Personnes passées par l'étape de départ. */
  depart: number;
  /** Parmi elles, celles passées aussi par l'étape d'arrivée ; `null` si la base ne le dit pas encore. */
  ensemble: number | null;
  taux: Calcule;
}

/**
 * La dépense et les leads Meta mis en face des demandes du CRM, sur les mêmes
 * jours : de la première demande reçue dans le CRM (ou du début de la période,
 * s'il est plus tardif) à la fin de la période.
 */
export type MetaEnFace =
  | { etat: "en_attente" }
  /** Le CRM n'a reçu aucune demande pour cette portée avant la fin de la période. */
  | { etat: "sans_demande" }
  | {
      etat: "ok";
      /** Le premier jour compté. */
      depuis: string;
      /** Vrai si ce jour est plus tardif que le début de la période (à dire à l'écran). */
      decale: boolean;
      depense: Exact;
      leads: Exact;
    };

/** Les jours comparables, ou `null` si le CRM n'a encore rien reçu à la fin de la période. */
export function joursComparables(
  debutPeriode: string | null,
  finPeriode: string,
  premiereDemande: string | null,
): { depuis: string; decale: boolean } | null {
  if (!premiereDemande || premiereDemande > finPeriode) return null;
  if (debutPeriode && debutPeriode >= premiereDemande) return { depuis: debutPeriode, decale: false };
  return { depuis: premiereDemande, decale: true };
}

/** Meta en face du CRM, pour un bien ou pour tout le portefeuille (`null`). */
export function metaEnFace(t: TableauPilotage, bien: string | null, premiereDemande: string | null): MetaEnFace {
  const jours = joursComparables(t.periode.debut, t.periode.fin, premiereDemande);
  if (!jours) return { etat: "sans_demande" };
  const m = metaAPartirDu(t, bien, jours.depuis);
  return m ? { etat: "ok", ...jours, ...m } : { etat: "en_attente" };
}

export interface CrmCalcule {
  mesures: MesuresCrm;
  /** Personnes « qualifié » ou « gros potentiel ». */
  qualifies: number;
  /** Visites non annulées : à faire et faites. */
  visites: number;
  etapes: LigneEtape[];
  passages: Passage[];
  qualification: { valeur: string; label: string; n: number }[];
  provenance: { libelle: string; n: number }[];
  couts: { parDemande: Calcule; parQualifie: Calcule; parVisite: Calcule; parOffre: Calcule };
  meta: {
    leads: Calcule;
    demandesPub: number;
    demandes: number;
    /** Le premier jour où Meta est compté, s'il est plus tardif que le début de la période. */
    decaleAu: string | null;
  };
}

/** Une part, ou ce qui l'empêche : jamais une division par zéro déguisée en 0 %. */
function part(n: number, sur: number, raison: string): Calcule {
  return sur > 0 ? { etat: "ok", valeur: divise(entier(n), entier(sur)) } : { etat: "sans_objet", raison };
}

const SANS_DEMANDE = "aucune demande reçue dans le CRM";

/** Un coût : la dépense Meta des jours comparables ÷ un nombre du CRM. */
function cout(meta: MetaEnFace, n: number, raison: string): Calcule {
  if (meta.etat === "en_attente") return { etat: "en_attente" };
  if (meta.etat === "sans_demande") return { etat: "sans_objet", raison: SANS_DEMANDE };
  return n > 0 ? { etat: "ok", valeur: divise(meta.depense, entier(n)) } : { etat: "sans_objet", raison };
}

const SOURCES: Record<string, string> = {
  fb: "Facebook",
  facebook: "Facebook",
  ig: "Instagram",
  instagram: "Instagram",
  "prodigio-site": "Site Prodigio",
  "": "Non renseignée",
};

/** La provenance d'une demande (`utm_source`), regroupée et lisible. */
export function provenance(source: string): string {
  return SOURCES[source] ?? source;
}

const MIGRATION_PASSAGES = "attend l'installation de la migration du 28/11/2026";

/** Les étapes atteintes en chaîne, pour les taux de passage d'une étape à l'autre. */
const CHAINE: [EtapeAcquereur, EtapeAcquereur][] = [
  ["en_discussion", "visite_planifiee"],
  ["visite_planifiee", "offre_en_cours"],
];

export function calculerCrm(m: MesuresCrm, meta: MetaEnFace): CrmCalcule {
  const label = (v: string) => ETAPES.find((e) => e.valeur === v)?.label ?? v;
  const etapes: LigneEtape[] = ETAPES.map((e) => ({
    valeur: e.valeur,
    label: e.label,
    sens: e.sens,
    aujourdHui: m.etapes[e.valeur] ?? 0,
    atteinte: m.atteintes[e.valeur] ?? 0,
    part: part(m.atteintes[e.valeur] ?? 0, m.personnes, "aucune personne arrivée"),
  }));
  // Un passage se compte sur les MÊMES personnes : passées par le départ ET
  // par l'arrivée, ÷ passées par le départ. Jamais au-delà de 100 %.
  const passages: Passage[] = CHAINE.map(([de, vers]) => {
    const depart = m.atteintes[de] ?? 0;
    if (!m.passages) {
      return { de: label(de), vers: label(vers), depart, ensemble: null, taux: { etat: "manquant", raison: MIGRATION_PASSAGES } };
    }
    const ensemble = m.passages[`${de}>${vers}`] ?? 0;
    return {
      de: label(de),
      vers: label(vers),
      depart,
      ensemble,
      taux: part(ensemble, depart, `personne n'a atteint « ${label(de)} »`),
    };
  });

  const regroupees = new Map<string, number>();
  for (const [source, n] of Object.entries(m.provenance)) {
    const l = provenance(source);
    regroupees.set(l, (regroupees.get(l) ?? 0) + n);
  }

  const qualifies = (m.qualification.qualifie ?? 0) + (m.qualification.gros_potentiel ?? 0);
  const visites = m.visites.planifiees + m.visites.faites;

  return {
    mesures: m,
    qualifies,
    visites,
    etapes,
    passages,
    qualification: QUALIFICATIONS.map((q) => ({ valeur: q.valeur, label: q.label, n: m.qualification[q.valeur] ?? 0 })),
    provenance: [...regroupees].map(([libelle, n]) => ({ libelle, n })).sort((a, b) => b.n - a.n || a.libelle.localeCompare(b.libelle)),
    couts: {
      parDemande: cout(meta, m.demandes, "aucune demande sur la période"),
      parQualifie: cout(meta, qualifies, "aucune personne qualifiée"),
      parVisite: cout(meta, visites, "aucune visite"),
      parOffre: cout(meta, m.offres.personnes, "aucune offre saisie"),
    },
    meta: {
      leads:
        meta.etat === "ok"
          ? { etat: "ok", valeur: meta.leads }
          : meta.etat === "en_attente"
            ? { etat: "en_attente" }
            : { etat: "sans_objet", raison: SANS_DEMANDE },
      demandesPub: m.pub.pub,
      demandes: m.demandes,
      decaleAu: meta.etat === "ok" && meta.decale ? meta.depuis : null,
    },
  };
}

/** Les demandes par point du graphique (jour, ou semaine), par bien. */
export function demandesParPoint(
  points: readonly { debut: string; fin: string }[],
  lignes: readonly LigneCrmJour[],
): { debut: string; fin: string; valeurs: Record<string, number> }[] {
  return points.map((p) => {
    const valeurs: Record<string, number> = {};
    for (const l of lignes) {
      if (l.jour >= p.debut && l.jour <= p.fin) valeurs[l.property_id] = (valeurs[l.property_id] ?? 0) + l.demandes;
    }
    return { debut: p.debut, fin: p.fin, valeurs };
  });
}
