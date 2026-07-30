import { Reveal } from "@/components/ui/reveal";
import { SectionMarker } from "./section-marker";
import { constat } from "./copy";

/**
 * Section 01 — Le constat. Colonne éditoriale + reconstitution volontairement
 * générique d'une « annonce standard » : elle montre comment un bien
 * d'exception se retrouve présenté comme n'importe quel autre.
 */
export function ConstatSection() {
  return (
    <section className="bg-ivory px-6 py-24 text-wood-black sm:px-10 sm:py-32 lg:px-16">
      <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2 lg:gap-20">
        <Reveal>
          <SectionMarker index={constat.index} label={constat.kicker} />
          <h2 className="mt-7 text-balance text-3xl leading-[1.14] sm:text-4xl lg:text-[2.75rem]">
            {constat.title}
          </h2>
          <p className="mt-7 max-w-xl text-pretty text-lg leading-relaxed text-text-secondary">
            {constat.body}
          </p>
        </Reveal>

        {/* Reconstitution d'une annonce standard (générique à dessein). */}
        <Reveal delayMs={120} className="lg:justify-self-end">
          <figure className="w-full max-w-md border border-border bg-surface shadow-[var(--shadow-md)]">
            <div
              aria-hidden="true"
              className="flex aspect-[4/3] items-center justify-center bg-ivory-muted"
            >
              <span className="font-signature text-xs uppercase tracking-[0.28em] text-text-secondary">
                Photographie
              </span>
            </div>
            <figcaption className="p-6">
              <div className="h-3 w-2/3 bg-ivory-muted" aria-hidden="true" />
              <div className="mt-3 h-2.5 w-full bg-ivory-muted" aria-hidden="true" />
              <div className="mt-2 h-2.5 w-5/6 bg-ivory-muted" aria-hidden="true" />
              <ul className="mt-5 flex flex-wrap gap-2">
                {constat.card.lines.map((line) => (
                  <li
                    key={line}
                    className="border border-border px-3 py-1 text-xs text-text-secondary"
                  >
                    {line}
                  </li>
                ))}
              </ul>
              <div
                aria-hidden="true"
                className="mt-6 flex h-11 items-center justify-center border border-border-strong text-xs uppercase tracking-[0.2em] text-text-secondary"
              >
                Contacter l&apos;agence
              </div>
            </figcaption>
          </figure>
          <p className="mt-4 text-center font-signature text-[0.7rem] uppercase tracking-[0.28em] text-text-secondary">
            {constat.card.label}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
