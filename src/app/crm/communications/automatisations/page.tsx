import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireCrmSession } from "@/modules/crm/auth/session";
import { hasAnyRole } from "@/modules/crm/auth/roles";
import { getCustomAutomations, getTemplateFamilies } from "@/modules/communications/studio/queries";
import {
  AutomationStudio,
  type CustomAutomationView,
  type TemplateOption,
} from "@/components/crm/communications/studio/automation-studio";
import type { ConditionValue } from "@/modules/communications/studio";

export const metadata: Metadata = { title: "Communications — Automatisations" };

/**
 * Studio des automatisations. Réservé à l'administrateur et au manager. La base
 * re-vérifie le rôle à chaque écriture et refuse, en toute hypothèse, toute
 * activation d'une automatisation personnalisée.
 */
export default async function AutomationsPage() {
  const session = await requireCrmSession("/crm/communications/automatisations");
  if (!hasAnyRole(session.roles, ["administrateur", "manager"])) {
    redirect("/crm/communications");
  }

  const [automations, families] = await Promise.all([
    getCustomAutomations(),
    getTemplateFamilies(),
  ]);

  const view: CustomAutomationView[] = automations.map((a) => ({
    id: a.id,
    automationKey: a.automation_key,
    version: a.version,
    name: a.name,
    triggerEvent: a.trigger_event,
    templateKey: a.template_key,
    templateVersion: a.template_version,
    channel: a.channel,
    delayMinutes: a.delay_minutes,
    // `conditions` est un jsonb : on ne conserve que les valeurs scalaires
    // attendues, jamais une structure arbitraire venue de la base.
    conditions: Object.fromEntries(
      Object.entries((a.conditions ?? {}) as Record<string, unknown>).filter(
        (entry): entry is [string, ConditionValue] =>
          ["string", "number", "boolean"].includes(typeof entry[1]),
      ),
    ),
    status: a.status,
    notes: a.notes,
    updatedAt: a.updated_at,
  }));

  const templates: TemplateOption[] = families.map((f) => ({
    templateKey: f.templateKey,
    channel: f.channel,
    versions: f.versions.map((v) => v.version).sort((a, b) => b - a),
  }));

  return <AutomationStudio automations={view} templates={templates} />;
}
