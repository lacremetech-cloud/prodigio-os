import { Reveal } from "@/components/ui/reveal";
import { systeme } from "./copy";

/**
 * Le système, en six temps.
 *
 * Six lignes, pas six pavés : chaque étape tient en trois mots. La progression
 * se lit d'un coup d'œil, comme une partition.
 */
export function SystemSection() {
  return (
    <section
      aria-label="Le Système Prodigio, étape par étape"
      className="grain relative bg-onyx px-6 py-20 text-ivory sm:px-10 sm:py-28 lg:px-16"
    >
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <p className="eyebrow text-gold-soft">{systeme.eyebrow}</p>
        </Reveal>
        <Reveal variant="rise" delayMs={70}>
          <h2 className="mt-6 max-w-3xl text-balance text-3xl leading-[1.14] text-ivory sm:text-4xl lg:text-[2.75rem]">
            {systeme.title}
          </h2>
        </Reveal>

        <ol className="mt-16 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {systeme.phases.map((phase, i) => (
            <Reveal as="li" key={phase.n} variant="rise" delayMs={i * 80}>
              <span
                aria-hidden="true"
                className="block h-px w-full bg-[color:var(--color-gold-soft)]/40"
              />
              <span className="mt-5 block font-signature text-xs tracking-[0.28em] text-gold-soft">
                {phase.n}
              </span>
              <h3 className="mt-3 text-2xl text-ivory">{phase.title}</h3>
              {phase.text ? (
                <p className="mt-2 leading-relaxed text-text-on-dark-muted">{phase.text}</p>
              ) : null}
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
