import type { AuditEventRow } from "@/lib/supabase/types";
import type { TimelineEntry } from "@/modules/crm/timeline";
import type { TimelineKind } from "@/modules/crm/status-visuals";

/**
 * Construit — de façon **pure** et testable — l'historique du bien à partir des
 * seuls AuditEvents (source non modifiable). On NE réintroduit AUCUNE donnée
 * sensible : l'audit ne contient déjà ni note confidentielle, ni montant, ni
 * contenu de document, ni URL signée. On ne fait que traduire type + libellé.
 *
 * Réutilise le composant `Timeline` du CRM (correctif structurel de grille) via
 * le type `TimelineEntry`. Activité métier ≠ AuditEvent : ici, seul l'audit est
 * pertinent pour un bien.
 */

const EVENT_LABELS: Record<string, string> = {
  bien_cree: "Bien créé",
  bien_identite: "Identité mise à jour",
  bien_positionnement: "Positionnement mis à jour",
  bien_statut: "Changement de statut",
  bien_responsable: "Responsable modifié",
  bien_media_ajoute: "Média ajouté",
  bien_media_supprime: "Média supprimé",
  bien_media_principal: "Image principale définie",
  bien_document_ajoute: "Document ajouté",
  bien_document_supprime: "Document supprimé",
  bien_production_maj: "Plan de production mis à jour",
  bien_pret: "Bien déclaré prêt à lancer",
};

function kindFor(eventType: string): TimelineKind {
  if (eventType === "bien_statut" || eventType === "bien_pret") return "stade";
  if (eventType === "bien_positionnement") return "segment";
  if (eventType === "bien_responsable") return "affectation";
  if (eventType.startsWith("bien_media") || eventType.startsWith("bien_document")) {
    return "document";
  }
  if (eventType === "bien_production_maj") return "tache";
  if (eventType === "bien_cree") return "mandat";
  return "audit";
}

function statusLabel(value: unknown): string | null {
  if (value && typeof value === "object" && "status" in (value as Record<string, unknown>)) {
    const v = (value as Record<string, unknown>).status;
    return v == null ? null : String(v);
  }
  return null;
}

export function buildPropertyTimeline(
  audit: AuditEventRow[],
  nameFor: (userId: string | null) => string | null,
): TimelineEntry[] {
  const entries = audit.map((e): TimelineEntry => {
    let body: string | null = null;
    if (e.event_type === "bien_statut" || e.event_type === "bien_pret") {
      const from = statusLabel(e.old_value);
      const to = statusLabel(e.new_value);
      body = from && to ? `${from} → ${to}` : to ?? null;
    }
    return {
      key: `audit-${e.id}`,
      at: e.created_at,
      source: "audit",
      kind: kindFor(e.event_type),
      title: EVENT_LABELS[e.event_type] ?? e.event_type,
      body,
      author: nameFor(e.actor_user_id),
      tone: e.event_type === "bien_pret" ? "ok" : "neutral",
    };
  });
  return entries.sort((a, b) => b.at.localeCompare(a.at));
}
