import "server-only";

/**
 * Lecture de l'écran « Meta Ads » du pilotage. Client serveur au jeton de
 * l'utilisateur : la RLS ne rend ces tables qu'à un administrateur, que la page
 * a vérifié avant de lire. Le rattachement se calcule ici, à partir des règles
 * en vigueur — il n'est recopié nulle part.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  PilotageMetaControleRow,
  PilotageMetaPubRow,
  PilotageMetaRegleRow,
  PilotageMetaSynchroRow,
  PilotageMetaTotalPubRow,
} from "@/lib/supabase/types";
import { estNonInstalle } from "../erreurs";
import { LectureImpossible, toutLire } from "../lecture-complete";
import { lirePilotage, nomDuBien } from "../queries";
import { syntheseDuBien, type SyntheseBien } from "../synthese";
import { jourParis } from "../versions";
import { centimesArrondis } from "../exact";
import { ajouterJours } from "./periodes";
import {
  indexerRegles,
  rattacher,
  repartirAuProrata,
  type Rattachement,
  type RegleRattachement,
} from "./rattachement";

export interface PartDeGroupe {
  bien: string;
  pourcent: number;
}

export interface RattachementAffiche {
  cle: string;
  rattachement: Rattachement;
  depenseCentimes: number;
  leads: number;
  pubs: number;
  /** Pour un groupe : la part de chaque bien, au prorata du prix affiché. */
  parts: PartDeGroupe[] | null;
  biensSansPrix: string[];
}

export interface CampagneAffichee {
  campaignId: string | null;
  campaignName: string | null;
  depenseCentimes: number;
  leads: number;
  impressions: number;
  pubs: PilotageMetaTotalPubRow[];
  rattachements: RattachementAffiche[];
  premierJour: string;
  dernierJour: string;
}

export interface TableauMeta {
  synchros: PilotageMetaSynchroRow[];
  ecarts: PilotageMetaControleRow[];
  controlesLus: number;
  campagnes: CampagneAffichee[];
  regles: PilotageMetaRegleRow[];
  biens: { id: string; nom: string }[];
  liens: Map<string, PilotageMetaPubRow>;
  totaux: { depense: number; orpheline: number; horsPortefeuille: number; campagnesOrphelines: number };
}

export type LectureMeta = { etat: "ok"; donnees: TableauMeta } | { etat: "non_installe" } | { etat: "erreur" };

/** Le prix qui sert de poids à la répartition d'un groupe : prix affiché, ou somme des lots. */
export function prixDeReference(s: SyntheseBien): number | null {
  const c = s.enVigueur;
  if (!c) return null;
  if (!c.vente_par_lots) return c.prix_affiche_cents;
  const t = s.totalLots?.prix;
  return t && t.complet && s.lots.length > 0 ? centimesArrondis(t.centimes) : null;
}

function cleDe(r: Rattachement): string {
  if (r.type === "orpheline") return "orpheline";
  if (r.type === "hors_portefeuille") return `hors:${r.regleId}`;
  return `biens:${[...r.biens].sort().join(",")}`;
}

export async function lireTableauMeta(maintenant: Date): Promise<LectureMeta> {
  const supabase = await createSupabaseServerClient();
  const jour = jourParis(maintenant);
  try {
    // Tout se lit page après page, trié sur une clé unique : un total calculé
    // sur une liste tronquée à 1 000 lignes serait faux sans le dire.
    const [synchros, controlesLus, totaux, pubs, toutesRegles, pilotage] = await Promise.all([
      supabase.from("pilotage_meta_synchros").select("*").order("demarree_le", { ascending: false }).limit(10),
      toutLire<PilotageMetaControleRow>((a, b) =>
        supabase
          .from("pilotage_meta_controles")
          .select("*")
          .gte("jour", ajouterJours(jour, -90))
          .order("jour", { ascending: false })
          .range(a, b),
      ),
      toutLire<PilotageMetaTotalPubRow>((a, b) =>
        supabase.rpc("crm_pilotage_meta_totaux", { p_debut: null, p_fin: null }).order("ad_id").range(a, b),
      ),
      toutLire<PilotageMetaPubRow>((a, b) => supabase.from("pilotage_meta_pubs").select("*").order("ad_id").range(a, b)),
      toutLire<PilotageMetaRegleRow>((a, b) =>
        supabase
          .from("pilotage_meta_regles")
          .select("*")
          .order("creee_le", { ascending: false })
          .order("id")
          .range(a, b),
      ),
      lirePilotage(),
    ]);
    if (synchros.error) {
      if (estNonInstalle(synchros.error.code)) return { etat: "non_installe" };
      console.error("pilotage meta : lecture impossible", { code: synchros.error.code ?? "sans code" });
      return { etat: "erreur" };
    }
    if (pilotage.etat === "non_installe") return { etat: "non_installe" };
    if (pilotage.etat === "erreur") return { etat: "erreur" };

    const biens = pilotage.donnees.map((d) => ({ id: d.bien.id, nom: nomDuBien(d.bien) }));
    const prix = new Map<string, number | null>(
      pilotage.donnees.map((d) => [
        d.bien.id,
        prixDeReference(
          syntheseDuBien({
            jour,
            conditions: d.conditions,
            lots: d.lots,
            etatsDesLots: d.etatsDesLots,
            couts: d.couts,
            photographieMandat: d.photographieMandat,
          }),
        ),
      ]),
    );

    const index = indexerRegles(toutesRegles as RegleRattachement[]);
    const parCampagne = new Map<string, CampagneAffichee>();
    let depense = 0;
    let orpheline = 0;
    let horsPortefeuille = 0;

    for (const p of totaux) {
      const cle = p.campaign_id ?? `sans-campagne:${p.ad_id}`;
      const c =
        parCampagne.get(cle) ??
        ({
          campaignId: p.campaign_id,
          campaignName: p.campaign_name,
          depenseCentimes: 0,
          leads: 0,
          impressions: 0,
          pubs: [],
          rattachements: [],
          premierJour: p.premier_jour,
          dernierJour: p.dernier_jour,
        } satisfies CampagneAffichee);
      c.depenseCentimes += p.depense_cents;
      c.leads += p.leads;
      c.impressions += p.impressions;
      c.pubs.push(p);
      if (p.premier_jour < c.premierJour) c.premierJour = p.premier_jour;
      if (p.dernier_jour > c.dernierJour) c.dernierJour = p.dernier_jour;

      const r = rattacher(p, index);
      const k = cleDe(r);
      let ra = c.rattachements.find((x) => x.cle === k);
      if (!ra) {
        let parts: PartDeGroupe[] | null = null;
        let biensSansPrix: string[] = [];
        if (r.type === "biens" && r.biens.length > 1) {
          const rep = repartirAuProrata(10_000, r.biens, prix);
          if (rep.ok) {
            parts = [...rep.parts.entries()].map(([bien, part]) => ({
              bien,
              pourcent: Number(part.n) / Number(part.d) / 100,
            }));
          } else biensSansPrix = rep.biensSansPrix;
        }
        ra = { cle: k, rattachement: r, depenseCentimes: 0, leads: 0, pubs: 0, parts, biensSansPrix };
        c.rattachements.push(ra);
      }
      ra.depenseCentimes += p.depense_cents;
      ra.leads += p.leads;
      ra.pubs += 1;

      depense += p.depense_cents;
      if (r.type === "orpheline") orpheline += p.depense_cents;
      if (r.type === "hors_portefeuille") horsPortefeuille += p.depense_cents;
      parCampagne.set(cle, c);
    }

    const campagnes = [...parCampagne.values()].sort((a, b) => b.depenseCentimes - a.depenseCentimes);
    return {
      etat: "ok",
      donnees: {
        synchros: (synchros.data ?? []) as PilotageMetaSynchroRow[],
        controlesLus: controlesLus.length,
        ecarts: controlesLus.filter((c) => Math.abs(c.depense_pubs_cents - c.depense_compte_cents) > c.pubs),
        campagnes,
        regles: toutesRegles,
        biens,
        liens: new Map(pubs.map((p) => [p.ad_id, p])),
        totaux: {
          depense,
          orpheline,
          horsPortefeuille,
          campagnesOrphelines: campagnes.filter((c) => c.rattachements.some((r) => r.rattachement.type === "orpheline")).length,
        },
      },
    };
  } catch (cause) {
    const code = cause instanceof LectureImpossible ? cause.code : undefined;
    if (estNonInstalle(code)) return { etat: "non_installe" };
    console.error("pilotage meta : lecture impossible", { code: code ?? "sans code" });
    return { etat: "erreur" };
  }
}
