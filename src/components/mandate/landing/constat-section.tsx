import Image from "next/image";
import { Reveal } from "@/components/ui/reveal";
import { media } from "@/lib/media";
import { landing } from "@/modules/mandates/funnel";

/**
 * Le constat : sur les portails traditionnels, même une propriété exceptionnelle
 * finit présentée comme les autres. Ton mesuré, sans attaque des agents.
 */
export function ConstatSection() {
  const { constat } = landing;

  return (
    <section className="bg-ivory-muted px-6 py-20 sm:px-10 sm:py-28 lg:px-16">
      <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2 lg:gap-20">
        <Reveal className="order-2 lg:order-1">
          <p className="eyebrow text-gold">{constat.kicker}</p>
          <h2 className="mt-5 text-balance text-3xl leading-[1.15] text-wood-black sm:text-4xl">
            {constat.title}
          </h2>
          <p className="mt-6 text-pretty leading-relaxed text-text-secondary">
            {constat.text}
          </p>

          <ul className="mt-8 divide-y divide-border border-y border-border">
            {constat.items.map((item) => (
              <li
                key={item}
                className="flex items-baseline gap-4 py-3.5 text-wood-black"
              >
                <span
                  aria-hidden="true"
                  className="mt-1 size-1.5 shrink-0 rounded-full bg-gold"
                />
                <span className="text-[0.975rem]">{item}</span>
              </li>
            ))}
          </ul>

          <p className="mt-8 max-w-md text-pretty font-display text-xl italic leading-snug text-wood-black">
            {constat.closing}
          </p>
        </Reveal>

        <Reveal className="order-1 lg:order-2" delayMs={80}>
          <div className="relative aspect-[4/5] w-full overflow-hidden border border-border shadow-[var(--shadow-lg)]">
            <Image
              src={media.constat.src}
              alt={media.constat.alt}
              fill
              sizes="(max-width: 1024px) 100vw, 560px"
              className="object-cover"
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
