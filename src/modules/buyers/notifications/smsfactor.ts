import "server-only";
import { env } from "@/config";

/**
 * Transport SMSFactor — **strictement serveur**.
 *
 * Contrat de l'API, relevé sur leur documentation :
 *
 *   POST https://api.smsfactor.com/send
 *   Authorization: Bearer <jeton>
 *   Content-Type / Accept: application/json
 *   { "sms": { "message": { "text", "sender" },
 *              "recipients": { "gsm": [ { "value": "+33…" } ] } } }
 *
 * L'en-tête `Accept: application/json` n'est pas facultatif : sans lui l'API
 * répond en XML, et la réponse devient illisible pour ce module.
 *
 * Réponse : `status` vaut 1 quand la campagne est acceptée. Le reste
 * (`ticket`, `cost`, `credits`) sert au suivi côté SMSFactor et ne nous
 * intéresse pas ici — on ne retient que l'acceptation et le coût.
 *
 * Le jeton permet de débiter des crédits : il ne sort jamais d'ici, n'est
 * jamais journalisé, et ne figure dans aucune URL — une URL se retrouve dans
 * les journaux d'accès, pas un en-tête.
 */

const URL_ENVOI = "https://api.smsfactor.com/send";
const DELAI_MS = 6000;

export type SmsFetch = typeof fetch;

export interface ResultatSms {
  envoye: boolean;
  raison?: "non_configure" | "sans_destinataire" | "refus" | "injoignable";
  /** Code de statut SMSFactor (1 = accepté), ou code HTTP en cas de refus. */
  code?: number;
  /** Crédits consommés, tels que l'API les rapporte. */
  cout?: number;
}

/**
 * Envoie un SMS. Ne lève jamais : rend la raison d'un non-envoi.
 *
 * Un accusé de réception raté ne doit jamais faire échouer un dépôt — la
 * demande est déjà enregistrée quand on arrive ici.
 */
export async function envoyerSms(
  destinataire: string | null | undefined,
  texte: string,
  opts: { fetchImpl?: SmsFetch; timeoutMs?: number } = {},
): Promise<ResultatSms> {
  const jeton = env.SMSFACTOR_API_TOKEN;
  if (typeof jeton !== "string" || jeton.trim().length === 0) {
    return { envoye: false, raison: "non_configure" };
  }
  const numero = (destinataire ?? "").trim();
  if (numero.length === 0) return { envoye: false, raison: "sans_destinataire" };

  const message: Record<string, unknown> = { text: texte };
  const expediteur = env.SMSFACTOR_SENDER?.trim();
  if (expediteur) message.sender = expediteur;

  const fetchImpl = opts.fetchImpl ?? fetch;
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), opts.timeoutMs ?? DELAI_MS);
  try {
    const reponse = await fetchImpl(URL_ENVOI, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        authorization: `Bearer ${jeton}`,
      },
      body: JSON.stringify({
        sms: { message, recipients: { gsm: [{ value: numero }] } },
      }),
      signal: controleur.signal,
      cache: "no-store",
    });

    if (!reponse.ok) return { envoye: false, raison: "refus", code: reponse.status };

    const corps = (await reponse.json().catch(() => null)) as {
      status?: number;
      cost?: number;
    } | null;
    /* `status` vaut 1 quand la campagne est acceptee. Une reponse illisible est
       traitee comme un refus : mieux vaut un accuse manquant signale qu'un
       envoi suppose. */
    if (!corps || corps.status !== 1) {
      return { envoye: false, raison: "refus", code: corps?.status };
    }
    return { envoye: true, code: corps.status, cout: corps.cost };
  } catch {
    return { envoye: false, raison: "injoignable" };
  } finally {
    clearTimeout(minuteur);
  }
}
