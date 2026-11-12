"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireCrmSession } from "@/modules/crm/auth/session";
import { canPiloter } from "@/modules/crm/auth/roles";
import { messagePilotage } from "./erreurs";
import {
  annulationSchema,
  conditionsSchema,
  coutFixeSchema,
  lotSchema,
  premierMessage,
} from "./schemas";

/**
 * Actions serveur d'ÉCRITURE du pilotage. Elles délèguent aux fonctions SQL
 * `crm_pilotage_*` (SECURITY DEFINER), qui revérifient le rôle administrateur,
 * refusent toute réécriture et tracent chaque saisie au journal — sans montant.
 * Ici : garde de session et de rôle (défense en profondeur), validation Zod,
 * et rafraîchissement des pages. Aucun message technique n'est renvoyé.
 */

export interface ActionResult {
  ok: boolean;
  error?: string;
  data?: Record<string, unknown>;
}

const REFUS = "Le pilotage est réservé aux administrateurs.";

async function garde(): Promise<ActionResult | null> {
  const session = await requireCrmSession();
  return canPiloter(session.roles) ? null : { ok: false, error: REFUS };
}

function rafraichir(propertyId: string) {
  revalidatePath("/crm/pilotage/donnees");
  revalidatePath(`/crm/pilotage/donnees/${propertyId}`);
}

export async function enregistrerConditionsAction(input: unknown): Promise<ActionResult> {
  const refus = await garde();
  if (refus) return refus;
  const parsed = conditionsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: premierMessage(parsed.error) };
  const d = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("crm_pilotage_enregistrer_conditions", {
    p_property_id: d.propertyId,
    p_date_effet: d.dateEffet,
    p_vente_par_lots: d.venteParLots,
    p_nature_prix: d.naturePrix,
    p_prix_affiche_cents: d.prixAfficheCentimes,
    p_taux_commission_pct: d.tauxCommissionPct,
    p_base_honoraires: d.baseHonoraires,
    p_part_prodigio_pct: d.partProdigioPct,
    p_taux_tva_pct: d.tauxTvaPct,
    p_statut_commercial: d.statutCommercial,
    p_prix_vente_final_cents: d.prixVenteFinalCentimes,
    p_vendu_le: d.venduLe,
    p_motif: d.motif,
  });
  if (error) return { ok: false, error: messagePilotage(error.code, error.message) };
  rafraichir(d.propertyId);
  return { ok: true, data: (data as Record<string, unknown>) ?? undefined };
}

export async function enregistrerLotAction(input: unknown): Promise<ActionResult> {
  const refus = await garde();
  if (refus) return refus;
  const parsed = lotSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: premierMessage(parsed.error) };
  const d = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("crm_pilotage_enregistrer_lot", {
    p_lot_id: d.lotId,
    p_property_id: d.propertyId,
    // Le numéro ne s'envoie qu'à la création : il est immuable ensuite.
    p_numero: d.lotId ? null : d.numero,
    p_description: d.description,
    p_prix_cents: d.prixCentimes,
    p_statut_commercial: d.statutCommercial,
    p_prix_vente_final_cents: d.prixVenteFinalCentimes,
    p_vendu_le: d.venduLe,
    p_retire: d.retire,
    p_motif: d.motif,
  });
  if (error) return { ok: false, error: messagePilotage(error.code, error.message) };
  rafraichir(d.propertyId);
  return { ok: true, data: (data as Record<string, unknown>) ?? undefined };
}

export async function saisirCoutFixeAction(input: unknown): Promise<ActionResult> {
  const refus = await garde();
  if (refus) return refus;
  const parsed = coutFixeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: premierMessage(parsed.error) };
  const d = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("crm_pilotage_saisir_cout_fixe", {
    p_property_id: d.propertyId,
    p_type_cout: d.typeCout,
    p_montant_ht_cents: d.montantHtCentimes,
    p_note: d.note,
    p_cle_saisie: d.cleSaisie,
  });
  if (error) return { ok: false, error: messagePilotage(error.code, error.message) };
  rafraichir(d.propertyId);
  return { ok: true, data: (data as Record<string, unknown>) ?? undefined };
}

export async function annulerCoutFixeAction(input: unknown): Promise<ActionResult> {
  const refus = await garde();
  if (refus) return refus;
  const parsed = annulationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: premierMessage(parsed.error) };
  const d = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("crm_pilotage_annuler_cout_fixe", {
    p_cout_id: d.coutId,
    p_motif: d.motif,
  });
  if (error) return { ok: false, error: messagePilotage(error.code, error.message) };
  // La base renvoie le bien du coût : c'est sa page qu'il faut rafraîchir.
  const resultat = (data as Record<string, unknown> | null) ?? {};
  if (typeof resultat.property_id === "string") rafraichir(resultat.property_id);
  else revalidatePath("/crm/pilotage/donnees", "layout");
  return { ok: true, data: resultat };
}
