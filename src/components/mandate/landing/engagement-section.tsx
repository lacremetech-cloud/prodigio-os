import { Reveal } from "@/components/ui/reveal";
import { SectionLabel } from "./section-label";
import { engagement } from "./copy";

/**
 * Notre engagement — l'argument le plus différenciant de la page.
 *
 * Trois familles de moyens (production, expérience, acquisition) présentées en
 * bandes typographiques larges, séparées par de simples filets — pas neuf petites
 * cartes identiques. Puis le climax : le financement de la diffusion, seul sur
 * son écran.
 */
export function EngagementSection() {
  return (
    <>
      <section className="bg-onyx px-5 py-24 text-ivory sm:px-10 sm:py-32 lg:px-14">
        <div className="mx-auto max-w-[88rem]">
          <Reveal>
            <SectionLabel tone="dark">{engagement.eyebrow}</SectionLabel>
          </Reveal>
          <div className="mt-8 grid gap-6 lg:grid-cols-12 lg:items-end lg:gap-12">
            <Reveal variant="rise" delayMs={70} className="lg:col-span-6">
              <h2 className="text-balance text-[1.9rem] leading-[1.1] text-text-on-dark-muted sm:text-4xl lg:text-[3.2rem]">
                {engagement.title}
              </h2>
            </Reveal>
            <Reveal variant="rise" delayMs={180} className="lg:col-span-5 lg:col-start-8">
              <p className="text-balance font-display text-[1.9rem] leading-[1.1] text-ivory sm:text-4xl lg:text-[3.2rem]">
                {engagement.statement}
              </p>
            </Reveal>
          </div>

          <dl className="mt-20 divide-y divide-border-dark border-y border-border-dark">
            {engagement.familles.map((famille, i) => (
              <Reveal
                as="div"
                key={famille.titre}
                delayMs={i * 110}
                className="grid gap-4 py-8 sm:grid-cols-12 sm:items-baseline sm:gap-8"
              >
                <dt className="font-signature text-[0.72rem] uppercase tracking-[0.24em] text-gold-soft sm:col-span-3">
                  {famille.titre}
                </dt>
                <dd className="sm:col-span-9">
                  <ul className="flex flex-wrap items-baseline gap-x-8 gap-y-2 font-display text-2xl text-ivory sm:text-3xl lg:text-4xl">
                    {famille.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </dd>
              </Reveal>
            ))}
          </dl>
        </div>
      </section>

      {/* Climax — une seule idée occupe tout l'écran. */}
      <section className="flex min-h-[80vh] items-center bg-wood-black px-5 py-24 text-ivory sm:px-10 lg:px-14">
        <div className="mx-auto w-full max-w-[88rem]">
          <Reveal variant="rise">
            <h2 className="max-w-[16ch] text-balance text-[2.2rem] leading-[1.04] text-ivory sm:text-5xl lg:max-w-[24ch] lg:text-[4.6rem]">
              {engagement.climaxTitle}
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-10 lg:grid-cols-12">
            <Reveal delayMs={140} className="lg:col-span-5 lg:col-start-7">
              <p className="text-pretty text-lg leading-relaxed text-text-on-dark-muted">
                {engagement.climaxBody}
              </p>
              <p className="mt-8 border-l border-[color:var(--color-gold-soft)] pl-5 font-display text-xl leading-snug text-ivory sm:text-2xl">
                {engagement.climaxStatement}
              </p>
            </Reveal>
          </div>
        </div>
      </section>
    </>
  );
}
