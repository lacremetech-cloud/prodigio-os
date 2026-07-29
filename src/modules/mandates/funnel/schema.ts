import { z } from "zod";
import { normalizeEmail, normalizePhone } from "./normalize";

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
 * Étape coordonnées. Le téléphone et l'e-mail sont normalisés à la volée ;
 * `transform` renvoie à la fois la valeur brute et normalisée pour conserver la
 * saisie originale (RGPD / preuve) tout en dédoublonnant sur la valeur propre.
 */
export const contactSchema = z.object({
  firstName: z.string().trim().min(1, "Merci d'indiquer votre prénom.").max(80),
  lastName: z.string().trim().min(1, "Merci d'indiquer votre nom.").max(80),
  phoneRaw: z
    .string()
    .trim()
    .min(1, "Merci d'indiquer un numéro de téléphone.")
    .max(40),
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
});

/**
 * Réponses complètes de l'analyse. Le honeypot (`company`) doit rester vide :
 * une valeur non vide signale un robot. Il n'est jamais montré à l'utilisateur.
 */
export const funnelAnswersSchema = z
  .object({
    propertyType: propertyTypeSchema,
    location: locationSchema,
    valueBand: valueBandSchema,
    saleHorizon: saleHorizonSchema,
    mandateSituation: mandateSituationSchema,
    contact: contactSchema,
    // Anti-spam : champ leurre, doit être vide.
    company: z.string().max(0, "Champ invalide.").optional().default(""),
  })
  .superRefine((data, ctx) => {
    const phone = normalizePhone(data.contact.phoneRaw);
    if (!phone) {
      ctx.addIssue({
        code: "custom",
        path: ["contact", "phoneRaw"],
        message: "Ce numéro de téléphone ne semble pas valide.",
      });
    }
    const email = normalizeEmail(data.contact.emailRaw);
    if (!email) {
      ctx.addIssue({
        code: "custom",
        path: ["contact", "emailRaw"],
        message: "Cet e-mail ne semble pas valide.",
      });
    }
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
