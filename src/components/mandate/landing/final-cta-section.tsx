import { LandingCta } from "@/components/ui/landing-cta";
import { Reveal } from "@/components/ui/reveal";
import { ANALYSE_ROUTE } from "@/lib/routes";
import { CTA_PRIMARY, CTA_SUB, finalCta } from "./copy";

/**
 * Fin plein écran — reprend tout l'écran, grande question et **CTA immense**
 * (quasi pleine largeur). Noir profond, grain, lueur dorée. Un seul geste.
 */
export function FinalCtaSection() {
  return (
    <section className="grain relative isolate flex min-h-[88vh] flex-col items-center justify-center overflow-hidden bg-onyx px-6 py-28 text-ivory lg:px-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(60% 65% at 50% 50%, rgba(203,180,136,0.16) 0%, rgba(12,12,14,0) 70%)",
        }}
      />
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center text-center">
        <Reveal>
          <p className="eyebrow text-gold-soft">{finalCta.eyebrow}</p>
        </Reveal>
        <Reveal variant="rise" delayMs={90}>
          <h2 className="mt-8 max-w-3xl text-balance text-4xl leading-[1.05] text-ivory sm:text-5xl md:text-6xl lg:text-[4.25rem]">
            {finalCta.title}
          </h2>
        </Reveal>
        <Reveal delayMs={220} className="mt-12 flex w-full flex-col items-center gap-4">
          <LandingCta
            href={ANALYSE_ROUTE}
            tone="gold"
            size="xl"
            className="w-full max-w-2xl"
          >
            {CTA_PRIMARY}
          </LandingCta>
          <p className="text-sm tracking-wide text-ivory/70">{CTA_SUB}</p>
        </Reveal>
      </div>
    </section>
  );
}
