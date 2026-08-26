import { Reveal } from "@/components/ui/reveal";
import { bigIdea } from "./copy";

interface FlowProps {
  label: string;
  items: readonly string[];
  outcome: string;
  /** La voie Prodigio est mise en relief ; la voie traditionnelle reste neutre. */
  highlight?: boolean;
}

/**
 * Une voie de commercialisation : des méthodes, une flèche, un public atteint.
 * Typographique plutôt qu'infographique — on reste dans la DA éditoriale.
 */
function Flow({ label, items, outcome, highlight = false }: FlowProps) {
  return (
    <div
      className={`flex h-full flex-col p-8 sm:p-10 ${
        highlight
          ? "border border-[color:var(--color-gold-soft)]/45 bg-onyx-soft shadow-[0_0_70px_-24px_rgba(203,180,136,0.45)]"
          : "border border-border-dark bg-onyx-soft/30"
      }`}
    >
      <p
        className={`font-signature text-xs uppercase tracking-[0.24em] ${
          highlight ? "text-gold-soft" : "text-text-on-dark-muted"
        }`}
      >
        {label}
      </p>

      <ul className="mt-7 flex-1 space-y-2.5">
        {items.map((item) => (
          <li
            key={item}
            className={`text-lg leading-snug ${highlight ? "text-ivory" : "text-text-on-dark-muted"}`}
          >
            {item}
          </li>
        ))}
      </ul>

      <span aria-hidden="true" className="mt-8 block text-center text-2xl text-gold-soft">
        ↓
      </span>

      <p
        className={`mt-6 font-display text-2xl leading-tight sm:text-[1.75rem] ${
          highlight ? "text-gold-soft" : "text-ivory/70"
        }`}
      >
        {outcome}
      </p>
    </div>
  );
}

/**
 * Big Idea — le problème invisible.
 *
 * Les méthodes traditionnelles captent une demande **existante**. La question
 * n'est pas de savoir si elles fonctionnent, mais qui elles ne touchent pas.
 * On n'attaque jamais la profession : on montre ce qui manque.
 */
export function BigIdeaSection() {
  return (
    <section className="grain relative isolate overflow-hidden bg-onyx px-6 py-20 text-ivory sm:px-10 sm:py-28 lg:px-16">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-3xl">
          <Reveal>
            <p className="eyebrow text-gold-soft">{bigIdea.eyebrow}</p>
          </Reveal>
          <Reveal variant="rise" delayMs={70}>
            <h2 className="mt-6 text-balance font-display text-2xl leading-[1.2] text-ivory/70 sm:text-3xl md:text-4xl">
              {bigIdea.title}
            </h2>
          </Reveal>
          <Reveal variant="rise" delayMs={200}>
            <p className="mt-4 font-display text-[2.6rem] leading-[1.04] text-gold-soft sm:text-6xl md:text-7xl">
              {bigIdea.emphasis}
            </p>
          </Reveal>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-2 md:gap-8">
          <Reveal variant="blur" className="h-full">
            <Flow
              label={bigIdea.traditional.label}
              items={bigIdea.traditional.items}
              outcome={bigIdea.traditional.outcome}
            />
          </Reveal>
          <Reveal variant="rise" delayMs={140} className="h-full">
            <Flow
              label={bigIdea.prodigio.label}
              items={bigIdea.prodigio.items}
              outcome={bigIdea.prodigio.outcome}
              highlight
            />
          </Reveal>
        </div>

        <Reveal delayMs={120}>
          <p className="mx-auto mt-14 max-w-2xl text-pretty text-center leading-relaxed text-text-on-dark-muted">
            {bigIdea.body}
          </p>
        </Reveal>

        <Reveal variant="rise" delayMs={220}>
          <p className="mx-auto mt-16 max-w-4xl text-balance text-center font-display text-3xl leading-[1.14] text-ivory sm:text-4xl md:text-[2.9rem]">
            {bigIdea.punch}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
