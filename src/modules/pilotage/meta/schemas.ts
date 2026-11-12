/**
 * Validation Zod des règles de rattachement, à la frontière serveur. La base
 * revérifie tout (`crm_pilotage_meta_ajouter_regle`) et normalise le jeton.
 */

import { z } from "zod";

const uuid = z.string().uuid("Identifiant invalide.");

export const regleSchema = z
  .object({
    typeRegle: z.enum(["jeton", "campagne"], { error: "Type de règle invalide." }),
    valeur: z.string().trim().min(1, "Indiquez le jeton ou l’identifiant de campagne.").max(60, "Valeur trop longue."),
    cible: z.enum(["biens", "hors_portefeuille"], { error: "Choisissez la cible." }),
    biens: z.array(uuid).max(20, "Vingt biens au plus."),
    note: z.string().trim().max(500, "Note trop longue (500 caractères au plus).").nullable(),
  })
  .superRefine((d, ctx) => {
    if (d.typeRegle === "campagne" && !/^\d{5,30}$/.test(d.valeur)) {
      ctx.addIssue({ code: "custom", message: "L’identifiant de campagne ne contient que des chiffres." });
    }
    if (d.cible === "biens" && d.biens.length === 0) {
      ctx.addIssue({ code: "custom", message: "Choisissez au moins un bien." });
    }
    if (d.cible === "hors_portefeuille" && d.biens.length > 0) {
      ctx.addIssue({ code: "custom", message: "Hors portefeuille : aucun bien à choisir." });
    }
  });

export const retraitSchema = z.object({
  regleId: uuid,
  motif: z.string().trim().max(500, "Motif trop long (500 caractères au plus).").nullable(),
});
