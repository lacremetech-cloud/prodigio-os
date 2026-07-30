import { LandingCta } from "@/components/ui/landing-cta";
import { Reveal } from "@/components/ui/reveal";
import { ANALYSE_ROUTE } from "@/lib/routes";
import { CTA_PRIMARY, MICROCOPY, finalCta } from "./copy";

/**
 * Dernier appel à l'action, sur noir profond avec grain et lueur dorée —
 * clôture éditoriale avant le pied de page. Un seul geste attendu.
 */
export function FinalCtaSection() {
  return (
    <section className="grain relative isolate overflow-hidden bg-onyx px-6 py-32 text-ivory sm:py-40 lg:px-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(55% 60% at 50% 50%, rgba(203,180,136,0.14) 0%, rgba(12,12,14,0) 70%)",
        }}
      />
      <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <Reveal>
          <p className="eyebrow text-gold-soft">{finalCta.eyebrow}</p>
        </Reveal>
        <Reveal variant="rise" delayMs={90}>
          <h2 className="mt-6 max-w-2xl text-balance text-3xl leading-[1.12] text-ivory sm:text-4xl md:text-[3rem]">
            {finalCta.title}
          </h2>
        </Reveal>
        <Reveal delayMs={200}>
          <p className="mt-6 max-w-xl text-pretty leading-relaxed text-ivory/80">
            {finalCta.text}
          </p>
        </Reveal>
        <Reveal delayMs={300} className="mt-11 flex flex-col items-center gap-4">
          <LandingCta href={ANALYSE_ROUTE} tone="gold" size="xl">
            {CTA_PRIMARY}
          </LandingCta>
          <p className="text-sm text-ivory/70">{MICROCOPY}</p>
        </Reveal>
      </div>
    </section>
  );
}
