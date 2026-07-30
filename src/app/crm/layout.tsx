import type { Metadata } from "next";
import "./crm.css";
import { requireCrmSession } from "@/modules/crm/auth/session";
import { CrmShell } from "@/components/crm/shell/crm-shell";

export const metadata: Metadata = {
  title: { default: "CRM Mandats", template: "%s — CRM Prodigio" },
  robots: { index: false, follow: false },
};

/**
 * Layout du CRM interne. `requireCrmSession()` vérifie **côté serveur** que
 * l’utilisateur est authentifié ET dispose d’un membership actif — sinon
 * redirection vers `/connexion`. Défense en profondeur avec le middleware.
 */
export default async function CrmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireCrmSession();
  return (
    <CrmShell email={session.email} roles={session.roles}>
      {children}
    </CrmShell>
  );
}
