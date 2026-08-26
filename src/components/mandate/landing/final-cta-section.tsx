import { LandingCta } from "@/components/ui/landing-cta";
import { Reveal } from "@/components/ui/reveal";
import { ANALYSE_ROUTE } from "@/lib/routes";
import { CTA_PRIMARY, MICROCOPY, finalCta } from "./copy";

/**
 * Fin de page — un seul geste possible.
 *
 * Noir plein, aucune image, aucune lueur : après une page dense en visuels, le
 * silence fait le contraste. Composition alignée à gauche, cohérente avec le
 * masthead de la hero — la page se referme comme elle s'est ouverte.
 */
export function FinalCtaSection() {
  return (
    <section className="flex min-h-[85vh] items-center bg-onyx px-5 py-28 text-ivory sm:px-10 lg:px-14">
      <div className="mx-auto w-full max-w-[88rem]">
        <Reveal variant="rise">
          <h2 className="max-w-[14ch] text-balance text-[2.4rem] leading-[1.02] text-ivory sm:text-6xl lg:max-w-[16ch] lg:text-[5.2rem]">
            {finalCta.title}
          </h2>
        </Reveal>
        <Reveal delayMs={140}>
          <p className="mt-8 max-w-[26ch] text-pretty text-lg leading-relaxed text-text-on-dark-muted sm:text-xl">
            {finalCta.subtitle}
          </p>
        </Reveal>
        <Reveal delayMs={240} className="mt-12 flex flex-col items-start gap-3">
          <LandingCta
            href={ANALYSE_ROUTE}
            tone="contrast"
            size="xl"
            className="w-full sm:w-auto"
          >
            {CTA_PRIMARY}
          </LandingCta>
          <p className="text-[0.85rem] text-ivory/65">{MICROCOPY}</p>
        </Reveal>
      </div>
    </section>
  );
}
