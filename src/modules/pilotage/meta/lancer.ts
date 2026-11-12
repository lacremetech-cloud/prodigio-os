import "server-only";

/**
 * LANCER UNE LECTURE META — le seul endroit qui assemble les vraies pièces :
 * le jeton de LECTURE, le compte publicitaire, le client de base du rôle de
 * service. Appelé par la route du matin (Vercel Cron) et par le bouton
 * « Lire maintenant » (administrateur).
 *
 * ⚠️ `META_CAPI_ACCESS_TOKEN` n'est jamais lu ici : il écrit dans le pixel. Un
 * test refuse qu'il apparaisse dans ce module.
 */

import { env, isMetaAdsReadConfigured, isSupabaseAdminConfigured } from "@/config";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { jourParis } from "../versions";
import { creerDepot } from "./depot";
import { creerPortMeta } from "./port-meta";
import { lireMeta, type Bilan } from "./synchro";

/**
 * Le temps accordé à une lecture. La fonction serveur peut durer jusqu'à cinq
 * minutes (`maxDuration`) ; on s'arrête d'entamer des tranches bien avant, pour
 * toujours finir proprement et écrire le bilan.
 */
export const BUDGET_LECTURE_MS = 200_000;

export type ResultatLancement =
  | { ok: true; bilan: Bilan }
  | { ok: false; raison: "meta_non_configure" | "base_non_configuree"; message: string };

export async function lancerLectureMeta(
  declencheur: "matin" | "manuel",
  demandeePar: string | null,
): Promise<ResultatLancement> {
  if (!isMetaAdsReadConfigured()) {
    return {
      ok: false,
      raison: "meta_non_configure",
      message: "La lecture Meta n’est pas configurée : META_ADS_READ_TOKEN et META_AD_ACCOUNT_ID manquent dans Vercel.",
    };
  }
  if (!isSupabaseAdminConfigured()) {
    return {
      ok: false,
      raison: "base_non_configuree",
      message: "La clé serveur de la base (SUPABASE_SECRET_KEY) manque : la lecture ne peut rien enregistrer.",
    };
  }

  const debut = Date.now();
  const echeanceMs = debut + BUDGET_LECTURE_MS;
  const meta = creerPortMeta(env.META_AD_ACCOUNT_ID as string, {
    jeton: env.META_ADS_READ_TOKEN as string,
    echeanceMs,
  });
  const bilan = await lireMeta({
    meta,
    base: creerDepot(getSupabaseAdminClient()),
    aujourdHui: jourParis(new Date(debut)),
    maintenant: Date.now,
    echeanceMs,
    declencheur,
    demandeePar,
  });
  return { ok: true, bilan };
}
