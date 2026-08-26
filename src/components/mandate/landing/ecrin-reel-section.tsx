import Image from "next/image";
import { Reveal } from "@/components/ui/reveal";
import { media, type MediaAsset } from "@/lib/media";
import { SectionLabel } from "./section-label";
import { ecrinReel } from "./copy";

const VISUELS: readonly MediaAsset[] = [media.ecrinProdigio, media.ecrinBrochureCover];

/**
 * L'écrin, en vrai — la preuve de création.
 *
 * Deux livrables réels, montrés en grand. Le lien « Parcourir / Feuilleter »
 * n'est rendu QUE si son URL est renseignée dans `copy.ts` : jamais de lien mort,
 * jamais d'URL inventée.
 */
export function EcrinReelSection() {
  return (
    <section className="bg-onyx px-5 py-24 text-ivory sm:px-10 sm:py-32 lg:px-14">
      <div className="mx-auto max-w-[88rem]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <Reveal>
            <SectionLabel tone="dark">{ecrinReel.eyebrow}</SectionLabel>
            <h2 className="mt-7 max-w-[16ch] text-balance text-[1.95rem] leading-[1.08] text-ivory sm:text-4xl lg:text-[3.2rem]">
              {ecrinReel.title}
            </h2>
          </Reveal>
          <Reveal delayMs={120}>
            <p className="font-signature text-[0.72rem] uppercase tracking-[0.2em] text-ivory/55">
              {ecrinReel.bien}
            </p>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-8 md:grid-cols-2 md:gap-10">
          {ecrinReel.pieces.map((piece, i) => {
            const visuel = VISUELS[i] ?? VISUELS[0]!;
            return (
              <Reveal key={piece.label} variant="rise" delayMs={i * 140}>
                <figure>
                  <div className="relative aspect-[4/3] w-full overflow-hidden border border-border-dark">
                    <Image
                      src={visuel.src}
                      alt={visuel.alt}
                      fill
                      sizes="(max-width: 768px) 100vw, 46vw"
                      className="object-cover object-top"
                    />
                  </div>
                  <figcaption className="mt-5 flex items-baseline justify-between gap-4 border-t border-border-dark pt-5">
                    <span className="font-display text-xl text-ivory sm:text-2xl">
                      {piece.label}
                    </span>
                    {piece.href ? (
                      <a
                        href={piece.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 font-signature text-[0.72rem] uppercase tracking-[0.18em] text-gold-soft underline decoration-gold-soft/40 underline-offset-4 transition-colors hover:decoration-gold-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus)]"
                      >
                        {piece.action} →
                      </a>
                    ) : (
                      <span className="shrink-0 font-signature text-[0.72rem] uppercase tracking-[0.18em] text-ivory/45">
                        {piece.caption}
                      </span>
                    )}
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
