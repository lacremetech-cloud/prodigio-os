import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireCrmSession } from "@/modules/crm/auth/session";
import { hasAnyRole } from "@/modules/crm/auth/roles";
import { getTemplateFamilies } from "@/modules/communications/studio/queries";
import {
  TemplateStudio,
  type TemplateFamilyView,
} from "@/components/crm/communications/studio/template-studio";

export const metadata: Metadata = { title: "Communications — Modèles" };

/**
 * Studio des modèles. Réservé à l'administrateur et au manager : la garde est
 * re-vérifiée ici, indépendamment de la navigation (un accès direct par URL ne
 * doit jamais passer). La base re-vérifie de son côté à chaque écriture.
 */
export default async function TemplatesPage() {
  const session = await requireCrmSession("/crm/communications/modeles");
  if (!hasAnyRole(session.roles, ["administrateur", "manager"])) {
    redirect("/crm/communications");
  }

  const families = await getTemplateFamilies();

  const view: TemplateFamilyView[] = families.map((f) => ({
    templateKey: f.templateKey,
    channel: f.channel,
    category: f.category,
    activeVersion: f.activeVersion,
    versions: f.versions.map((v) => ({
      id: v.id,
      templateKey: v.template_key,
      version: v.version,
      name: v.name,
      channel: v.channel,
      category: v.category,
      status: v.status,
      subject: v.subject,
      body: v.body,
      bodyFormat: v.body_format,
      previewText: v.preview_text,
      allowedVariables: v.allowed_variables ?? [],
      notes: v.notes,
      updatedAt: v.updated_at,
    })),
  }));

  return <TemplateStudio families={view} />;
}
