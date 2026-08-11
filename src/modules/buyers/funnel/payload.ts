import { z } from "zod";
import {
  normalizeEmail,
  normalizePhone,
  normalizeText,
} from "@/modules/mandates/funnel/normalize";
import { buyerConsent } from "./content";
import {
  BUYER_CONSENT_NOTICE_VERSION,
  BUYER_FUNNEL_KEY,
  BUYER_FUNNEL_VERSION,
  buyerAnswersSchema,
} from "./schema";

/**
 * Construction du payload envoyé à la fonction SQL `submit_buyer_interest`. Pur
 * et testable : aucune I/O. Sépare toujours la valeur BRUTE (preuve) de la valeur
 * NORMALISÉE (dédoublonnage). Le `slug` du bien accompagne la soumission (le bien
 * n'est résolu QUE s'il est publié — contrôle côté base).
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
  variant: z.string().max(60).nullable().default(null),
  submittedAt: z.string().default(""),
});

/** Requête de soumission acquéreur (bien ciblé + réponses + contexte). */
export const buyerSubmissionRequestSchema = z.object({
  slug: z.string().trim().min(1).max(120),
  answers: buyerAnswersSchema,
  context: clientContextSchema,
});

export type BuyerSubmissionRequest = z.infer<typeof buyerSubmissionRequestSchema>;

/** Entrée de l'action serveur : la requête + le jeton Turnstile (vit à part). */
export const buyerSubmitActionInputSchema = buyerSubmissionRequestSchema.extend({
  turnstileToken: z.string().min(1).max(4096).nullable().default(null),
});

export type BuyerSubmitActionInput = z.infer<typeof buyerSubmitActionInputSchema>;

/**
 * Résultat renvoyé au navigateur. Volontairement minimal et NEUTRE : jamais de
 * score, jamais de « refusé », jamais d'état interne.
 */
export type BuyerSubmitResult =
  | { ok: true }
  | {
      ok: false;
      reason: "unavailable" | "validation" | "error" | "turnstile";
      message: string;
      resetChallenge?: boolean;
    };

type Json = Record<string, unknown>;

/** Traduit une requête validée en payload jsonb pour `submit_buyer_interest`. */
export function buildBuyerPayload(request: BuyerSubmissionRequest): Json {
  const { answers, context, slug } = request;
  const contact = answers.contact;

  const emailNormalized = normalizeEmail(contact.emailRaw);
  const phoneNormalized = normalizePhone(contact.phoneRaw, contact.phoneCountry);
  const country = normalizeText(answers.residence.country, 120);
  const area = normalizeText(answers.residence.area ?? "", 160);

  const rawAnswers = {
    project_nature: answers.projectNature,
    budget_band: answers.budgetBand,
    financing: answers.financing,
    purchase_horizon: answers.purchaseHorizon,
    decision_mode: answers.decisionMode,
    availability: answers.availability,
    residence: {
      country: answers.residence.country,
      area: answers.residence.area ?? "",
    },
    contact: {
      first_name: contact.firstName,
      last_name: contact.lastName,
      phone: contact.phoneRaw,
      phone_country: contact.phoneCountry,
      email: contact.emailRaw,
      preference: contact.preference ?? null,
      recall_preference: contact.recallPreference,
    },
  };

  const normalizedAnswers = {
    project_nature: answers.projectNature,
    budget_band: answers.budgetBand,
    financing: answers.financing,
    purchase_horizon: answers.purchaseHorizon,
    decision_mode: answers.decisionMode,
    availability: answers.availability,
    residence: { country, area },
    contact: {
      first_name: normalizeText(contact.firstName, 80),
      last_name: normalizeText(contact.lastName, 80),
      phone: phoneNormalized,
      phone_country: contact.phoneCountry,
      email: emailNormalized,
      preference: contact.preference ?? null,
      recall_preference: contact.recallPreference,
    },
  };

  const last = context.lastTouch;

  return {
    slug,
    funnel_key: BUYER_FUNNEL_KEY,
    funnel_version: BUYER_FUNNEL_VERSION,
    variant: context.variant,
    idempotency_key: context.idempotencyKey,

    raw_answers: rawAnswers,
    normalized_answers: normalizedAnswers,

    project_nature: answers.projectNature,
    budget_band: answers.budgetBand,
    financing: answers.financing,
    purchase_horizon: answers.purchaseHorizon,
    decision_mode: answers.decisionMode,
    availability: answers.availability,
    residence_country: country,
    residence_area: area,

    contact_first_name: normalizeText(contact.firstName, 80),
    contact_last_name: normalizeText(contact.lastName, 80),
    contact_email: emailNormalized,
    contact_email_raw: contact.emailRaw,
    contact_phone: phoneNormalized,
    contact_phone_raw: contact.phoneRaw,
    contact_preference: contact.preference ?? null,
    contact_recall_preference: contact.recallPreference,

    consent_given: contact.consent === true,
    consent_notice_version: BUYER_CONSENT_NOTICE_VERSION,
    consent_notice_text: buyerConsent.label,

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
      given: contact.consent === true,
      notice_version: BUYER_CONSENT_NOTICE_VERSION,
      at: last?.at ?? context.submittedAt,
      preference: contact.preference ?? null,
    },
  };
}
