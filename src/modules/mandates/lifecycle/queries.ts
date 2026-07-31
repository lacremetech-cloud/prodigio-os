import "server-only";

/**
 * Couche de LECTURE du cycle « estimation → éligibilité → mandat → bien ».
 * Toutes les requêtes passent par le client serveur (JWT utilisateur) : la RLS
 * applique les permissions (opérateur = tout ; agent = ses dossiers affectés).
 * Aucune donnée confidentielle n'est exposée au-delà de ce que la RLS autorise.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  EconomicRuleSetRow,
  EstimationReportRow,
  MandateDocumentRow,
  MandateRow,
  PropertyRow,
} from "@/lib/supabase/types";

/** Compte rendu d'estimation d'un dossier (au plus un en V1). */
export async function getEstimationReport(
  opportunityId: string,
): Promise<EstimationReportRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("estimation_reports")
    .select("*")
    .eq("opportunity_id", opportunityId)
    .maybeSingle();
  return (data as EstimationReportRow | null) ?? null;
}

/** Tous les mandats d'un dossier (le plus récent d'abord). */
export async function listMandatesForOpportunity(
  opportunityId: string,
): Promise<MandateRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("mandates")
    .select("*")
    .eq("opportunity_id", opportunityId)
    .order("created_at", { ascending: false });
  return Array.isArray(data) ? (data as MandateRow[]) : [];
}

/**
 * Mandat « courant » d'un dossier : le mandat actif (non terminal) s'il existe,
 * sinon le plus récent. Sert d'ancre à la fiche.
 */
export async function getCurrentMandate(
  opportunityId: string,
): Promise<MandateRow | null> {
  const mandates = await listMandatesForOpportunity(opportunityId);
  const active = mandates.find((m) =>
    ["brouillon", "propose", "en_attente_signature", "signe"].includes(m.status),
  );
  return active ?? mandates[0] ?? null;
}

/** Documents actifs d'un dossier (RLS filtre déjà `status = actif`). */
export async function getDocumentsForOpportunity(
  opportunityId: string,
): Promise<MandateDocumentRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("mandate_documents")
    .select("*")
    .eq("opportunity_id", opportunityId)
    .eq("status", "actif")
    .order("created_at", { ascending: false });
  return Array.isArray(data) ? (data as MandateDocumentRow[]) : [];
}

/** Bien rattaché à un dossier (handoff Fabrique de biens), au plus un. */
export async function getPropertyForOpportunity(
  opportunityId: string,
): Promise<PropertyRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("properties")
    .select("*")
    .eq("opportunity_id", opportunityId)
    .maybeSingle();
  return (data as PropertyRow | null) ?? null;
}

/** Bien par identifiant (page du bien créé). */
export async function getPropertyById(id: string): Promise<PropertyRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("properties")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as PropertyRow | null) ?? null;
}

/** Règles économiques (opérateur uniquement, RLS). Historique inclus. */
export async function listEconomicRules(): Promise<EconomicRuleSetRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("economic_rule_sets")
    .select("*")
    .order("segment", { ascending: true })
    .order("effective_from", { ascending: false });
  return Array.isArray(data) ? (data as EconomicRuleSetRow[]) : [];
}

/** Règles économiques actives (pour proposer un mandat). */
export async function listActiveEconomicRules(): Promise<EconomicRuleSetRow[]> {
  const rules = await listEconomicRules();
  return rules.filter((r) => r.status === "actif");
}

/** Organisations porteuses candidates (agences partenaires configurées). */
export interface HolderOrganizationOption {
  id: string;
  name: string;
  slug: string;
}
export async function listHolderOrganizations(): Promise<HolderOrganizationOption[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("organizations")
    .select("id, name, slug, kind, status")
    .eq("kind", "agence_partenaire")
    .eq("status", "actif")
    .order("name", { ascending: true });
  return Array.isArray(data)
    ? (data as { id: string; name: string; slug: string }[]).map((o) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
      }))
    : [];
}
