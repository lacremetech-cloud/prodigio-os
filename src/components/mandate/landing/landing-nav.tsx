import { LandingCta } from "@/components/ui/landing-cta";
import { ProdigioLogo } from "@/components/ui/prodigio-logo";
import { ANALYSE_ROUTE } from "@/lib/routes";
import { CTA_NAV } from "./copy";

/**
 * Navigation en surimpression sur la hero : logo à gauche, action à droite.
 *
 * Le bouton d'en-tête est **plein doré**, comme tous les autres appels à
 * l'action de la page : un contour transparent ne se lit pas comme un bouton et
 * n'invitait pas au clic.
 *
 * Il n'apparaît qu'à partir de `sm` : sur mobile, il ferait doublon avec le CTA
 * de la hero et le CTA collant en bas d'écran.
 */
export function LandingNav() {
  return (
    <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-3 px-5 pt-5 sm:px-10 sm:pt-8 lg:px-16">
      <ProdigioLogo priority />
      <div className="hidden sm:block">
        <LandingCta
          href={ANALYSE_ROUTE}
          tone="gold"
          size="lg"
          className="!min-h-[2.9rem] !px-6 !py-3 text-sm"
        >
          {CTA_NAV}
        </LandingCta>
      </div>
    </header>
  );
}
