import "server-only";

/**
 * Planification de l'alerte Slack : collecte les données EN REQUÊTE (rapide) puis
 * DIFFÈRE l'envoi réseau après la réponse utilisateur via `after()` (Next.js).
 * L'envoi (jusqu'à 3 tentatives × 4 s) ne ralentit donc jamais le rendez-vous.
 * Entièrement best-effort : n'échoue jamais l'opération appelante.
 */

import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isEstimationSlackConfigured } from "@/config";
import type { Database } from "@/lib/supabase/types";
import { collectEstimationAlertData, type AlertTrigger } from "./collect";
import { sendEstimationSlackAlert } from "./notify";

export async function scheduleEstimationAlert(
  supabase: SupabaseClient<Database>,
  trigger: AlertTrigger,
): Promise<void> {
  // Désactivé proprement si non configuré : aucune collecte, aucun appel.
  if (!isEstimationSlackConfigured()) return;

  let data;
  try {
    data = await collectEstimationAlertData(supabase, trigger);
  } catch {
    return; // best-effort : la collecte ne bloque jamais le rendez-vous
  }
  if (!data) return;

  const run = async () => {
    await sendEstimationSlackAlert(data);
  };

  try {
    // Exécuté APRÈS l'envoi de la réponse au client.
    after(run);
  } catch {
    // Hors contexte requête (cas rare) : envoi immédiat non bloquant.
    void run();
  }
}
