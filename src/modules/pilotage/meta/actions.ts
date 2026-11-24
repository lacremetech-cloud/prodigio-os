"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireCrmSession } from "@/modules/crm/auth/session";
import { canPiloter } from "@/modules/crm/auth/roles";
import { messagePilotage } from "../erreurs";
import { premierMessage } from "../schemas";
import { lancerLectureMeta } from "./lancer";
import { regleSchema, retraitSchema } from "./schemas";

/**
 * Actions serveur de la lecture Meta. Administrateur seul : contrôlé ici, puis
 * en base (fonctions `crm_pilotage_meta_*`). La lecture elle-même passe par le
 * rôle de service, côté serveur, après ce contrôle — jamais depuis le navigateur.
 */

export interface ActionResult {
  ok: boolean;
  error?: string;
  data?: Record<string, unknown>;
}

const REFUS = "Le pilotage est réservé aux administrateurs.";
const PAGE = "/crm/pilotage/meta";

export async function lireMetaMaintenantAction(): Promise<ActionResult> {
  const session = await requireCrmSession();
  if (!canPiloter(session.roles)) return { ok: false, error: REFUS };

  const resultat = await lancerLectureMeta("manuel", session.userId);
  revalidatePath(PAGE);
  if (!resultat.ok) return { ok: false, error: resultat.message };
  const b = resultat.bilan;
  if (b.statut === "occupe" || b.statut === "echec") return { ok: false, error: b.message ?? "La lecture n’a pas abouti." };
  return {
    ok: true,
    data: { statut: b.statut, lignes: b.lignes, tranches: b.tranches, message: b.message },
  };
}

export async function ajouterRegleAction(input: unknown): Promise<ActionResult> {
  const session = await requireCrmSession();
  if (!canPiloter(session.roles)) return { ok: false, error: REFUS };
  const parsed = regleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: premierMessage(parsed.error) };
  const d = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("crm_pilotage_meta_ajouter_regle", {
    p_type_regle: d.typeRegle,
    p_valeur: d.valeur,
    p_cible: d.cible,
    p_biens: d.biens,
    p_note: d.note,
  });
  if (error) return { ok: false, error: messagePilotage(error.code, error.message) };
  revalidatePath(PAGE);
  return { ok: true, data: (data as Record<string, unknown>) ?? undefined };
}

export async function retirerRegleAction(input: unknown): Promise<ActionResult> {
  const session = await requireCrmSession();
  if (!canPiloter(session.roles)) return { ok: false, error: REFUS };
  const parsed = retraitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: premierMessage(parsed.error) };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("crm_pilotage_meta_retirer_regle", {
    p_regle_id: parsed.data.regleId,
    p_motif: parsed.data.motif,
  });
  if (error) return { ok: false, error: messagePilotage(error.code, error.message) };
  revalidatePath(PAGE);
  return { ok: true, data: (data as Record<string, unknown>) ?? undefined };
}
