import { z } from "zod";
import { DEFAULT_PHONE_COUNTRY } from "@/modules/mandates/funnel/normalize";

/**
 * Formulaire acquéreur **universel** — deux écrans, valable pour n'importe quel
 * bien, embarquable sur une annonce hébergée ailleurs.
 *
 * Son vocabulaire de budget est **distinct** de `BUDGET_BANDS` (funnel V1) et le
 * reste : trois des cinq réponses sont à cheval sur les anciennes tranches, et
 * « aucun projet » n'est pas « à définir ». Aucune conversion n'est faite dans
 * un sens ni dans l'autre — les deux vocabulaires coexistent, chacun fidèle au
 * formulaire qui l'a produit. Miroir des CHECK de
 * `20260922090000_buyer_universal_form_v1.sql`.
 */

export const UNIVERSAL_FUNNEL_VERSION = "universal-v1" as const;
export const UNIVERSAL_CONSENT_NOTICE_VERSION = "buyer-universal-v1-2026-09" as const;

// --- Budget (miroir SQL) -----------------------------------------------------
export const BUYER_BUDGET_CHOICES = [
  "aucun_projet",
  "500k_1m",
  "1m_2m",
  "2m_3m",
  "plus_3m",
] as const;
export type BuyerBudgetChoice = (typeof BUYER_BUDGET_CHOICES)[number];

export const BUDGET_CHOICE_LABELS: Record<BuyerBudgetChoice, string> = {
  aucun_projet: "Je n'ai pas de projet d'achat",
  "500k_1m": "500 000 € à 1 M€",
  "1m_2m": "1 M€ à 2 M€",
  "2m_3m": "2 M€ à 3 M€",
  plus_3m: "Plus de 3 M€",
};

/**
 * Bornes indicatives en centimes. `aucun_projet` n'en a **pas** : ce n'est pas
 * un budget inconnu, c'est l'absence de projet. Miroir de
 * `public.buyer_choice_bounds(text)`.
 */
export function budgetChoiceBounds(
  choice: BuyerBudgetChoice,
): { min: number | null; max: number | null } {
  switch (choice) {
    case "500k_1m":
      return { min: 50_000_000, max: 100_000_000 };
    case "1m_2m":
      return { min: 100_000_000, max: 200_000_000 };
    case "2m_3m":
      return { min: 200_000_000, max: 300_000_000 };
    case "plus_3m":
      return { min: 300_000_000, max: null };
    case "aucun_projet":
      return { min: null, max: null };
  }
}

// --- Schémas -----------------------------------------------------------------
export const budgetChoiceSchema = z.enum(BUYER_BUDGET_CHOICES, {
  message: "Indiquez votre budget.",
});

/** Écran 1 — le projet. Une seule question, celle qui qualifie. */
export const universalStepOneSchema = z.object({
  budgetChoice: budgetChoiceSchema,
});

/** Écran 2 — la prise de contact. */
export const universalStepTwoSchema = z.object({
  firstName: z.string().trim().min(1, "Prénom requis.").max(80),
  lastName: z.string().trim().min(1, "Nom requis.").max(80),
  emailRaw: z.string().trim().min(1, "E-mail requis.").max(180),
  phoneRaw: z.string().trim().min(1, "Téléphone requis.").max(40),
  phoneCountry: z.string().trim().length(2).toUpperCase().default(DEFAULT_PHONE_COUNTRY),
  consent: z.literal(true, {
    message: "Votre accord est nécessaire pour être recontacté.",
  }),
});

export const universalBuyerAnswersSchema = universalStepOneSchema
  .extend(universalStepTwoSchema.shape)
  .extend({
    // Honeypot : doit rester vide. Défense faible ; Turnstile reste la garde.
    company: z.string().max(0).optional().default(""),
  });

export type UniversalBuyerAnswers = z.infer<typeof universalBuyerAnswersSchema>;

/** Les deux écrans, dans l'ordre. Il n'y en a jamais un troisième. */
export const UNIVERSAL_STEPS = [
  { id: "projet", title: "Votre projet" },
  { id: "contact", title: "Vous recontacter" },
] as const;

export type UniversalStepId = (typeof UNIVERSAL_STEPS)[number]["id"];
