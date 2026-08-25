import Image from "next/image";
import { LandingCta } from "@/components/ui/landing-cta";
import { Parallax } from "@/components/ui/parallax";
import { Reveal } from "@/components/ui/reveal";
import { media } from "@/lib/media";
import { ANALYSE_ROUTE } from "@/lib/routes";
import { CTA_PRIMARY, CTA_SUB, finalCta } from "./copy";

/**
 * Fin de page — **sélectivité et appel à l'action réunis**.
 *
 * Ces deux idées occupaient auparavant deux sections successives qui disaient la
 * même chose (« nous sommes sélectifs », « c'est confidentiel », « une minute »)
 * avec le même bouton. Un seul écran, un seul geste.
 */
export function FinalCtaSection() {
  return (
    <section className="relative isolate flex min-h-[88vh] flex-col items-center justify-center overflow-hidden px-6 py-28 text-ivory sm:px-10 lg:px-16">
      {/* Image en parallaxe (sur-dimensionnée pour ne jamais révéler de bord). */}
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

      <div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
        <Reveal>
          <p className="eyebrow text-gold-soft">{finalCta.eyebrow}</p>
        </Reveal>
        <Reveal variant="rise" delayMs={90}>
          <h2 className="mt-8 max-w-2xl text-balance text-4xl leading-[1.06] text-ivory sm:text-5xl lg:text-6xl">
            {finalCta.title}
          </h2>
        </Reveal>
        <Reveal delayMs={200}>
          <p className="mx-auto mt-7 max-w-xl text-pretty leading-relaxed text-ivory/85">
            {finalCta.text}
          </p>
        </Reveal>
        <Reveal delayMs={300} className="mt-12 flex w-full flex-col items-center gap-4">
          <LandingCta
            href={ANALYSE_ROUTE}
            tone="gold"
            size="xl"
            className="w-full max-w-xl"
          >
            {CTA_PRIMARY}
          </LandingCta>
          <p className="text-sm tracking-wide text-ivory/80">{CTA_SUB}</p>
        </Reveal>
      </div>
    </section>
  );
}
