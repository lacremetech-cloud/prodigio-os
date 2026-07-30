import Image from "next/image";
import { BeforeAfterSlider } from "@/components/ui/before-after-slider";
import { Reveal } from "@/components/ui/reveal";
import { media } from "@/lib/media";
import { SectionMarker } from "./section-marker";
import { constat, ecrin } from "./copy";

const galleryMedia = {
  ecrinIdentite: media.ecrinIdentite,
  ecrinBrochureCover: media.ecrinBrochureCover,
  ecrinPublicites: media.ecrinPublicites,
} as const;

/**
 * Section 01 — Le constat / L'écrin. Colonne éditoriale + **comparateur
 * interactif** (annonce de portail standard ↔ mise en marché Prodigio), puis une
 * galerie d'illustrations réelles (carte d'identité, brochure, publicités).
 */
export function ConstatSection() {
  return (
    <section className="bg-ivory px-6 py-24 text-wood-black sm:px-10 sm:py-32 lg:px-16">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <Reveal>
            <SectionMarker index={constat.index} label={constat.kicker} />
          </Reveal>
          <Reveal variant="rise" delayMs={80}>
            <h2 className="mt-7 text-balance text-3xl leading-[1.12] sm:text-4xl lg:text-[2.9rem]">
              {constat.title}
            </h2>
          </Reveal>
          <Reveal delayMs={180}>
            <p className="mt-7 text-pretty text-lg leading-relaxed text-text-secondary">
              {constat.body}
            </p>
          </Reveal>
        </div>

        {/* Comparateur interactif */}
        <Reveal variant="scale" delayMs={120} className="mt-12">
          <BeforeAfterSlider
            before={media.ecrinAnnonce}
            after={media.ecrinProdigio}
            beforeLabel={ecrin.beforeLabel}
            afterLabel={ecrin.afterLabel}
          />
          <p className="mt-4 flex items-center justify-center gap-2 font-signature text-[0.7rem] uppercase tracking-[0.24em] text-text-secondary">
            <span aria-hidden="true" className="text-gold">↔</span>
            {ecrin.hint}
          </p>
        </Reveal>

        {/* Galerie d'illustrations réelles */}
        <div className="mt-14 grid gap-5 sm:grid-cols-3">
          {ecrin.gallery.map((item, i) => {
            const asset = galleryMedia[item.key as keyof typeof galleryMedia];
            return (
              <Reveal key={item.key} variant="rise" delayMs={i * 90}>
                <figure className="group overflow-hidden border border-border bg-surface shadow-[var(--shadow-md)]">
                  <div className="relative aspect-[16/10] w-full overflow-hidden">
                    <Image
                      src={asset.src}
                      alt={asset.alt}
                      fill
                      sizes="(max-width: 640px) 100vw, 33vw"
                      className="object-cover object-top transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <figcaption className="px-4 py-3 font-signature text-[0.68rem] uppercase tracking-[0.2em] text-text-secondary">
                    {item.caption}
                  </figcaption>
                </figure>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
