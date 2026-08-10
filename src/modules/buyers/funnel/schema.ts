import { z } from "zod";
import { DEFAULT_PHONE_COUNTRY } from "@/modules/mandates/funnel/normalize";

/**
 * Schémas et constantes du **funnel Acquéreur** — source de vérité côté client
 * ET serveur. Les tokens miroir les CHECK SQL de `submit_buyer_interest`. Aucune
 * question inutilement intrusive : uniquement ce qui sert la qualification.
 */

export const BUYER_FUNNEL_KEY = "buyer_interest" as const;
export const BUYER_FUNNEL_VERSION = "v1" as const;
export const BUYER_CONSENT_NOTICE_VERSION = "buyer-v1-2026-08" as const;

// --- Tokens (miroir SQL) -----------------------------------------------------
export const PROJECT_NATURES = [
  "residence_principale",
  "residence_secondaire",
  "investissement",
  "autre",
] as const;
export type ProjectNature = (typeof PROJECT_NATURES)[number];

export const BUDGET_BANDS = [
  "moins_800k",
  "800k_1_2m",
  "1_2m_2m",
  "2m_3m",
  "plus_3m",
  "a_definir",
] as const;
export type BudgetBand = (typeof BUDGET_BANDS)[number];

export const FINANCINGS = [
  "fonds_propres",
  "accord_bancaire",
  "financement_a_organiser",
] as const;
export type Financing = (typeof FINANCINGS)[number];

export const PURCHASE_HORIZONS = [
  "immediat",
  "trois_mois",
  "six_mois",
  "en_reflexion",
] as const;
export type PurchaseHorizon = (typeof PURCHASE_HORIZONS)[number];

export const DECISION_MODES = ["seul", "avec_autres"] as const;
export type DecisionMode = (typeof DECISION_MODES)[number];

export const AVAILABILITIES = [
  "disponible_visite",
  "disponible_echange",
  "a_convenir",
] as const;
export type Availability = (typeof AVAILABILITIES)[number];

export const CONTACT_PREFERENCES = ["telephone", "email", "indifferent"] as const;
export type ContactPreference = (typeof CONTACT_PREFERENCES)[number];

export const RECALL_PREFERENCES = [
  "des_que_possible",
  "matin",
  "apres_midi",
  "debut_soiree",
] as const;
export type RecallPreference = (typeof RECALL_PREFERENCES)[number];

// --- Schémas Zod -------------------------------------------------------------
export const projectNatureSchema = z.enum(PROJECT_NATURES);
export const budgetBandSchema = z.enum(BUDGET_BANDS);
export const financingSchema = z.enum(FINANCINGS);
export const purchaseHorizonSchema = z.enum(PURCHASE_HORIZONS);
export const decisionModeSchema = z.enum(DECISION_MODES);
export const availabilitySchema = z.enum(AVAILABILITIES);

export const residenceSchema = z.object({
  country: z.string().trim().min(2, "Indiquez votre pays de résidence.").max(120),
  area: z.string().trim().max(160).optional().default(""),
});

export const buyerContactSchema = z.object({
  firstName: z.string().trim().min(1, "Prénom requis.").max(80),
  lastName: z.string().trim().min(1, "Nom requis.").max(80),
  phoneRaw: z.string().trim().min(1, "Téléphone requis.").max(40),
  phoneCountry: z
    .string()
    .trim()
    .length(2)
    .toUpperCase()
    .default(DEFAULT_PHONE_COUNTRY),
  emailRaw: z.string().trim().min(1, "E-mail requis.").max(180),
  preference: z.enum(CONTACT_PREFERENCES).optional(),
  recallPreference: z.enum(RECALL_PREFERENCES),
  consent: z.literal(true, {
    message: "Votre accord est nécessaire pour être recontacté.",
  }),
});

export type BuyerContact = z.infer<typeof buyerContactSchema>;

export const buyerAnswersSchema = z.object({
  projectNature: projectNatureSchema,
  budgetBand: budgetBandSchema,
  financing: financingSchema,
  purchaseHorizon: purchaseHorizonSchema,
  decisionMode: decisionModeSchema,
  availability: availabilitySchema,
  residence: residenceSchema,
  contact: buyerContactSchema,
  // Honeypot : doit rester vide (défense faible ; Turnstile reste la vraie garde).
  company: z.string().max(0).optional().default(""),
});

export type BuyerAnswers = z.infer<typeof buyerAnswersSchema>;
