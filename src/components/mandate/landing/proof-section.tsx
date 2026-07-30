import { Reveal } from "@/components/ui/reveal";
import { SectionMarker } from "./section-marker";
import { preuve } from "./copy";

/**
 * Section 03 — La preuve. Un cas réel, chiffres exacts, présentés sans promesse.
 * Grille très visuelle ; disclaimer explicite.
 */
export function ProofSection() {
  return (
    <section className="bg-ivory px-6 py-24 text-wood-black sm:px-10 sm:py-32 lg:px-16">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <SectionMarker index={preuve.index} label={preuve.kicker} />
          <h2 className="mt-7 max-w-2xl text-balance text-3xl leading-[1.14] sm:text-4xl lg:text-[2.75rem]">
            {preuve.title}
          </h2>
        </Reveal>

        <dl className="mt-14 grid grid-cols-2 gap-px overflow-hidden border border-border bg-border md:grid-cols-5">
          {preuve.stats.map((stat, index) => (
            <Reveal key={stat.label} className="bg-surface p-7 sm:p-8" delayMs={index * 70}>
              <dt className="font-display text-5xl text-wood-black sm:text-6xl">
                {stat.value}
              </dt>
              <dd className="mt-3 text-sm leading-snug text-text-secondary">
                {stat.label}
              </dd>
            </Reveal>
          ))}
        </dl>

        <p className="mt-10 max-w-2xl text-sm leading-relaxed text-text-secondary">
          {preuve.disclaimer}
        </p>
      </div>
    </section>
  );
}
