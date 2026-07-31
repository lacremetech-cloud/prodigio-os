import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./crm.css";
import { requireCrmSession } from "@/modules/crm/auth/session";
import { CrmShell } from "@/components/crm/shell/crm-shell";
import { normalizePreference, THEME_COOKIE } from "@/components/crm/theme/theme";

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
  const cookieStore = await cookies();
  const themePreference = normalizePreference(cookieStore.get(THEME_COOKIE)?.value);
  return (
    <CrmShell email={session.email} roles={session.roles} themePreference={themePreference}>
      {children}
    </CrmShell>
  );
}
