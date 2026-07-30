import Image from "next/image";
import { LandingCta } from "@/components/ui/landing-cta";
import { Reveal } from "@/components/ui/reveal";
import { ScrollScale } from "@/components/ui/scroll-scale";
import { media } from "@/lib/media";
import { ANALYSE_ROUTE } from "@/lib/routes";
import { HeroVsl } from "./hero-vsl";
import { LandingNav } from "./landing-nav";
import { CTA_PRIMARY, CTA_SUB, hero } from "./copy";

/**
 * Hero cinématographique centrée sur la VSL. Entrée en cascade (titre, écrin,
 * CTA), grain filmique, lueurs dorées, grand CTA très visible, et indice de
 * défilement. La vidéo domine la composition.
 */
export function Hero() {
  return (
    <section className="grain relative isolate flex min-h-dvh flex-col overflow-hidden bg-onyx text-ivory">
      {/* Fond « ambiant » : version floutée et assombrie de l'écrin, derrière tout
          le contenu (impression de vidéo d'ambiance, sans coût d'un 2e lecteur). */}
      <Image
        src={media.vsl.src}
        alt=""
        aria-hidden="true"
        fill
        priority
        sizes="100vw"
        className="-z-20 scale-110 object-cover opacity-25 blur-2xl"
      />
      {/* Lueurs de lumière + assombrissement (lisibilité du texte). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(55% 45% at 50% 0%, rgba(203,180,136,0.14) 0%, rgba(12,12,14,0) 62%)," +
            "radial-gradient(80% 60% at 50% 120%, rgba(154,123,69,0.12) 0%, rgba(12,12,14,0) 60%)," +
            "linear-gradient(180deg, rgba(12,12,14,0.7) 0%, rgba(12,12,14,0.55) 45%, rgba(12,12,14,0.85) 100%)",
        }}
      />

      <LandingNav />

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 pb-12 pt-24 sm:px-10 sm:pt-28 lg:px-8">
        {/* Accroche + titre */}
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <p className="eyebrow text-gold-soft">{hero.eyebrow}</p>
          </Reveal>
          <Reveal variant="rise" delayMs={90}>
            <h1 className="mt-5 text-balance text-[2.65rem] leading-[1.04] text-ivory sm:text-6xl lg:text-[4.5rem]">
              {hero.titleLine1}
              <br />
              {hero.titleLine2}
            </h1>
          </Reveal>
        </div>

        {/* Annotation manuscrite pointant la VSL. */}
        <Reveal delayMs={180} className="mx-auto mt-7 flex w-full max-w-4xl justify-center sm:mt-9 sm:justify-end sm:pr-6">
          <span className="flex items-end gap-2 text-gold-soft">
            <span className="font-display text-lg italic leading-tight sm:text-xl">
              {hero.vslNote}
            </span>
            <svg
              aria-hidden="true"
              viewBox="0 0 48 44"
              className="h-8 w-9 shrink-0 -scale-x-100"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Flèche courbe pointant vers le bas (la vidéo). */}
              <path d="M6 6c10 4 18 14 20 30" />
              <path d="M16 30l10 8 4-11" />
            </svg>
          </span>
        </Reveal>

        {/* Écrin VSL — pièce maîtresse (grandit légèrement au défilement) */}
        <Reveal variant="scale" delayMs={240} className="mx-auto mt-3 w-full max-w-4xl sm:mt-4">
          <ScrollScale to={1.1}>
            <HeroVsl />
          </ScrollScale>
        </Reveal>

        {/* Sous-titre + grand CTA */}
        <div className="mx-auto mt-8 flex max-w-2xl flex-col items-center text-center">
          <Reveal delayMs={140}>
            <p className="text-pretty text-base leading-relaxed text-ivory/85 sm:text-lg">
              {hero.subtitle}
            </p>
          </Reveal>
          <Reveal delayMs={240} className="mt-8 flex w-full flex-col items-center gap-3">
            <LandingCta
              href={ANALYSE_ROUTE}
              tone="contrast"
              size="xl"
              className="w-full max-w-xl sm:w-auto"
            >
              {CTA_PRIMARY}
            </LandingCta>
            <p className="text-sm tracking-wide text-ivory/70">{CTA_SUB}</p>
          </Reveal>
        </div>
      </div>

      {/* Indice de défilement */}
      <div className="pointer-events-none flex justify-center pb-6">
        <span className="flex flex-col items-center gap-2 text-[0.68rem] uppercase tracking-[0.28em] text-ivory/45">
          {hero.scrollCue}
          <span aria-hidden="true" className="animate-scroll-cue text-gold-soft">
            ↓
          </span>
        </span>
      </div>
    </section>
  );
}
