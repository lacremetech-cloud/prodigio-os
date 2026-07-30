import { LandingCta } from "@/components/ui/landing-cta";
import { ProdigioLogo } from "@/components/ui/prodigio-logo";
import { ANALYSE_ROUTE } from "@/lib/routes";
import { CTA_NAV, CTA_NAV_SHORT } from "./copy";

/**
 * Navigation très discrète en surimpression sur la hero sombre : logo Prodigio à
 * gauche, CTA d'éligibilité à droite. Le CTA est **compact sur mobile** (libellé
 * court, sans le monogramme superflu) pour ne pas encombrer l'écran ; il retrouve
 * sa taille et son libellé complet dès `sm`.
 */
export function LandingNav() {
  return (
    <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-3 px-5 pt-5 sm:px-10 sm:pt-8 lg:px-16">
      <ProdigioLogo priority />
      <LandingCta
        href={ANALYSE_ROUTE}
        tone="ghost-dark"
        size="lg"
        className="!min-h-[2.5rem] !gap-1.5 !px-3.5 !py-2 text-[0.72rem] tracking-normal sm:!min-h-[2.9rem] sm:!gap-3 sm:!px-6 sm:!py-3 sm:text-sm"
      >
        {/* Libellé court sur mobile, complet à partir de sm. */}
        <span className="sm:hidden">{CTA_NAV_SHORT}</span>
        <span className="hidden sm:inline">{CTA_NAV}</span>
      </LandingCta>
    </header>
  );
}
