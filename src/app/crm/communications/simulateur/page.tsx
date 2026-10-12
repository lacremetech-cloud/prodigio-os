import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireCrmSession } from "@/modules/crm/auth/session";
import { hasAnyRole } from "@/modules/crm/auth/roles";
import { isCommunicationDispatchEnabled, isLumailConfigured, isTwilioConfigured } from "@/config";
import { getTemplateFamilies } from "@/modules/communications/studio/queries";
import {
  WorkflowSimulator,
  type SimulatorTemplate,
} from "@/components/crm/communications/studio/workflow-simulator";

export const metadata: Metadata = { title: "Communications — Simulateur" };

/**
 * Simulateur de workflow. Réservé à l'administrateur et au manager.
 *
 * Seuls des **modèles** (configuration) sont transmis au navigateur : aucun
 * contact, aucun choix RGPD, aucun message réel. Les destinataires proviennent
 * exclusivement du jeu fictif embarqué.
 */
export default async function SimulatorPage() {
  const session = await requireCrmSession("/crm/communications/simulateur");
  if (!hasAnyRole(session.roles, ["administrateur", "manager"])) {
    redirect("/crm/communications");
  }

  const families = await getTemplateFamilies();
  const templates: SimulatorTemplate[] = families.flatMap((f) =>
    f.versions.map((v) => ({
      templateKey: v.template_key,
      version: v.version,
      status: v.status,
      channel: v.channel,
      category: v.category,
      subject: v.subject,
      body: v.body,
      bodyFormat: v.body_format,
      allowedVariables: v.allowed_variables ?? [],
    })),
  );

  const dispatchEnabled =
    isCommunicationDispatchEnabled() && (isLumailConfigured() || isTwilioConfigured());

  return <WorkflowSimulator templates={templates} dispatchEnabled={dispatchEnabled} />;
}
