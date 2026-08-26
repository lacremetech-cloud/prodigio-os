import { Reveal } from "@/components/ui/reveal";
import { SectionLabel } from "./section-label";
import { systeme } from "./copy";

/**
 * Système Prodigio™ — six étapes, comprises en quelques secondes.
 *
 * Délibérément PAS un diagramme : une séquence numérotée reliée par un filet
 * continu, qui se lit d'un seul regard sur ordinateur et se déroule verticalement
 * sur mobile. Pas de défilement horizontal capturé, pas de cartes, pas d'icônes.
 */
export function SystemeSection() {
  return (
    <section className="bg-ivory px-5 py-24 text-wood-black sm:px-10 sm:py-32 lg:px-14">
      <div className="mx-auto max-w-[88rem]">
        <Reveal>
          <SectionLabel>{systeme.eyebrow}</SectionLabel>
        </Reveal>
        <Reveal variant="rise" delayMs={70}>
          <h2 className="mt-8 max-w-[18ch] text-balance text-[2rem] leading-[1.08] sm:text-4xl lg:max-w-[24ch] lg:text-[3.4rem]">
            {systeme.title}
          </h2>
        </Reveal>

        {/* Le filet continu matérialise la séquence : une seule ligne, six temps. */}
        <ol className="relative mt-16 grid gap-10 border-border sm:grid-cols-2 lg:grid-cols-6 lg:gap-6 lg:border-t lg:pt-10">
          {systeme.phases.map((phase, i) => (
            <Reveal as="li" key={phase.n} variant="rise" delayMs={i * 80} className="relative">
              {/* Repère sur le filet (ordinateur uniquement). */}
              <span
                aria-hidden="true"
                className="absolute -top-[2.6rem] left-0 hidden size-1.5 rounded-full bg-[color:var(--color-gold)] lg:block"
              />
              <span className="font-signature text-[0.72rem] font-semibold tracking-[0.22em] text-[color:var(--color-gold)]">
                {phase.n}
              </span>
              <h3 className="mt-3 font-display text-2xl leading-tight text-wood-black">
                {phase.title}
              </h3>
              <p className="mt-2 text-pretty text-[0.95rem] leading-relaxed text-text-secondary">
                {phase.text}
              </p>
            </Reveal>
          ))}
        </ol>

        {/* L'aboutissement — deux mots, en grand. */}
        <Reveal variant="rise" delayMs={120}>
          <p className="mt-20 flex flex-wrap items-baseline gap-x-6 gap-y-2 border-t border-border pt-12 font-display text-[1.8rem] leading-[1.1] sm:text-4xl lg:text-[3rem]">
            <span className="text-text-secondary">{systeme.resultatA}</span>
            <span aria-hidden="true" className="text-[color:var(--color-gold)]">
              →
            </span>
            <span className="text-wood-black">{systeme.resultatB}</span>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
