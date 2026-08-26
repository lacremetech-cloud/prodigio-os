import { Reveal } from "@/components/ui/reveal";
import { SectionLabel } from "./section-label";
import { data } from "./copy";

/**
 * La data — le tableau de bord propriétaire.
 *
 * Illustration d'interface construite avec les VRAIS jetons de design, dans le
 * même vocabulaire que le CRM : filets, chiffres tabulaires, aucune couleur
 * décorative. Les valeurs sont explicitement signalées comme fictives — jamais
 * de faux résultat présenté comme réel.
 */
export function DataSection() {
  const barres = [38, 62, 47, 88, 71, 96, 64];

  return (
    <section className="bg-ivory px-5 py-24 text-wood-black sm:px-10 sm:py-32 lg:px-14">
      <div className="mx-auto max-w-[88rem]">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <Reveal className="lg:col-span-4">
            <SectionLabel>{data.eyebrow}</SectionLabel>
            <h2 className="mt-8 max-w-[12ch] text-balance text-[2.1rem] leading-[1.06] sm:text-4xl lg:text-[3.2rem]">
              {data.title}
            </h2>
            <p className="mt-8 text-pretty text-lg leading-relaxed text-text-secondary">
              {data.body}
            </p>
            <ul className="mt-8 space-y-1 font-display text-xl leading-snug text-wood-black sm:text-2xl">
              {data.lignes.map((ligne) => (
                <li key={ligne}>{ligne}</li>
              ))}
            </ul>
          </Reveal>

          {/* Tableau de bord — sobre, dense, crédible. */}
          <Reveal variant="rise" delayMs={140} className="lg:col-span-8">
            <div className="border border-border bg-surface">
              <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-3.5">
                <span className="font-signature text-[0.68rem] uppercase tracking-[0.2em] text-text-secondary">
                  Commercialisation · 14 jours
                </span>
                <span className="font-signature text-[0.68rem] uppercase tracking-[0.2em] text-[color:var(--color-gold)]">
                  En cours
                </span>
              </div>

              <dl className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0">
                {data.indicateurs.map((ind) => (
                  <div key={ind.label} className="px-5 py-6">
                    <dt className="text-[0.72rem] leading-snug text-text-secondary">
                      {ind.label}
                    </dt>
                    <dd className="mt-2 font-display text-3xl tabular-nums leading-none text-wood-black">
                      {ind.value}
                    </dd>
                  </div>
                ))}
              </dl>

              {/* Réaction du marché, jour après jour. */}
              <div className="border-t border-border px-5 py-6">
                <p className="font-signature text-[0.68rem] uppercase tracking-[0.2em] text-text-secondary">
                  Demandes par jour
                </p>
                <div className="mt-5 flex h-24 items-end gap-2" aria-hidden="true">
                  {barres.map((h, i) => (
                    <span
                      key={i}
                      className="flex-1 bg-[color:var(--color-gold)]/70"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <p className="mt-4 text-[0.75rem] text-text-secondary">{data.disclaimer}</p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
