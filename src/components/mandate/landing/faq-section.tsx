import { Reveal } from "@/components/ui/reveal";
import { SectionLabel } from "./section-label";
import { faq } from "./copy";

/**
 * Questions fréquentes.
 *
 * Repliables NATIFS (`details` / `summary`) : accessibles au clavier, utilisables
 * sans JavaScript, indexables. Aucune condition contractuelle chiffrée n'est
 * affirmée — le mandat est porté par une agence habilitée et ses conditions sont
 * présentées avant signature.
 */
export function FaqSection() {
  return (
    <section className="bg-ivory px-5 py-24 text-wood-black sm:px-10 sm:py-32 lg:px-14">
      <div className="mx-auto grid max-w-[88rem] gap-12 lg:grid-cols-12 lg:gap-16">
        <Reveal className="lg:col-span-4">
          <SectionLabel>{faq.eyebrow}</SectionLabel>
          <h2 className="mt-8 text-balance text-[1.8rem] leading-[1.12] sm:text-3xl lg:text-[2.4rem]">
            {faq.title}
          </h2>
        </Reveal>

        <Reveal delayMs={120} className="lg:col-span-7 lg:col-start-6">
          <div className="divide-y divide-border border-y border-border">
            {faq.items.map((item) => (
              <details key={item.q} className="group">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-6 text-left font-display text-xl leading-snug text-wood-black transition-colors hover:text-[color:var(--color-gold)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus)] sm:text-2xl">
                  {item.q}
                  <span
                    aria-hidden="true"
                    className="mt-1 shrink-0 text-[color:var(--color-gold)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="max-w-2xl pb-7 text-pretty leading-relaxed text-text-secondary">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
