import Image from "next/image";
import { LandingCta } from "@/components/ui/landing-cta";
import { Parallax } from "@/components/ui/parallax";
import { Reveal } from "@/components/ui/reveal";
import { media } from "@/lib/media";
import { ANALYSE_ROUTE, PROPRIETAIRE_ROUTE } from "@/lib/routes";
import { HomeNav } from "./home-nav";
import { homeCopy } from "./home-copy";

/**
 * Hero d'accueil cinématographique occupant presque tout le premier écran.
 *
 * Photographie d'exception déjà autorisée dans le projet, voile sombre pour la
 * lisibilité, lueurs dorées discrètes, grain filmique, profondeur par parallaxe
 * légère et entrées animées sobres. La signature Prodigio sert de H1 unique.
 * Deux grands CTA : éligibilité (primaire) et découverte du système (secondaire).
 */
export function HomeHero() {
  const { hero } = homeCopy;

  return (
    <section className="grain relative isolate flex min-h-dvh flex-col overflow-hidden bg-onyx text-ivory">
      {/* Photographie d'ambiance en fond, légèrement sur-dimensionnée pour la
          parallaxe (aucun bord visible). Voile sombre appliqué par-dessus. */}
      <Parallax speed={0.12} className="absolute inset-0 -z-20">
        <Image
          src={media.hero.src}
          alt=""
          aria-hidden="true"
          fill
          priority
          sizes="100vw"
          className="scale-110 object-cover"
        />
      </Parallax>

      {/* Lueurs dorées + assombrissement dégradé (le texte prime sur l'image). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(55% 45% at 50% 0%, rgba(203,180,136,0.16) 0%, rgba(12,12,14,0) 60%)," +
            "radial-gradient(90% 70% at 50% 120%, rgba(154,123,69,0.14) 0%, rgba(12,12,14,0) 60%)," +
            "linear-gradient(180deg, rgba(12,12,14,0.68) 0%, rgba(12,12,14,0.5) 40%, rgba(12,12,14,0.9) 100%)",
        }}
      />

      <HomeNav />

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 pb-16 pt-28 text-center sm:px-10 sm:pt-32 lg:px-8">
        <Reveal className="flex justify-center">
          <span className="badge-shine inline-flex max-w-full items-center gap-2 rounded-full border border-[color:var(--color-gold)]/35 bg-[color:var(--color-gold)]/[0.08] px-4 py-1.5">
            <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-gold-soft" />
            <span className="whitespace-nowrap font-signature text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-gold-soft sm:text-[0.72rem] sm:tracking-[0.2em]">
              {hero.eyebrow}
            </span>
          </span>
        </Reveal>

        <Reveal variant="rise" delayMs={90}>
          <h1 className="mx-auto mt-7 max-w-4xl text-balance text-[2rem] leading-[1.08] text-ivory min-[420px]:text-[2.4rem] sm:text-6xl sm:leading-[1.05] lg:text-[4.25rem]">
            {hero.signatureLine1}
            <br />
            <span className="text-gold-soft">{hero.signatureLine2}</span>
          </h1>
        </Reveal>

        <Reveal delayMs={160}>
          <p className="mx-auto mt-7 max-w-2xl text-pretty text-base leading-relaxed text-ivory/85 sm:text-lg">
            {hero.description}
          </p>
        </Reveal>

        <Reveal delayMs={240} className="mt-10 flex w-full flex-col items-center gap-4">
          <div className="flex w-full flex-col items-center justify-center gap-3.5 sm:flex-row">
            {/* CTA primaire : éligibilité. Halo doré doux et pulsé pour attirer
                l'œil sans alourdir le bouton clair. */}
            <div className="cta-halo-host relative w-full sm:w-auto">
              <span
                aria-hidden="true"
                className="cta-halo pointer-events-none absolute -inset-3 -z-10 rounded-full bg-[radial-gradient(60%_60%_at_50%_50%,rgba(203,180,136,0.5)_0%,rgba(203,180,136,0)_70%)] blur-xl"
              />
              <LandingCta href={ANALYSE_ROUTE} tone="contrast" size="xl" className="w-full sm:w-auto">
                {hero.ctaPrimary}
              </LandingCta>
            </div>
            {/* CTA secondaire : découverte du système. */}
            <LandingCta
              href={PROPRIETAIRE_ROUTE}
              tone="ghost-dark"
              size="xl"
              className="w-full sm:w-auto"
            >
              {hero.ctaSecondary}
            </LandingCta>
          </div>
          <p className="text-sm tracking-wide text-ivory/70">{hero.ctaSub}</p>
        </Reveal>
      </div>

      {/* Indice de défilement vers l'aiguillage. */}
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
