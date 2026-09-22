import { z } from "zod";
import {
  normalizeEmail,
  normalizePhone,
  normalizeText,
} from "@/modules/mandates/funnel/normalize";
import { BUYER_FUNNEL_KEY } from "./schema";
import {
  UNIVERSAL_CONSENT_NOTICE_VERSION,
  UNIVERSAL_FUNNEL_VERSION,
  universalBuyerAnswersSchema,
} from "./universal";

/**
 * Payload du formulaire **universel** vers `submit_buyer_interest`. Pur et
 * testable : aucune I/O.
 *
 * Deux principes repris du funnel V1 : la valeur BRUTE (preuve) est toujours
 * séparée de la valeur NORMALISÉE (dédoublonnage), et l'attribution complète
 * accompagne la soumission.
 *
 * Un principe propre à ce formulaire : la réponse de budget part dans
 * `budget_choice`, **jamais** dans `budget_band`. Aucune conversion — le champ
 * historique reste vide, et c'est voulu.
 */

const attributionTouchSchema = z
  .object({
    utm_source: z.string().nullable(),
    utm_medium: z.string().nullable(),
    utm_campaign: z.string().nullable(),
    utm_term: z.string().nullable(),
    utm_content: z.string().nullable(),
    fbclid: z.string().nullable(),
    gclid: z.string().nullable(),
    url: z.string().nullable(),
    referrer: z.string().nullable(),
    at: z.string(),
  })
  .nullable();

const clientContextSchema = z.object({
  idempotencyKey: z.string().min(8).max(200),
  originUrl: z.string().max(2000).nullable().default(null),
  referrer: z.string().max(2000).nullable().default(null),
  userAgent: z.string().max(600).nullable().default(null),
  firstTouch: attributionTouchSchema.default(null),
  lastTouch: attributionTouchSchema.default(null),
  submittedAt: z.string().default(""),
});

export const universalSubmissionRequestSchema = z.object({
  slug: z.string().trim().min(1).max(120),
  answers: universalBuyerAnswersSchema,
  context: clientContextSchema,
});

export type UniversalSubmissionRequest = z.infer<typeof universalSubmissionRequestSchema>;

export const universalSubmitActionInputSchema = universalSubmissionRequestSchema.extend({
  turnstileToken: z.string().min(1).max(4096).nullable().default(null),
});

/**
 * Résultat renvoyé au navigateur. Neutre sur le fond (jamais de score, jamais
 * de « refusé »), mais porteur de la **brochure** : c'est la contrepartie
 * promise à la personne, remise immédiatement après un dépôt valide.
 */
export type UniversalSubmitResult =
  | { ok: true; brochureUrl?: string | null }
  | {
      ok: false;
      reason: "unavailable" | "validation" | "error" | "turnstile";
      message: string;
      resetChallenge?: boolean;
    };

type Json = Record<string, unknown>;

/** Texte d'information affiché sous les champs — conservé comme preuve. */
export const UNIVERSAL_PRIVACY_NOTICE =
  "Vos coordonnées sont utilisées pour répondre à votre demande et vous transmettre " +
  "la brochure de ce bien. Elles sont conservées par Prodigio et l'agence porteuse " +
  "du bien, ne sont pas cédées à des tiers, et vous pouvez demander leur " +
  "rectification ou leur effacement à tout moment.";

export function buildUniversalPayload(request: UniversalSubmissionRequest): Json {
  const { answers, context, slug } = request;

  const emailNormalized = normalizeEmail(answers.emailRaw);
  const phoneNormalized = normalizePhone(answers.phoneRaw, answers.phoneCountry);

  const rawAnswers = {
    budget_choice: answers.budgetChoice,
    contact: {
      first_name: answers.firstName,
      last_name: answers.lastName,
      email: answers.emailRaw,
      phone: answers.phoneRaw,
      phone_country: answers.phoneCountry,
    },
    marketing_opt_in: answers.marketingOptIn === true,
  };

  const normalizedAnswers = {
    budget_choice: answers.budgetChoice,
    contact: {
      first_name: normalizeText(answers.firstName, 80),
      last_name: normalizeText(answers.lastName, 80),
      email: emailNormalized,
      phone: phoneNormalized,
      phone_country: answers.phoneCountry,
    },
    marketing_opt_in: answers.marketingOptIn === true,
  };

  const last = context.lastTouch;

  return {
    slug,
    funnel_key: BUYER_FUNNEL_KEY,
    funnel_version: UNIVERSAL_FUNNEL_VERSION,
    idempotency_key: context.idempotencyKey,

    raw_answers: rawAnswers,
    normalized_answers: normalizedAnswers,

    // Vocabulaire du formulaire universel UNIQUEMENT. `budget_band` reste
    // absent : le rapprocher d'une ancienne tranche transformerait la réponse.
    budget_choice: answers.budgetChoice,

    contact_first_name: normalizeText(answers.firstName, 80),
    contact_last_name: normalizeText(answers.lastName, 80),
    contact_email: emailNormalized,
    contact_email_raw: answers.emailRaw,
    contact_phone: phoneNormalized,
    contact_phone_raw: answers.phoneRaw,

    // La demande elle-même vaut accord pour y répondre ; elle ne vaut PAS accord
    // marketing. Les deux sont consignés séparément, et un refus marketing
    // n'empêche jamais la remise de la brochure.
    consent_given: true,
    consent_notice_version: UNIVERSAL_CONSENT_NOTICE_VERSION,
    consent_notice_text: UNIVERSAL_PRIVACY_NOTICE,

    utm_source: last?.utm_source ?? null,
    utm_medium: last?.utm_medium ?? null,
    utm_campaign: last?.utm_campaign ?? null,
    utm_term: last?.utm_term ?? null,
    utm_content: last?.utm_content ?? null,
    fbclid: last?.fbclid ?? null,
    gclid: last?.gclid ?? null,
    origin_url: context.originUrl,
    referrer: context.referrer,
    first_touch: context.firstTouch,
    last_touch: context.lastTouch,
    user_agent: context.userAgent,

    consent_proof: {
      purpose: "reponse_demande_et_brochure",
      given: true,
      marketing_opt_in: answers.marketingOptIn === true,
      notice_version: UNIVERSAL_CONSENT_NOTICE_VERSION,
      at: last?.at ?? context.submittedAt,
    },
  };
}
