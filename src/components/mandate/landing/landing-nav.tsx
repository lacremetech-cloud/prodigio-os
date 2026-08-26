import { LandingCta } from "@/components/ui/landing-cta";
import { ProdigioLogo } from "@/components/ui/prodigio-logo";
import { ANALYSE_ROUTE } from "@/lib/routes";
import { CTA_NAV } from "./copy";

/**
 * Navigation en surimpression sur la hero : logo à gauche, action discrète à
 * droite. Le CTA n'apparaît qu'à partir de `sm` — sur mobile, il ferait doublon
 * avec le CTA de la hero et le CTA collant en bas d'écran.
 */
export function LandingNav() {
  return (
    <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-3 px-5 pt-6 sm:px-10 sm:pt-8 lg:px-14">
      <ProdigioLogo priority />
      <div className="hidden sm:block">
        <LandingCta
          href={ANALYSE_ROUTE}
          tone="ghost-dark"
          size="lg"
          className="!min-h-[2.75rem] !px-5 !py-2.5 text-[0.82rem]"
        >
          {CTA_NAV}
        </LandingCta>
      </div>
    </header>
  );
}
