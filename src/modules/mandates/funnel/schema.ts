import { z } from "zod";
import { DEFAULT_PHONE_COUNTRY, isValidPhone, normalizeEmail } from "./normalize";

/**
 * Schémas de validation et de normalisation du funnel Mandats.
 *
 * Source de vérité des **valeurs normalisées** (tokens) : elles doivent rester
 * alignées sur les contraintes CHECK de la migration SQL
 * `20260729120000_mandate_funnel_capture.sql`. Les libellés affichés vivent dans
 * `content.ts` ; ici, uniquement les valeurs et les règles.
 */

// --- Version du funnel (conservée avec chaque soumission) --------------------
export const FUNNEL_KEY = "mandate_owner" as const;
export const FUNNEL_VERSION = "v1" as const;
export const FUNNEL_LANDING = "/proprietaire" as const;
export const CONSENT_NOTICE_VERSION = "v1-2026-07" as const;

// --- Valeurs normalisées (tokens) — miroir des CHECK SQL ---------------------
export const PROPERTY_TYPES = [
  "villa_architecte",
  "appartement_exception",
  "chalet",
  "domaine_caractere",
  "autre",
] as const;

export const VALUE_BANDS = [
  "moins_500k",
  "500k_800k",
  "800k_1_2m",
  "1_2m_2m",
  "plus_2m",
  "accompagnement_estimation",
] as const;

export const SALE_HORIZONS = [
  "des_que_possible",
  "trois_mois",
  "six_mois",
  "en_reflexion",
] as const;

export const MANDATE_SITUATIONS = [
  "aucun_mandat",
  "mandat_simple",
  "mandat_exclusif",
  "autre",
] as const;

export const CONTACT_PREFERENCES = ["telephone", "email", "indifferent"] as const;

// Préférence de créneau de rappel (logistique du futur entretien d'éligibilité).
// N'ENTRE PAS dans le scoring : simple confort de mise en relation.
export const RECALL_PREFERENCES = [
  "des_que_possible",
  "matin",
  "apres_midi",
  "debut_soiree",
] as const;

export type PropertyType = (typeof PROPERTY_TYPES)[number];
export type ValueBand = (typeof VALUE_BANDS)[number];
export type SaleHorizon = (typeof SALE_HORIZONS)[number];
export type MandateSituation = (typeof MANDATE_SITUATIONS)[number];
export type ContactPreference = (typeof CONTACT_PREFERENCES)[number];
export type RecallPreference = (typeof RECALL_PREFERENCES)[number];

// --- Schémas par étape -------------------------------------------------------

export const propertyTypeSchema = z.enum(PROPERTY_TYPES);

export const locationSchema = z.object({
  city: z
    .string()
    .trim()
    .min(2, "Merci d'indiquer la ville.")
    .max(120),
  postalCode: z
    .string()
    .trim()
    .min(2, "Merci d'indiquer le code postal.")
    .max(16),
  country: z.string().trim().max(80).optional().default("France"),
});

export const valueBandSchema = z.enum(VALUE_BANDS);
export const saleHorizonSchema = z.enum(SALE_HORIZONS);
export const mandateSituationSchema = z.enum(MANDATE_SITUATIONS);

/**
 * Étape coordonnées.
 *
 * La **validité** du téléphone (selon le pays choisi) et de l'e-mail est
 * contrôlée **ici même** (superRefine) — et donc **dès l'étape 6** — afin
 * d'afficher une **erreur précise sous chaque champ** plutôt qu'un message
 * générique à la soumission finale. `phoneRaw` conserve la saisie originale
 * (preuve / RGPD) ; la valeur E.164 est calculée à part (voir `payload.ts`).
 */
export const contactSchema = z
  .object({
    firstName: z.string().trim().min(1, "Merci d'indiquer votre prénom.").max(80),
    lastName: z.string().trim().min(1, "Merci d'indiquer votre nom.").max(80),
    phoneRaw: z
      .string()
      .trim()
      .min(1, "Merci d'indiquer un numéro de téléphone.")
      .max(40),
    // Pays sélectionné dans le champ téléphone (ISO 3166-1 alpha-2). Défaut FR ;
    // un code inconnu retombe sur FR côté normalisation.
    phoneCountry: z
      .string()
      .trim()
      .min(2)
      .max(2)
      .transform((c) => c.toUpperCase())
      .default(DEFAULT_PHONE_COUNTRY),
    emailRaw: z
      .string()
      .trim()
      .min(1, "Merci d'indiquer un e-mail.")
      .max(180),
    preference: z.enum(CONTACT_PREFERENCES).optional(),
    recallPreference: z.enum(RECALL_PREFERENCES, {
      message: "Merci d'indiquer un moment de rappel.",
    }),
    consent: z.literal(true, {
      message: "Votre accord est nécessaire pour que nous puissions vous recontacter.",
    }),
  })
  .superRefine((data, ctx) => {
    if (!isValidPhone(data.phoneRaw, data.phoneCountry)) {
      ctx.addIssue({
        code: "custom",
        path: ["phoneRaw"],
        message:
          "Ce numéro ne semble pas valide. Vérifiez le pays et le numéro saisi.",
      });
    }
    if (!normalizeEmail(data.emailRaw)) {
      ctx.addIssue({
        code: "custom",
        path: ["emailRaw"],
        message: "Cet e-mail ne semble pas valide.",
      });
    }
  });

/**
 * Réponses complètes de l'analyse. Le honeypot (`company`) doit rester vide :
 * une valeur non vide signale un robot. Il n'est jamais montré à l'utilisateur.
 * La validité téléphone/e-mail est portée par `contactSchema` (ci-dessus).
 */
export const funnelAnswersSchema = z.object({
  propertyType: propertyTypeSchema,
  location: locationSchema,
  valueBand: valueBandSchema,
  saleHorizon: saleHorizonSchema,
  mandateSituation: mandateSituationSchema,
  contact: contactSchema,
  // Anti-spam : champ leurre, doit être vide.
  company: z.string().max(0, "Champ invalide.").optional().default(""),
});

export type FunnelAnswers = z.infer<typeof funnelAnswersSchema>;

/** Schéma d'une étape à choix unique (cartes / options). */
export const singleChoiceStepKeys = [
  "propertyType",
  "valueBand",
  "saleHorizon",
  "mandateSituation",
] as const;
export type SingleChoiceStepKey = (typeof singleChoiceStepKeys)[number];
