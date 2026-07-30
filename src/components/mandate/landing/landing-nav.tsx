import Link from "next/link";
import { LandingCta } from "@/components/ui/landing-cta";
import { ANALYSE_ROUTE } from "@/lib/routes";
import { hero, CTA_NAV } from "./copy";

/**
 * Navigation très discrète en surimpression sur la hero sombre : signature
 * Prodigio à gauche, CTA d'éligibilité à droite (bouton net, reflet au survol).
 */
export function LandingNav() {
  return (
    <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-6 pt-6 sm:px-10 sm:pt-8 lg:px-16">
      <Link href="/proprietaire" className="group flex flex-col leading-none">
        <span className="font-signature text-sm font-semibold tracking-[0.3em] text-ivory">
          {hero.brand}
        </span>
        <span className="mt-1 font-signature text-[0.62rem] uppercase tracking-[0.28em] text-ivory/70">
          {hero.tagline}
        </span>
      </Link>
      <LandingCta
        href={ANALYSE_ROUTE}
        tone="ghost-dark"
        size="lg"
        className="!min-h-[2.9rem] !px-6 !py-3 text-xs sm:text-sm"
      >
        {CTA_NAV}
      </LandingCta>
    </header>
  );
}
