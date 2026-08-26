import Image from "next/image";
import { Reveal } from "@/components/ui/reveal";
import { media } from "@/lib/media";
import { SectionLabel } from "./section-label";
import { marche } from "./copy";

/**
 * Au-delà des fichiers — respiration cinématographique.
 *
 * Photographie pleine largeur, très peu de texte, une affirmation en deux temps.
 * Après deux sections denses, la page doit se taire un instant.
 *
 * Les chiffres d'audience ne sont affichés QUE s'ils sont renseignés et sourcés
 * (`marche.chiffres`) : aucune volumétrie n'est inventée.
 */
export function MarcheSection() {
  return (
    <section className="relative isolate flex min-h-[86vh] flex-col justify-end overflow-hidden px-5 py-20 text-ivory sm:px-10 sm:py-24 lg:px-14">
      <Image
        src={media.ambiance2.src}
        alt={media.ambiance2.alt}
        fill
        sizes="100vw"
        className="-z-20 object-cover"
      />
      <div
        aria-hidden="true"
        className="-z-10 absolute inset-0 bg-[linear-gradient(180deg,rgba(12,12,14,0.62)_0%,rgba(12,12,14,0.48)_45%,rgba(12,12,14,0.92)_100%)]"
      />

      <div className="mx-auto w-full max-w-[88rem]">
        <Reveal>
          <SectionLabel tone="dark">{marche.eyebrow}</SectionLabel>
        </Reveal>
        <Reveal variant="rise" delayMs={80}>
          <h2 className="mt-7 max-w-[18ch] text-balance text-[1.95rem] leading-[1.08] text-ivory sm:text-4xl lg:max-w-[22ch] lg:text-[3.6rem]">
            {marche.title}
          </h2>
        </Reveal>

        <div className="mt-10 grid gap-10 lg:grid-cols-12 lg:items-end">
          <Reveal delayMs={140} className="lg:col-span-6">
            <p className="max-w-xl text-pretty leading-relaxed text-ivory/85">
              {marche.body}
            </p>
          </Reveal>

          <Reveal variant="rise" delayMs={220} className="lg:col-span-5 lg:col-start-8">
            <p className="font-display text-xl leading-[1.2] text-ivory/60 sm:text-2xl">
              {marche.statementA}
            </p>
            <p className="mt-1 font-display text-xl leading-[1.2] text-ivory sm:text-2xl">
              {marche.statementB}
            </p>
          </Reveal>
        </div>

        {/* Volumétrie d'audience — rendue uniquement si elle est sourcée. */}
        {marche.chiffres.length > 0 ? (
          <Reveal delayMs={200}>
            <dl className="mt-14 flex flex-wrap gap-x-16 gap-y-8 border-t border-ivory/20 pt-10">
              {marche.chiffres.map((c) => (
                <div key={c.label}>
                  <dt className="sr-only">{c.label}</dt>
                  <dd>
                    <span className="block font-display text-4xl leading-none text-ivory sm:text-5xl">
                      {c.value}
                    </span>
                    <span className="mt-3 block max-w-[22ch] text-[0.82rem] leading-snug text-ivory/70">
                      {c.label}
                    </span>
                    <span className="mt-1 block text-[0.68rem] text-ivory/45">{c.source}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>
        ) : null}

        <Reveal delayMs={260}>
          <p className="mt-12 flex flex-wrap items-center gap-x-5 gap-y-2 font-signature text-[0.72rem] uppercase tracking-[0.24em] text-ivory/60">
            {marche.portee.map((z, i) => (
              <span key={z} className="flex items-center gap-5">
                {i > 0 ? <span aria-hidden="true" className="h-px w-5 bg-ivory/30" /> : null}
                {z}
              </span>
            ))}
          </p>
          <p className="mt-4 text-[0.8rem] text-ivory/55">{marche.microcopy}</p>
        </Reveal>
      </div>
    </section>
  );
}
