import { Reveal } from "@/components/ui/reveal";
import { SectionMarker } from "./section-marker";
import { systeme } from "./copy";

/**
 * Section 02 — Le Système Prodigio. Fond noir profond, trois étapes numérotées,
 * lignes fines, respiration éditoriale.
 */
export function SystemeSection() {
  return (
    <section className="bg-onyx px-6 py-24 text-ivory sm:px-10 sm:py-32 lg:px-16">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <SectionMarker index={systeme.index} label={systeme.kicker} tone="light" />
          <h2 className="mt-7 max-w-3xl text-balance text-3xl leading-[1.16] text-ivory sm:text-4xl lg:text-[2.75rem]">
            {systeme.titleLine1}
            <br />
            <span className="text-gold-soft">{systeme.titleLine2}</span>
          </h2>
        </Reveal>

        <ol className="mt-16 grid gap-px overflow-hidden border border-border-dark bg-border-dark md:grid-cols-3">
          {systeme.steps.map((step, i) => (
            <Reveal as="li" key={step.n} delayMs={i * 90} className="bg-onyx p-8 sm:p-10">
              <span className="font-display text-5xl text-gold-soft sm:text-6xl">
                {step.n}
              </span>
              <h3 className="mt-6 text-xl text-ivory sm:text-2xl">{step.title}</h3>
              <p className="mt-4 text-pretty leading-relaxed text-text-on-dark-muted">
                {step.text}
              </p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
