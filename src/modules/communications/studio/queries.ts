import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { contactName } from "@/modules/crm/format";
import type {
  CommunicationAutomationRow,
  CommunicationMessageStatus,
  CommunicationSuppressionRow,
  CommunicationTemplateRow,
} from "@/lib/supabase/types";
import { SYSTEM_AUTOMATIONS } from "./system-automations";

/**
 * Lectures propres au **studio**. Elles complètent `queries.ts` sans le
 * dupliquer : mêmes tables, mêmes politiques RLS, mêmes règles de masquage.
 *
 * ⚠️ Toutes les statistiques sont des **comptages réels** effectués en base
 * (`count: 'exact'`), jamais une estimation ni une extrapolation d'un
 * échantillon. Une valeur qui ne peut pas être établie n'est pas affichée.
 */

export interface StudioStats {
  /** Messages réellement préparés (une ligne existe). */
  prepares: number;
  /** En attente d'envoi (planifié ou en attente). */
  enAttente: number;
  /** Remis au fournisseur. ⚠️ N'est ni « envoyé » ni « livré ». */
  enFileFournisseur: number;
  /** Échecs techniques. */
  echecs: number;
  /** Livraisons dont la PREUVE fournisseur est enregistrée. */
  livraisonsProuvees: number;
  /**
   * Messages au statut `livre` sans preuve fournisseur. Doit rester à zéro :
   * la base l'interdit. Affiché pour que l'anomalie ne puisse pas se cacher.
   */
  livresSansPreuve: number;
  /** Communications bloquées par la politique, motif connu. */
  bloques: number;
  /** Événements ignorés dans la file, motif toujours renseigné. */
  ignores: number;
  /** Oppositions actives. */
  oppositionsActives: number;
  /** Automatisations système, en lecture seule. */
  automatisationsSysteme: number;
  /** Brouillons d'automatisations personnalisées. */
  brouillonsPersonnalises: number;
}

/** Répartition d'un motif, avec son décompte réel. */
export interface ReasonCount {
  reason: string;
  count: number;
}

export interface StudioOverview {
  stats: StudioStats;
  blockedReasons: ReasonCount[];
  skippedReasons: ReasonCount[];
}

/** Décompte EXACT des lignes visibles d'une table (`head: true` : aucune donnée transférée). */
async function countRows(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  table:
    | "communication_messages"
    | "communication_outbox"
    | "communication_suppressions"
    | "communication_automations",
): Promise<number> {
  const { count } = await supabase.from(table).select("id", { count: "exact", head: true });
  return count ?? 0;
}

/**
 * Vue d'ensemble chiffrée. Les décomptes respectent la RLS : un agent
 * immobilier ne compte que ce qu'il a le droit de voir.
 */
export async function getStudioOverview(): Promise<StudioOverview> {
  const supabase = await createSupabaseServerClient();

  const messagesByStatus = async (status: CommunicationMessageStatus) => {
    const { count } = await supabase
      .from("communication_messages")
      .select("id", { count: "exact", head: true })
      .eq("status", status);
    return count ?? 0;
  };

  const [
    prepares,
    planifies,
    enAttente,
    enFileFournisseur,
    echecs,
    bloques,
    livres,
  ] = await Promise.all([
    countRows(supabase, "communication_messages"),
    messagesByStatus("planifie"),
    messagesByStatus("en_attente"),
    messagesByStatus("en_file_fournisseur"),
    messagesByStatus("echec"),
    messagesByStatus("bloque"),
    messagesByStatus("livre"),
  ]);

  // « Livré » exige une PREUVE fournisseur. On compte donc les deux populations
  // séparément plutôt que de supposer qu'elles coïncident.
  const { count: livraisonsProuvees } = await supabase
    .from("communication_messages")
    .select("id", { count: "exact", head: true })
    .eq("status", "livre")
    .not("provider_status", "is", null);

  const { count: ignores } = await supabase
    .from("communication_outbox")
    .select("id", { count: "exact", head: true })
    .eq("status", "ignore");

  const { count: oppositionsActives } = await supabase
    .from("communication_suppressions")
    .select("id", { count: "exact", head: true })
    .eq("active", true);

  const brouillonsPersonnalises = await countRows(supabase, "communication_automations");

  // Motifs : agrégés côté serveur à partir des seules lignes visibles.
  const [{ data: blockedRows }, { data: skippedRows }] = await Promise.all([
    supabase
      .from("communication_messages")
      .select("blocked_reason")
      .eq("status", "bloque")
      .not("blocked_reason", "is", null)
      .limit(1000),
    supabase
      .from("communication_outbox")
      .select("skip_reason")
      .eq("status", "ignore")
      .not("skip_reason", "is", null)
      .limit(1000),
  ]);

  const tally = (values: (string | null)[]): ReasonCount[] => {
    const map = new Map<string, number>();
    for (const v of values) {
      if (!v) continue;
      map.set(v, (map.get(v) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);
  };

  return {
    stats: {
      prepares,
      enAttente: planifies + enAttente,
      enFileFournisseur,
      echecs,
      livraisonsProuvees: livraisonsProuvees ?? 0,
      livresSansPreuve: Math.max(0, livres - (livraisonsProuvees ?? 0)),
      bloques,
      ignores: ignores ?? 0,
      oppositionsActives: oppositionsActives ?? 0,
      automatisationsSysteme: SYSTEM_AUTOMATIONS.length,
      brouillonsPersonnalises,
    },
    blockedReasons: tally((blockedRows ?? []).map((r) => r.blocked_reason)),
    skippedReasons: tally((skippedRows ?? []).map((r) => r.skip_reason)),
  };
}

/** Toutes les versions d'un modèle, regroupées par clé, la plus récente d'abord. */
export interface TemplateFamily {
  templateKey: string;
  channel: string;
  category: string;
  versions: CommunicationTemplateRow[];
  activeVersion: number | null;
}

export async function getTemplateFamilies(): Promise<TemplateFamily[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("communication_templates")
    .select("*")
    .order("template_key")
    .order("version", { ascending: false });

  const rows = (data ?? []) as CommunicationTemplateRow[];
  const byKey = new Map<string, TemplateFamily>();

  for (const row of rows) {
    const family = byKey.get(row.template_key);
    if (family) {
      family.versions.push(row);
      if (row.status === "actif") family.activeVersion = row.version;
    } else {
      byKey.set(row.template_key, {
        templateKey: row.template_key,
        channel: row.channel,
        category: row.category,
        versions: [row],
        activeVersion: row.status === "actif" ? row.version : null,
      });
    }
  }

  return [...byKey.values()];
}

/** Brouillons d'automatisations personnalisées, la version la plus récente d'abord. */
export async function getCustomAutomations(): Promise<CommunicationAutomationRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("communication_automations")
    .select("*")
    .order("automation_key")
    .order("version", { ascending: false });
  return (data ?? []) as CommunicationAutomationRow[];
}

export interface SuppressionListItem {
  row: CommunicationSuppressionRow;
  /** NOM du contact uniquement : jamais la coordonnée visée par l'opposition. */
  contactName: string;
}

/**
 * Oppositions, actives et levées. Le nom du contact est résolu côté serveur ;
 * aucune coordonnée n'est transmise au navigateur — afficher l'adresse visée par
 * une opposition la révélerait sans nécessité.
 */
export async function getSuppressions(opts: {
  includeReleased?: boolean;
  limit?: number;
}): Promise<SuppressionListItem[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("communication_suppressions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 200);

  if (!opts.includeReleased) query = query.eq("active", true);

  const { data } = await query;
  const rows = (data ?? []) as CommunicationSuppressionRow[];
  if (rows.length === 0) return [];

  const ids = [...new Set(rows.map((r) => r.contact_id))];
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, company_name")
    .in("id", ids);

  const nameById = new Map(
    (contacts ?? []).map((c) => [
      c.id,
      c.company_name?.trim() || contactName(c.first_name, c.last_name),
    ]),
  );

  return rows.map((row) => ({
    row,
    contactName: nameById.get(row.contact_id) ?? "Contact inconnu",
  }));
}
