import { z } from "zod";
import {
  normalizeEmail,
  normalizePhone,
  normalizePostalCode,
  normalizeText,
} from "./normalize";
import { consent } from "./content";
import type { AppreciationKey } from "../scoring";
import {
  CONSENT_NOTICE_VERSION,
  FUNNEL_KEY,
  FUNNEL_LANDING,
  FUNNEL_VERSION,
  funnelAnswersSchema,
} from "./schema";

/**
 * Construction du payload envoyé à la fonction SQL `submit_mandate_funnel`.
 * Pur et testable : aucune I/O. Sépare toujours la valeur BRUTE (preuve) de la
 * valeur NORMALISÉE (dédoublonnage).
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

/** Contexte technique capté côté client (URL, referrer, user agent). */
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

/** Schéma complet de la requête de soumission (réponses + contexte). */
export const submissionRequestSchema = z.object({
  answers: funnelAnswersSchema,
  context: clientContextSchema,
});

export type SubmissionRequest = z.infer<typeof submissionRequestSchema>;

/**
 * Entrée de l'action serveur : la requête de soumission **plus** le jeton
 * Cloudflare Turnstile. Le jeton est le **seul** élément transmis par le
 * navigateur pour l'anti-abus ; il vit à part (jamais dans `context`, donc
 * jamais dans le payload persistant). Il peut être `null` si le widget n'a pas
 * encore produit de jeton — la vérification renverra alors « jeton absent ».
 */
export const submitActionInputSchema = submissionRequestSchema.extend({
  turnstileToken: z.string().min(1).max(4096).nullable().default(null),
});

export type SubmitActionInput = z.infer<typeof submitActionInputSchema>;

/**
 * Résultat renvoyé par l'action serveur de dépôt de demande. Volontairement
 * minimal : un booléen d'acceptation, jamais de donnée ni d'état interne.
 */
export type SubmitResult =
  | {
      ok: true;
      // Appréciation qualitative publique (calculée côté serveur). Jamais de
      // score numérique interne. Absente pour un dépôt honeypot silencieux.
      appreciation: AppreciationKey | null;
    }
  | {
      ok: false;
      reason: "unavailable" | "validation" | "error" | "turnstile";
      message: string;
      // Signale au client de réinitialiser le widget anti-abus pour réessayer
      // (jeton refusé, expiré, déjà utilisé, ou vérification indisponible).
      resetChallenge?: boolean;
    };

type Json = Record<string, unknown>;

/**
 * Traduit une requête validée en payload jsonb pour la fonction SQL. Conserve
 * les réponses brutes ET normalisées ; ne journalise aucune donnée personnelle.
 */
export function buildSubmissionPayload(request: SubmissionRequest): Json {
  const { answers, context } = request;
  const contact = answers.contact;

  const emailNormalized = normalizeEmail(contact.emailRaw);
  // E.164 calculé selon le pays sélectionné (ex. « 06 25 77 35 92 » + FR).
  const phoneNormalized = normalizePhone(contact.phoneRaw, contact.phoneCountry);
  const city = normalizeText(answers.location.city, 120);
  const postalCode = normalizePostalCode(answers.location.postalCode);
  const country = normalizeText(answers.location.country ?? "France", 80);

  const rawAnswers = {
    property_type: answers.propertyType,
    location: {
      city: answers.location.city,
      postal_code: answers.location.postalCode,
      country: answers.location.country ?? "France",
    },
    value_band: answers.valueBand,
    sale_horizon: answers.saleHorizon,
    mandate_situation: answers.mandateSituation,
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
    property_type: answers.propertyType,
    location: { city, postal_code: postalCode, country },
    value_band: answers.valueBand,
    sale_horizon: answers.saleHorizon,
    mandate_situation: answers.mandateSituation,
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
    funnel_key: FUNNEL_KEY,
    funnel_version: FUNNEL_VERSION,
    landing: FUNNEL_LANDING,
    variant: context.variant,
    idempotency_key: context.idempotencyKey,

    raw_answers: rawAnswers,
    normalized_answers: normalizedAnswers,

    property_type: answers.propertyType,
    location_city: city,
    location_postal_code: postalCode,
    location_country: country,
    estimated_value_band: answers.valueBand,
    sale_horizon: answers.saleHorizon,
    mandate_situation: answers.mandateSituation,

    contact_first_name: normalizeText(contact.firstName, 80),
    contact_last_name: normalizeText(contact.lastName, 80),
    contact_email: emailNormalized,
    contact_email_raw: contact.emailRaw,
    contact_phone: phoneNormalized,
    contact_phone_raw: contact.phoneRaw,
    contact_preference: contact.preference ?? null,
    contact_recall_preference: contact.recallPreference,

    consent_given: contact.consent === true,
    consent_notice_version: CONSENT_NOTICE_VERSION,
    consent_notice_text: consent.label,

    // Attribution (premier / dernier contact).
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

    // RGPD : la finalité, les canaux autorisés, les responsables et les
    // destinataires sont fixés CÔTÉ SQL (non issus du client). On ne transmet
    // que la preuve du geste de consentement et la version de notice.
    consent_proof: {
      given: contact.consent === true,
      notice_version: CONSENT_NOTICE_VERSION,
      at: last?.at ?? context.submittedAt,
      preference: contact.preference ?? null,
    },
  };
}
