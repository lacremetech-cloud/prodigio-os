import { CountUp } from "@/components/ui/count-up";
import { Reveal } from "@/components/ui/reveal";
import { proofStrip } from "./copy";

/**
 * Preuve immédiate — la première chose que voit le visiteur après le film.
 * Quatre nombres, un intitulé, une note. Comprise en trois secondes.
 */
export function ProofStripSection() {
  return (
    <section className="bg-onyx px-6 py-16 text-ivory sm:px-10 sm:py-20 lg:px-16">
      <div className="mx-auto max-w-5xl text-center">
        <Reveal>
          <p className="eyebrow text-gold-soft">{proofStrip.eyebrow}</p>
        </Reveal>
        <Reveal variant="rise" delayMs={70}>
          <h2 className="mt-5 text-balance text-3xl leading-[1.12] text-ivory sm:text-4xl lg:text-[2.6rem]">
            {proofStrip.title}
          </h2>
        </Reveal>

        <ol className="mt-14 grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4">
          {proofStrip.stats.map((stat, i) => {
            const isLast = i === proofStrip.stats.length - 1;
            return (
              <Reveal as="li" key={stat.label} variant="rise" delayMs={i * 110}>
                <CountUp
                  value={stat.value}
                  className={`block font-display text-5xl leading-none sm:text-6xl lg:text-7xl ${
                    isLast ? "text-gold-soft" : "text-ivory"
                  }`}
                />
                <span className="mt-3 block text-sm leading-snug text-text-on-dark-muted">
                  {stat.label}
                </span>
              </Reveal>
            );
          })}
        </ol>

        <Reveal delayMs={200}>
          <p className="mt-12 font-signature text-[0.66rem] uppercase tracking-[0.22em] text-text-on-dark-muted">
            {proofStrip.note}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
