import type { ReactNode } from "react";
import { requireCrmSession } from "@/modules/crm/auth/session";
import { hasAnyRole } from "@/modules/crm/auth/roles";
import { StudioNav, type StudioSection } from "@/components/crm/communications/studio/studio-nav";
import { RGPD_STATEMENT } from "@/modules/communications/studio";

/**
 * Enveloppe du **studio Communications & Workflows**.
 *
 * L'autorisation est résolue ici, côté serveur, une seule fois : chaque page
 * la revérifie néanmoins pour elle-même (défense en profondeur — un accès direct
 * par URL ne doit jamais dépendre de la seule navigation).
 */
export default async function CommunicationsLayout({ children }: { children: ReactNode }) {
  const session = await requireCrmSession("/crm/communications");
  const canConfigure = hasAnyRole(session.roles, ["administrateur", "manager"]);

  const sections: StudioSection[] = [
    { href: "/crm/communications", label: "Vue d’ensemble", icon: "◈" },
    ...(canConfigure
      ? [
          { href: "/crm/communications/modeles", label: "Modèles", icon: "✎" },
          { href: "/crm/communications/automatisations", label: "Automatisations", icon: "⚙" },
          { href: "/crm/communications/simulateur", label: "Simulateur", icon: "▷" },
        ]
      : []),
    { href: "/crm/communications/oppositions", label: "Oppositions", icon: "⦸" },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <header className="min-w-0">
        <p className="crm-eyebrow">Communications</p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--crm-text)]">
          Studio Communications &amp; Workflows
        </h1>
        <p className="crm-wrap mt-1 max-w-3xl text-sm text-[var(--crm-text-dim)]">
          Prodigio OS reste la <strong>source de vérité</strong> : contacts, choix enregistrés,
          modèles, historique et audit. Lumail et Twilio ne seront que des infrastructures de
          transport, remplaçables sans toucher aux dossiers.
        </p>
        <p className="crm-wrap mt-1 max-w-3xl text-[12px] text-[var(--crm-text-faint)]">
          {RGPD_STATEMENT}
        </p>
      </header>

      <StudioNav sections={sections} />

      {children}
    </div>
  );
}
