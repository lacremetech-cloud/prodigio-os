import Link from "next/link";
import { ProdigioLogo } from "@/components/ui/prodigio-logo";
import { homeCopy } from "./home-copy";

/**
 * Navigation de la page d'accueil, en surimpression sur la hero sombre :
 * logo Prodigio à gauche, lien discret « Accès privé » à droite (→ /connexion).
 *
 * Volontairement minimale — aucune route interne (`/crm/*`) n'est exposée
 * publiquement. Le logo pointe vers l'accueil.
 */
export function HomeNav() {
  return (
    <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-3 px-5 pt-5 sm:px-10 sm:pt-8 lg:px-16">
      <ProdigioLogo href="/" priority />
      <Link
        href="/connexion"
        className="inline-flex items-center gap-2 rounded-full border border-ivory/25 px-4 py-2 font-signature text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-ivory/80 transition-colors duration-200 hover:border-ivory/60 hover:text-ivory focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus)] sm:text-[0.78rem]"
      >
        <span
          aria-hidden="true"
          className="size-1.5 rounded-full bg-gold-soft"
        />
        {homeCopy.nav.privateAccess}
      </Link>
    </header>
  );
}
