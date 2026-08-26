import Image from "next/image";
import { Reveal } from "@/components/ui/reveal";
import { media } from "@/lib/media";
import { audience } from "./copy";

/**
 * Maquette d'une publicité Prodigio sur un écran de téléphone.
 *
 * Décorative et explicitement présentée comme une illustration : elle montre où
 * se joue l'acquisition active, sans imiter l'interface d'un réseau précis.
 */
function AdMock() {
  return (
    <figure className="mx-auto w-full max-w-[17rem]">
      <div className="overflow-hidden rounded-[2rem] border border-ivory/15 bg-onyx-soft p-2 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.9)]">
        <div className="overflow-hidden rounded-[1.6rem] bg-onyx">
          <div className="flex items-center gap-2 px-4 py-3">
            <span aria-hidden="true" className="size-6 rounded-full bg-gold-soft/25" />
            <span className="font-signature text-[0.58rem] uppercase tracking-[0.18em] text-ivory/80">
              Prodigio
            </span>
            <span className="ml-auto font-signature text-[0.52rem] uppercase tracking-[0.16em] text-ivory/40">
              {audience.adMock.sponsored}
            </span>
          </div>
          <div className="relative aspect-[4/5] w-full">
            <Image
              src={media.categoryVilla.src}
              alt=""
              aria-hidden="true"
              fill
              sizes="272px"
              className="object-cover"
            />
          </div>
          <p className="px-4 pb-3 pt-3 text-[0.8rem] leading-snug text-ivory/85">
            {audience.adMock.caption}
          </p>
          <p className="mx-4 mb-4 bg-[color:var(--color-gold-soft)] px-3 py-2 text-center text-[0.72rem] font-semibold text-wood-black">
            {audience.adMock.cta}
          </p>
        </div>
      </div>
      <figcaption className="mt-3 text-center font-signature text-[0.56rem] uppercase tracking-[0.18em] text-ivory/40">
        {audience.adMock.note}
      </figcaption>
    </figure>
  );
}

/**
 * Prolongement de la Big Idea : l'attention est ailleurs, et elle est mesurable.
 *
 * Deux volumes, une question, la portée géographique. Les sources restent
 * discrètes mais présentes — aucune statistique sans référence.
 */
export function AudienceSection() {
  return (
    <section className="grain relative isolate overflow-hidden bg-onyx px-6 pb-28 text-ivory sm:px-10 lg:px-16">
      <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1fr_auto] lg:gap-20">
        <div>
          <Reveal variant="rise">
            <h2 className="text-balance font-display text-3xl leading-[1.12] text-ivory sm:text-4xl md:text-[2.9rem]">
              {audience.title}
            </h2>
          </Reveal>

          <dl className="mt-12 grid gap-10 sm:grid-cols-2">
            {audience.stats.map((stat, i) => (
              <Reveal as="div" key={stat.value} variant="rise" delayMs={i * 120}>
                <dt className="font-display text-5xl leading-none text-gold-soft sm:text-6xl">
                  {stat.value}
                </dt>
                <dd className="mt-3 text-sm leading-snug text-text-on-dark-muted">
                  {stat.label}
                </dd>
              </Reveal>
            ))}
          </dl>

          <Reveal delayMs={160}>
            <p className="mt-12 max-w-xl text-balance font-display text-2xl leading-snug text-ivory sm:text-3xl">
              {audience.punch}
            </p>
          </Reveal>

          <Reveal delayMs={220}>
            <p className="mt-10 font-signature text-xs uppercase tracking-[0.24em] text-gold-soft">
              {audience.reach}
            </p>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-text-on-dark-muted">
              {audience.reachNote}
            </p>
            <p className="mt-6 text-[0.7rem] leading-relaxed text-ivory/35">
              {audience.sourceNote}
            </p>
          </Reveal>
        </div>

        <Reveal variant="scale" delayMs={140}>
          <AdMock />
        </Reveal>
      </div>
    </section>
  );
}
