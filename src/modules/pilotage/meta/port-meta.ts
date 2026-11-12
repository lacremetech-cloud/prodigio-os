/**
 * Ce que la lecture du matin demande à Meta, traduit en requêtes de l'API
 * Graph (lecture seule). Aucune logique métier ici : les règles vivent dans
 * `synchro.ts`, testées avec un faux Meta.
 */

import { creerClientGraph, type OptionsGraph } from "./graph";
import {
  couvertureMeta,
  entierDepuisTexte,
  versDepenseCompte,
  versLigneInsight,
  versPub,
  type LigneInsight,
  type PubLue,
} from "./lecture";
import { presetMeta, type Periode } from "./periodes";

/** Les champs demandés, ligne par ligne, au niveau de la pub (consigne du brief). */
export const CHAMPS_INSIGHTS = [
  "date_start",
  "date_stop",
  "campaign_id",
  "campaign_name",
  "adset_id",
  "adset_name",
  "ad_id",
  "ad_name",
  "spend",
  "impressions",
  "reach",
  "frequency",
  "clicks",
  "inline_link_clicks",
  "ctr",
  "cpm",
  "actions",
  "cost_per_action_type",
].join(",");

export interface CouvertureLue {
  couverture: number;
  impressions: number;
  debut: string | null;
  fin: string | null;
}

/** Un filtre de couverture : les pubs à compter, ou celles à écarter. */
export type FiltreCouverture = { inclure: string[] } | { exclure: string[] };

export interface PortMeta {
  compte(): Promise<{ devise: string | null; fuseau: string | null; creeLe: string | null }>;
  insights(debut: string, fin: string): Promise<LigneInsight[]>;
  depenseCompte(debut: string, fin: string): Promise<{ jour: string; depense_compte_cents: number }[]>;
  pubs(): Promise<PubLue[]>;
  couverture(periode: Periode, filtre: FiltreCouverture): Promise<CouvertureLue>;
  readonly appels: number;
}

/** « act_123 » ou « 123 » → « 123 ». */
export function identifiantDeCompte(brut: string): string {
  const id = brut.trim().replace(/^act_/i, "");
  if (!/^\d{5,30}$/.test(id)) throw new RangeError("identifiant de compte publicitaire invalide");
  return id;
}

export function creerPortMeta(compteId: string, options: OptionsGraph): PortMeta {
  const graph = creerClientGraph(options);
  const compte = `act_${identifiantDeCompte(compteId)}`;
  const periodeDe = (debut: string, fin: string) => JSON.stringify({ since: debut, until: fin });

  return {
    async compte() {
      const c = await graph.objet(compte, { fields: "currency,timezone_name,created_time" });
      const texte = (v: unknown) => (typeof v === "string" && v ? v : null);
      return { devise: texte(c.currency), fuseau: texte(c.timezone_name), creeLe: texte(c.created_time) };
    },

    async insights(debut, fin) {
      const lignes = await graph.liste(`${compte}/insights`, {
        level: "ad",
        time_increment: 1,
        time_range: periodeDe(debut, fin),
        fields: CHAMPS_INSIGHTS,
        limit: 500,
      });
      return lignes.map(versLigneInsight);
    },

    async depenseCompte(debut, fin) {
      const lignes = await graph.liste(`${compte}/insights`, {
        level: "account",
        time_increment: 1,
        time_range: periodeDe(debut, fin),
        fields: "spend,date_start,date_stop",
        limit: 500,
      });
      return lignes.map(versDepenseCompte);
    },

    async pubs() {
      const lignes = await graph.liste(`${compte}/ads`, {
        fields: "id,name,effective_status,adset_id,campaign_id,preview_shareable_link,created_time",
        limit: 500,
      });
      return lignes.map(versPub);
    },

    async couverture(periode, filtre) {
      const filtrage =
        "inclure" in filtre
          ? [{ field: "ad.id", operator: "IN", value: filtre.inclure }]
          : filtre.exclure.length > 0
            ? [{ field: "ad.id", operator: "NOT_IN", value: filtre.exclure }]
            : null;
      const lignes = await graph.liste(`${compte}/insights`, {
        level: "account",
        date_preset: presetMeta[periode],
        fields: "reach,impressions,date_start,date_stop",
        ...(filtrage ? { filtering: JSON.stringify(filtrage) } : {}),
      });
      const l = lignes[0] ? couvertureMeta.parse(lignes[0]) : null;
      // Aucune ligne : aucune impression sur la période, donc personne touché.
      return {
        couverture: l ? entierDepuisTexte(l.reach) : 0,
        impressions: l ? entierDepuisTexte(l.impressions) : 0,
        debut: l?.date_start ?? null,
        fin: l?.date_stop ?? null,
      };
    },

    get appels() {
      return graph.appels;
    },
  };
}
