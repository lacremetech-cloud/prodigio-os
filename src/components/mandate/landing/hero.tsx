import Image from "next/image";
import { LandingCta } from "@/components/ui/landing-cta";
import { Reveal } from "@/components/ui/reveal";
import { media } from "@/lib/media";
import { ANALYSE_ROUTE } from "@/lib/routes";
import { LandingNav } from "./landing-nav";
import { CTA_PRIMARY, CTA_SUB, hero } from "./copy";

/**
 * Hero — trois blocs, rien de plus : titre, une ligne, une action.
 *
 * Le fond est une **vraie photographie nette** (villa d'exception) assombrie par
 * un voile vertical : le sujet reste lisible et donne la profondeur qui manquait
 * à l'aplat noir. Pas de miniature floutée, pas de lueur dorée centrale — elles
 * salissaient exactement la zone du titre.
 *
 * La vidéo n'est plus dans la hero : elle suit dans sa propre section, pour que
 * le CTA reste au-dessus de la ligne de flottaison sur ordinateur comme sur
 * mobile.
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
            "linear-gradient(180deg, rgba(12,12,14,0.86) 0%, rgba(12,12,14,0.72) 40%," +
            "rgba(12,12,14,0.80) 76%, rgba(12,12,14,0.97) 100%)",
        }}
      />

      <LandingNav />

      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-6 pb-16 pt-28 text-center sm:px-10 sm:pt-32">
        <Reveal variant="rise">
          <h1 className="text-balance text-[2.15rem] leading-[1.06] text-ivory min-[420px]:text-[2.6rem] sm:text-6xl sm:leading-[1.04] lg:text-[4.5rem]">
            {hero.titleLine1}
            <br />
            {hero.titleLine2}
          </h1>
        </Reveal>

        <Reveal delayMs={120}>
          <p className="mx-auto mt-7 max-w-2xl text-balance text-lg leading-relaxed text-ivory/85 sm:text-xl">
            {hero.subtitle}
          </p>
        </Reveal>

        <Reveal delayMs={240} className="mt-11 flex flex-col items-center gap-3">
          <LandingCta
            href={ANALYSE_ROUTE}
            tone="gold"
            size="xl"
            className="w-full max-w-md sm:w-auto"
          >
            {CTA_PRIMARY}
          </LandingCta>
          <p className="text-sm tracking-wide text-ivory/80">{CTA_SUB}</p>
        </Reveal>
      </div>

      {/* Indice de défilement — annonce le film qui suit. */}
      <div className="pointer-events-none flex justify-center pb-8">
        <span className="flex flex-col items-center gap-2 text-[0.68rem] uppercase tracking-[0.28em] text-ivory/50">
          {hero.scrollCue}
          <span aria-hidden="true" className="animate-scroll-cue text-gold-soft">
            ↓
          </span>
        </span>
      </div>
    </section>
  );
}
