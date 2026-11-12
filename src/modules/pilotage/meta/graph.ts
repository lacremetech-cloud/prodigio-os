/**
 * LE CLIENT DE L'API GRAPH DE META — EN LECTURE SEULE.
 *
 * Quatre règles, tenues ici et vérifiées par les tests :
 *
 *  1. RIEN N'EST JAMAIS ÉCRIT CHEZ META. Ce client n'émet que des requêtes
 *     `GET`. La remontée de conversions est l'étape 4 ; elle ne passera pas
 *     par ici.
 *  2. LE JETON VOYAGE DANS L'EN-TÊTE `Authorization`, JAMAIS DANS L'URL, ni
 *     dans un message, ni dans un journal. La pagination de Meta propose des
 *     liens `next` qui peuvent porter `access_token` : on ne les suit pas, on
 *     reconstruit la requête avec le curseur `after`.
 *  3. LES LIMITES DE DÉBIT SE RATTRAPENT (codes 4, 17, 32, 613, 80000–80014) :
 *     on attend, on reprend, dans la limite du temps accordé à la lecture.
 *  4. UN REFUS SE DIT EN CLAIR : jeton refusé (190), droits manquants — avec ce
 *     qu'il faut faire, jamais avec le texte brut de Meta.
 *
 * Version de l'API vérifiée le 11/11/2026 : v27.0.
 */

export const META_GRAPH_VERSION = "v27.0";
const HOTE = "https://graph.facebook.com";
const DELAI_REQUETE_MS = 30_000;

export type GenreErreurMeta = "jeton" | "droits" | "limite" | "reseau" | "reponse" | "delai";

export class ErreurMeta extends Error {
  constructor(
    readonly genre: GenreErreurMeta,
    message: string,
    readonly code?: number,
    readonly sousCode?: number,
  ) {
    super(message);
    this.name = "ErreurMeta";
  }
}

export const MESSAGE_JETON_REFUSE =
  "Meta refuse le jeton de lecture (expiré, révoqué ou mal recopié) : renouvelez META_ADS_READ_TOKEN dans Vercel, puis redéployez.";

export const MESSAGE_DROITS =
  "Meta refuse l’accès au compte publicitaire : l’utilisateur système « Prodigio » doit avoir accès à ce compte avec le droit ads_read, et META_AD_ACCOUNT_ID doit être le bon.";

/** Codes de limite de débit : on attend, puis on reprend. */
export function estLimiteDeDebit(code: number | undefined): boolean {
  return code === 4 || code === 17 || code === 32 || code === 613 || (code != null && code >= 80000 && code <= 80014);
}

/** Codes de droits : l'accès au compte ou à l'objet est refusé. */
export function estRefusDeDroits(code: number | undefined, sousCode: number | undefined): boolean {
  return code === 10 || (code != null && code >= 200 && code <= 299) || (code === 100 && sousCode === 33);
}

export interface OptionsGraph {
  jeton: string;
  /** Injection pour les tests : un faux Meta, sans réseau. */
  fetch?: typeof fetch;
  /** Injection pour les tests : attendre sans attendre. */
  attendre?: (ms: number) => Promise<void>;
  /** Horloge, en millisecondes. */
  maintenant?: () => number;
  /** Au-delà de cet instant, plus de reprise : la lecture s'arrête proprement. */
  echeanceMs?: number;
  /** Reprises au plus, par requête. */
  maxReprises?: number;
}

type Parametres = Record<string, string | number>;

interface ErreurGraph {
  error?: { message?: string; type?: string; code?: number; error_subcode?: number; is_transient?: boolean };
}

interface PageGraph {
  data?: unknown[];
  paging?: { cursors?: { after?: string }; next?: string };
}

function attendreVraiment(ms: number): Promise<void> {
  return new Promise((ok) => setTimeout(ok, ms));
}

export interface ClientGraph {
  /** Un objet (`/act_…` par exemple). */
  objet(chemin: string, params: Parametres): Promise<Record<string, unknown>>;
  /** Toutes les lignes d'une liste paginée, page après page. */
  liste(chemin: string, params: Parametres): Promise<unknown[]>;
  /** Nombre de requêtes émises, reprises comprises. */
  readonly appels: number;
}

export function creerClientGraph(options: OptionsGraph): ClientGraph {
  const leFetch = options.fetch ?? fetch;
  const attendre = options.attendre ?? attendreVraiment;
  const maintenant = options.maintenant ?? Date.now;
  const maxReprises = options.maxReprises ?? 5;
  let appels = 0;

  if (!options.jeton) throw new ErreurMeta("jeton", MESSAGE_JETON_REFUSE);

  function adresse(chemin: string, params: Parametres): string {
    if (Object.keys(params).some((k) => k.toLowerCase() === "access_token")) {
      // Garde-fou : le jeton ne passe JAMAIS par l'URL.
      throw new Error("le jeton ne se met pas dans l'URL");
    }
    const url = new URL(`${HOTE}/${META_GRAPH_VERSION}/${chemin.replace(/^\/+/, "")}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    return url.toString();
  }

  async function lire(chemin: string, params: Parametres): Promise<unknown> {
    // Construite AVANT toute requête : le refus d'un jeton dans l'URL doit
    // remonter tel quel, pas passer pour une panne de réseau.
    const url = adresse(chemin, params);
    for (let essai = 0; ; essai += 1) {
      const delaiReprise = Math.min(2 ** essai * 1000, 30_000);
      const peutReprendre =
        essai < maxReprises && (options.echeanceMs == null || maintenant() + delaiReprise < options.echeanceMs);

      let reponse: Response;
      const arret = new AbortController();
      const minuterie = setTimeout(() => arret.abort(), DELAI_REQUETE_MS);
      try {
        appels += 1;
        reponse = await leFetch(url, {
          method: "GET",
          headers: { Authorization: `Bearer ${options.jeton}`, Accept: "application/json" },
          signal: arret.signal,
          cache: "no-store",
        });
      } catch {
        clearTimeout(minuterie);
        if (peutReprendre) {
          await attendre(delaiReprise);
          continue;
        }
        throw new ErreurMeta("reseau", "Meta ne répond pas (réseau ou délai dépassé). La lecture reprendra demain matin.");
      }
      clearTimeout(minuterie);

      let corps: unknown = null;
      try {
        corps = await reponse.json();
      } catch {
        corps = null;
      }

      if (reponse.ok && corps && typeof corps === "object" && !("error" in corps)) return corps;

      const err = (corps as ErreurGraph | null)?.error;
      const code = err?.code;
      const sousCode = err?.error_subcode;

      if (code === 190) throw new ErreurMeta("jeton", MESSAGE_JETON_REFUSE, code, sousCode);
      if (estRefusDeDroits(code, sousCode)) throw new ErreurMeta("droits", MESSAGE_DROITS, code, sousCode);

      const transitoire = estLimiteDeDebit(code) || reponse.status >= 500 || err?.is_transient === true;
      if (transitoire && peutReprendre) {
        await attendre(delaiReprise);
        continue;
      }
      if (estLimiteDeDebit(code)) {
        throw new ErreurMeta(
          "limite",
          "Meta limite le nombre de lectures pour l’instant. Ce qui a été lu est enregistré ; la suite reprendra à la prochaine lecture.",
          code,
          sousCode,
        );
      }
      if (transitoire) {
        throw new ErreurMeta("reseau", "Meta est momentanément indisponible. La lecture reprendra demain matin.", code, sousCode);
      }
      // Ni le texte brut de Meta, ni l'adresse : seulement le code, qui suffit au diagnostic.
      throw new ErreurMeta(
        "reponse",
        `Meta a refusé la lecture (code ${code ?? reponse.status}${sousCode ? `/${sousCode}` : ""}).`,
        code,
        sousCode,
      );
    }
  }

  return {
    async objet(chemin, params) {
      const corps = await lire(chemin, params);
      return (corps ?? {}) as Record<string, unknown>;
    },
    async liste(chemin, params) {
      const lignes: unknown[] = [];
      let apres: string | undefined;
      for (let page = 0; page < 10_000; page += 1) {
        const corps = (await lire(chemin, apres ? { ...params, after: apres } : params)) as PageGraph;
        lignes.push(...(Array.isArray(corps.data) ? corps.data : []));
        // On ne suit PAS `paging.next` (il peut porter le jeton) : seul le
        // curseur `after` est repris, dans une requête reconstruite par nous.
        const suivant = corps.paging?.next ? corps.paging.cursors?.after : undefined;
        if (!suivant || suivant === apres) return lignes;
        apres = suivant;
      }
      return lignes;
    },
    get appels() {
      return appels;
    },
  };
}
