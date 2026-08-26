import { Reveal } from "@/components/ui/reveal";
import { marcheInvisible } from "./copy";

/**
 * Le marché invisible.
 *
 * La section la plus courte de la page, et la seule qui ne démontre rien : elle
 * installe une question que le propriétaire ne s'était pas posée. Beaucoup de
 * noir, quatre mots isolés, une phrase. La démonstration vient juste après.
 */
export function MarcheInvisibleSection() {
  return (
    <section className="grain relative isolate overflow-hidden bg-onyx px-6 py-20 text-ivory sm:px-10 sm:py-28 lg:px-16">
      <div className="mx-auto max-w-4xl">
        <Reveal>
          <p className="eyebrow text-gold-soft">{marcheInvisible.eyebrow}</p>
        </Reveal>

        <Reveal variant="rise" delayMs={70}>
          <h2 className="mt-8 text-balance font-display text-[2rem] leading-[1.14] text-ivory sm:text-4xl lg:text-[3rem]">
            {marcheInvisible.title}
          </h2>
        </Reveal>

        {/* Les quatre conditions déjà réunies — une par ligne, sans commentaire. */}
        <ul className="mt-12 space-y-1.5">
          {marcheInvisible.traits.map((trait, i) => (
            <Reveal as="li" key={trait} delayMs={i * 90}>
              <span className="font-display text-2xl text-ivory/70 sm:text-3xl">
                {trait}
              </span>
            </Reveal>
          ))}
        </ul>

        <Reveal delayMs={200}>
          <p className="mt-12 max-w-xl text-pretty text-lg leading-relaxed text-text-on-dark-muted">
            {marcheInvisible.body}
          </p>
        </Reveal>

        <Reveal variant="rise" delayMs={280}>
          <p className="mt-14 max-w-2xl text-balance font-display text-[1.9rem] leading-[1.16] text-gold-soft sm:text-4xl lg:text-[2.75rem]">
            {marcheInvisible.statement}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
