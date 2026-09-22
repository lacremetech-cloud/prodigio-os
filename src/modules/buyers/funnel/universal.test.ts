import { describe, expect, it } from "vitest";
import { BUDGET_BANDS } from "./schema";
import {
  BUYER_BUDGET_CHOICES,
  BUDGET_CHOICE_LABELS,
  UNIVERSAL_STEPS,
  budgetChoiceBounds,
  universalBuyerAnswersSchema,
  universalStepOneSchema,
  universalStepTwoSchema,
} from "./universal";

/** Les QUATRE champs obligatoires de l'écran 2, et rien d'autre. */
const CONTACT = {
  firstName: "Camille",
  lastName: "Durand",
  emailRaw: "camille@example.test",
  phoneRaw: "+33 6 12 34 56 78",
};

describe("vocabulaire de budget", () => {
  it("porte exactement les cinq réponses du formulaire universel", () => {
    expect(BUYER_BUDGET_CHOICES).toEqual([
      "aucun_projet",
      "500k_1m",
      "1m_2m",
      "2m_3m",
      "plus_3m",
    ]);
  });

  it("reste DISTINCT des tranches historiques — aucune conversion possible", () => {
    // Trois réponses sur cinq n'existent pas dans l'ancien vocabulaire : les
    // rapprocher ferait perdre ou transformer l'information.
    const anciennes = new Set<string>(BUDGET_BANDS);
    const inconnues = BUYER_BUDGET_CHOICES.filter((c) => !anciennes.has(c));
    expect(inconnues).toEqual(["aucun_projet", "500k_1m", "1m_2m"]);
  });

  it("étiquette chaque réponse", () => {
    for (const choice of BUYER_BUDGET_CHOICES) {
      expect(BUDGET_CHOICE_LABELS[choice]).toBeTruthy();
    }
  });
});

describe("budgetChoiceBounds", () => {
  it("ne donne AUCUNE borne à « aucun projet » — absence de projet, pas budget inconnu", () => {
    expect(budgetChoiceBounds("aucun_projet")).toEqual({ min: null, max: null });
  });

  it("borne les tranches chiffrées, en centimes", () => {
    expect(budgetChoiceBounds("500k_1m")).toEqual({ min: 50_000_000, max: 100_000_000 });
    expect(budgetChoiceBounds("1m_2m")).toEqual({ min: 100_000_000, max: 200_000_000 });
    expect(budgetChoiceBounds("2m_3m")).toEqual({ min: 200_000_000, max: 300_000_000 });
  });

  it("laisse la tranche haute ouverte", () => {
    expect(budgetChoiceBounds("plus_3m")).toEqual({ min: 300_000_000, max: null });
  });

  it("enchaîne les tranches sans trou ni recouvrement", () => {
    const chiffrees = ["500k_1m", "1m_2m", "2m_3m", "plus_3m"] as const;
    for (let i = 0; i < chiffrees.length - 1; i += 1) {
      const courante = budgetChoiceBounds(chiffrees[i]!);
      const suivante = budgetChoiceBounds(chiffrees[i + 1]!);
      expect(courante.max).toBe(suivante.min);
    }
  });
});

describe("le formulaire n'a que deux écrans", () => {
  it("en déclare exactement deux, dans l'ordre", () => {
    expect(UNIVERSAL_STEPS.map((s) => s.id)).toEqual(["projet", "contact"]);
  });
});

describe("validation", () => {
  it("accepte une réponse complète", () => {
    const parsed = universalBuyerAnswersSchema.safeParse({
      budgetChoice: "1m_2m",
      ...CONTACT,
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.phoneCountry).toBe("FR");
  });

  it("accepte « aucun projet » : c'est une réponse, pas un refus de répondre", () => {
    expect(
      universalStepOneSchema.safeParse({ budgetChoice: "aucun_projet" }).success,
    ).toBe(true);
  });

  it("refuse un budget absent ou étranger au vocabulaire", () => {
    expect(universalStepOneSchema.safeParse({}).success).toBe(false);
    expect(universalStepOneSchema.safeParse({ budgetChoice: "800k_1_2m" }).success).toBe(false);
    expect(universalStepOneSchema.safeParse({ budgetChoice: "a_definir" }).success).toBe(false);
  });

  it("n'exige AUCUNE case marketing : quatre champs suffisent", () => {
    // La demande de brochure doit aboutir même si la personne refuse toute
    // utilisation marketing ultérieure. Aucune case n'est donc bloquante.
    expect(universalStepTwoSchema.safeParse(CONTACT).success).toBe(true);
  });

  it("traite le refus marketing comme une réponse recevable, pas comme une erreur", () => {
    const refus = universalStepTwoSchema.safeParse({ ...CONTACT, marketingOptIn: false });
    const accord = universalStepTwoSchema.safeParse({ ...CONTACT, marketingOptIn: true });
    expect(refus.success).toBe(true);
    expect(accord.success).toBe(true);
    expect(refus.success && refus.data.marketingOptIn).toBe(false);
    expect(accord.success && accord.data.marketingOptIn).toBe(true);
  });

  it("laisse l'accord marketing à FAUX par défaut — jamais de consentement implicite", () => {
    const parsed = universalStepTwoSchema.safeParse(CONTACT);
    expect(parsed.success && parsed.data.marketingOptIn).toBe(false);
  });

  it("exige nom, prénom, e-mail et téléphone", () => {
    for (const champ of ["firstName", "lastName", "emailRaw", "phoneRaw"] as const) {
      expect(universalStepTwoSchema.safeParse({ ...CONTACT, [champ]: "  " }).success).toBe(false);
    }
  });

  it("ACCEPTE un pot de miel rempli au niveau du schéma — le piège se referme ailleurs", () => {
    // Rejeter ici apprendrait au robot qu'il a été repéré, et lui dirait quoi
    // corriger. L'action serveur renvoie un accusé « ok » silencieux et
    // n'enregistre rien : c'est elle qui tient le piège.
    const parsed = universalBuyerAnswersSchema.safeParse({
      budgetChoice: "1m_2m",
      ...CONTACT,
      company: "robot",
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.company).toBe("robot");
  });
});
