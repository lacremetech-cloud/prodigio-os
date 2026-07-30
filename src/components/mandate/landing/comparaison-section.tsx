import { Reveal } from "@/components/ui/reveal";
import { SectionMarker } from "./section-marker";
import { comparaison } from "./copy";

/**
 * Section 05 — Avant / Avec Prodigio. Comparaison en deux colonnes ; la colonne
 * « Avec Prodigio » est mise en relief (halo doré, léger relief) et ses points
 * apparaissent en cascade.
 */
export function ComparaisonSection() {
  return (
    <section className="grain relative bg-onyx px-6 py-24 text-ivory sm:px-10 sm:py-32 lg:px-16">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <SectionMarker index={comparaison.index} label={comparaison.kicker} tone="light" />
          <h2 className="mt-7 max-w-2xl text-balance text-3xl leading-[1.14] text-ivory sm:text-4xl lg:text-[2.75rem]">
            {comparaison.title}
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-6 md:grid-cols-2 md:gap-8">
          {/* Sans Prodigio */}
          <Reveal variant="blur" className="border border-border-dark bg-onyx-soft/40 p-8 sm:p-10">
            <p className="font-signature text-xs uppercase tracking-[0.28em] text-text-on-dark-muted">
              {comparaison.before.label}
            </p>
            <ul className="mt-7 space-y-4">
              {comparaison.before.items.map((item, i) => (
                <Reveal
                  as="li"
                  key={item}
                  delayMs={i * 80}
                  className="flex items-start gap-3 text-text-on-dark-muted"
                >
                  <span aria-hidden="true" className="mt-2 h-px w-4 shrink-0 bg-text-on-dark-muted" />
                  <span className="text-[0.975rem] leading-relaxed line-through decoration-text-on-dark-muted/40">
                    {item}
                  </span>
                </Reveal>
              ))}
            </ul>
          </Reveal>

          {/* Avec Prodigio — en relief */}
          <Reveal
            variant="rise"
            delayMs={120}
            className="relative border border-[color:var(--color-gold-soft)]/50 bg-onyx-soft p-8 shadow-[0_0_60px_-20px_rgba(203,180,136,0.5)] sm:p-10"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -z-10 opacity-70"
              style={{
                backgroundImage:
                  "radial-gradient(60% 50% at 50% 0%, rgba(203,180,136,0.14) 0%, rgba(12,12,14,0) 70%)",
              }}
            />
            <p className="font-signature text-xs uppercase tracking-[0.28em] text-gold-soft">
              {comparaison.after.label}
            </p>
            <ul className="mt-7 space-y-4">
              {comparaison.after.items.map((item, i) => (
                <Reveal
                  as="li"
                  key={item}
                  delayMs={160 + i * 90}
                  className="flex items-start gap-3 text-ivory"
                >
                  <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-gold" />
                  <span className="text-[0.975rem] leading-relaxed">{item}</span>
                </Reveal>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
