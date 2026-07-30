import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/crm/login-form";

export const metadata: Metadata = {
  title: "Connexion",
  robots: { index: false, follow: false },
};

/**
 * Page de connexion interne (`/connexion`). Design sombre et premium, cohérent
 * avec l’univers Prodigio. La protection réelle des routes `/crm/*` est assurée
 * par le middleware + les Server Components (autorisation côté serveur).
 */
export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string }>;
}) {
  const params = await searchParams;
  const redirectTo =
    typeof params.redirect === "string" && params.redirect.startsWith("/crm")
      ? params.redirect
      : "/crm";
  const accessError = params.error === "acces";

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[var(--color-onyx)] px-6 py-16 text-[var(--color-text-on-dark)]">
      <div className="w-full max-w-[420px]">
        <div className="mb-10 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-gold-soft)]">
            Prodigio OS
          </p>
          <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-semibold text-[var(--color-text-on-dark)]">
            CRM Mandats
          </h1>
          <p className="mt-3 text-sm text-[var(--color-text-on-dark-muted)]">
            Espace interne réservé à l’équipe Prodigio.
          </p>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-dark)] bg-[#101015] p-8 shadow-[var(--shadow-lg)]">
          <LoginForm redirectTo={redirectTo} accessError={accessError} />
        </div>

        <p className="mt-8 text-center text-xs text-[var(--color-text-on-dark-muted)]">
          <Link href="/" className="underline-offset-4 hover:underline">
            Retour au site public
          </Link>
        </p>
      </div>
    </main>
  );
}
