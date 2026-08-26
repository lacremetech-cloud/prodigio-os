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
 * Hiérarchie verrouillée : cartouche, titre, sous-titre, annotation manuscrite,
 * film, action. Rien d'autre — pas de second paragraphe explicatif, pas de
 * bandeau. Le « comment » est révélé progressivement par la VSL et les sections
 * suivantes.
 *
 * La mise à l'échelle sur écran court est portée par `.hero-fit` / `.hero-media`
 * (globals.css) : deux paliers de hauteur de fenêtre se recouvrent, et seul un
 * ordre de cascade explicite garantit lequel l'emporte.
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

      <div className="hero-fit mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-5 px-6 pb-4 pt-20 text-center sm:gap-6 sm:px-8 sm:pt-24">
        {/* Cartouche d'ouverture — un reflet lumineux le balaie par
            intermittence (`.badge-shine`). */}
        <Reveal className="flex justify-center">
          <span className="badge-shine inline-flex max-w-full items-center gap-2 rounded-full border border-[color:var(--color-gold)]/35 bg-[color:var(--color-gold)]/[0.08] px-3.5 py-1.5 sm:px-4">
            <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-gold-soft" />
            <span className="whitespace-nowrap font-signature text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-gold-soft min-[420px]:text-[0.66rem] min-[420px]:tracking-[0.18em] sm:text-[0.72rem] sm:tracking-[0.22em]">
              {hero.badge}
            </span>
          </span>
        </Reveal>

        <Reveal variant="rise" delayMs={60} className="-mt-1">
          <h1 className="hero-title text-balance text-[1.75rem] leading-[1.1] text-ivory min-[420px]:text-[2rem] sm:text-[2.4rem] sm:leading-[1.08] lg:text-[2.85rem]">
            {hero.title}
          </h1>
        </Reveal>

        <Reveal delayMs={120} className="-mt-1">
          <p className="hero-sub mx-auto max-w-2xl text-pretty font-medium leading-relaxed text-ivory/85">
            {hero.subtitleBefore}
            {/* Le nom de la méthode ressort sans casser la phrase. */}
            <strong className="font-semibold uppercase tracking-[0.04em] text-gold-soft">
              {hero.systemName}
            </strong>
            {hero.subtitleAfter}
          </p>
        </Reveal>

        {/* Annotation manuscrite qui désigne le film, juste en dessous.
            Formulation validée par le propriétaire — ne pas la réécrire. */}
        <Reveal delayMs={150} className="-mt-1">
          <span className="flex items-end justify-center gap-2 text-gold-soft">
            <span className="hero-note font-display text-lg italic leading-tight sm:text-xl">
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

        {/* Le film. Sur un écran court, l'écrin se resserre pour que le bouton
            et sa réassurance restent visibles sans défiler. */}
        <Reveal variant="scale" delayMs={200} className="hero-media mx-auto w-full">
          <div className="vsl-frame">
            <HeroVsl />
          </div>
        </Reveal>

        <Reveal delayMs={260} className="flex flex-col items-center gap-3">
          <div className="cta-halo-host relative w-full max-w-md sm:w-auto">
            <span
              aria-hidden="true"
              className="cta-halo pointer-events-none absolute -inset-4 -z-10 rounded-full bg-[radial-gradient(60%_60%_at_50%_50%,rgba(203,180,136,0.55)_0%,rgba(203,180,136,0)_70%)] blur-xl"
            />
            <LandingCta href={ANALYSE_ROUTE} tone="gold" size="lg" location="hero" className="w-full">
              {CTA_PRIMARY}
            </LandingCta>
          </div>
          <p className="text-sm tracking-wide text-ivory/80">{CTA_SUB}</p>
        </Reveal>
      </div>

    </section>
  );
}
