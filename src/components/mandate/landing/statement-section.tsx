import { Reveal } from "@/components/ui/reveal";
import { statement } from "./copy";

/**
 * Moment signature — le cœur émotionnel de la page.
 * « Prodigio ne met pas votre bien en vente. Prodigio le vend. »
 * Fond noir profond, grain filmique, révélation en deux temps.
 */
export function StatementSection() {
  return (
    <section className="grain relative isolate overflow-hidden bg-onyx px-6 py-32 text-ivory sm:py-40 lg:px-16">
      {/* Lueur dorée centrale très discrète */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(50% 55% at 50% 45%, rgba(203,180,136,0.12) 0%, rgba(12,12,14,0) 70%)",
        }}
      />
      <div className="mx-auto max-w-4xl text-center">
        <Reveal>
          <p className="eyebrow text-gold-soft">{statement.kicker}</p>
        </Reveal>

        <Reveal variant="blur" delayMs={80}>
          <p className="mt-8 font-display text-2xl leading-tight text-ivory/55 sm:text-3xl md:text-4xl">
            {statement.line1}
          </p>
        </Reveal>

        <Reveal variant="rise" delayMs={220}>
          <p className="mt-3 font-display text-[2.6rem] leading-[1.05] text-ivory sm:text-6xl md:text-7xl lg:text-[5.5rem]">
            Prodigio <span className="text-gold-soft">le vend.</span>
          </p>
        </Reveal>

        <Reveal delayMs={420}>
          <span
            aria-hidden="true"
            className="mx-auto mt-12 block h-px w-24 bg-[color:var(--color-gold-soft)] animate-glow"
          />
          <p className="mx-auto mt-8 max-w-2xl text-pretty leading-relaxed text-text-on-dark-muted">
            {statement.support}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
