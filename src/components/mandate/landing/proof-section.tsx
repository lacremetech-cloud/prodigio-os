import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "./section-heading";
import { landing } from "@/modules/mandates/funnel";

/**
 * La preuve : un cas réel (chalet ~1,6 M€), chiffres exacts, sans promesse ni
 * garantie de résultat. Le disclaimer est explicite.
 */
export function ProofSection() {
  const { proof } = landing;

  return (
    <section className="bg-ivory px-6 py-20 sm:px-10 sm:py-28 lg:px-16">
      <div className="mx-auto max-w-6xl">
        <SectionHeading kicker={proof.kicker} title={proof.title} />
        <p className="mt-6 max-w-2xl text-pretty leading-relaxed text-text-secondary">
          {proof.context}
        </p>

        <dl className="mt-14 grid grid-cols-2 gap-px overflow-hidden border border-border bg-border md:grid-cols-5">
          {proof.stats.map((stat, index) => (
            <Reveal
              key={stat.label}
              className="bg-surface p-7 sm:p-8"
              delayMs={index * 70}
            >
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
          {proof.disclaimer}
        </p>
      </div>
    </section>
  );
}
