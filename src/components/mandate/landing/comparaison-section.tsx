import { Reveal } from "@/components/ui/reveal";
import { comparaison } from "./copy";

/**
 * Comparaison **additive**.
 *
 * L'adversaire est la commercialisation passive, jamais la profession : la
 * colonne traditionnelle est présentée telle quelle, sans ironie, et la colonne
 * Prodigio commence par « tout cela, plus : ».
 */
export function ComparaisonSection() {
  return (
    <section className="bg-ivory px-6 py-20 text-wood-black sm:px-10 sm:py-28 lg:px-16">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <p className="eyebrow text-[color:var(--color-gold)]">{comparaison.eyebrow}</p>
          <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-text-secondary">
            {comparaison.body}
          </p>
        </Reveal>

        <div className="mt-12 grid gap-8 md:grid-cols-2">
          <Reveal variant="blur" className="border border-border p-8 sm:p-10">
            <p className="font-signature text-xs uppercase tracking-[0.24em] text-text-secondary">
              {comparaison.traditional.label}
            </p>
            <ul className="mt-7 space-y-3">
              {comparaison.traditional.items.map((item) => (
                <li key={item} className="text-lg leading-snug text-text-secondary">
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal
            variant="rise"
            delayMs={120}
            className="border border-[color:var(--color-gold)]/45 bg-surface p-8 shadow-[var(--shadow-md)] sm:p-10"
          >
            <p className="font-signature text-xs uppercase tracking-[0.24em] text-[color:var(--color-gold)]">
              {comparaison.prodigio.label}
            </p>
            <p className="mt-6 text-lg text-text-secondary">{comparaison.prodigio.intro}</p>
            <ul className="mt-4 space-y-3">
              {comparaison.prodigio.items.map((item) => (
                <li key={item} className="flex items-start gap-3 text-lg leading-snug">
                  <span
                    aria-hidden="true"
                    className="mt-2.5 size-1.5 shrink-0 rounded-full bg-[color:var(--color-gold)]"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <Reveal variant="rise" delayMs={140}>
          <h2 className="mt-16 text-balance text-center font-display text-3xl leading-[1.14] sm:text-4xl md:text-[2.75rem]">
            {comparaison.punchLine1}
            <br />
            <span className="text-[color:var(--color-gold)]">{comparaison.punchLine2}</span>
          </h2>
        </Reveal>
      </div>
    </section>
  );
}
