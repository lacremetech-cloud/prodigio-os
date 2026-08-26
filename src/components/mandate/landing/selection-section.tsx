import { LandingCta } from "@/components/ui/landing-cta";
import { Reveal } from "@/components/ui/reveal";
import { ANALYSE_ROUTE } from "@/lib/routes";
import { CTA_PRIMARY, MICROCOPY, selection } from "./copy";

/**
 * Sélectivité — la montée en gamme juste avant le dernier geste.
 *
 * La posture n'est pas « confiez-nous votre mandat » mais « vérifions si votre
 * propriété entre dans le système ». C'est ce renversement qui rend le clic
 * désirable.
 */
export function SelectionSection() {
  return (
    <section className="grain relative isolate overflow-hidden bg-onyx px-6 py-24 text-ivory sm:px-10 sm:py-32 lg:px-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(50% 50% at 50% 40%, rgba(203,180,136,0.12) 0%, rgba(12,12,14,0) 70%)",
        }}
      />
      <div className="mx-auto max-w-3xl text-center">
        <Reveal>
          <p className="eyebrow text-gold-soft">{selection.eyebrow}</p>
        </Reveal>
        <Reveal variant="rise" delayMs={80}>
          <h2 className="mt-8 text-balance font-display text-3xl leading-[1.1] text-ivory sm:text-4xl md:text-[2.9rem]">
            {selection.title}
          </h2>
        </Reveal>
        <Reveal variant="rise" delayMs={220}>
          <p className="mt-3 font-display text-3xl leading-[1.1] text-gold-soft sm:text-4xl md:text-[2.9rem]">
            {selection.emphasis}
          </p>
        </Reveal>

        <Reveal delayMs={300}>
          <p className="mx-auto mt-10 max-w-xl text-pretty leading-relaxed text-text-on-dark-muted">
            {selection.body}
          </p>
        </Reveal>

        <Reveal delayMs={360}>
          <ul className="mt-12 flex flex-wrap justify-center gap-x-12 gap-y-4">
            {selection.criteria.map((c) => (
              <li key={c} className="font-display text-2xl text-ivory/90 sm:text-3xl">
                {c}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delayMs={420} className="mt-14 flex flex-col items-center gap-4">
          <div className="relative w-full max-w-xl">
            <span
              aria-hidden="true"
              className="animate-glow pointer-events-none absolute -inset-4 -z-10 rounded-full bg-[radial-gradient(60%_60%_at_50%_50%,rgba(203,180,136,0.5)_0%,rgba(203,180,136,0)_70%)] blur-xl"
            />
            <LandingCta href={ANALYSE_ROUTE} tone="gold" size="xl" className="w-full">
              {CTA_PRIMARY}
            </LandingCta>
          </div>
          <p className="text-sm tracking-wide text-ivory/75">{MICROCOPY}</p>
        </Reveal>
      </div>
    </section>
  );
}
