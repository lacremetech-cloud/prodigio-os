import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "./section-heading";
import { landing } from "@/modules/mandates/funnel";

/**
 * La différence Prodigio : trois principes (comprendre, créer l'écrin, aller
 * chercher l'acheteur), présentés sur fond sombre pour un contraste éditorial.
 */
export function DifferenceSection() {
  const { difference } = landing;
  const [comprendre, ecrin, acheteur] = difference.principles;

  return (
    <section className="bg-onyx px-6 py-20 text-ivory sm:px-10 sm:py-28 lg:px-16">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          kicker={difference.kicker}
          title={difference.title}
          tone="dark"
        />

        <div className="mt-16 grid gap-px overflow-hidden border border-border-dark bg-border-dark md:grid-cols-3">
          {/* 01 — Comprendre */}
          <Reveal as="article" className="bg-onyx p-8 sm:p-10">
            <p className="font-display text-5xl text-gold-soft">
              {comprendre.index}
            </p>
            <h3 className="mt-6 text-2xl text-ivory">{comprendre.title}</h3>
            <p className="mt-4 text-pretty leading-relaxed text-text-on-dark-muted">
              {comprendre.lead}
            </p>
            <ul className="mt-6 space-y-3">
              {comprendre.questions.map((q) => (
                <li
                  key={q}
                  className="border-l border-border-dark pl-4 text-[0.95rem] italic leading-snug text-ivory/90"
                >
                  {q}
                </li>
              ))}
            </ul>
          </Reveal>

          {/* 02 — Créer son écrin */}
          <Reveal as="article" className="bg-onyx p-8 sm:p-10" delayMs={80}>
            <p className="font-display text-5xl text-gold-soft">{ecrin.index}</p>
            <h3 className="mt-6 text-2xl text-ivory">{ecrin.title}</h3>
            <p className="mt-4 text-pretty leading-relaxed text-text-on-dark-muted">
              {ecrin.lead}
            </p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {ecrin.deliverables.map((d) => (
                <li
                  key={d}
                  className="border border-border-dark px-3 py-1.5 text-xs tracking-wide text-ivory/85"
                >
                  {d}
                </li>
              ))}
            </ul>
          </Reveal>

          {/* 03 — Aller chercher l'acheteur */}
          <Reveal as="article" className="bg-onyx p-8 sm:p-10" delayMs={160}>
            <p className="font-display text-5xl text-gold-soft">
              {acheteur.index}
            </p>
            <h3 className="mt-6 text-2xl text-ivory">{acheteur.title}</h3>
            <p className="mt-4 text-pretty leading-relaxed text-text-on-dark-muted">
              {acheteur.lead}
            </p>
            <p className="mt-4 text-pretty leading-relaxed text-ivory/90">
              {acheteur.body}
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
