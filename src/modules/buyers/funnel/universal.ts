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

/** Question de l'écran 1, au mot près. Elle porte le « si oui » : le budget
 *  n'est pas demandé seul, il est la suite d'une question sur l'existence même
 *  d'un projet. « Non, je n'ai pas de projet » est une réponse pleine. */
export const BUDGET_QUESTION = "Avez-vous un projet ? Si oui, quel est votre budget ?";

export const BUDGET_CHOICE_LABELS: Record<BuyerBudgetChoice, string> = {
  aucun_projet: "Non, je n'ai pas de projet",
  "500k_1m": "Oui, entre 500 000 € et 1 million d'euros",
  "1m_2m": "Oui, entre 1 et 2 millions d'euros",
  "2m_3m": "Oui, entre 2 et 3 millions d'euros",
  plus_3m: "Plus de 3 millions d'euros",
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

/**
 * Écran 2 — la prise de contact. **Quatre champs obligatoires, pas un de plus.**
 *
 * Aucune case marketing obligatoire, et aucun consentement marketing implicite :
 * la demande de brochure doit aboutir même si la personne refuse toute
 * utilisation marketing ultérieure. L'accord marketing est donc **facultatif**,
 * décoché par défaut, et ne conditionne jamais l'envoi. Le traitement de la
 * demande elle-même repose sur la demande de la personne, pas sur cette case.
 */
export const universalStepTwoSchema = z.object({
  firstName: z.string().trim().min(1, "Prénom requis.").max(80),
  lastName: z.string().trim().min(1, "Nom requis.").max(80),
  emailRaw: z.string().trim().min(1, "E-mail requis.").max(180),
  phoneRaw: z.string().trim().min(1, "Téléphone requis.").max(40),
  phoneCountry: z.string().trim().length(2).toUpperCase().default(DEFAULT_PHONE_COUNTRY),
  /** Facultatif et NON bloquant. `false` est une réponse recevable. */
  marketingOptIn: z.boolean().optional().default(false),
});

export const universalBuyerAnswersSchema = universalStepOneSchema
  .extend(universalStepTwoSchema.shape)
  .extend({
    /**
     * Pot de miel. Le schéma l'ACCEPTE rempli, volontairement : c'est l'action
     * serveur qui le repère et renvoie un accusé « ok » silencieux. Le rejeter
     * ici en erreur de validation apprendrait au robot qu'il a été repéré, et
     * lui indiquerait quoi changer. Défense faible de toute façon — Turnstile
     * reste la vraie garde.
     */
    company: z.string().max(200).optional().default(""),
  });

export type UniversalBuyerAnswers = z.infer<typeof universalBuyerAnswersSchema>;

/** Les deux écrans, dans l'ordre. Il n'y en a jamais un troisième. */
export const UNIVERSAL_STEPS = [
  { id: "projet", title: "Votre projet" },
  { id: "contact", title: "Vous recontacter" },
] as const;

export type UniversalStepId = (typeof UNIVERSAL_STEPS)[number]["id"];
