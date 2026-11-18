import { Reveal } from "@/components/ui/reveal";
import { systeme } from "./copy";

/**
 * Le Système, en six temps.
 *
 * Une **séquence**, pas un ensemble : les six temps descendent le long d'un
 * rail, et chacun s'allume à son arrivée à l'écran — le point passe à l'or, le
 * titre reprend sa pleine densité. C'est ce qui fait ressembler la méthode à
 * une méthode plutôt qu'à une liste de services.
 *
 * Aucun observateur supplémentaire n'est monté : l'allumage se greffe sur
 * l'état que `Reveal` pose déjà (voir `.step-dot` / `.step-title` dans
 * `globals.css`). Trois mots par étape, jamais plus.
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

        {/* Le rail : une ligne continue derrière les points, qui fait de la
            liste une progression. */}
        <ol className="relative mt-16 max-w-3xl pl-8 sm:pl-10">
          <span
            aria-hidden="true"
            className="absolute bottom-3 left-[3px] top-3 w-px bg-gradient-to-b from-[color:var(--color-gold-soft)]/45 via-[color:var(--color-gold-soft)]/25 to-transparent sm:left-[5px]"
          />

          {systeme.phases.map((phase) => (
            <Reveal
              as="li"
              key={phase.n}
              className="relative py-5 first:pt-0 last:pb-0 sm:py-6"
            >
              <span
                aria-hidden="true"
                className="step-dot absolute -left-8 top-[0.95rem] block size-[7px] rounded-full sm:-left-10 sm:size-[11px]"
              />
              <div className="step-title flex flex-wrap items-baseline gap-x-5 gap-y-1">
                <span className="font-signature text-[0.68rem] tracking-[0.28em] text-gold-soft">
                  {phase.n}
                </span>
                <h3 className="font-display text-2xl leading-none text-ivory sm:text-3xl">
                  {phase.title}
                </h3>
                {phase.text ? (
                  <p className="text-sm leading-snug text-text-on-dark-muted">
                    {phase.text}
                  </p>
                ) : null}
              </div>
            </Reveal>
          ))}
        </ol>

        {/* Ce à quoi la séquence aboutit. Deux mots, pas une promesse. */}
        <Reveal variant="rise" delayMs={80}>
          <p className="mt-16 flex flex-wrap items-baseline gap-x-5 gap-y-2 pl-8 font-display sm:pl-10">
            <span className="text-2xl text-ivory sm:text-3xl">{systeme.outcome.from}</span>
            <span aria-hidden="true" className="text-xl text-gold-soft/60">
              →
            </span>
            <span className="text-3xl text-gold-soft sm:text-5xl">{systeme.outcome.to}</span>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
