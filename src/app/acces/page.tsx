import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCrmSession } from "@/modules/crm/auth/session";
import { hasCrmAccess } from "@/modules/crm/auth/roles";
import { signOutAction } from "@/modules/crm/auth/actions";

export const metadata: Metadata = {
  title: "Accès non autorisé",
  robots: { index: false, follow: false },
};

/**
 * Écran « Accès non autorisé » : utilisateur authentifié **sans** membership
 * active (jamais invité, invitation non acceptée, ou accès désactivé). Distinct
 * de `/connexion` pour éviter toute boucle de redirection avec le middleware.
 */
export default async function AccesPage() {
  const session = await getCrmSession();
  // Non connecté → vers la connexion. Déjà autorisé → vers le CRM.
  if (!session) redirect("/connexion");
  if (hasCrmAccess(session.roles)) redirect("/crm");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[var(--color-onyx)] px-6 py-16 text-[var(--color-text-on-dark)]">
      <div className="w-full max-w-[440px]">
        <div className="mb-8 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-gold-soft)]">
            Prodigio OS
          </p>
          <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-semibold">
            Accès non autorisé
          </h1>
        </div>
        <div className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--color-border-dark)] bg-[#101015] p-8 text-center shadow-[var(--shadow-lg)]">
          <p className="text-sm text-[var(--color-text-on-dark-muted)]">
            Votre compte{session.email ? ` (${session.email})` : ""} n’a pas d’accès actif au CRM
            Prodigio. Si vous venez de recevoir une invitation, ouvrez le lien reçu par e-mail pour
            l’accepter. Si votre accès a été désactivé, contactez un administrateur.
          </p>
          <div className="flex flex-col items-center gap-3">
            <Link
              href="/invitation"
              className="text-sm text-[var(--color-gold-soft)] underline-offset-4 hover:underline"
            >
              J’ai une invitation à accepter
            </Link>
            <form action={signOutAction}>
              <button
                type="submit"
                className="text-sm text-[var(--color-text-on-dark-muted)] underline-offset-4 hover:underline"
              >
                Se déconnecter
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
