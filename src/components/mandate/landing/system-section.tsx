import { Reveal } from "@/components/ui/reveal";
import { SectionMarker } from "./section-marker";
import { systeme } from "./copy";

/**
 * Section 02 — Le Système Prodigio, **en un seul écran**.
 *
 * L'ancienne version épinglait la section sur quatre hauteurs d'écran
 * (3 600 px, un tiers de la page) pour quatre phrases, sans aucun appel à
 * l'action pendant tout ce défilement. Les quatre phases tiennent désormais
 * côte à côte : même contenu, un douzième du défilement.
 */
export function SystemSection() {
  return (
    <section
      aria-label="Le Système Prodigio en quatre phases"
      className="grain relative bg-onyx px-6 py-24 text-ivory sm:px-10 sm:py-32 lg:px-16"
    >
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <SectionMarker index={systeme.index} label={systeme.kicker} tone="light" />
        </Reveal>
        <Reveal variant="rise" delayMs={80}>
          <h2 className="mt-7 max-w-3xl text-balance text-3xl leading-[1.14] text-ivory sm:text-4xl lg:text-[2.75rem]">
            {systeme.titleLine1}{" "}
            <span className="text-gold-soft">{systeme.titleLine2}</span>
          </h2>
        </Reveal>
        <Reveal delayMs={160}>
          <p className="mt-7 max-w-xl text-pretty text-lg leading-relaxed text-text-on-dark-muted">
            {systeme.lead}
          </p>
        </Reveal>

        <ol className="mt-14 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {systeme.phases.map((phase, i) => (
            <Reveal as="li" key={phase.n} variant="rise" delayMs={i * 90}>
              <span
                aria-hidden="true"
                className="block h-px w-full bg-[color:var(--color-gold-soft)]/40"
              />
              <span className="mt-6 block font-display text-4xl text-gold-soft">
                {phase.n}
              </span>
              <p className="mt-4 font-signature text-[0.66rem] uppercase tracking-[0.24em] text-text-on-dark-muted">
                {phase.lead}
              </p>
              <h3 className="mt-2 text-2xl text-ivory">{phase.title}</h3>
              <p className="mt-4 text-pretty leading-relaxed text-text-on-dark-muted">
                {phase.text}
              </p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
