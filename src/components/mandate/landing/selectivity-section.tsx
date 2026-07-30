import Image from "next/image";
import { CtaLink } from "@/components/ui/cta-link";
import { media } from "@/lib/media";
import { ANALYSE_ROUTE } from "@/lib/routes";
import { SectionMarker } from "./section-marker";
import { CTA_PRIMARY, MICROCOPY, selection } from "./copy";

/**
 * Section 05 — Sélection & confidentialité. Fond photographique sombre avec
 * overlay solide (texte toujours parfaitement lisible), et appel à l'action.
 */
export function SelectivitySection() {
  return (
    <section className="relative isolate overflow-hidden px-6 py-28 sm:px-10 sm:py-36 lg:px-16">
      <Image
        src={media.ambiance2.src}
        alt={media.ambiance2.alt}
        fill
        sizes="100vw"
        className="-z-20 object-cover"
      />
      <div
        aria-hidden="true"
        className="-z-10 absolute inset-0"
        style={{ backgroundImage: "var(--overlay-immersive)" }}
      />

      <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <SectionMarker index={selection.index} label={selection.kicker} tone="light" />
        <h2 className="mx-auto mt-7 max-w-2xl text-balance text-3xl leading-[1.15] text-ivory sm:text-4xl md:text-[2.75rem]">
          {selection.title}
        </h2>
        <p className="mx-auto mt-7 max-w-xl text-pretty leading-relaxed text-ivory/85">
          {selection.text}
        </p>
        <div className="mt-11 flex flex-col items-center gap-4">
          <CtaLink href={ANALYSE_ROUTE} variant="contrast">
            {CTA_PRIMARY}
          </CtaLink>
          <p className="text-sm text-ivory/80">{MICROCOPY}</p>
        </div>
      </div>
    </section>
  );
}
