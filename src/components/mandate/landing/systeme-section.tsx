import { Reveal } from "@/components/ui/reveal";
import { SectionMarker } from "./section-marker";
import { systeme } from "./copy";

/**
 * Section 02 — Le Système Prodigio, en quatre phases (Comprendre, Concevoir,
 * Produire, Acquérir). Fond noir profond, numérotation romaine dorée, ligne de
 * progression, apparition en cascade.
 */
export function SystemeSection() {
  return (
    <section className="bg-onyx px-6 py-24 text-ivory sm:px-10 sm:py-32 lg:px-16">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <SectionMarker index={systeme.index} label={systeme.kicker} tone="light" />
          <h2 className="mt-7 max-w-3xl text-balance text-3xl leading-[1.16] text-ivory sm:text-4xl lg:text-[2.75rem]">
            {systeme.titleLine1}
            <br />
            <span className="text-gold-soft">{systeme.titleLine2}</span>
          </h2>
        </Reveal>

        {/* Ligne de progression + phases */}
        <ol className="mt-16 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {systeme.phases.map((phase, i) => (
            <Reveal
              as="li"
              key={phase.n}
              variant="rise"
              delayMs={i * 120}
              className="group relative border-t border-border-strong-dark pt-7"
            >
              {/* Point de jalon sur la ligne */}
              <span
                aria-hidden="true"
                className="absolute -top-[3px] left-0 h-1.5 w-1.5 rounded-full bg-gold-soft transition-transform duration-300 group-hover:scale-150"
              />
              <span className="font-display text-4xl text-gold-soft sm:text-5xl">
                {phase.n}
              </span>
              <p className="mt-5 font-signature text-[0.66rem] uppercase tracking-[0.24em] text-text-on-dark-muted">
                {phase.lead}
              </p>
              <h3 className="mt-2 text-xl text-ivory sm:text-2xl">{phase.title}</h3>
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
