import Image from "next/image";
import { Reveal } from "@/components/ui/reveal";
import { media } from "@/lib/media";
import { SectionLabel } from "./section-label";
import { creation } from "./copy";

/**
 * La création — « annonce » puis « expérience ».
 *
 * Le contraste est spatial, pas argumentatif : à gauche, trois annonces
 * réduites, désaturées, empilées — le bien y est un élément parmi d'autres ; en
 * dessous, la mise en marché Prodigio occupe TOUTE la largeur. On ne dit pas que
 * les annonces sont mauvaises : on montre la différence d'échelle et d'attention.
 */
export function CreationSection() {
  return (
    <section className="bg-ivory py-24 text-wood-black sm:py-32">
      <div className="mx-auto max-w-[88rem] px-5 sm:px-10 lg:px-14">
        <Reveal>
          <SectionLabel>{creation.eyebrow}</SectionLabel>
        </Reveal>
        <Reveal variant="rise" delayMs={70}>
          <h2 className="mt-8 max-w-[16ch] text-balance text-[2.1rem] leading-[1.06] sm:text-5xl lg:text-[3.8rem]">
            {creation.title}
          </h2>
        </Reveal>

        <div className="mt-12 grid gap-10 lg:grid-cols-12 lg:gap-12">
          <Reveal delayMs={130} className="lg:col-span-5">
            <p className="text-pretty text-lg leading-relaxed text-wood-black">
              {creation.body}
            </p>
            {/* Les angles : une énumération rythmée, pas six petites boîtes. */}
            <ul className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1 font-display text-xl leading-[1.4] text-text-secondary sm:text-2xl">
              {creation.angles.map((angle, i) => (
                <li key={angle} className="flex items-baseline gap-3">
                  {i > 0 ? (
                    <span aria-hidden="true" className="text-[color:var(--color-gold)]">
                      ·
                    </span>
                  ) : null}
                  {angle}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delayMs={200} className="lg:col-span-5 lg:col-start-8 lg:self-end">
            <p className="text-pretty leading-relaxed text-text-secondary">
              {creation.body2}
            </p>
          </Reveal>
        </div>
      </div>

      {/* Étape 1 — le bien tel qu'il apparaît dans le format standard. */}
      <div className="mx-auto mt-20 max-w-[88rem] px-5 sm:px-10 lg:px-14">
        <Reveal variant="blur">
          <p className="font-signature text-[0.72rem] uppercase tracking-[0.24em] text-text-secondary">
            {creation.avant.label}
          </p>
          <div className="mt-6 flex max-w-2xl gap-3 opacity-60 saturate-[0.35] sm:gap-4">
            {[media.ecrinAnnonce, media.ecrinAgence1, media.ecrinAgence2].map((asset, i) => (
              <div
                key={asset.src}
                className="relative aspect-[4/3] flex-1 overflow-hidden border border-border bg-surface"
                style={{ transform: `translateY(${i * 10}px)` }}
              >
                <Image
                  src={asset.src}
                  alt={asset.alt}
                  fill
                  sizes="(max-width: 640px) 33vw, 220px"
                  className="object-cover object-top"
                />
              </div>
            ))}
          </div>
          <p className="mt-6 text-[0.82rem] text-text-secondary">{creation.avant.caption}</p>
        </Reveal>
      </div>

      {/* Étape 2 — la même propriété, seule, en très grand. Rupture d'échelle. */}
      <div className="mt-16 sm:mt-24">
        <Reveal variant="rise">
          <div className="mx-auto max-w-[88rem] px-5 sm:px-10 lg:px-14">
            <p className="font-signature text-[0.72rem] uppercase tracking-[0.24em] text-[color:var(--color-gold)]">
              {creation.apres.label}
            </p>
          </div>
          <div className="relative mt-6 aspect-[16/9] w-full overflow-hidden sm:aspect-[21/9]">
            <Image
              src={media.ecrinProdigio.src}
              alt={media.ecrinProdigio.alt}
              fill
              sizes="100vw"
              className="object-cover object-top"
            />
          </div>
          <div className="mx-auto max-w-[88rem] px-5 sm:px-10 lg:px-14">
            <p className="mt-6 text-[0.82rem] text-text-secondary">{creation.apres.caption}</p>
            <ul className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 font-signature text-[0.72rem] uppercase tracking-[0.2em] text-text-secondary">
              {creation.livrables.map((l, i) => (
                <li key={l} className="flex items-center gap-6">
                  {i > 0 ? <span aria-hidden="true" className="h-px w-5 bg-border-strong" /> : null}
                  {l}
                </li>
              ))}
            </ul>
            <p className="mt-14 max-w-[20ch] text-balance font-display text-[1.9rem] leading-[1.12] sm:text-4xl lg:max-w-[26ch] lg:text-[3rem]">
              {creation.statement}
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
