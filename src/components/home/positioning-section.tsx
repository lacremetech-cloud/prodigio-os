import { Reveal } from "@/components/ui/reveal";
import { homeCopy } from "./home-copy";

/**
 * Positionnement en points courts : ce qu'est (et n'est pas) Prodigio.
 * Section claire, très lisible, pour contraster avec la hero sombre. Grille
 * éditoriale sobre — pas un mur de cartes SaaS — avec un filet doré et un
 * numéro sérif discret par pilier, révélés en cascade.
 */
export function PositioningSection() {
  const { positioning } = homeCopy;

  return (
    <section
      aria-labelledby="positioning-title"
      className="bg-ivory px-6 py-20 text-wood-black sm:px-10 sm:py-28 lg:px-16"
    >
      <div className="mx-auto max-w-6xl">
        <div className="max-w-3xl">
          <Reveal>
            <p className="eyebrow text-[color:var(--color-gold)]">{positioning.eyebrow}</p>
          </Reveal>
          <Reveal delayMs={80}>
            <h2
              id="positioning-title"
              className="mt-4 text-balance text-3xl leading-[1.1] sm:text-4xl lg:text-[2.9rem]"
            >
              {positioning.title}
            </h2>
          </Reveal>
        </div>

        <ul className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {positioning.pillars.map((pillar, index) => (
            <Reveal
              as="li"
              key={pillar.title}
              variant="up"
              delayMs={index * 70}
              className="border-t border-border pt-5"
            >
              <span
                aria-hidden="true"
                className="font-display text-lg italic text-[color:var(--color-gold)]"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-3 text-xl leading-snug">{pillar.title}</h3>
              <p className="mt-2 text-pretty text-[0.95rem] leading-relaxed text-text-secondary">
                {pillar.text}
              </p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
