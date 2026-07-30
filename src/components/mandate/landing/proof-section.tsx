import { CountUp } from "@/components/ui/count-up";
import { Reveal } from "@/components/ui/reveal";
import { SectionMarker } from "./section-marker";
import { preuve } from "./copy";

/**
 * Section 04 — La preuve. Un cas réel présenté en **entonnoir** : les chiffres
 * s'animent (comptage de 0 à la valeur) au passage dans le viewport. Le dernier
 * palier (la vente) est mis en avant. Sans promesse ; disclaimer explicite.
 */
export function ProofSection() {
  const last = preuve.stats.length - 1;

  return (
    <section className="bg-onyx px-6 py-24 text-ivory sm:px-10 sm:py-32 lg:px-16">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <SectionMarker index={preuve.index} label={preuve.kicker} tone="light" />
          <h2 className="mt-7 max-w-2xl text-balance text-3xl leading-[1.14] text-ivory sm:text-4xl lg:text-[2.75rem]">
            {preuve.title}
          </h2>
          <p className="mt-6 max-w-xl text-pretty leading-relaxed text-text-on-dark-muted">
            {preuve.intro}
          </p>
        </Reveal>

        <ol className="mt-16 grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-5 md:gap-x-4">
          {preuve.stats.map((stat, i) => {
            const isLast = i === last;
            return (
              <Reveal
                as="li"
                key={stat.label}
                variant="rise"
                delayMs={i * 110}
                className="relative border-t pt-6"
              >
                {/* Ligne d'entonnoir : opacité décroissante */}
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-0 -top-px h-px ${isLast ? "bg-gold-soft" : "bg-border-strong-dark"}`}
                />
                <CountUp
                  value={stat.value}
                  suffix={stat.suffix}
                  className={`block font-display text-5xl leading-none sm:text-6xl ${isLast ? "text-gold-soft" : "text-ivory"}`}
                />
                <span className="mt-3 block text-sm leading-snug text-text-on-dark-muted">
                  {stat.label}
                </span>
              </Reveal>
            );
          })}
        </ol>

        <p className="mt-12 max-w-2xl text-sm leading-relaxed text-text-on-dark-muted">
          {preuve.disclaimer}
        </p>
      </div>
    </section>
  );
}
