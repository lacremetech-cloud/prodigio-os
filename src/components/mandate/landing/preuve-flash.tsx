import { CountUp } from "@/components/ui/count-up";
import { Reveal } from "@/components/ui/reveal";
import { SectionLabel } from "./section-label";
import { preuveFlash } from "./copy";

/**
 * Preuve immédiate — bandeau court, juste après la hero.
 *
 * Elle ne raconte rien : elle pose des chiffres et laisse la question « comment
 * ont-ils fait ? » s'installer. Volontairement horizontale et compacte, pour
 * contraster avec la hauteur de la hero et ne surtout pas ressembler à une
 * énième section « titre + paragraphe ».
 */
export function PreuveFlash() {
  return (
    <section className="border-b border-border-dark bg-onyx px-5 py-16 text-ivory sm:px-10 sm:py-20 lg:px-14">
      <div className="mx-auto max-w-[88rem]">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
          <Reveal className="lg:shrink-0">
            <SectionLabel tone="dark">{preuveFlash.eyebrow}</SectionLabel>
            <p className="mt-5 max-w-[14ch] text-balance font-display text-3xl leading-[1.08] text-ivory sm:text-4xl lg:text-5xl">
              {preuveFlash.title}
            </p>
          </Reveal>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4 lg:flex-1 lg:gap-x-10">
            {preuveFlash.stats.map((stat, i) => (
              <Reveal
                as="div"
                key={stat.label}
                variant="rise"
                delayMs={i * 90}
                className="flex flex-col-reverse"
              >
                {/* Ordre du DOM : terme puis valeur (correct pour une liste de
                    définitions) ; ordre visuel inversé — le chiffre d'abord. */}
                <dt className="mt-3 text-[0.82rem] leading-snug text-text-on-dark-muted">
                  {stat.label}
                </dt>
                <dd>
                  <CountUp
                    value={stat.value}
                    className="block font-display text-4xl leading-none text-ivory sm:text-5xl"
                  />
                </dd>
              </Reveal>
            ))}
          </dl>
        </div>

        <Reveal delayMs={220}>
          <p className="mt-10 font-signature text-[0.72rem] uppercase tracking-[0.18em] text-ivory/45">
            {preuveFlash.microcopy}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
