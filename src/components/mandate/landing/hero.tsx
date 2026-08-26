import Image from "next/image";
import { LandingCta } from "@/components/ui/landing-cta";
import { Reveal } from "@/components/ui/reveal";
import { media } from "@/lib/media";
import { ANALYSE_ROUTE } from "@/lib/routes";
import { HeroVsl } from "./hero-vsl";
import { LandingNav } from "./landing-nav";
import { CTA_PRIMARY, MICROCOPY, hero } from "./copy";

/**
 * Hero — masthead éditorial asymétrique.
 *
 * Composition volontairement NON centrée : la question occupe toute la largeur
 * en tête de page, puis la colonne de gauche porte la promesse et l'appel à
 * l'action pendant que le film occupe la droite. Sur ordinateur, le CTA est
 * visible sans défiler — c'est la contrainte qui gouverne toute la composition.
 *
 * Aucun cartouche « premium », aucune annotation manuscrite, aucun halo pulsé,
 * aucun faux repère de tournage : la tenue vient de la typographie, du cadrage
 * et du silence autour.
 */
export function Hero() {
  return (
    <section className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-onyx text-ivory">
      {/* Photographie d'ambiance, très assombrie : de la matière, pas un décor. */}
      <Image
        src={media.hero.src}
        alt=""
        aria-hidden="true"
        fill
        priority
        sizes="100vw"
        className="-z-20 object-cover opacity-[0.28]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(12,12,14,0.86)_0%,rgba(12,12,14,0.72)_38%,rgba(12,12,14,0.94)_100%)]"
      />

      <LandingNav />

      <div className="mx-auto flex w-full max-w-[88rem] flex-1 flex-col justify-center px-5 pb-14 pt-28 sm:px-10 sm:pt-32 lg:px-14 lg:pb-16">
        {/* Masthead : la question, pleine largeur, alignée à gauche. */}
        <Reveal>
          <p className="font-signature text-[0.72rem] font-semibold uppercase tracking-[0.26em] text-gold-soft">
            {hero.eyebrow}
          </p>
        </Reveal>
        <Reveal variant="rise" delayMs={80}>
          <h1 className="mt-6 max-w-[19ch] text-balance text-[2rem] leading-[1.05] text-ivory min-[420px]:text-[2.4rem] sm:text-[3.4rem] lg:max-w-[24ch] lg:text-[4.1rem] xl:text-[4.6rem]">
            {hero.titleLine1}{" "}
            <span className="text-gold-soft">{hero.titleLine2}</span>
          </h1>
        </Reveal>

        {/* Deux colonnes : promesse + action à gauche, film à droite. */}
        <div className="mt-10 grid gap-8 lg:mt-14 lg:grid-cols-12 lg:items-end lg:gap-12">
          {/* Le film passe en premier sur mobile : c'est ce qui donne envie. */}
          <Reveal
            variant="scale"
            delayMs={220}
            className="order-1 lg:order-2 lg:col-span-7"
          >
            <HeroVsl />
          </Reveal>

          <div className="order-2 lg:order-1 lg:col-span-5">
            <Reveal delayMs={140}>
              <p className="max-w-xl text-pretty text-[1.02rem] leading-relaxed text-ivory/85 sm:text-lg">
                {hero.subtitle}
              </p>
            </Reveal>
            <Reveal delayMs={220} className="mt-8 flex flex-col items-start gap-3">
              <LandingCta
                href={ANALYSE_ROUTE}
                tone="contrast"
                size="lg"
                className="w-full sm:w-auto"
              >
                {CTA_PRIMARY}
              </LandingCta>
              <p className="text-[0.82rem] leading-relaxed text-ivory/60">
                {MICROCOPY}
              </p>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
