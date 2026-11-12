/**
 * Ce que Meta renvoie, lu et vérifié à la frontière (Zod), puis converti dans
 * nos unités : centimes entiers, entiers, et l'action `lead` SEULE.
 *
 * Meta renvoie ses nombres en TEXTE (« 12.34 ») : on les convertit sans passer
 * par la virgule flottante. Une ligne illisible est refusée avec sa raison,
 * jamais devinée.
 */

import { z } from "zod";

const texteNombre = z.string().regex(/^-?\d+(?:\.\d+)?$/, "nombre attendu");

const action = z.object({ action_type: z.string(), value: texteNombre }).passthrough();

/** Une ligne d'`insights` au niveau `ad`, `time_increment=1`. */
export const ligneInsightMeta = z
  .object({
    date_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    date_stop: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    ad_id: z.string().regex(/^\d{1,30}$/),
    ad_name: z.string().optional(),
    adset_id: z.string().regex(/^\d{1,30}$/).optional(),
    adset_name: z.string().optional(),
    campaign_id: z.string().regex(/^\d{1,30}$/).optional(),
    campaign_name: z.string().optional(),
    spend: texteNombre.optional(),
    impressions: texteNombre.optional(),
    reach: texteNombre.optional(),
    frequency: texteNombre.optional(),
    clicks: texteNombre.optional(),
    inline_link_clicks: texteNombre.optional(),
    ctr: texteNombre.optional(),
    cpm: texteNombre.optional(),
    actions: z.array(action).optional(),
    cost_per_action_type: z.array(action).optional(),
  })
  .passthrough();

/** Une ligne d'`insights` au niveau `account` : la dépense du compte, un jour. */
export const ligneCompteMeta = z
  .object({
    date_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    spend: texteNombre.optional(),
  })
  .passthrough();

/** Une pub de `/act_…/ads`. */
export const pubMeta = z
  .object({
    id: z.string().regex(/^\d{1,30}$/),
    name: z.string().optional(),
    effective_status: z.string().optional(),
    adset_id: z.string().optional(),
    campaign_id: z.string().optional(),
    preview_shareable_link: z.string().optional(),
    created_time: z.string().optional(),
  })
  .passthrough();

/** La couverture d'une période (`level=account`, un `date_preset`). */
export const couvertureMeta = z
  .object({
    reach: texteNombre.optional(),
    impressions: texteNombre.optional(),
    date_start: z.string().optional(),
    date_stop: z.string().optional(),
  })
  .passthrough();

/**
 * « 12.34 » → 1234 centimes, sans virgule flottante. Au-delà de deux décimales
 * (Meta en donne parfois davantage), arrondi au centime, demi vers le haut.
 */
export function centimesDepuisTexte(valeur: string | undefined): number {
  if (valeur == null || valeur === "") return 0;
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(valeur.trim());
  if (!m) throw new RangeError(`montant Meta illisible : ${valeur}`);
  const decimales = (m[3] ?? "").padEnd(3, "0");
  let centimes = BigInt(m[2]!) * BigInt(100) + BigInt(decimales.slice(0, 2));
  if (Number(decimales[2]) >= 5) centimes += BigInt(1);
  const n = Number(centimes);
  if (!Number.isSafeInteger(n)) throw new RangeError(`montant Meta hors limites : ${valeur}`);
  return m[1] === "-" ? -n : n;
}

/** « 1234 » → 1234. Un nombre décimal ou absent est refusé, ou vaut 0. */
export function entierDepuisTexte(valeur: string | undefined): number {
  if (valeur == null || valeur === "") return 0;
  if (!/^\d+$/.test(valeur.trim())) throw new RangeError(`entier Meta illisible : ${valeur}`);
  const n = Number(valeur);
  if (!Number.isSafeInteger(n)) throw new RangeError(`entier Meta hors limites : ${valeur}`);
  return n;
}

/**
 * Les leads : l'action `lead` SEULE. Meta renvoie aussi `onsite_web_lead`,
 * `offsite_conversion.fb_pixel_lead` et `offsite_lead_add_20_s_calls`, aux
 * mêmes valeurs : les additionner compterait chaque demande plusieurs fois.
 */
export function leadsDepuisActions(actions: readonly { action_type: string; value: string }[] | undefined): number {
  if (!actions) return 0;
  let total = 0;
  for (const a of actions) {
    if (a.action_type !== "lead") continue;
    const n = Number(a.value);
    if (Number.isFinite(n) && n > 0) total += Math.round(n);
  }
  return total;
}

/** Une ligne prête pour `crm_pilotage_meta_remplacer_tranche`. */
export interface LigneInsight {
  jour: string;
  ad_id: string;
  ad_name: string | null;
  adset_id: string | null;
  adset_name: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  depense_cents: number;
  impressions: number;
  couverture: number | null;
  frequence: string | null;
  clics: number;
  clics_lien: number;
  ctr: string | null;
  cpm: string | null;
  leads: number;
  actions: unknown[] | null;
  cout_par_action: unknown[] | null;
}

export function versLigneInsight(brute: unknown): LigneInsight {
  const l = ligneInsightMeta.parse(brute);
  return {
    jour: l.date_start,
    ad_id: l.ad_id,
    ad_name: l.ad_name ?? null,
    adset_id: l.adset_id ?? null,
    adset_name: l.adset_name ?? null,
    campaign_id: l.campaign_id ?? null,
    campaign_name: l.campaign_name ?? null,
    depense_cents: Math.max(centimesDepuisTexte(l.spend), 0),
    impressions: entierDepuisTexte(l.impressions),
    couverture: l.reach == null ? null : entierDepuisTexte(l.reach),
    frequence: l.frequency ?? null,
    clics: entierDepuisTexte(l.clicks),
    clics_lien: entierDepuisTexte(l.inline_link_clicks),
    ctr: l.ctr ?? null,
    cpm: l.cpm ?? null,
    leads: leadsDepuisActions(l.actions),
    actions: l.actions ?? null,
    cout_par_action: l.cost_per_action_type ?? null,
  };
}

/** Le jour et la dépense du compte, en centimes. */
export function versDepenseCompte(brute: unknown): { jour: string; depense_compte_cents: number } {
  const l = ligneCompteMeta.parse(brute);
  return { jour: l.date_start, depense_compte_cents: Math.max(centimesDepuisTexte(l.spend), 0) };
}

export interface PubLue {
  ad_id: string;
  ad_name: string | null;
  adset_id: string | null;
  campaign_id: string | null;
  statut: string | null;
  lien_apercu: string | null;
  cree_le_chez_meta: string | null;
}

export function versPub(brute: unknown): PubLue {
  const p = pubMeta.parse(brute);
  return {
    ad_id: p.id,
    ad_name: p.name ?? null,
    adset_id: p.adset_id ?? null,
    campaign_id: p.campaign_id ?? null,
    statut: p.effective_status ?? null,
    // Un aperçu n'est gardé que s'il est en https : c'est un lien qu'on ouvrira.
    lien_apercu: p.preview_shareable_link && /^https:\/\//.test(p.preview_shareable_link) ? p.preview_shareable_link : null,
    cree_le_chez_meta: p.created_time ?? null,
  };
}
