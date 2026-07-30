/**
 * Validation des réponses du funnel côté client, robuste au **honeypot rempli
 * par autofill**.
 *
 * Contexte : le champ leurre `company` (honeypot anti-robot) est masqué aux
 * humains, mais certains navigateurs et gestionnaires de mots de passe le
 * **remplissent automatiquement**. Comme `funnelAnswersSchema` impose
 * `company` vide, un honeypot rempli **bloquait toute la soumission** (l'action
 * serveur n'était jamais appelée) — et de façon silencieuse, l'erreur portant
 * sur un champ sans input visible.
 *
 * Règle retenue : un **humain ne doit jamais être bloqué par le honeypot**.
 * Si la SEULE erreur de validation porte sur `company`, on considère qu'il
 * s'agit d'un remplissage automatique involontaire : on **neutralise** le
 * champ (valeur vide) et on laisse la soumission se poursuivre. La vraie garde
 * anti-abus reste **Cloudflare Turnstile** (vérifié côté serveur), et un robot
 * qui posterait directement `company` non vide serait de toute façon rejeté par
 * la validation serveur. Les robots opérant via l'UI React sont négligeables.
 */

import { funnelAnswersSchema, type FunnelAnswers } from "./schema";

export type FunnelValidationResult =
  | { ok: true; data: FunnelAnswers; honeypotNeutralized: boolean }
  | { ok: false; fieldErrors: Record<string, string> };

/** Nom du champ honeypot (leurre). Doit rester vide pour un humain. */
export const HONEYPOT_FIELD = "company";

/**
 * Valide les réponses du funnel. Si l'unique échec est le honeypot (`company`)
 * rempli par autofill, il est neutralisé et la validation réessaie ; sinon les
 * erreurs sont renvoyées par champ (chemin Zod « contact.phoneRaw », etc.).
 */
export function validateFunnelAnswers(input: unknown): FunnelValidationResult {
  const first = funnelAnswersSchema.safeParse(input);
  if (first.success) return { ok: true, data: first.data, honeypotNeutralized: false };

  const keys = first.error.issues.map((issue) => issue.path.join("."));
  const onlyHoneypot = keys.length > 0 && keys.every((key) => key === HONEYPOT_FIELD);

  if (onlyHoneypot && input !== null && typeof input === "object") {
    const retry = funnelAnswersSchema.safeParse({
      ...(input as Record<string, unknown>),
      [HONEYPOT_FIELD]: "",
    });
    if (retry.success) return { ok: true, data: retry.data, honeypotNeutralized: true };
  }

  const fieldErrors: Record<string, string> = {};
  for (const issue of first.error.issues) {
    const key = issue.path.join(".");
    if (key && !(key in fieldErrors)) fieldErrors[key] = issue.message;
  }
  return { ok: false, fieldErrors };
}
