import Image from "next/image";
import { LandingCta } from "@/components/ui/landing-cta";
import { Parallax } from "@/components/ui/parallax";
import { Reveal } from "@/components/ui/reveal";
import { media } from "@/lib/media";
import { ANALYSE_ROUTE } from "@/lib/routes";
import { CTA_PRIMARY, MICROCOPY, finalCta } from "./copy";

/**
 * Dernier écran — une propriété plein cadre, une question, un geste.
 *
 * La signature de marque ferme la page : c'est le seul endroit où « votre
 * propriété mérite mieux qu'une annonce » revient, en tant que devise, après
 * avoir été démontrée.
 */
export function FinalCtaSection() {
  return (
    <section className="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 py-28 text-ivory sm:px-10 lg:px-16">
      <Parallax speed={0.16} className="-z-20 absolute inset-0">
        <div className="relative h-[130%] w-full -translate-y-[8%]">
          <Image
            src={media.ambiance2.src}
            alt={media.ambiance2.alt}
            fill
            sizes="100vw"
            className="scale-110 object-cover"
          />
        </div>
      </Parallax>
      <div
        aria-hidden="true"
        className="-z-10 absolute inset-0"
        style={{ backgroundImage: "var(--overlay-immersive)" }}
      />

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center text-center">
        <Reveal variant="rise">
          <h2 className="text-balance font-display text-4xl leading-[1.08] text-ivory sm:text-5xl lg:text-6xl">
            {finalCta.title}
          </h2>
        </Reveal>
        <Reveal delayMs={140}>
          <p className="mx-auto mt-6 max-w-xl text-pretty text-lg leading-relaxed text-ivory/85">
            {finalCta.subtitle}
          </p>
        </Reveal>
        <Reveal delayMs={260} className="mt-12 flex w-full flex-col items-center gap-4">
          <div className="relative w-full max-w-xl">
            <span
              aria-hidden="true"
              className="animate-glow pointer-events-none absolute -inset-4 -z-10 rounded-full bg-[radial-gradient(60%_60%_at_50%_50%,rgba(203,180,136,0.5)_0%,rgba(203,180,136,0)_70%)] blur-xl"
            />
            <LandingCta href={ANALYSE_ROUTE} tone="gold" size="xl" className="w-full">
              {CTA_PRIMARY}
            </LandingCta>
          </div>
          <p className="text-sm tracking-wide text-ivory/80">{MICROCOPY}</p>
        </Reveal>
      </div>

      {/* Signature de marque — la devise, après la démonstration. */}
      <Reveal delayMs={340} className="mt-20 text-center">
        <p className="font-display text-2xl tracking-[0.3em] text-ivory sm:text-3xl">
          {finalCta.brand}
        </p>
        <p className="mt-3 font-display text-lg italic text-gold-soft sm:text-xl">
          {finalCta.brandLine}
        </p>
      </Reveal>
    </section>
  );
}
