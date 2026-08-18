import "server-only";
import type {
  EmailProvider,
  EmailSendInput,
  ProviderTransportOptions,
  SendResult,
} from "./types";
import { httpStatusToErrorCode } from "./types";

/**
 * Adaptateur **Lumail** — transport e-mail, STRICTEMENT serveur.
 *
 * API REST (et non SDK) : voir docs/adr/002 §2.4. La surface utile se limite à
 * un endpoint, et un `fetchImpl` injectable permet de tester **sans jamais
 * appeler l'API réelle**.
 *
 * Contrat observé dans la documentation officielle (https://lumail.io/docs) :
 *   POST https://lumail.io/api/v1/emails
 *   Authorization: Bearer lum_…
 *   Body : { to, subject, content, contentType?, preview?, replyTo?, from, tracking? }
 *   Réponse : { success, message, qstashMessageId }
 *
 * ⚠️ Deux points documentés et volontairement traités ici :
 *   1. **Aucun en-tête d'idempotence n'existe.** L'idempotence est donc portée
 *      par Prodigio (index unique en base), jamais par le fournisseur.
 *   2. **L'envoi crée le destinataire comme « subscriber »** s'il n'existe pas.
 *      Envoyer a donc un effet de bord côté fournisseur : raison de plus pour
 *      ne rien activer avant validation juridique et ne JAMAIS importer la base.
 *
 * La clé n'est jamais journalisée, jamais renvoyée, jamais dans le bundle client.
 */

const LUMAIL_ENDPOINT = "https://lumail.io/api/v1/emails";

export interface LumailConfig {
  apiKey: string | null | undefined;
  fromAddress: string | null | undefined;
  replyTo?: string | null;
}

/** Format de contenu attendu par Lumail, dérivé du format du modèle. */
function contentType(format: EmailSendInput["bodyFormat"]): "MARKDOWN" | "HTML" {
  return format === "html" ? "HTML" : "MARKDOWN";
}

export function createLumailProvider(config: LumailConfig): EmailProvider {
  return {
    key: "lumail",

    isConfigured(): boolean {
      const key = config.apiKey;
      const from = config.fromAddress;
      return (
        typeof key === "string" &&
        key.trim().length > 0 &&
        typeof from === "string" &&
        /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(from.trim())
      );
    },

    async send(input: EmailSendInput, opts: ProviderTransportOptions = {}): Promise<SendResult> {
      if (!this.isConfigured()) {
        return { ok: false, errorCode: "configuration_absente" };
      }

      const fetchImpl = opts.fetchImpl ?? fetch;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 8000);

      try {
        const res = await fetchImpl(LUMAIL_ENDPOINT, {
          method: "POST",
          headers: {
            authorization: `Bearer ${config.apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            to: input.to,
            from: config.fromAddress,
            subject: input.subject,
            content: input.body,
            contentType: contentType(input.bodyFormat),
            preview: input.previewText ?? undefined,
            replyTo: input.replyTo ?? config.replyTo ?? undefined,
            // Transactionnel : ni pixel d'ouverture, ni réécriture des liens.
            // Un lien de réinitialisation ou de rendez-vous doit rester lisible
            // et vérifiable par le destinataire.
            tracking: { links: false, open: false },
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          return {
            ok: false,
            errorCode: httpStatusToErrorCode(res.status),
            status: res.status,
            // Aucun corps de réponse n'est journalisé : il peut contenir l'adresse.
            detail: `HTTP ${res.status}`,
          };
        }

        const payload = (await res.json().catch(() => null)) as
          | { success?: boolean; qstashMessageId?: string }
          | null;

        if (payload && payload.success === false) {
          return { ok: false, errorCode: "rejet_permanent", detail: "réponse négative du fournisseur" };
        }

        return {
          ok: true,
          providerMessageId: payload?.qstashMessageId ?? null,
          // L'API accuse une MISE EN FILE, pas une remise : le statut réel est
          // rapproché ultérieurement (voir docs/21 § rapprochement).
          providerStatus: "queued",
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
