import type { Metadata } from "next";
import { requireCrmSession } from "@/modules/crm/auth/session";
import { canOperate, canViewContactDetails, maskContactValue } from "@/modules/crm/auth/roles";
import { loadLeadBundle } from "@/modules/crm/data/queries";
import { isHighPotential, isOverdue } from "@/modules/crm/leads";
import { contactName } from "@/modules/crm/format";
import { propertyLabel, valueBandLabel } from "@/modules/crm/labels";
import type { KanbanLead } from "@/modules/crm/kanban";
import { KanbanBoard } from "@/components/crm/pipeline/kanban-board";

export const metadata: Metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  const session = await requireCrmSession("/crm/mandats/pipeline");
  const canView = canViewContactDetails(session.roles);
  const canMove = canOperate(session.roles);
  const { leads } = await loadLeadBundle();

  // DTO minimal, coordonnées DÉJÀ masquées selon le rôle (rien de sensible en trop).
  const cards: KanbanLead[] = leads.map((l) => ({
    opportunityId: l.opportunityId,
    stage: l.stage,
    name: contactName(l.contactFirstName, l.contactLastName),
    propertyLabel: propertyLabel(l.propertyType) ?? "Type inconnu",
    city: l.city,
    valueLabel: valueBandLabel(l.valueBand) ?? "Valeur à estimer",
    compatibilityScore: l.compatibilityScore,
    maturityScore: l.maturityScore,
    highPotential: isHighPotential(l),
    overdue: isOverdue(l),
    unassigned: l.assignees.length === 0,
    phoneMasked: maskContactValue(l.contactPhone, canView),
  }));

  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="crm-eyebrow">Pipeline</p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--crm-text)]">Pipeline visuel</h1>
        <p className="mt-1 text-sm text-[var(--crm-text-dim)]">
          Le stade du pipeline est distinct du segment du bien.{" "}
          {canMove
            ? "Glissez une carte entre les colonnes, ou utilisez le menu « Déplacer vers… » / le clavier. Les colonnes « proposition », « mandat signé » et « perdu » se pilotent depuis le dossier."
            : "Votre rôle est en lecture pour cette vue."}
        </p>
      </header>

      <KanbanBoard leads={cards} canMove={canMove} canView={canView} />
    </div>
  );
}
