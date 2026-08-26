import Image from "next/image";
import { LandingCta } from "@/components/ui/landing-cta";
import { Reveal } from "@/components/ui/reveal";
import { media } from "@/lib/media";
import { ANALYSE_ROUTE } from "@/lib/routes";
import { HeroVsl } from "./hero-vsl";
import { LandingNav } from "./landing-nav";
import { CTA_PRIMARY, CTA_SUB, hero } from "./copy";

/**
 * Hero — la VSL est la pièce maîtresse : le visiteur arrive dessus.
 *
 * Quatre éléments, et rien d'autre, pour qu'ils tiennent **tous sur le premier
 * écran** (la vidéo ET le bouton) : le titre, l'annotation manuscrite qui
 * désigne le film, l'écrin vidéo, l'action. Tout bloc supplémentaire
 * repousserait le CTA sous la ligne de flottaison — c'est la contrainte qui
 * gouverne ce hero.
 *
 * Le fond est une photographie nette voilée par un dégradé vertical : de la
 * profondeur derrière l'écrin vidéo, sans halo doré qui salirait le titre.
 */
export function Hero() {
  return (
    <section className="grain relative isolate flex min-h-dvh flex-col overflow-hidden bg-onyx text-ivory">
      <Image
        src={media.hero.src}
        alt=""
        aria-hidden="true"
        fill
        priority
        sizes="100vw"
        className="-z-20 object-cover"
      />
      {/* Voile vertical : lisibilité du texte, sans halo doré. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(12,12,14,0.88) 0%, rgba(12,12,14,0.76) 40%," +
            "rgba(12,12,14,0.82) 76%, rgba(12,12,14,0.97) 100%)",
        }}
      />

      <LandingNav />

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-5 px-6 pb-6 pt-20 text-center sm:gap-6 sm:px-8 sm:pb-8 sm:pt-24">
        <Reveal variant="rise">
          <h1 className="text-balance text-[1.9rem] leading-[1.08] text-ivory min-[420px]:text-[2.2rem] sm:text-[2.6rem] sm:leading-[1.06] lg:text-[2.9rem]">
            {hero.titleLine1}
            <br />
            {hero.titleLine2}
          </h1>
        </Reveal>

        {/* Annotation manuscrite qui désigne le film, juste en dessous. */}
        <Reveal delayMs={80} className="-mt-1">
          <span className="flex items-end justify-center gap-2 text-gold-soft">
            <span className="font-display text-lg italic leading-tight sm:text-xl">
              {hero.vslNote}
            </span>
            <svg
              aria-hidden="true"
              viewBox="0 0 48 44"
              className="h-7 w-8 shrink-0 -scale-x-100 sm:h-8 sm:w-9"
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

        {/* Le film — pièce maîtresse, immédiatement visible.
            Sur un écran court (portable 768 px), l'écrin se resserre pour que la
            réassurance sous le bouton reste visible sans défiler. */}
        <Reveal
          variant="scale"
          delayMs={160}
          className="mx-auto w-full [@media(max-height:840px)]:max-w-2xl"
        >
          <div className="vsl-frame">
            <HeroVsl />
          </div>
        </Reveal>

        <Reveal delayMs={280} className="flex flex-col items-center gap-3">
          {/* Halo doré pulsé derrière le bouton : il attire l'œil sans alourdir. */}
          <div className="relative w-full max-w-md sm:w-auto">
            <span
              aria-hidden="true"
              className="animate-glow pointer-events-none absolute -inset-4 -z-10 rounded-full bg-[radial-gradient(60%_60%_at_50%_50%,rgba(203,180,136,0.55)_0%,rgba(203,180,136,0)_70%)] blur-xl"
            />
            <LandingCta href={ANALYSE_ROUTE} tone="gold" size="lg" className="w-full">
              {CTA_PRIMARY}
            </LandingCta>
          </div>
          <p className="text-sm tracking-wide text-ivory/80">{CTA_SUB}</p>
        </Reveal>
      </div>
    </section>
  );
}
