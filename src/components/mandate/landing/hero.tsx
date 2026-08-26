import Image from "next/image";
import { LandingCta } from "@/components/ui/landing-cta";
import { Reveal } from "@/components/ui/reveal";
import { media } from "@/lib/media";
import { ANALYSE_ROUTE } from "@/lib/routes";
import { HeroVsl } from "./hero-vsl";
import { LandingNav } from "./landing-nav";
import { CTA_PRIMARY, CTA_SUB, hero } from "./copy";

/**
 * Hero — la question qui installe la Big Idea, puis le film, puis l'action.
 *
 * La headline domine : c'est elle qui doit rester en tête si le visiteur ne lit
 * rien d'autre. Aucun paragraphe explicatif : une seule ligne sous le titre.
 *
 * L'écrin vidéo et le CTA tiennent avec le titre sur le premier écran ; la
 * barre de réassurance vient juste après, en bas de la hero.
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
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(12,12,14,0.88) 0%, rgba(12,12,14,0.76) 40%," +
            "rgba(12,12,14,0.84) 76%, rgba(12,12,14,0.97) 100%)",
        }}
      />

      <LandingNav />

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-5 px-6 pb-4 pt-20 text-center sm:gap-6 sm:px-8 sm:pt-24">
        <Reveal>
          <p className="eyebrow text-gold-soft">{hero.eyebrow}</p>
        </Reveal>

        <Reveal variant="rise" delayMs={60} className="-mt-1">
          <h1 className="text-balance text-[1.75rem] leading-[1.1] text-ivory min-[420px]:text-[2rem] sm:text-[2.4rem] sm:leading-[1.08] lg:text-[2.85rem]">
            {hero.title}
          </h1>
        </Reveal>

        <Reveal delayMs={120} className="-mt-1">
          <p className="mx-auto max-w-xl text-pretty leading-relaxed text-ivory/80">
            {hero.subtitle}
          </p>
        </Reveal>

        {/* Le film. Sur un écran court, l'écrin se resserre pour que le bouton
            et sa réassurance restent visibles sans défiler. */}
        <Reveal
          variant="scale"
          delayMs={180}
          className="mx-auto w-full [@media(max-height:900px)]:max-w-2xl [@media(max-height:800px)]:max-w-xl"
        >
          <div className="vsl-frame">
            <HeroVsl />
          </div>
        </Reveal>

        <Reveal delayMs={260} className="flex flex-col items-center gap-3">
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

      {/* Barre de réassurance — quatre repères, aucun superlatif. */}
      <Reveal
        as="div"
        delayMs={340}
        className="border-t border-ivory/10 px-6 py-4 sm:px-10"
      >
        <ul className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-center">
          {hero.reassurance.map((item) => (
            <li
              key={item}
              className="font-signature text-[0.6rem] uppercase tracking-[0.2em] text-ivory/55 sm:text-[0.66rem]"
            >
              {item}
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
}
