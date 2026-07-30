import { LandingCta } from "@/components/ui/landing-cta";
import { ProdigioLogo } from "@/components/ui/prodigio-logo";
import { ANALYSE_ROUTE } from "@/lib/routes";
import { CTA_NAV } from "./copy";

/**
 * Navigation en surimpression sur la hero sombre : logo Prodigio à gauche.
 *
 * Le CTA d'en-tête n'apparaît qu'à partir de `sm` : sur mobile, il ferait
 * doublon avec le grand CTA de la hero et le CTA collant en bas d'écran — on
 * garde donc seulement le logo pour un en-tête épuré.
 */
export function LandingNav() {
  return (
    <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-3 px-5 pt-5 sm:px-10 sm:pt-8 lg:px-16">
      <ProdigioLogo priority />
      {/* CTA masqué sur mobile (doublon avec le CTA de la hero + le CTA collant).
          Enveloppé dans un conteneur pour piloter l'affichage sans entrer en
          conflit avec le `display` propre au bouton. */}
      <div className="hidden sm:block">
        <LandingCta
          href={ANALYSE_ROUTE}
          tone="ghost-dark"
          size="lg"
          className="!min-h-[2.9rem] !px-6 !py-3 text-sm"
        >
          {CTA_NAV}
        </LandingCta>
      </div>
    </header>
  );
}
