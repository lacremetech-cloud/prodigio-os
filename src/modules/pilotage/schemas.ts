/**
 * Validation Zod des écritures du pilotage, à la frontière serveur.
 *
 * Elle reprend les règles des fonctions SQL `crm_pilotage_*` pour répondre
 * une phrase claire AVANT d'appeler la base ; la base, elle, revérifie tout et
 * reste l'autorité. Module séparé d'`actions.ts` : un fichier « use server »
 * n'exporte que des fonctions asynchrones, et ces schémas se testent.
 */

import { z } from "zod";
import { BASES_HONORAIRES, NATURES_PRIX, STATUTS_COMMERCIAUX, TYPES_COUT } from "./labels";
import { auPlusDecimales, estUnJour } from "./saisie";

const uuid = z.string().uuid("Identifiant invalide.");

const jour = z.string().refine(estUnJour, "Date invalide.");

/** Un montant en centimes : entier, positif, sous mille milliards d'euros. */
const centimes = z
  .number({ error: "Montant invalide." })
  .int("Montant invalide.")
  .positive("Le montant doit être positif.")
  .max(100_000_000_000_000, "Montant invalide.");

const motif = z
  .string()
  .trim()
  .min(1, "Motif requis : dites pourquoi.")
  .max(2000, "Motif trop long (2 000 caractères au plus).");

const tauxCommission = z
  .number({ error: "Taux de commission invalide." })
  .gt(0, "Le taux de commission doit être positif.")
  .lt(100, "Taux de commission invalide.")
  .refine((x) => auPlusDecimales(x, 4), "Taux de commission : 4 décimales au plus.");

const part = z
  .number({ error: "Part de Prodigio invalide." })
  .min(0, "Part de Prodigio invalide.")
  .max(100, "La part de Prodigio ne dépasse pas 100 %.")
  .refine((x) => auPlusDecimales(x, 2), "Part de Prodigio : 2 décimales au plus.");

const tva = z
  .number({ error: "Taux de TVA invalide." })
  .min(0, "Taux de TVA invalide.")
  .lt(100, "Taux de TVA invalide.")
  .refine((x) => auPlusDecimales(x, 2), "Taux de TVA : 2 décimales au plus.");

export const conditionsSchema = z
  .object({
    propertyId: uuid,
    dateEffet: jour,
    venteParLots: z.boolean(),
    naturePrix: z.enum(NATURES_PRIX),
    prixAfficheCentimes: centimes.nullable(),
    tauxCommissionPct: tauxCommission.nullable(),
    baseHonoraires: z.enum(BASES_HONORAIRES, { error: "Choisissez la base des honoraires." }),
    partProdigioPct: part.nullable(),
    tauxTvaPct: tva.nullable(),
    statutCommercial: z.enum(STATUTS_COMMERCIAUX).nullable(),
    prixVenteFinalCentimes: centimes.nullable(),
    venduLe: jour.nullable(),
    motif,
  })
  .superRefine((d, ctx) => {
    if (d.venteParLots) {
      if (
        d.prixAfficheCentimes != null ||
        d.statutCommercial != null ||
        d.prixVenteFinalCentimes != null ||
        d.venduLe != null
      ) {
        ctx.addIssue({
          code: "custom",
          message: "Vente par lots : le prix, le statut et la vente se saisissent lot par lot.",
        });
      }
    } else if (d.statutCommercial == null) {
      ctx.addIssue({ code: "custom", message: "Statut commercial requis." });
    }
    if ((d.prixVenteFinalCentimes != null || d.venduLe != null) && d.statutCommercial !== "vendu") {
      ctx.addIssue({
        code: "custom",
        message: "Le prix de vente final et la date de vente ne se saisissent que pour un bien vendu.",
      });
    }
  });

export type ConditionsSaisie = z.infer<typeof conditionsSchema>;

export const lotSchema = z
  .object({
    lotId: uuid.nullable(),
    propertyId: uuid,
    numero: z.string().trim().max(40, "Numéro de lot trop long.").nullable(),
    description: z.string().trim().max(500, "Description trop longue (500 caractères au plus).").nullable(),
    prixCentimes: centimes.nullable(),
    statutCommercial: z.enum(STATUTS_COMMERCIAUX),
    prixVenteFinalCentimes: centimes.nullable(),
    venduLe: jour.nullable(),
    retire: z.boolean(),
    motif,
  })
  .superRefine((d, ctx) => {
    if (d.lotId == null) {
      if (!d.numero) ctx.addIssue({ code: "custom", message: "Numéro de lot requis." });
      if (d.retire) ctx.addIssue({ code: "custom", message: "Un lot ne peut pas naître retiré." });
    }
    if ((d.prixVenteFinalCentimes != null || d.venduLe != null) && d.statutCommercial !== "vendu") {
      ctx.addIssue({
        code: "custom",
        message: "Le prix de vente final et la date de vente ne se saisissent que pour un lot vendu.",
      });
    }
  });

export type LotSaisie = z.infer<typeof lotSchema>;

export const coutFixeSchema = z.object({
  propertyId: uuid,
  typeCout: z.enum(TYPES_COUT, { error: "Choisissez le type de coût." }),
  montantHtCentimes: centimes,
  note: z.string().trim().max(2000, "Note trop longue (2 000 caractères au plus).").nullable(),
  /** Clé tirée à l'affichage du formulaire : un double envoi ne compte qu'une fois. */
  cleSaisie: uuid,
});

export type CoutFixeSaisie = z.infer<typeof coutFixeSchema>;

export const annulationSchema = z.object({
  coutId: uuid,
  motif: z.string().trim().max(2000, "Motif trop long (2 000 caractères au plus).").nullable(),
});

/** Premier message d'une validation refusée, pour l'écran. */
export function premierMessage(erreur: z.ZodError): string {
  return erreur.issues[0]?.message ?? "Saisie invalide.";
}
