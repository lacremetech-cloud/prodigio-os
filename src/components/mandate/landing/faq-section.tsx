import { Reveal } from "@/components/ui/reveal";
import { faq } from "./copy";

/**
 * Foire aux questions — les objections d'un propriétaire, traitées avant qu'il
 * ait à les poser.
 *
 * `<details>/<summary>` natifs : accessible au clavier, ouvrable sans
 * JavaScript, et le contenu reste indexable. Aucune promesse de délai ni
 * condition économique chiffrée : ces éléments sont contractuels et n'ont pas
 * leur place dans une page publique.
 */
export function FaqSection() {
  return (
    <section className="bg-ivory px-6 py-20 text-wood-black sm:px-10 sm:py-28 lg:px-16">
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <p className="eyebrow text-[color:var(--color-gold)]">{faq.eyebrow}</p>
        </Reveal>
        <Reveal variant="rise" delayMs={80}>
          <h2 className="mt-6 text-balance text-3xl leading-[1.12] sm:text-4xl">
            {faq.title}
          </h2>
        </Reveal>

        <dl className="mt-12">
          {faq.items.map((item, i) => (
            <Reveal as="div" key={item.q} delayMs={i * 70}>
              <details className="group border-b border-border">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus)]">
                  <dt className="font-display text-xl leading-snug sm:text-2xl">
                    {item.q}
                  </dt>
                  <span
                    aria-hidden="true"
                    className="relative size-4 shrink-0 text-[color:var(--color-gold)]"
                  >
                    <span className="absolute left-0 top-1/2 h-px w-4 -translate-y-1/2 bg-current" />
                    <span className="absolute left-1/2 top-0 h-4 w-px -translate-x-1/2 bg-current transition-transform duration-300 group-open:rotate-90 group-open:opacity-0" />
                  </span>
                </summary>
                <dd className="pb-6 pr-10 text-pretty leading-relaxed text-text-secondary">
                  {item.a}
                </dd>
              </details>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}
