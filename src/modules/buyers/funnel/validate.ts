import { buyerAnswersSchema, type BuyerAnswers } from "./schema";
import { isValidPhone, normalizeEmail } from "@/modules/mandates/funnel/normalize";

/**
 * Validation tolérante au honeypot du funnel Acquéreur (miroir de la logique du
 * funnel Mandats). Renvoie des erreurs par champ (chemins pointés, ex.
 * `contact.phoneRaw`) exploitables directement par la machine du parcours.
 */

export const HONEYPOT_FIELD = "company";

export type BuyerValidationResult =
  | { ok: true; data: BuyerAnswers; honeypotNeutralized: boolean }
  | { ok: false; fieldErrors: Record<string, string> };

function collect(
  issues: readonly { readonly path: readonly PropertyKey[]; readonly message: string }[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".");
    if (key && !(key in out)) out[key] = issue.message;
  }
  return out;
}

export function validateBuyerAnswers(input: unknown): BuyerValidationResult {
  const first = buyerAnswersSchema.safeParse(input);
  let honeypotNeutralized = false;
  let parsed = first;

  // Tolérance à l'autofill du honeypot : si la SEULE erreur est `company`, on la
  // neutralise et on revalide (le honeypot rempli est traité en amont côté serveur).
  if (!first.success) {
    const paths = first.error.issues.map((i) => i.path.join("."));
    const onlyHoneypot = paths.length > 0 && paths.every((p) => p === HONEYPOT_FIELD);
    if (onlyHoneypot && input && typeof input === "object") {
      parsed = buyerAnswersSchema.safeParse({ ...(input as object), [HONEYPOT_FIELD]: "" });
      honeypotNeutralized = true;
    }
  }

  if (!parsed.success) {
    return { ok: false, fieldErrors: collect(parsed.error.issues) };
  }

  // Validations fines cohérentes avec la normalisation serveur (téléphone/e-mail).
  const errors: Record<string, string> = {};
  const c = parsed.data.contact;
  if (!isValidPhone(c.phoneRaw, c.phoneCountry)) {
    errors["contact.phoneRaw"] = "Numéro de téléphone invalide.";
  }
  if (normalizeEmail(c.emailRaw) === null) {
    errors["contact.emailRaw"] = "Adresse e-mail invalide.";
  }
  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };

  return { ok: true, data: parsed.data, honeypotNeutralized };
}
