import "server-only";
import type {
  ProviderTransportOptions,
  SendResult,
  SmsProvider,
  SmsSendInput,
} from "./types";
import { httpStatusToErrorCode, toE164 } from "./types";

/**
 * Adaptateur **Twilio** — transport SMS, STRICTEMENT serveur.
 *
 * PRÉPARÉ, non activé : aucun SMS réel n'est envoyé dans cette V1 (aucune
 * variable n'est renseignée, et le dispatcher reste en simulation).
 *
 * Contrat REST stable de Twilio :
 *   POST https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Messages.json
 *   Authorization: Basic base64(AccountSid:AuthToken)
 *   Corps `application/x-www-form-urlencoded` : To, Body, et From
 *   (ou MessagingServiceSid).
 *   Réponse : { sid, status, error_code, price }
 *
 * Comme Lumail, Twilio n'expose **aucun en-tête d'idempotence** sur l'envoi :
 * l'anti-doublon reste porté par Prodigio.
 *
 * Le jeton n'est jamais journalisé, jamais renvoyé, jamais dans le bundle client.
 */

const TWILIO_BASE = "https://api.twilio.com/2010-04-01";

export interface TwilioConfig {
  accountSid: string | null | undefined;
  authToken: string | null | undefined;
  /** Expéditeur : numéro E.164 **ou** identifiant de Messaging Service. */
  from: string | null | undefined;
}

/** Codes d'erreur Twilio les plus courants, traduits vers le vocabulaire Prodigio. */
function twilioErrorCode(code: number | null | undefined) {
  switch (code) {
    case 21211: // 'To' invalide
    case 21614: // non joignable par SMS
      return "destinataire_invalide" as const;
    case 21610: // destinataire désabonné (STOP)
      return "rejet_permanent" as const;
    case 20003:
      return "authentification_refusee" as const;
    case 20429:
      return "limite_debit" as const;
    default:
      return null;
  }
}

export function createTwilioProvider(config: TwilioConfig): SmsProvider {
  return {
    key: "twilio",

    isConfigured(): boolean {
      return (
        typeof config.accountSid === "string" &&
        config.accountSid.trim().length > 0 &&
        typeof config.authToken === "string" &&
        config.authToken.trim().length > 0 &&
        typeof config.from === "string" &&
        config.from.trim().length > 0
      );
    },

    async send(input: SmsSendInput, opts: ProviderTransportOptions = {}): Promise<SendResult> {
      if (!this.isConfigured()) {
        return { ok: false, errorCode: "configuration_absente" };
      }

      // Normalisation E.164 : un numéro non exploitable est refusé AVANT tout
      // appel réseau — jamais « tenté pour voir ».
      const to = toE164(input.to);
      if (!to) return { ok: false, errorCode: "destinataire_invalide" };

      const from = config.from as string;
      const body = new URLSearchParams({ To: to, Body: input.body });
      // Un Messaging Service commence par `MG` ; sinon c'est un numéro émetteur.
      if (from.startsWith("MG")) body.set("MessagingServiceSid", from);
      else body.set("From", from);

      const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64");
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 8000);

      try {
        const res = await (opts.fetchImpl ?? fetch)(
          `${TWILIO_BASE}/Accounts/${encodeURIComponent(config.accountSid as string)}/Messages.json`,
          {
            method: "POST",
            headers: {
              authorization: `Basic ${auth}`,
              "content-type": "application/x-www-form-urlencoded",
            },
            body: body.toString(),
            signal: controller.signal,
          },
        );

        const payload = (await res.json().catch(() => null)) as
          | { sid?: string; status?: string; error_code?: number | null }
          | null;

        if (!res.ok) {
          return {
            ok: false,
            errorCode: twilioErrorCode(payload?.error_code) ?? httpStatusToErrorCode(res.status),
            status: res.status,
            detail: `HTTP ${res.status}`,
          };
        }

        return {
          ok: true,
          providerMessageId: payload?.sid ?? null,
          providerStatus: payload?.status ?? null,
        };
      } catch (err) {
        const aborted = err instanceof Error && err.name === "AbortError";
        return { ok: false, errorCode: aborted ? "delai_depasse" : "indisponible" };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
