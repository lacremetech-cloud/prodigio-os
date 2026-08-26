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
 * Trois éléments, et rien d'autre, pour qu'ils tiennent **tous sur le premier
 * écran** (la vidéo ET le bouton) : le titre, le film, l'action. Chaque bloc
 * supplémentaire — badge, paragraphe, annotation — repoussait le CTA sous la
 * ligne de flottaison ; c'est pour cela qu'ils ne sont pas revenus.
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

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-6 pb-10 pt-24 text-center sm:gap-7 sm:px-8 sm:pt-28">
        <Reveal variant="rise">
          <h1 className="text-balance text-[1.9rem] leading-[1.08] text-ivory min-[420px]:text-[2.2rem] sm:text-[2.6rem] sm:leading-[1.06] lg:text-[3.1rem]">
            {hero.titleLine1}
            <br />
            {hero.titleLine2}
          </h1>
        </Reveal>

        {/* Le film — pièce maîtresse, immédiatement visible. */}
        <Reveal variant="scale" delayMs={120}>
          <HeroVsl />
        </Reveal>

        <Reveal delayMs={240} className="flex flex-col items-center gap-3">
          <LandingCta
            href={ANALYSE_ROUTE}
            tone="gold"
            size="lg"
            className="w-full max-w-md sm:w-auto"
          >
            {CTA_PRIMARY}
          </LandingCta>
          <p className="text-sm tracking-wide text-ivory/80">{CTA_SUB}</p>
        </Reveal>
      </div>
    </section>
  );
}
