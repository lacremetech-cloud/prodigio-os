"use server";

import { isSupabaseConfigured } from "@/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json, SubmitMandateFunnelResult } from "@/lib/supabase/types";
import { scoreFromAnswers } from "../scoring";
import { analysis } from "./content";
import {
  buildSubmissionPayload,
  submissionRequestSchema,
  type SubmitResult,
} from "./payload";

/**
 * Action serveur : dépose une demande via la fonction SQL contrôlée
 * `submit_mandate_funnel`. Valide à nouveau les données côté serveur (Zod),
 * n'utilise que la clé publiable, et ne renvoie jamais de données d'autrui.
 *
 * Le honeypot et l'idempotence sont vérifiés dans le schéma / la base : un rejeu
 * renvoie la même soumission sans doublon.
 */
export async function submitMandateFunnelAction(
  input: unknown,
): Promise<SubmitResult> {
  // 1) Validation + normalisation côté serveur (frontière de confiance).
  const parsed = submissionRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "validation",
      message: analysis.errors.validation,
    };
  }

  // Honeypot : un champ leurre rempli => on répond « ok » sans rien enregistrer
  // ni révéler d'appréciation. (Défense faible : Turnstile reste requis — docs/07.)
  if (parsed.data.answers.company && parsed.data.answers.company.length > 0) {
    return { ok: true, appreciation: null };
  }

  // Appréciation qualitative calculée CÔTÉ SERVEUR à partir des seules réponses
  // validées : le navigateur ne peut ni l'imposer ni la modifier (les scores
  // numériques ne sont jamais renvoyés). La valeur stockée en base est, elle,
  // recalculée par la fonction SQL (source de vérité) — voir la migration scoring.
  const appreciation = scoreFromAnswers(parsed.data.answers).appreciation;

  // 2) Supabase requis pour enregistrer réellement la demande.
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      reason: "unavailable",
      message: analysis.errors.unavailable,
    };
  }

  // 3) Dépôt atomique via la fonction contrôlée.
  try {
    const payload = buildSubmissionPayload(parsed.data) as Json;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("submit_mandate_funnel", {
      payload,
    });

    if (error) {
      // On ne journalise QUE le SQLSTATE : un message Postgres peut contenir des
      // valeurs de ligne (donnée personnelle). Détail technique côté serveur.
      console.error("submit_mandate_funnel a échoué", { code: error.code });
      return { ok: false, reason: "error", message: analysis.errors.generic };
    }

    // La réponse est un accusé neutre ; on ne s'appuie sur aucune donnée renvoyée.
    const result = data as unknown as SubmitMandateFunnelResult | null;
    if (result && result.accepted === true) {
      return { ok: true, appreciation };
    }
    return { ok: false, reason: "error", message: analysis.errors.generic };
  } catch (cause) {
    console.error("submit_mandate_funnel exception", {
      name: cause instanceof Error ? cause.name : "unknown",
    });
    return { ok: false, reason: "error", message: analysis.errors.generic };
  }
}
