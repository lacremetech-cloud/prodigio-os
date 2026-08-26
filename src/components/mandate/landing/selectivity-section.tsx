import Image from "next/image";
import { LandingCta } from "@/components/ui/landing-cta";
import { Parallax } from "@/components/ui/parallax";
import { Reveal } from "@/components/ui/reveal";
import { media } from "@/lib/media";
import { ANALYSE_ROUTE } from "@/lib/routes";
import { SectionLabel } from "./section-label";
import { CTA_PRIMARY, MICROCOPY, selection } from "./copy";

/**
 * Sélectif par nature — la sélectivité découle de l'investissement, pas d'une
 * posture. Photographie en parallaxe douce, composition alignée à gauche (et non
 * centrée), appel à l'action.
 */
export function SelectivitySection() {
  return (
    <section className="relative isolate overflow-hidden px-5 py-28 sm:px-10 sm:py-36 lg:px-14">
      <Parallax speed={0.12} className="-z-20 absolute inset-0">
        <div className="relative h-[126%] w-full -translate-y-[7%]">
          <Image
            src={media.ambiance1.src}
            alt={media.ambiance1.alt}
            fill
            sizes="100vw"
            className="scale-105 object-cover"
          />
        </div>
      </Parallax>
      <div
        aria-hidden="true"
        className="-z-10 absolute inset-0"
        style={{ backgroundImage: "var(--overlay-immersive)" }}
      />

      <div className="mx-auto max-w-[88rem]">
        <Reveal>
          <SectionLabel tone="dark">{selection.eyebrow}</SectionLabel>
        </Reveal>
        <Reveal variant="rise" delayMs={80}>
          <h2 className="mt-8 max-w-[18ch] text-balance text-[1.95rem] leading-[1.08] text-ivory sm:text-4xl lg:max-w-[22ch] lg:text-[3.4rem]">
            <span className="text-ivory">{selection.titleLine1}</span>{" "}
            <span className="text-ivory/60">{selection.titleLine2}</span>
          </h2>
        </Reveal>

        <div className="mt-10 grid gap-10 lg:grid-cols-12">
          <Reveal delayMs={160} className="lg:col-span-5">
            <p className="text-pretty leading-relaxed text-ivory/85">{selection.body}</p>
            <p className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 font-signature text-[0.72rem] uppercase tracking-[0.24em] text-ivory/60">
              {selection.criteres.map((c, i) => (
                <span key={c} className="flex items-center gap-5">
                  {i > 0 ? <span aria-hidden="true" className="h-px w-5 bg-ivory/30" /> : null}
                  {c}
                </span>
              ))}
            </p>
          </Reveal>

          <Reveal delayMs={240} className="lg:col-span-5 lg:col-start-8 lg:self-end">
            <LandingCta href={ANALYSE_ROUTE} tone="contrast" size="lg" className="w-full sm:w-auto">
              {CTA_PRIMARY}
            </LandingCta>
            <p className="mt-3 text-[0.82rem] text-ivory/65">{MICROCOPY}</p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
