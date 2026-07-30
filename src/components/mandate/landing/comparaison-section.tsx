import { Reveal } from "@/components/ui/reveal";
import { SectionMarker } from "./section-marker";
import { comparaison } from "./copy";

/**
 * Section 04 — Avant / Avec Prodigio. Comparaison visuelle en deux colonnes :
 * la diffusion passive standard face à la mise en marché active Prodigio.
 */
export function ComparaisonSection() {
  return (
    <section className="bg-onyx px-6 py-24 text-ivory sm:px-10 sm:py-32 lg:px-16">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <SectionMarker index={comparaison.index} label={comparaison.kicker} tone="light" />
          <h2 className="mt-7 max-w-2xl text-balance text-3xl leading-[1.14] text-ivory sm:text-4xl lg:text-[2.75rem]">
            {comparaison.title}
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-px overflow-hidden border border-border-dark bg-border-dark md:grid-cols-2">
          {/* Avant */}
          <Reveal className="bg-onyx p-8 sm:p-10">
            <p className="font-signature text-xs uppercase tracking-[0.28em] text-text-on-dark-muted">
              {comparaison.before.label}
            </p>
            <ul className="mt-7 space-y-4">
              {comparaison.before.items.map((item) => (
                <li key={item} className="flex items-start gap-3 text-text-on-dark-muted">
                  <span aria-hidden="true" className="mt-2 h-px w-4 shrink-0 bg-text-on-dark-muted" />
                  <span className="text-[0.975rem] leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </Reveal>

          {/* Avec Prodigio */}
          <Reveal delayMs={120} className="bg-onyx-soft p-8 sm:p-10">
            <p className="font-signature text-xs uppercase tracking-[0.28em] text-gold-soft">
              {comparaison.after.label}
            </p>
            <ul className="mt-7 space-y-4">
              {comparaison.after.items.map((item) => (
                <li key={item} className="flex items-start gap-3 text-ivory">
                  <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-gold" />
                  <span className="text-[0.975rem] leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
