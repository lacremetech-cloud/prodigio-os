import Image from "next/image";
import { LandingCta } from "@/components/ui/landing-cta";
import { Parallax } from "@/components/ui/parallax";
import { Reveal } from "@/components/ui/reveal";
import { media } from "@/lib/media";
import { ANALYSE_ROUTE } from "@/lib/routes";
import { SectionMarker } from "./section-marker";
import { CTA_PRIMARY, MICROCOPY, selection } from "./copy";

/**
 * Section 06 — Sélection & confidentialité. Fond photographique en parallaxe
 * avec overlay solide (texte toujours parfaitement lisible), et grand appel à
 * l'action.
 */
export function SelectivitySection() {
  return (
    <section className="relative isolate overflow-hidden px-6 py-32 sm:px-10 sm:py-40 lg:px-16">
      {/* Image en parallaxe (sur-dimensionnée pour ne jamais révéler de bord). */}
      <Parallax speed={0.16} className="-z-20 absolute inset-0">
        <div className="relative h-[130%] w-full -translate-y-[8%]">
          <Image
            src={media.ambiance2.src}
            alt={media.ambiance2.alt}
            fill
            sizes="100vw"
            className="scale-110 object-cover"
          />
        </div>
      </Parallax>
      <div
        aria-hidden="true"
        className="-z-10 absolute inset-0"
        style={{ backgroundImage: "var(--overlay-immersive)" }}
      />

      <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <Reveal>
          <SectionMarker index={selection.index} label={selection.kicker} tone="light" />
        </Reveal>
        <Reveal variant="rise" delayMs={90}>
          <h2 className="mx-auto mt-7 max-w-2xl text-balance text-3xl leading-[1.13] text-ivory sm:text-4xl md:text-[2.9rem]">
            {selection.title}
          </h2>
        </Reveal>
        <Reveal delayMs={200}>
          <p className="mx-auto mt-7 max-w-xl text-pretty leading-relaxed text-ivory/85">
            {selection.text}
          </p>
        </Reveal>
        <Reveal delayMs={300} className="mt-11 flex flex-col items-center gap-4">
          <LandingCta href={ANALYSE_ROUTE} tone="gold" size="xl">
            {CTA_PRIMARY}
          </LandingCta>
          <p className="text-sm text-ivory/80">{MICROCOPY}</p>
        </Reveal>
      </div>
    </section>
  );
}
