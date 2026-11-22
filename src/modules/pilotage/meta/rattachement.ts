/**
 * LE RATTACHEMENT DES DÉPENSES META AUX BIENS — fonctions pures.
 *
 * Ordre des règles (validé par Victor) :
 *   1. une EXCEPTION par identifiant de campagne prime sur tout ;
 *   2. sinon, la convention de nommage, du plus précis au plus large :
 *        - la pub      « BIEN | ANGLE | FORMAT | V1 »  → le BIEN, premier segment ;
 *        - la campagne « PRODIGIO | BIEN | LEADS »     → le BIEN, deuxième segment ;
 *      un jeton ne compte que s'il correspond à une règle en vigueur ;
 *   3. sinon, la dépense est ORPHELINE : comptée dans les totaux, et signalée.
 *
 * Une règle vise un bien, ou plusieurs (un groupe, réparti au prorata du prix
 * affiché), ou « hors portefeuille » (visible, mais hors des indicateurs).
 *
 * Le rattachement n'est pas recopié en base : il se calcule à la lecture, à
 * partir des règles en vigueur. Changer une règle reclasse tout l'historique.
 */

import { divise, entier, fois, somme, type Exact } from "../exact";

export interface RegleRattachement {
  id: string;
  type_regle: "jeton" | "campagne";
  valeur: string;
  cible: "biens" | "hors_portefeuille";
  biens: string[];
  retiree_le: string | null;
}

/** Ce qui identifie une pub pour la rattacher. */
export interface PubARattacher {
  campaign_id: string | null;
  campaign_name: string | null;
  ad_name: string | null;
}

export type SourceRattachement = "exception_campagne" | "nom_pub" | "nom_campagne";

export type Rattachement =
  | { type: "biens"; biens: string[]; regleId: string; source: SourceRattachement; jeton: string | null }
  | { type: "hors_portefeuille"; regleId: string; source: SourceRattachement; jeton: string | null }
  | { type: "orpheline"; jetonPub: string | null; jetonCampagne: string | null };

/**
 * Un jeton comme le compare la base : sans accent, en capitales, espaces
 * resserrés. « Verdùn », « verdun » et « VERDUN » sont le même bien.
 */
export function normaliserJeton(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function segments(nom: string | null): string[] {
  if (!nom) return [];
  return nom.split("|").map((s) => normaliserJeton(s));
}

/** Le BIEN d'une pub « BIEN | ANGLE | FORMAT | V1 » : premier segment, s'il y en a plusieurs. */
export function jetonDeLaPub(adName: string | null): string | null {
  const s = segments(adName);
  return s.length >= 2 && s[0] ? s[0] : null;
}

/** Le BIEN d'une campagne « PRODIGIO | BIEN | LEADS » : deuxième segment, après PRODIGIO. */
export function jetonDeLaCampagne(campaignName: string | null): string | null {
  const s = segments(campaignName);
  return s.length >= 2 && s[0] === "PRODIGIO" && s[1] ? s[1] : null;
}

/** Les règles en vigueur, indexées pour la recherche. */
export interface IndexDesRegles {
  campagnes: Map<string, RegleRattachement>;
  jetons: Map<string, RegleRattachement>;
}

export function indexerRegles(regles: readonly RegleRattachement[]): IndexDesRegles {
  const campagnes = new Map<string, RegleRattachement>();
  const jetons = new Map<string, RegleRattachement>();
  for (const r of regles) {
    if (r.retiree_le) continue;
    if (r.type_regle === "campagne") campagnes.set(r.valeur.trim(), r);
    else jetons.set(normaliserJeton(r.valeur), r);
  }
  return { campagnes, jetons };
}

function depuisRegle(regle: RegleRattachement, source: SourceRattachement, jeton: string | null): Rattachement {
  return regle.cible === "hors_portefeuille"
    ? { type: "hors_portefeuille", regleId: regle.id, source, jeton }
    : { type: "biens", biens: [...regle.biens], regleId: regle.id, source, jeton };
}

/** Le rattachement d'une pub, selon l'ordre des règles. */
export function rattacher(pub: PubARattacher, index: IndexDesRegles): Rattachement {
  const exception = pub.campaign_id ? index.campagnes.get(pub.campaign_id.trim()) : undefined;
  if (exception) return depuisRegle(exception, "exception_campagne", null);

  const jetonPub = jetonDeLaPub(pub.ad_name);
  const parPub = jetonPub ? index.jetons.get(jetonPub) : undefined;
  if (parPub && jetonPub) return depuisRegle(parPub, "nom_pub", jetonPub);

  const jetonCampagne = jetonDeLaCampagne(pub.campaign_name);
  const parCampagne = jetonCampagne ? index.jetons.get(jetonCampagne) : undefined;
  if (parCampagne && jetonCampagne) return depuisRegle(parCampagne, "nom_campagne", jetonCampagne);

  return { type: "orpheline", jetonPub, jetonCampagne };
}

/** Vrai si la dépense compte dans les indicateurs (tout sauf « hors portefeuille »). */
export function dansLesIndicateurs(r: Rattachement): boolean {
  return r.type !== "hors_portefeuille";
}

export type Repartition =
  | { ok: true; parts: Map<string, Exact> }
  | { ok: false; biensSansPrix: string[] };

/**
 * Répartit un montant entre les biens d'un groupe, AU PRORATA DU PRIX AFFICHÉ.
 * Un seul bien : tout pour lui. Un prix manquant : répartition impossible,
 * et on dit lequel — on ne remplace pas un prix absent par une part égale.
 * Les parts sont exactes ; leur somme vaut le montant, au centime près.
 */
export function repartirAuProrata(
  montantCentimes: number,
  biens: readonly string[],
  prixDuBien: ReadonlyMap<string, number | null>,
): Repartition {
  const uniques = [...new Set(biens)];
  if (uniques.length === 1) return { ok: true, parts: new Map([[uniques[0]!, entier(montantCentimes)]]) };
  const sansPrix = uniques.filter((b) => {
    const p = prixDuBien.get(b);
    return p == null || !Number.isSafeInteger(p) || p <= 0;
  });
  if (uniques.length === 0 || sansPrix.length > 0) return { ok: false, biensSansPrix: sansPrix };
  const poids = uniques.map((b) => entier(prixDuBien.get(b) as number));
  const total = somme(poids);
  const montant = entier(montantCentimes);
  return {
    ok: true,
    parts: new Map(uniques.map((b, i) => [b, divise(fois(montant, poids[i]!), total)])),
  };
}
