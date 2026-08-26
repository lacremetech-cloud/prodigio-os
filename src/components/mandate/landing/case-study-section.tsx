import Image from "next/image";
import { Reveal } from "@/components/ui/reveal";
import { media } from "@/lib/media";
import { caseStudy } from "./copy";

/**
 * Case study — la démonstration complète du mécanisme, en entonnoir.
 *
 * Chaque palier apparaît en cascade au défilement ; le dernier (la vente) est
 * mis en relief. L'avertissement reste attaché aux chiffres : un cas réel n'est
 * pas une promesse.
 */
export function CaseStudySection() {
  const last = caseStudy.steps.length - 1;

  return (
    <section className="grain relative isolate overflow-hidden bg-onyx px-6 py-20 text-ivory sm:px-10 sm:py-28 lg:px-16">
      {/* Le bien du cas réel, en fond très assombri : on situe sans illustrer. */}
      <Image
        src={media.categoryChalet.src}
        alt=""
        aria-hidden="true"
        fill
        sizes="100vw"
        className="-z-20 object-cover opacity-30"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(12,12,14,0.92) 0%, rgba(12,12,14,0.86) 50%, rgba(12,12,14,0.96) 100%)",
        }}
      />

      <div className="mx-auto max-w-5xl">
        <Reveal>
          <p className="eyebrow text-gold-soft">{caseStudy.eyebrow}</p>
        </Reveal>
        <Reveal variant="rise" delayMs={70}>
          <h2 className="mt-6 max-w-2xl text-balance text-3xl leading-[1.14] text-ivory sm:text-4xl lg:text-[2.75rem]">
            {caseStudy.title}
          </h2>
        </Reveal>

        <ol className="mt-16">
          {caseStudy.steps.map((step, i) => {
            const isLast = i === last;
            return (
              <Reveal
                as="li"
                key={step.value}
                variant="rise"
                delayMs={i * 110}
                className="border-t border-border-strong-dark/40 py-6 first:border-t-0"
              >
                <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
                  <span
                    className={`font-display leading-none ${
                      isLast
                        ? "text-4xl text-gold-soft sm:text-5xl"
                        : "text-3xl text-ivory sm:text-4xl"
                    }`}
                  >
                    {step.value}
                  </span>
                  {step.label ? (
                    <span className="text-sm text-text-on-dark-muted">{step.label}</span>
                  ) : null}
                </div>
              </Reveal>
            );
          })}
        </ol>

        <Reveal variant="rise" delayMs={160}>
          <p className="mt-14 max-w-2xl text-balance font-display text-2xl leading-snug text-ivory sm:text-3xl">
            {caseStudy.conclusion}
          </p>
        </Reveal>
        <Reveal delayMs={220}>
          <p className="mt-10 max-w-2xl text-sm leading-relaxed text-ivory/45">
            {caseStudy.disclaimer}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
