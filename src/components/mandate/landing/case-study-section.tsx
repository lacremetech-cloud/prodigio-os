import { CountUp } from "@/components/ui/count-up";
import { Reveal } from "@/components/ui/reveal";
import { SectionLabel } from "./section-label";
import { caseStudy } from "./copy";

/**
 * Étude de cas Font-Romeu — révélation progressive.
 *
 * Les paliers apparaissent l'un après l'autre au défilement (décalage court : on
 * ne fait jamais attendre le visiteur), et « 1 vente » est le point d'arrivée,
 * seul, en très grand. Aucune promesse : le cas est présenté comme une preuve,
 * pas comme une garantie — le disclaimer reste attaché aux chiffres.
 */
export function CaseStudySection() {
  return (
    <section className="bg-onyx px-5 py-24 text-ivory sm:px-10 sm:py-32 lg:px-14">
      <div className="mx-auto max-w-[88rem]">
        <Reveal>
          <SectionLabel tone="dark">{caseStudy.eyebrow}</SectionLabel>
        </Reveal>
        <Reveal variant="rise" delayMs={70}>
          <h2 className="mt-8 max-w-[16ch] text-balance text-[2.1rem] leading-[1.06] text-ivory sm:text-5xl lg:max-w-[22ch] lg:text-[4rem]">
            {caseStudy.title}
          </h2>
        </Reveal>

        <Reveal variant="rise" delayMs={140}>
          <p className="mt-16 flex items-baseline gap-4">
            <CountUp
              value={caseStudy.duree.value}
              className="font-display text-6xl leading-none text-ivory sm:text-7xl"
            />
            <span className="font-signature text-[0.78rem] uppercase tracking-[0.22em] text-text-on-dark-muted">
              {caseStudy.duree.label}
            </span>
          </p>
        </Reveal>

        {/* L'entonnoir : chaque palier se dévoile à son tour. */}
        <ol className="mt-14 divide-y divide-border-dark border-y border-border-dark">
          {caseStudy.stats.map((stat, i) => (
            <Reveal
              as="li"
              key={stat.label}
              variant="rise"
              delayMs={i * 110}
              className="flex flex-col gap-2 py-7 sm:flex-row sm:items-baseline sm:gap-10"
            >
              <CountUp
                value={stat.value}
                className="w-full shrink-0 font-display text-4xl leading-none tabular-nums text-ivory sm:w-40 sm:text-5xl"
              />
              <span className="text-pretty leading-relaxed text-text-on-dark-muted">
                {stat.label}
              </span>
            </Reveal>
          ))}
        </ol>

        {/* Le climax — un seul chiffre, tout l'espace. */}
        <Reveal variant="rise" delayMs={160}>
          <p className="mt-20 flex flex-wrap items-baseline gap-x-8 gap-y-2">
            <CountUp
              value={caseStudy.climax.value}
              className="font-display text-[5.5rem] leading-[0.9] text-gold-soft sm:text-[9rem] lg:text-[12rem]"
            />
            <span className="font-display text-3xl text-ivory sm:text-5xl lg:text-6xl">
              {caseStudy.climax.label}
            </span>
          </p>
        </Reveal>

        <Reveal delayMs={220}>
          <p className="mt-14 max-w-[24ch] text-balance font-display text-xl leading-snug text-ivory sm:text-2xl lg:max-w-[30ch] lg:text-3xl">
            {caseStudy.statement}
          </p>
          <p className="mt-10 max-w-2xl text-[0.82rem] leading-relaxed text-text-on-dark-muted">
            {caseStudy.disclaimer}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
