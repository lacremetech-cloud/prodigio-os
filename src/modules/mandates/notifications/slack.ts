import "server-only";
import type { SlackMessage } from "./message";

/**
 * Transport Slack (webhook entrant) — **strictement serveur**. Aucune valeur de
 * webhook n'est jamais journalisée ni renvoyée. `fetchImpl` est injectable pour
 * permettre des tests **sans jamais appeler le vrai webhook**.
 */

export type SlackFetch = typeof fetch;

export interface SlackTransportResult {
  ok: boolean;
  status: number | null;
}

/**
 * Poste un message Block Kit vers l'URL de webhook. Applique un timeout via
 * `AbortController`. Lève en cas d'erreur réseau / timeout (l'orchestrateur
 * décide du réessai) ; renvoie `{ ok, status }` pour une réponse HTTP.
 */
export async function postSlackWebhook(
  webhookUrl: string,
  message: SlackMessage,
  opts: { fetchImpl?: SlackFetch; timeoutMs?: number } = {},
): Promise<SlackTransportResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 4000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(message),
      signal: controller.signal,
    });
    return { ok: res.ok, status: res.status };
  } finally {
    clearTimeout(timer);
  }
}
